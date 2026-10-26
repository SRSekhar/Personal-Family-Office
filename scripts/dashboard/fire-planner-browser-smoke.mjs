import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createDashboardServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const server = createDashboardServer();
let browser;
let temporaryDirectory;

async function assertOfflineReport(download, expectedFilename, expectedText) {
    assert.equal(download.suggestedFilename(), expectedFilename);
    const path = join(temporaryDirectory, expectedFilename);
    await download.saveAs(path);
    const html = await readFile(path, 'utf8');
    assert.match(html, /<!doctype html/i, 'report should be a standalone HTML document');
    assert.ok(html.includes(expectedText), `report should contain expected assumption text: ${expectedText}`);
    assert.doesNotMatch(html, /<script\b/i, 'offline report must not contain executable scripts');
    assert.doesNotMatch(html, /<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i,
        'offline report must not depend on remote assets');
    return html;
}

async function assertOpensWithoutNetwork(browserInstance, reportPath, expectedText) {
    const offlineContext = await browserInstance.newContext();
    const offlinePage = await offlineContext.newPage();
    const externalRequests = [];
    offlinePage.on('request', (request) => {
        if (/^https?:\/\//i.test(request.url())) externalRequests.push(request.url());
    });
    await offlinePage.route(/^https?:\/\//i, (route) => route.abort());
    await offlinePage.goto(pathToFileURL(reportPath).href);
    assert.ok((await offlinePage.locator('body').innerText()).includes(expectedText),
        'standalone report should render its essential content when opened from a local file');
    assert.deepEqual(externalRequests, [],
        'opening a standalone report must not attempt any HTTP or HTTPS requests');
    await offlineContext.close();
}

try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-fire-browser-'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/`;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    await context.addInitScript(() => {
        globalThis.__pfoPrintInvoked = false;
        globalThis.print = () => {
            globalThis.__pfoPrintInvoked = true;
        };
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#historical-snapshots-source').innerText(), 'Fictional development fixture · not saved');
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 3,
        'local development sample workspace should show fictional multi-year history points only');
    assert.equal(await page.evaluate(() => globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1')), null,
        'fictional history fixtures must never be written to browser storage');
    assert.equal(await page.locator('#historical-net-worth-chart li').count(), 3,
        'the trend chart should contain one point per actual sample snapshot');
    assert.ok(!(await page.locator('#historical-net-worth-chart').innerText()).includes('2023'),
        'sample history must not invent a missing year');
    const cancelledDemoImport = page.waitForEvent('dialog');
    await page.locator('#import-file').setInputFiles({
        name: 'cancelled-demo-import.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
            schemaVersion: 1,
            currency: 'INR',
            records: [{ name: 'Must not import', category: 'Investments', type: 'asset', value: 100 }]
        }))
    });
    const cancelledDemoImportDialog = await cancelledDemoImport;
    assert.match(cancelledDemoImportDialog.message(), /Backup import preview/);
    await cancelledDemoImportDialog.dismiss();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.textContent.includes('Import cancelled.'));
    assert.equal(await page.locator('#workspace-label').innerText(), 'SAMPLE WORKSPACE',
        'cancelling a backup import must not switch away from the sample workspace');
    assert.ok(!(await page.locator('#records-body').innerText()).includes('Must not import'),
        'cancelling a backup import must not import any records');

    await page.evaluate(() => {
        const originalSetItem = globalThis.Storage.prototype.setItem;
        globalThis.__pfoOriginalSetItem = originalSetItem;
        let failNextPrivateWrite = true;
        globalThis.Storage.prototype.setItem = function (key, value) {
            if (failNextPrivateWrite && key === 'pfo-os.dashboard.private.v1') {
                failNextPrivateWrite = false;
                throw new globalThis.DOMException('Simulated storage quota failure', 'QuotaExceededError');
            }
            return originalSetItem.call(this, key, value);
        };
    });
    const failedDemoImport = page.waitForEvent('dialog');
    await page.locator('#import-file').setInputFiles({
        name: 'failed-demo-import.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
            schemaVersion: 1,
            currency: 'INR',
            records: [{ name: 'Must not replace workspace', category: 'Investments', type: 'asset', value: 100 }]
        }))
    });
    const failedDemoImportDialog = await failedDemoImport;
    assert.match(failedDemoImportDialog.message(), /Backup import preview/);
    await failedDemoImportDialog.accept();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.textContent.includes('Could not save locally.'));
    assert.equal(await page.locator('#workspace-label').innerText(), 'SAMPLE WORKSPACE',
        'a failed backup write must not switch the sample workspace to private');
    assert.ok(!(await page.locator('#records-body').innerText()).includes('Must not replace workspace'),
        'a failed backup write must not display unpersisted imported records');
    await page.evaluate(() => {
        globalThis.Storage.prototype.setItem = globalThis.__pfoOriginalSetItem;
        delete globalThis.__pfoOriginalSetItem;
    });
    assert.equal(await page.locator('#ratio-liabilities-to-assets').innerText(), '18.6%',
        'dashboard should show liabilities as a share of sample assets');
    assert.equal(await page.locator('#ratio-net-worth-to-assets').innerText(), '81.4%',
        'dashboard should show reconciled net worth as a share of sample assets');
    assert.equal(await page.locator('#ratio-assets-to-liabilities').innerText(), '5.37×',
        'dashboard should show assets per unit of sample liabilities');
    assert.match(await page.locator('#financial-ratios').innerText(), /no benchmarks, forecasts, or recommendations/);
    assert.equal(await page.locator('#allocation-concentration').isVisible(), true,
        'overview should show category concentration metrics for sample assets');
    assert.equal(await page.locator('#allocation-concentration .concentration-metrics article').count(), 3,
        'concentration summary should show HHI, effective category count, and largest category share');
    assert.equal(await page.locator('#allocation-concentration .concentration-metrics article:nth-child(3) strong').innerText(), '54.0%',
        'largest category share should reconcile to the sample allocation');
    assert.match(await page.locator('#allocation-concentration').innerText(), /does not measure holding-level diversification/);

    await page.keyboard.press('Tab');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.classList.contains('skip-link')),
        true,
        'the first keyboard Tab should reveal and focus the skip link'
    );
    await page.keyboard.press('Enter');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.id),
        'main-content',
        'activating the skip link should move focus to the main content landmark'
    );
    process.stdout.write('PASS: keyboard skip link is first in tab order and moves focus to main content.\n');
    const historyDetailsTrigger = page.locator('[data-history-details="2025-12-31"]');
    await historyDetailsTrigger.click();
    assert.equal(await page.locator('#historical-snapshot-detail').isVisible(), true);
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.id), 'historical-snapshot-detail-heading',
        'opening snapshot details should move keyboard and screen-reader focus to the details heading');
    assert.match(await page.locator('#historical-snapshot-detail').innerText(), /Investment portfolio/);
    assert.match(await page.locator('#historical-snapshot-detail').innerText(), /Cash & deposits/);
    assert.match(await page.locator('#historical-snapshot-detail').innerText(), /Residential property/);
    assert.equal(await page.locator('#historical-snapshot-category-rows tr').count(), 4,
        'snapshot detail should group fictional records by category and asset/liability type');
    await page.locator('#close-historical-snapshot-detail').click();
    assert.equal(await page.locator('#historical-snapshot-detail').isVisible(), false);
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.getAttribute('data-history-details')), '2025-12-31',
        'closing snapshot details should return focus to the exact triggering button');

    await page.setViewportSize({ width: 320, height: 900 });
    const historyChart = page.locator('#historical-net-worth-chart');
    assert.equal(await historyChart.evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).gridTemplateColumns.split(' ').length), 1,
        'historical trend should collapse to a single column at a 320 CSS-pixel viewport');
    assert.ok(await historyChart.evaluate((element) => element.scrollWidth <= element.clientWidth),
        'historical trend should not introduce internal horizontal overflow at a 320 CSS-pixel viewport');
    assert.ok(await page.locator('.historical-snapshots-panel').evaluate((element) => element.scrollWidth <= element.clientWidth),
        'history panel should contain its content at a 320 CSS-pixel viewport');
    await page.locator('[data-history-details="2025-12-31"]').click();
    const mobileDetail = page.locator('#historical-snapshot-detail');
    assert.ok(await mobileDetail.isVisible(), 'snapshot details should remain available at a narrow viewport');
    assert.equal(await mobileDetail.evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element.querySelector('.historical-detail-totals')).gridTemplateColumns.split(' ').length), 1,
        'snapshot detail totals should stack in one column at a 320 CSS-pixel viewport');
    assert.ok(await mobileDetail.evaluate((element) => element.scrollWidth <= element.clientWidth),
        'snapshot detail should contain its content at a 320 CSS-pixel viewport');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.id), 'historical-snapshot-detail-heading',
        'opening details at a narrow viewport should still move focus to the detail heading');
    await page.locator('#close-historical-snapshot-detail').click();
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.getAttribute('data-history-details')), '2025-12-31',
        'closing narrow-viewport details should restore focus to the trigger');
    await page.setViewportSize({ width: 1280, height: 900 });
    process.stdout.write('PASS: historical trend and snapshot details reflow and retain focus at a 320 CSS-pixel viewport.\\n');

    await page.goto(`${baseUrl}#fire-planner`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => globalThis.document.querySelector('.nav-item[href="#fire-planner"]')?.getAttribute('aria-current') === 'page');
    assert.equal(await page.locator('#page-breadcrumb').innerText(), 'FIRE planner',
        'initial URL fragment should synchronize the breadcrumb');
    assert.equal(await page.locator('.nav-item[href="#fire-planner"]').getAttribute('aria-current'), 'page');
    process.stdout.write('PASS: initial URL fragment synchronizes sidebar and breadcrumb.\n');

    await page.locator('.nav-item[href="#records"]').click();
    await page.waitForFunction(() => globalThis.location.hash === '#records'
        && globalThis.document.querySelector('.nav-item[href="#records"]')?.getAttribute('aria-current') === 'page');
    assert.equal(await page.locator('#page-breadcrumb').innerText(), 'Financial records');
    assert.equal(await page.locator('.nav-item[href="#fire-planner"]').getAttribute('aria-current'), null,
        'only the current navigation item should expose aria-current');
    process.stdout.write('PASS: sidebar navigation updates active state and breadcrumb.\n');

    await page.goBack();
    await page.waitForFunction(() => globalThis.location.hash === '#fire-planner'
        && globalThis.document.querySelector('.nav-item[href="#fire-planner"]')?.getAttribute('aria-current') === 'page');
    assert.equal(await page.locator('#page-breadcrumb').innerText(), 'FIRE planner',
        'browser Back should restore the matching breadcrumb');
    await page.goForward();
    await page.waitForFunction(() => globalThis.location.hash === '#records'
        && globalThis.document.querySelector('.nav-item[href="#records"]')?.getAttribute('aria-current') === 'page');
    assert.equal(await page.locator('#page-breadcrumb').innerText(), 'Financial records',
        'browser Forward should restore the matching breadcrumb');
    process.stdout.write('PASS: browser Back and Forward keep navigation state synchronized.\n');
    const fullCsvDownload = page.waitForEvent('download');
    await page.locator('#export-csv-button').click();
    const fullCsv = await fullCsvDownload;
    assert.equal(fullCsv.suggestedFilename(), 'pfo-os-financial-records.csv');
    const fullCsvPath = join(temporaryDirectory, fullCsv.suggestedFilename());
    await fullCsv.saveAs(fullCsvPath);
    const fullCsvText = await readFile(fullCsvPath, 'utf8');
    assert.match(fullCsvText, /^Name,Category,Type,Value,Currency\r\n/);
    assert.ok(fullCsvText.includes('Savings account'), 'full CSV should include the matching demo record');
    assert.ok(fullCsvText.includes('Mutual fund portfolio'), 'full CSV should include records beyond the first row');
    process.stdout.write('PASS: full CSV export downloads and contains the complete record set.\n');

    await page.locator('#record-search').fill('Savings account');
    const filteredCsvDownload = page.waitForEvent('download');
    await page.locator('#export-view-csv-button').click();
    const filteredCsv = await filteredCsvDownload;
    assert.equal(filteredCsv.suggestedFilename(), 'pfo-os-financial-records-view.csv');
    const filteredCsvPath = join(temporaryDirectory, filteredCsv.suggestedFilename());
    await filteredCsv.saveAs(filteredCsvPath);
    const filteredCsvText = await readFile(filteredCsvPath, 'utf8');
    assert.ok(filteredCsvText.includes('Savings account'), 'filtered CSV should include matching records');
    assert.ok(!filteredCsvText.includes('Mutual fund portfolio'), 'filtered CSV must exclude non-matching records');
    process.stdout.write('PASS: filtered CSV export contains only matching records.\n');
    await page.locator('#record-search').fill('');
    const financialReportDownload = page.waitForEvent('download');
    await page.locator('#export-report-button').click();
    const financialReport = await financialReportDownload;
    const financialReportHtml = await assertOfflineReport(
        financialReport,
        'pfo-os-financial-summary.html',
        'Financial overview'
    );
    assert.ok(financialReportHtml.includes('Savings account'), 'financial report should include demo assets');
    assert.ok(financialReportHtml.includes('Home loan'), 'financial report should include liabilities');
    assert.ok(financialReportHtml.includes('does not track valuation dates'),
        'financial report must disclose that records have no valuation dates');
    assert.ok(financialReportHtml.includes('Net worth'), 'financial report should include a net-worth summary');
    assert.ok(financialReportHtml.includes('Liability breakdown'), 'financial report should include liabilities grouped by category');
    assert.ok(financialReportHtml.includes('Reconciliation:'), 'financial report should explicitly reconcile assets, liabilities, and net worth');
    assert.ok(financialReportHtml.includes('@page{margin:14mm}'), 'financial report should define printable page margins');
    assert.ok(financialReportHtml.includes('thead{display:table-header-group}'), 'printed report should repeat table headings');
    await assertOpensWithoutNetwork(browser, join(temporaryDirectory, 'pfo-os-financial-summary.html'), 'Financial overview');
    process.stdout.write('PASS: financial summary opens from a local file without network access.\\n');
    const [printReportPage] = await Promise.all([
        page.waitForEvent('popup'),
        page.locator('#print-report-button').click()
    ]);
    await printReportPage.waitForLoadState('load');
    assert.ok((await printReportPage.locator('body').innerText()).includes('Financial overview'),
        'print workflow should open the same self-contained financial report');
    await printReportPage.waitForFunction(() => globalThis.__pfoPrintInvoked === true);
    assert.ok((await page.locator('#toast').innerText()).includes('Choose Save as PDF'),
        'dashboard should explain how to save the print-ready report as PDF');
    await printReportPage.close();
    process.stdout.write('PASS: financial summary can open a print-ready window and invoke Save as PDF workflow.\n');
    process.stdout.write('PASS: financial summary report downloads with totals, records, and valuation-date limitation.\n');

    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-required-result').isVisible(), true,
        'required-contribution result should be visible before editing assumptions');
    await page.locator('#fire-inflation').fill('3.5');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'editing a shared assumption must hide the stale required-contribution result');
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'editing a shared assumption must hide stale readiness results');
    process.stdout.write('PASS: editing FIRE assumptions invalidates stale required-contribution and readiness results.\n');

    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.locator('#fire-annual-contribution').fill('300000');
    await page.getByLabel('Years until retirement').fill('10');
    await page.locator('#fire-return').fill('7');
    await page.getByLabel('Annual inflation (%)').fill('3');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByLabel('Initial withdrawal rate (%)').fill('4');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.textContent?.trim()),
        'Calculate readiness',
        'keyboard navigation from the final assumption should reach the readiness action in tab order'
    );
    await page.keyboard.press('Enter');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.textContent?.trim()),
        'Calculate readiness',
        'activating readiness should preserve focus on its action button'
    );
    assert.equal(await page.locator('#fire-results').isVisible(), true, 'readiness results should appear');
    assert.notEqual((await page.locator('#fire-projected-portfolio').innerText()).trim(), '—');
    assert.notEqual((await page.locator('#fire-target-corpus').innerText()).trim(), '—');
    process.stdout.write('PASS: FIRE readiness calculates and displays results.\n');

    // Bypass the input event intentionally so this specifically exercises the invalid-submit stale-result guard.
    await page.locator('#fire-spending').evaluate((element) => { element.value = ''; });
    const solveContributionButton = page.getByRole('button', { name: 'Solve required annual contribution' });
    await solveContributionButton.focus();
    await page.keyboard.press('Enter');
    assert.equal(
        await page.locator('#fire-spending').evaluate((input) => input === globalThis.document.activeElement),
        true,
        'keyboard submission should move focus to the invalid required spending field'
    );
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'an invalid required-contribution solve must clear stale results');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'an invalid solve must clear the previous required-contribution message');
    process.stdout.write('PASS: keyboard-submitted invalid contribution solve clears stale results and retains focus.\n');

    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-results').isVisible(), true, 'valid solver results should appear');
    assert.equal(await page.locator('#fire-required-result').isVisible(), true,
        'required annual contribution should be displayed');
    assert.match(await page.locator('#fire-required-result').innerText(), /Required constant annual contribution:/);
    process.stdout.write('PASS: required annual contribution solver returns a visible result.\n');

    let reachedSingleReportDownload = false;
    for (let index = 0; index < 6; index += 1) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => globalThis.document.activeElement?.id === 'fire-download-report')) {
            reachedSingleReportDownload = true;
            break;
        }
    }
    assert.equal(reachedSingleReportDownload, true,
        'keyboard tab order should reach the single-scenario report download action');
    const [singleDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.keyboard.press('Enter')
    ]);
    await assertOfflineReport(singleDownload, 'pfo-fire-scenario-report.html', 'Annual spending today:');
    await assertOpensWithoutNetwork(browser, join(temporaryDirectory, 'pfo-fire-scenario-report.html'), 'Annual spending today:');
    process.stdout.write('PASS: single-scenario FIRE report opens from a local file without network access.\\n');
    process.stdout.write('PASS: single-scenario report downloads as standalone, script-free HTML.\n');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
        globalThis.__scrollIntoViewBehavior = null;
        globalThis.__originalScrollIntoView = globalThis.Element.prototype.scrollIntoView;
        globalThis.Element.prototype.scrollIntoView = function (options) {
            globalThis.__scrollIntoViewBehavior = options?.behavior;
            return globalThis.__originalScrollIntoView.call(this, options);
        };
    });
    await page.getByRole('button', { name: 'Compare scenarios' }).click();
    assert.equal(
        await page.evaluate(() => globalThis.__scrollIntoViewBehavior),
        'auto',
        'scenario panel navigation should avoid smooth scrolling when reduced motion is requested'
    );
    await page.evaluate(() => { globalThis.Element.prototype.scrollIntoView = globalThis.__originalScrollIntoView; });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('#fire-comparison').isVisible(), true, 'scenario comparison panel should open');
    process.stdout.write('PASS: scenario navigation respects the reduced-motion preference.\n');
    assert.equal(await page.locator('#fire-comparison').isVisible(), true, 'scenario comparison panel should open');
    await page.getByRole('button', { name: 'Copy current assumptions into all scenarios' }).click();
    await page.locator('#fire-compare-a-name').fill('Conservative');
    await page.locator('#fire-compare-a-contribution').fill('200000');
    await page.locator('#fire-compare-b-name').fill('Baseline');
    await page.locator('#fire-compare-b-contribution').fill('300000');
    await page.locator('#fire-compare-c-name').fill('Higher saving');
    await page.locator('#fire-compare-c-contribution').fill('500000');
    let reachedCompareRun = false;
    for (let index = 0; index < 6; index += 1) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => globalThis.document.activeElement?.id === 'fire-compare-run')) {
            reachedCompareRun = true;
            break;
        }
    }
    assert.equal(reachedCompareRun, true,
        'keyboard tab order should reach the scenario comparison action after scenario inputs');
    await page.keyboard.press('Enter');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.id),
        'fire-compare-run',
        'activating comparison should preserve focus on its action button'
    );
    assert.equal(await page.locator('#fire-compare-results').isVisible(), true, 'comparison results should appear');
    assert.equal(await page.locator('#fire-compare-body tr').count(), 3, 'comparison should render all three scenarios');
    assert.match(await page.locator('#fire-compare-body').innerText(), /Conservative[\s\S]*Baseline[\s\S]*Higher saving/);
    process.stdout.write('PASS: three-scenario comparison renders each scenario in entered order.\n');

    await page.keyboard.press('Tab');
    assert.equal(
        await page.evaluate(() => globalThis.document.activeElement?.id),
        'fire-download-comparison-report',
        'keyboard tab order should reach the comparison report action after results appear'
    );
    const [comparisonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.keyboard.press('Enter')
    ]);
    await assertOfflineReport(comparisonDownload, 'pfo-fire-comparison-report.html', 'Conservative');
    const comparisonHtml = await readFile(join(temporaryDirectory, 'pfo-fire-comparison-report.html'), 'utf8');
    assert.ok(comparisonHtml.includes('Baseline') && comparisonHtml.includes('Higher saving'),
        'comparison report should include all three scenario names');
    await assertOpensWithoutNetwork(browser, join(temporaryDirectory, 'pfo-fire-comparison-report.html'), 'Conservative');
    process.stdout.write('PASS: comparison FIRE report opens from a local file without network access.\\n');
    process.stdout.write('PASS: comparison report downloads with all scenario assumptions and no remote dependencies.\n');

    await page.locator('#fire-compare-a-contribution').fill('250000');
    assert.equal(await page.locator('#fire-compare-results').isHidden(), true,
        'editing comparison assumptions should hide results calculated from the previous assumptions');
    const staleComparisonDownload = page.waitForEvent('download', { timeout: 1000 })
        .then(() => true, () => false);
    await page.locator('#fire-download-comparison-report').evaluate((button) => button.click());
    assert.equal(await staleComparisonDownload, false,
        'an invalidated comparison must not retain a downloadable report snapshot');
    assert.match(await page.locator('#toast').innerText(), /Calculate a scenario before downloading its report/,
        'attempting to use an invalidated comparison report should explain that a fresh comparison is required');
    process.stdout.write('PASS: editing comparison assumptions invalidates the old report snapshot.\n');
    await page.locator('#fire-compare-run').click();
    assert.equal(await page.locator('#fire-compare-results').isVisible(), true,
        'running the comparison again should refresh results after assumptions change');

    await page.setViewportSize({ width: 320, height: 800 });
    const narrowComparison = await page.evaluate(() => {
        const table = globalThis.document.querySelector('#fire-compare-results table');
        const wrapper = table?.parentElement;
        return {
            viewportWidth: globalThis.window.innerWidth,
            documentWidth: globalThis.document.documentElement.scrollWidth,
            wrapperClientWidth: wrapper?.clientWidth ?? 0,
            wrapperScrollWidth: wrapper?.scrollWidth ?? 0,
            wrapperOverflowX: wrapper ? globalThis.getComputedStyle(wrapper).overflowX : 'missing'
        };
    });
    assert.ok(narrowComparison.documentWidth <= narrowComparison.viewportWidth,
        `320px comparison view should not create page-level horizontal overflow: ${JSON.stringify(narrowComparison)}`);
    assert.ok(['auto', 'scroll'].includes(narrowComparison.wrapperOverflowX),
        `wide comparison table should remain inside a horizontally scrollable wrapper: ${JSON.stringify(narrowComparison)}`);
    assert.ok(narrowComparison.wrapperScrollWidth > narrowComparison.wrapperClientWidth,
        `comparison table should scroll within its own container at narrow widths: ${JSON.stringify(narrowComparison)}`);
    await page.locator('#fire-compare-run').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fire-compare-results').isVisible(), true,
        'keyboard activation should recalculate comparison results at a 320px viewport');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.id), 'fire-compare-run',
        'comparison action should retain keyboard focus at a 320px viewport');
    let reachedNarrowReportDownload = false;
    for (let index = 0; index < 8; index += 1) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => globalThis.document.activeElement?.id === 'fire-download-comparison-report')) {
            reachedNarrowReportDownload = true;
            break;
        }
    }
    assert.equal(reachedNarrowReportDownload, true,
        'keyboard tab order should reach the comparison report action at a 320px viewport');
    const narrowReportButton = await page.locator('#fire-download-comparison-report').boundingBox();
    assert.ok(narrowReportButton && narrowReportButton.x >= 0
        && narrowReportButton.x + narrowReportButton.width <= narrowComparison.viewportWidth,
    `comparison report action should fit within the narrow viewport: ${JSON.stringify(narrowReportButton)}`);
    process.stdout.write('PASS: narrow comparison layout contains table overflow without widening the page.\n');
    process.stdout.write('PASS: comparison recalculation and report-action keyboard focus work at 320px.\n');
    await page.setViewportSize({ width: 1280, height: 800 });

    // A 320 CSS-pixel viewport is the automated reflow proxy for 400% zoom from a 1280px baseline.
    // Headless Chromium does not expose browser-chrome zoom shortcuts, so do not claim to test browser UI zoom itself.
    await page.goto(`${baseUrl}#fire-planner`, { waitUntil: 'networkidle' });
    const initialCssViewportWidth = await page.evaluate(() => globalThis.window.innerWidth);
    const zoomEquivalentWidth = Math.floor(initialCssViewportWidth / 4);
    await page.setViewportSize({ width: zoomEquivalentWidth, height: 800 });
    const zoomEquivalentViewport = await page.evaluate(() => ({
        width: globalThis.window.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth
    }));
    assert.equal(zoomEquivalentViewport.width, zoomEquivalentWidth,
        '400%-zoom-equivalent test should use one quarter of the baseline CSS viewport width');
    assert.ok(zoomEquivalentViewport.documentWidth <= zoomEquivalentViewport.width,
        `FIRE planner should not create page-level horizontal overflow at a 400%-zoom-equivalent viewport: ${JSON.stringify(zoomEquivalentViewport)}`);
    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByRole('button', { name: 'Calculate readiness' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fire-results').isVisible(), true,
        'FIRE readiness should remain operable at a 400%-zoom-equivalent viewport');
    assert.equal(await page.locator('#fire-projected-portfolio').isVisible(), true,
        'FIRE results should remain available at a 400%-zoom-equivalent viewport');
    await page.setViewportSize({ width: initialCssViewportWidth, height: 800 });
    process.stdout.write('PASS: FIRE planner reflows and remains operable at a 320 CSS-pixel viewport (400% zoom equivalent from 1280px); this is not a browser-chrome zoom test.\n');

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.locator('#goal-name').fill('Emergency fund');
    await page.locator('#goal-target').fill('1000000');
    await page.locator('#goal-current').fill('250000');
    await page.locator('#goal-date').fill(futureDate.toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Calculate goal progress' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#goal-results').isVisible(), true, 'goal progress results should appear');
    assert.equal((await page.locator('#goal-progress-percent').innerText()).trim(), '25%',
        'goal progress should reflect accumulated amount divided by target');
    assert.equal(await page.locator('#goal-progress-bar').getAttribute('aria-valuetext'), '25 percent of target');
    assert.ok((await page.locator('#goal-monthly-pace-result').innerText()).includes('62,500'),
        'goal results should show an approximate monthly savings pace');

    // A normal input event must invalidate stale results before native keyboard validation runs.
    await page.locator('#goal-target').fill('');
    assert.equal(await page.locator('#goal-results').isHidden(), true,
        'editing the required target amount should clear stale goal results');
    const calculateGoalButton = page.getByRole('button', { name: 'Calculate goal progress' });
    await calculateGoalButton.focus();
    await page.keyboard.press('Enter');
    assert.equal(
        await page.locator('#goal-target').evaluate((input) => input === globalThis.document.activeElement),
        true,
        'keyboard submission should focus the invalid required goal target field'
    );
    assert.equal(await page.locator('#goal-results').isHidden(), true,
        'invalid keyboard submission must not restore stale goal results');
    await page.locator('#goal-target').fill('1000000');
    process.stdout.write('PASS: invalid keyboard-submitted goal assumptions clear stale results and focus the required target field.\\n');

    await page.locator('#goal-current').fill('1500000');
    await page.getByRole('button', { name: 'Calculate goal progress' }).focus();
    await page.keyboard.press('Enter');
    assert.equal((await page.locator('#goal-progress-percent').innerText()).trim(), '150%',
        'goal progress should show the full accumulated amount when it exceeds the target');
    assert.equal(await page.locator('#goal-progress-bar').getAttribute('value'), '100',
        'the native progress element should cap its visual value at its maximum');
    assert.equal(await page.locator('#goal-progress-bar').getAttribute('aria-valuetext'), '150 percent of target',
        'assistive technology should receive the uncapped percentage-of-target wording');
    assert.match(await page.locator('#goal-status').innerText(), /Goal reached/,
        'a goal above its target should be marked as reached');
    assert.equal((await page.locator('#goal-remaining-result').innerText()).replace(/[^0-9]/g, ''), '0',
        'amount remaining should not become negative after exceeding the target');
    process.stdout.write('PASS: over-target goal progress stays accurate while the native progress bar and accessible value remain valid.\\n');

    await page.getByRole('button', { name: 'Clear form' }).click();
    assert.equal(await page.locator('#goal-results').isHidden(), true, 'reset should clear goal results');
    process.stdout.write('PASS: goal tracker calculates accessible progress and reset clears its results.\n');

    await page.goto(`${baseUrl}#return-risk-analysis`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#page-breadcrumb').innerText(), 'Return risk analysis',
        'return risk navigation should synchronize the breadcrumb');
    await page.locator('#return-risk-observations').fill('2026-01-31,10\n2026-02-28,-20\n2026-03-31,5');
    await page.locator('#return-risk-risk-free').fill('1');
    await page.locator('#return-risk-target').fill('0');
    const calculateReturnRiskButton = page.getByRole('button', { name: 'Calculate risk metrics' });
    await calculateReturnRiskButton.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#return-risk-results').isVisible(), true,
        'keyboard submission should display return-risk results');
    assert.equal(await page.locator('#return-risk-observation-count').innerText(), '3');
    assert.equal(await page.locator('#return-risk-drawdown').innerText(), '20%');
    assert.equal(await page.locator('#return-risk-worst-period').innerText(), '-20%');
    assert.equal(await page.locator('#return-risk-negative-count').innerText(), '1');
    assert.notEqual(await page.locator('#return-risk-sharpe').innerText(), '—',
        'an explicit risk-free return should enable the Sharpe ratio');
    assert.notEqual(await page.locator('#return-risk-sortino').innerText(), '—',
        'an explicit target should enable the Sortino ratio');
    const riskCsvDownload = page.waitForEvent('download');
    await page.locator('#return-risk-export-csv').click();
    const riskCsv = await riskCsvDownload;
    assert.equal(riskCsv.suggestedFilename(), 'pfo-return-risk-analysis.csv');
    const riskCsvPath = join(temporaryDirectory, riskCsv.suggestedFilename());
    await riskCsv.saveAs(riskCsvPath);
    const riskCsvText = await readFile(riskCsvPath, 'utf8');
    assert.match(riskCsvText, /"maximum_drawdown","0\.199999/,
        'risk CSV should export the calculated maximum drawdown');
    await page.locator('#return-risk-observations').fill('2026-02-30,3');
    assert.equal(await page.locator('#return-risk-export-csv').isDisabled(), true,
        'editing risk observations should invalidate stale metric exports');
    await page.locator('#return-risk-form button[type="submit"]').click();
    assert.equal(await page.locator('#return-risk-validation').isVisible(), true,
        'invalid calendar dates should show an actionable validation message');
    process.stdout.write('PASS: return risk calculator validates dates, calculates metrics, exports CSV, and invalidates stale results.\n');

    const cashFlowDate = await page.evaluate(() => {
        const now = new Date();
        return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    });
    await page.locator('#cash-flow-date').fill(cashFlowDate);
    await page.locator('#cash-flow-type').selectOption('income');
    await page.locator('#cash-flow-category').fill('Salary');
    await page.locator('#cash-flow-description').fill('Browser test salary');
    await page.locator('#cash-flow-amount').fill('100000');
    await page.locator('#cash-flow-recurring').check();
    await page.locator('#cash-flow-save').click();
    await page.locator('#cash-flow-type').selectOption('expense');
    await page.locator('#cash-flow-category').fill('Housing');
    await page.locator('#cash-flow-description').fill('Browser test rent');
    await page.locator('#cash-flow-amount').fill('20000');
    await page.locator('#cash-flow-recurring').uncheck();
    await page.locator('#cash-flow-save').click();
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '100000',
        'cash flow should total income separately');
    assert.equal((await page.locator('#cash-flow-expense-total').innerText()).replace(/[^0-9]/g, ''), '20000',
        'cash flow should total expenses separately');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '80000',
        'cash flow should calculate net cash flow');
    assert.equal(await page.locator('#cash-flow-savings-rate').innerText(), '80%',
        'savings rate should be net cash flow divided by income');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2, 'cash flow should list both transactions');
    const housingCategoryRow = page.locator('#cash-flow-category-rows tr').filter({ hasText: 'Housing' });
    const salaryCategoryRow = page.locator('#cash-flow-category-rows tr').filter({ hasText: 'Salary' });
    assert.equal(await housingCategoryRow.locator('td').count(), 6,
        'cash-flow category table should include the expense-share column');
    assert.equal(await housingCategoryRow.locator('td').nth(3).innerText(), '100%',
        'housing should account for all recorded expenses in the sample period');
    assert.equal(await salaryCategoryRow.locator('td').nth(3).innerText(), '0%',
        'income-only categories should have zero share of recorded expenses');
    await page.locator('#cash-flow-type-filter').selectOption('expense');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'type filter should limit visible transactions');
    assert.match(await page.locator('#cash-flow-count').innerText(), /1 shown of 2 transactions/,
        'filtered count should distinguish visible rows from period totals');
    await page.locator('#cash-flow-search').fill('Browser test rent');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'search should match descriptions');
    await page.locator('#cash-flow-search').fill('no matching transaction');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 0, 'empty search results should be handled');
    assert.match(await page.locator('#cash-flow-empty').innerText(), /No transactions match/);
    await page.locator('#cash-flow-reset-filters').click();
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2, 'reset should restore visible transactions');
    const cashFlowRangeToday = new Date();
    const cashFlowRangeTodayString = [cashFlowRangeToday.getFullYear(), String(cashFlowRangeToday.getMonth() + 1).padStart(2, '0'), String(cashFlowRangeToday.getDate()).padStart(2, '0')].join('-');
    const cashFlowRangeTomorrow = new Date(cashFlowRangeToday);
    cashFlowRangeTomorrow.setDate(cashFlowRangeTomorrow.getDate() + 1);
    const cashFlowRangeTomorrowString = [cashFlowRangeTomorrow.getFullYear(), String(cashFlowRangeTomorrow.getMonth() + 1).padStart(2, '0'), String(cashFlowRangeTomorrow.getDate()).padStart(2, '0')].join('-');
    await page.locator('#cash-flow-date-from').fill(cashFlowRangeTomorrowString);
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 0, 'a valid future start date should exclude earlier transactions');
    await page.locator('#cash-flow-date-to').fill(cashFlowRangeTodayString);
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 0, 'an inverted date range should not render stale or misleading rows');
    assert.match(await page.locator('#cash-flow-date-range-error').innerText(), /Start date must be on or before end date/);
    assert.equal(await page.locator('#cash-flow-count').innerText(), 'Invalid date range');
    assert.equal(await page.locator('#cash-flow-export-filtered-csv').isDisabled(), true,
        'filtered CSV export should be disabled while the date range is invalid');
    assert.equal(await page.locator('#cash-flow-export-filtered-summary-csv').isDisabled(), true,
        'filtered summary export should be disabled while the date range is invalid');
    assert.equal(await page.locator('#cash-flow-export-filtered-category-csv').isDisabled(), true,
        'filtered category export should be disabled while the date range is invalid');
    await page.locator('#cash-flow-reset-filters').click();
    assert.equal(await page.locator('#cash-flow-date-range-error').isHidden(), true,
        'reset should clear date-range validation errors');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2, 'reset should clear date range filters');
    await page.locator('#cash-flow-category-filter').selectOption({ label: 'Housing' });
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'category filter should show only matching transactions');
    assert.equal((await page.locator('#cash-flow-filtered-expenses').innerText()).replace(/[^0-9]/g, ''), '20000',
        'filtered totals should reflect the category-filtered expense');
    assert.equal((await page.locator('#cash-flow-filtered-income').innerText()).replace(/[^0-9]/g, ''), '0',
        'filtered totals should exclude income outside the selected category');
    assert.equal((await page.locator('#cash-flow-filtered-net').innerText()).replace(/[^0-9]/g, ''), '20000',
        'filtered net should reconcile to the visible expense');
    const filteredSummaryDownloadPromise = page.waitForEvent('download');
    await page.locator('#cash-flow-export-filtered-summary-csv').click();
    const filteredSummaryDownload = await filteredSummaryDownloadPromise;
    assert.equal(filteredSummaryDownload.suggestedFilename(), 'pfo-cash-flow-filtered-summary.csv');
    const filteredSummaryPath = join(temporaryDirectory, 'pfo-cash-flow-filtered-summary.csv');
    await filteredSummaryDownload.saveAs(filteredSummaryPath);
    const filteredSummaryCsv = await readFile(filteredSummaryPath, 'utf8');
    assert.match(filteredSummaryCsv, /"income","expenses","net","savings_rate_percent","transaction_count"/);
    assert.match(filteredSummaryCsv, /"0","20000","-20000","","1"/,
        'filtered summary export should match category-filtered totals and leave savings rate empty without income');
    const filteredCategoryDownloadPromise = page.waitForEvent('download');
    await page.locator('#cash-flow-export-filtered-category-csv').click();
    const filteredCategoryDownload = await filteredCategoryDownloadPromise;
    assert.equal(filteredCategoryDownload.suggestedFilename(), 'pfo-cash-flow-filtered-categories.csv');
    const filteredCategoryPath = join(temporaryDirectory, 'pfo-cash-flow-filtered-categories.csv');
    await filteredCategoryDownload.saveAs(filteredCategoryPath);
    const filteredCategoryCsv = await readFile(filteredCategoryPath, 'utf8');
    assert.match(filteredCategoryCsv, /"category","income","expenses","expense_share_percent","net","transaction_count"/);
    assert.match(filteredCategoryCsv, /"Housing","0","20000","100","-20000","1"/,
        'filtered category export should include only the selected category and calculate its expense share');
    assert.match(await page.locator('#cash-flow-rows tr').first().innerText(), /Browser test rent/,
        'category filter should select the matching expense');
    await page.locator('#cash-flow-reset-filters').click();
    await page.locator('#cash-flow-sort-order').selectOption('amount-high');
    assert.match(await page.locator('#cash-flow-rows tr').first().innerText(), /Browser test salary/,
        'highest-amount sort should put income first');
    await page.locator('#cash-flow-sort-order').selectOption('amount-low');
    assert.match(await page.locator('#cash-flow-rows tr').first().innerText(), /Browser test rent/,
        'lowest-amount sort should put the expense first');
    await page.locator('#cash-flow-reset-filters').click();
    assert.equal(await page.locator('#cash-flow-sort-order').inputValue(), 'date-newest',
        'reset view should restore the default sort');
    assert.equal(await page.locator('#cash-flow-category-rows tr').count(), 2,
        'cash flow should summarize each category for the selected period');
    const housingCategory = page.locator('#cash-flow-category-rows tr').filter({ hasText: 'Housing' });
    assert.equal((await housingCategory.locator('td').nth(2).innerText()).replace(/[^0-9]/g, ''), '20000',
        'category summary should show expenses in the correct category');
    assert.equal(await housingCategory.locator('td').nth(5).innerText(), '1',
        'category summary should show the number of transactions in each category');
    assert.equal(await page.locator('#cash-flow-monthly-rows tr').count(), 1,
        'monthly trend should group transactions that share the same month');
    const monthlyTrend = page.locator('#cash-flow-monthly-rows tr').first();
    assert.equal((await monthlyTrend.locator('td').nth(1).innerText()).replace(/[^0-9]/g, ''), '100000',
        'monthly trend should total recorded income');
    assert.equal((await monthlyTrend.locator('td').nth(2).innerText()).replace(/[^0-9]/g, ''), '20000',
        'monthly trend should total recorded expenses');
    assert.equal((await monthlyTrend.locator('td').nth(3).innerText()).replace(/[^0-9]/g, ''), '80000',
        'monthly trend should calculate recorded net cash flow');
    assert.equal(await monthlyTrend.locator('td').nth(4).innerText(), '80%',
        'monthly trend should calculate net cash flow as a share of income');
    const [monthlyCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-monthly-csv').click()
    ]);
    assert.equal(monthlyCsvDownload.suggestedFilename(), 'pfo-cash-flow-monthly-summary.csv');
    const monthlyCsvPath = join(temporaryDirectory, 'pfo-cash-flow-monthly-summary.csv');
    await monthlyCsvDownload.saveAs(monthlyCsvPath);
    const monthlyCsv = await readFile(monthlyCsvPath, 'utf8');
    assert.ok(monthlyCsv.includes('"' + cashFlowDate.slice(0, 7) + '"'), 'monthly CSV should include the current recorded month key');
    assert.ok(monthlyCsv.includes('"month","income","expenses","net","savings_rate_percent","transaction_count"'),
        'monthly CSV should include the machine-readable savings-rate column');
    assert.ok(monthlyCsv.includes('"100000","20000","80000","80","2"'),
        'monthly CSV should include income, expenses, net, savings rate, and count matching the trend');
    const [categoryCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-category-csv').click()
    ]);
    assert.equal(categoryCsvDownload.suggestedFilename(), 'pfo-cash-flow-category-summary.csv');
    const categoryCsvPath = join(temporaryDirectory, 'pfo-cash-flow-category-summary.csv');
    await categoryCsvDownload.saveAs(categoryCsvPath);
    const categoryCsv = await readFile(categoryCsvPath, 'utf8');
    assert.ok(categoryCsv.includes('"category","income","expenses","expense_share_percent","net","transaction_count"'),
        'category CSV should include its machine-readable header');
    assert.ok(categoryCsv.includes('"Salary","100000","0","0","100000","1"'),
        'category CSV should include income totals matching the visible category breakdown');
    assert.ok(categoryCsv.includes('"Housing","0","20000","100","-20000","1"'),
        'category CSV should preserve negative category net as a numeric value');
    await page.locator('#cash-flow-frequency-filter').selectOption('recurring');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'recurring filter should show recurring transactions only');
    assert.equal((await page.locator('#cash-flow-rows tr').innerText()).includes('Browser test salary'), true);
    await page.locator('#cash-flow-frequency-filter').selectOption('one-time');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'one-time filter should show one-time transactions only');
    assert.equal((await page.locator('#cash-flow-rows tr').innerText()).includes('Browser test rent'), true);
    await page.locator('#cash-flow-reset-filters').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '100000',
        'cash flow transactions should persist across reloads');
    const salaryRow = page.locator('#cash-flow-rows tr').filter({ hasText: 'Browser test salary' });
    await salaryRow.getByRole('button', { name: 'Edit Browser test salary' }).click();
    await page.locator('#cash-flow-amount').fill('110000');
    await page.locator('#cash-flow-save').click();
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '90000',
        'editing a transaction should recalculate net cash flow');
    assert.equal(await page.locator('#cash-flow-savings-rate').innerText(), '81.8%',
        'editing income should recalculate savings rate');
    const [cashFlowBackupDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-json').click()
    ]);
    assert.equal(cashFlowBackupDownload.suggestedFilename(), 'pfo-cash-flow-backup.json');
    const cashFlowBackupPath = join(temporaryDirectory, 'pfo-cash-flow-backup.json');
    await cashFlowBackupDownload.saveAs(cashFlowBackupPath);
    const cashFlowBackup = JSON.parse(await readFile(cashFlowBackupPath, 'utf8'));
    assert.equal(cashFlowBackup.schemaVersion, 1);
    assert.equal(cashFlowBackup.entries.length, 2);
    await page.locator('#cash-flow-type').selectOption('income');
    await page.locator('#cash-flow-category').fill('Other');
    await page.locator('#cash-flow-description').fill('Temporary extra income');
    await page.locator('#cash-flow-amount').fill('1000');
    await page.locator('#cash-flow-save').click();
    page.once('dialog', (dialog) => {
        assert.match(dialog.message(), /Import preview: 2 transactions/);
        assert.match(dialog.message(), /Income:/);
        assert.match(dialog.message(), /Expenses:/);
        assert.match(dialog.message(), /Net cash flow:/);
        dialog.dismiss();
    });
    await page.locator('#cash-flow-import-json').setInputFiles({
        name: 'cash-flow-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(cashFlowBackup))
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-message')?.innerText.includes('Import cancelled'));
    assert.equal(await page.locator('#cash-flow-count').innerText(), '3 transactions',
        'cancelling import preview should leave the existing ledger unchanged');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#cash-flow-import-json').setInputFiles({
        name: 'cash-flow-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(cashFlowBackup))
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-count')?.innerText === '2 transactions');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '90000',
        'restoring the cash flow backup should replace all transactions with the validated backup');
    await page.locator('#cash-flow-type-filter').selectOption('expense');
    const [cashFlowFilteredCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-filtered-csv').click()
    ]);
    assert.equal(cashFlowFilteredCsvDownload.suggestedFilename(), 'pfo-cash-flow-filtered.csv');
    const cashFlowFilteredCsvPath = join(temporaryDirectory, 'pfo-cash-flow-filtered.csv');
    await cashFlowFilteredCsvDownload.saveAs(cashFlowFilteredCsvPath);
    const cashFlowFilteredCsv = await readFile(cashFlowFilteredCsvPath, 'utf8');
    assert.ok(cashFlowFilteredCsv.includes('Browser test rent'), 'filtered CSV should include visible expense rows');
    assert.ok(!cashFlowFilteredCsv.includes('Browser test salary'), 'filtered CSV should exclude rows outside the active filter');
    await page.locator('#cash-flow-reset-filters').click();

    const rentRow = page.locator('#cash-flow-rows tr').filter({ hasText: 'Browser test rent' });
    page.once('dialog', async (dialog) => {
        assert.match(dialog.message(), /Delete this cash-flow transaction/);
        assert.match(dialog.message(), /Description: Browser test rent/);
        assert.match(dialog.message(), /Date: \d{4}-\d{2}-\d{2}/);
        assert.match(dialog.message(), /Type: Expense/);
        assert.match(dialog.message(), /Category: Housing/);
        assert.match(dialog.message(), /20,000/);
        await dialog.dismiss();
    });
    await rentRow.getByRole('button', { name: 'Delete Browser test rent' }).click();
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2,
        'cancelling deletion should preserve the transaction row');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '90000',
        'cancelling deletion should preserve net cash flow');
    assert.equal(await page.locator('#cash-flow-savings-rate').innerText(), '81.8%',
        'cancelling deletion should preserve the savings rate');

    page.once('dialog', (dialog) => {
        assert.match(dialog.message(), /Delete this cash-flow transaction/);
        assert.match(dialog.message(), /Description: Browser test rent/);
        assert.match(dialog.message(), /Date: \d{4}-\d{2}-\d{2}/);
        assert.match(dialog.message(), /Type: Expense/);
        assert.match(dialog.message(), /Category: Housing/);
        assert.match(dialog.message(), /20,000/);
        dialog.accept();
    });
    await rentRow.getByRole('button', { name: 'Delete Browser test rent' }).click();
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'deleting a transaction should remove it');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '110000',
        'deleting an expense should recalculate net cash flow');
    assert.equal(await page.locator('#cash-flow-savings-rate').innerText(), '100%',
        'savings rate should update when expenses are deleted');
    const duplicateSalaryRow = page.locator('#cash-flow-rows tr').filter({ hasText: 'Browser test salary' });
    await duplicateSalaryRow.getByRole('button', { name: 'Duplicate Browser test salary' }).click();
    assert.equal(await page.locator('#cash-flow-save').innerText(), 'Save as new transaction',
        'duplicate action should clearly indicate that a new entry will be created');
    assert.equal(await page.locator('#cash-flow-description').inputValue(), 'Browser test salary',
        'duplicate action should prefill the selected transaction');
    page.once('dialog', async (dialog) => {
        assert.match(dialog.message(), /same date, type, category, description, amount, and frequency/i);
        await dialog.accept();
    });
    await page.locator('#cash-flow-save').click();
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2,
        'saving a duplicate should add a new transaction rather than edit the original');
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '220000',
        'duplicating an income transaction should update totals using the edited source amount');
    assert.match(await page.locator('#cash-flow-message').innerText(), /duplicated locally/);
    process.stdout.write('PASS: local cash flow add, persistence, edit, delete, summaries, and JSON backup/restore work in Chromium.\n');
    const [cashFlowCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-all-csv').click()
    ]);
    assert.equal(cashFlowCsvDownload.suggestedFilename(), 'pfo-cash-flow.csv');
    const cashFlowCsvPath = join(temporaryDirectory, 'pfo-cash-flow.csv');
    await cashFlowCsvDownload.saveAs(cashFlowCsvPath);
    const cashFlowCsv = await readFile(cashFlowCsvPath, 'utf8');
    assert.match(cashFlowCsv, /"date","type","category","description","amount","recurring"/);
    assert.ok(cashFlowCsv.includes('Browser test salary'));
    process.stdout.write('PASS: cash flow CSV export downloads the current ledger.\n');

    // Cash-flow tests do not depend on the asset/liability workspace; switch back explicitly for its backup assertions.
    await page.locator('#switch-private-button').click();
    await page.locator('#historical-snapshot-date').fill('2023-12-31');
    await page.locator('#capture-historical-snapshot-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#historical-snapshot-rows')?.innerText.includes('Dec 2023')
        || globalThis.document.querySelector('#historical-snapshot-rows')?.innerText.includes('31 Dec 2023'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'capturing a dated snapshot should persist it locally');
    await page.locator('#capture-historical-snapshot-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.innerText.includes('A historical snapshot already exists for this date.'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'a duplicate capture must leave the original saved snapshot unchanged');
    let cancelledRemovalMessage = '';
    page.once('dialog', async (dialog) => {
        cancelledRemovalMessage = dialog.message();
        await dialog.dismiss();
    });
    await page.locator('[data-history-remove="2023-12-31"]').focus();
    await page.keyboard.press('Enter');
    assert.match(cancelledRemovalMessage, /export a full workspace backup first/i);
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'cancelling snapshot removal must preserve saved history');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.getAttribute('data-history-remove')), '2023-12-31',
        'cancelling keyboard-initiated removal should return focus to its trigger');
    let removalFailureMessage = '';
    await page.evaluate(() => {
        const originalSetItem = globalThis.Storage.prototype.setItem;
        globalThis.__pfoHistoryOriginalSetItem = originalSetItem;
        let failHistoryWriteOnce = true;
        globalThis.Storage.prototype.setItem = function (key, value) {
            if (failHistoryWriteOnce && key === 'pfo-os.historical-snapshots.v1') {
                failHistoryWriteOnce = false;
                throw new globalThis.DOMException('Simulated history removal storage failure', 'QuotaExceededError');
            }
            return originalSetItem.call(this, key, value);
        };
    });
    page.once('dialog', async (dialog) => {
        removalFailureMessage = dialog.message();
        await dialog.accept();
    });
    await page.locator('[data-history-remove="2023-12-31"]').focus();
    await page.keyboard.press('Enter');
    assert.match(removalFailureMessage, /does not change current financial records/i);
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.innerText.includes('previous saved history was left unchanged'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'failed snapshot removal persistence must leave the original history intact');
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 1,
        'failed snapshot removal must not remove the visible history row');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.getAttribute('data-history-remove')), '2023-12-31',
        'failed keyboard-initiated removal should retain focus on its trigger');
    await page.evaluate(() => {
        globalThis.Storage.prototype.setItem = globalThis.__pfoHistoryOriginalSetItem;
        delete globalThis.__pfoHistoryOriginalSetItem;
    });
    let confirmedRemovalMessage = '';
    page.once('dialog', async (dialog) => {
        confirmedRemovalMessage = dialog.message();
        await dialog.accept();
    });
    await page.locator('[data-history-remove="2023-12-31"]').focus();
    await page.keyboard.press('Enter');
    assert.match(confirmedRemovalMessage, /does not change current financial records/i);
    await page.waitForFunction(() => globalThis.document.querySelector('#historical-snapshot-rows')?.children.length === 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]')), [],
        'confirmed removal should persist an empty history collection');
    assert.equal(await page.evaluate(() => globalThis.document.activeElement?.id), 'historical-snapshots-heading',
        'successful keyboard-initiated removal should move focus to the history heading');
    await page.locator('#historical-snapshot-date').fill('2023-12-31');
    await page.locator('#capture-historical-snapshot-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#historical-snapshot-rows')?.innerText.includes('Dec 2023')
        || globalThis.document.querySelector('#historical-snapshot-rows')?.innerText.includes('31 Dec 2023'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'an explicitly removed snapshot date should be available for a corrected recapture');
    const [historyCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-historical-snapshots-csv').click()
    ]);
    assert.equal(historyCsvDownload.suggestedFilename(), 'pfo-os-historical-snapshots.csv');
    process.stdout.write('PASS: explicit historical snapshot capture persists locally and exports to CSV.\n');
    await page.locator('#switch-demo-button').click();
    assert.equal(await page.locator('#historical-snapshots-source').innerText(), 'Fictional development fixture · not saved');
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 3);
    assert.equal(await page.locator('#historical-net-worth-chart li').count(), 3);
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'switching to sample mode must not replace saved private history');
    await page.locator('#switch-private-button').click();
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'switching back must preserve the private historical snapshot');
    const [backupDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-button').click()
    ]);
    assert.equal(backupDownload.suggestedFilename(), 'pfo-os-full-workspace-backup.json');
    const backupPath = join(temporaryDirectory, 'pfo-os-full-workspace-backup.json');
    await backupDownload.saveAs(backupPath);
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    assert.equal(backup.schemaVersion, 4, 'private JSON backup should use schema version 4 with historical snapshots');
    assert.equal(backup.currency, 'INR', 'JSON backup should declare the workspace currency');
    assert.ok(Array.isArray(backup.records), 'JSON backup should contain a records array');
    assert.deepEqual(backup.goals, [], 'private JSON backup should include an empty goals array when no goals are saved');
    assert.equal(backup.cashFlowEntries.length, 2, 'private JSON backup should include all cash-flow transactions');
    assert.ok(backup.cashFlowEntries.some((entry) => entry.description === 'Browser test salary'), 'cash-flow backup should preserve transaction details');
    assert.deepEqual(backup.budgets, [], 'private JSON backup should include category budgets');
    assert.equal(backup.historicalSnapshots.length, 1, 'private JSON backup should include historical snapshots');
    assert.equal(backup.historicalSnapshots[0].date, '2023-12-31');
    assert.equal(typeof backup.exportedAt, 'string', 'JSON backup should include an export timestamp');
    process.stdout.write('PASS: private workspace JSON backup downloads and contains a valid versioned payload.\n');

    const legacyV3Backup = {
        schemaVersion: 3, currency: 'INR', exportedAt: new Date().toISOString(),
        records: [{ name: 'Legacy full backup asset', category: 'Investments', type: 'asset', value: 321000 }],
        goals: [], cashFlowEntries: [], budgets: []
    };
    const legacyV3Confirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-file').setInputFiles({
        name: 'legacy-v3-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyV3Backup))
    });
    assert.match(await legacyV3Confirmation, /existing history is preserved/i);
    await page.waitForFunction(() => globalThis.document.querySelector('#records-body')?.innerText.includes('Legacy full backup asset'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'restoring a schema v3 backup should preserve historical snapshots');
    process.stdout.write('PASS: schema v3 full-workspace restore preserves history omitted by the legacy format.\n');

    const validBackup = {
        schemaVersion: 1,
        currency: 'INR',
        exportedAt: new Date().toISOString(),
        records: [{ name: 'Imported browser asset', category: 'Investments', type: 'asset', value: 123456 }]
    };
    const importPreviewDialogPromise = page.waitForEvent('dialog');
    await page.locator('#import-file').setInputFiles({
        name: 'valid-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(validBackup))
    });
    const importPreviewDialog = await importPreviewDialogPromise;
    assert.equal(importPreviewDialog.type(), 'confirm');
    assert.match(importPreviewDialog.message(), /Backup import preview/);
    assert.match(importPreviewDialog.message(), /\nFinancial records: 1/);
    assert.doesNotMatch(importPreviewDialog.message(), /\\\\nFinancial records: 1/);
    assert.match(importPreviewDialog.message(), /Financial records: 1/);
    assert.match(importPreviewDialog.message(), /Assets:/);
    assert.match(importPreviewDialog.message(), /Net worth:/);
    assert.match(importPreviewDialog.message(), /Saved goals: not included/);
    assert.match(importPreviewDialog.message(), /cash flow and budgets: not included/i);
    await importPreviewDialog.accept();
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#records-body')?.innerText.includes('Imported browser asset')
    );
    assert.match(await page.locator('#net-worth').innerText(), /1,23,456/,
        'imported financial records should update the dashboard totals');
    assert.equal(await page.locator('#ratio-assets-to-liabilities').innerText(), '—',
        'zero liabilities should produce an unavailable assets-to-liabilities ratio rather than infinity');
    process.stdout.write('PASS: importing a valid backup updates the private workspace and totals.\n');

    await page.locator('#import-file').setInputFiles({
        name: 'invalid-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ schemaVersion: 999, currency: 'INR', records: [] }))
    });
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#toast')?.textContent.includes('Unsupported backup format.')
    );
    assert.ok((await page.locator('#records-body').innerText()).includes('Imported browser asset'),
        'a rejected backup must not overwrite the previously imported records');
    assert.match(await page.locator('#net-worth').innerText(), /1,23,456/,
        'a rejected backup must preserve the prior financial totals');
    process.stdout.write('PASS: invalid backup rejection preserves the current records and totals.\n');

    const replacementBackup = {
        schemaVersion: 1,
        currency: 'INR',
        exportedAt: new Date().toISOString(),
        records: [{ name: 'Replacement browser asset', category: 'Investments', type: 'asset', value: 654321 }]
    };
    const dismissedConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.dismiss();
            resolve(message);
        });
    });
    await page.locator('#import-file').setInputFiles({
        name: 'replacement-cancelled.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(replacementBackup))
    });
    assert.match(await dismissedConfirmation, /Importing replaces financial records/i);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#toast')?.textContent.includes('Import cancelled.')
    );
    assert.ok((await page.locator('#records-body').innerText()).includes('Imported browser asset'),
        'cancelling replacement must preserve existing records');
    assert.ok(!(await page.locator('#records-body').innerText()).includes('Replacement browser asset'),
        'cancelling replacement must not import the replacement records');
    process.stdout.write('PASS: cancelling backup replacement preserves existing records.\n');

    const acceptedConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-file').setInputFiles({
        name: 'replacement-confirmed.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(replacementBackup))
    });
    assert.match(await acceptedConfirmation, /Importing replaces financial records/i);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#records-body')?.innerText.includes('Replacement browser asset')
    );
    const replacedRecords = await page.locator('#records-body').innerText();
    assert.ok(!replacedRecords.includes('Imported browser asset'),
        'confirmed replacement should replace rather than append existing records');
    assert.match(await page.locator('#net-worth').innerText(), /6,54,321/,
        'confirmed replacement should recalculate totals from the new backup');
    process.stdout.write('PASS: confirming backup replacement imports the new records and recalculates totals.\n');

    // Saved financial goals are private, persist across reloads, and support update/delete.
    await page.locator('#goal-name').fill('Browser test emergency fund');
    await page.locator('#goal-target').fill('500000');
    await page.locator('#goal-current').fill('125000');
    await page.locator('#goal-date').fill('2027-12-31');
    await page.locator('#goal-save-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund'));
    assert.match(await page.locator('#saved-goals-count').innerText(), /1 goal/);
    assert.match(await page.locator('#saved-goals-list').innerText(), /3,75,000/);
    assert.ok((await page.locator('#saved-goals-list').innerText()).includes('25,000 per month'),
        'saved goal should display its approximate monthly savings pace');
    assert.equal(await page.locator('#saved-goals-export-csv').isDisabled(), false,
        'saved-goal CSV export should be enabled in the private workspace when a goal exists');
    const [goalProgressCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#saved-goals-export-csv').click()
    ]);
    assert.equal(goalProgressCsvDownload.suggestedFilename(), 'pfo-saved-goal-progress.csv');
    const goalProgressCsvPath = join(temporaryDirectory, 'pfo-saved-goal-progress.csv');
    await goalProgressCsvDownload.saveAs(goalProgressCsvPath);
    const goalProgressCsv = await readFile(goalProgressCsvPath, 'utf8');
    assert.ok(goalProgressCsv.includes('Browser test emergency fund'), 'goal CSV should include the saved goal name');
    assert.ok(goalProgressCsv.includes('500000,125000,375000,25'), 'goal CSV should include target, current, remaining, and progress');
    assert.ok(goalProgressCsv.includes('2027-12-31'), 'goal CSV should include the target date');
    process.stdout.write('PASS: saved goal progress can be exported as a local CSV.\n');
    process.stdout.write('PASS: a financial goal can be saved with calculated progress and monthly pace in the private workspace.\n');

    const csvImportConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-csv-file').setInputFiles(fullCsvPath);
    assert.match(await csvImportConfirmation, /replace all financial records in your private workspace/i);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#records-body')?.innerText.includes('Savings account')
    );
    await page.locator('#view-all-button').click();
    assert.ok((await page.locator('#records-body').innerText()).includes('Home loan'),
        'view all should reveal the sixth imported record');
    assert.match(await page.locator('#net-worth').innerText(), /63,30,000/,
        'CSV import should recalculate totals from all imported rows');
    assert.ok((await page.locator('#saved-goals-list').innerText()).includes('Browser test emergency fund'),
        'CSV import must preserve saved goals');
    process.stdout.write('PASS: CSV import replaces financial records, recalculates totals, and preserves saved goals.\n');

    await page.locator('#import-csv-file').setInputFiles({
        name: 'invalid-records.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Name,Value\nCash,1')
    });
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#toast')?.textContent.includes('Unsupported CSV format')
    );
    assert.ok((await page.locator('#records-body').innerText()).includes('Savings account'),
        'invalid CSV must not overwrite imported records');
    assert.ok((await page.locator('#saved-goals-list').innerText()).includes('Browser test emergency fund'),
        'invalid CSV must not alter saved goals');
    process.stdout.write('PASS: malformed CSV is rejected without changing records or saved goals.\n');

    const [goalBackupDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-button').click()
    ]);
    const goalBackupPath = join(temporaryDirectory, 'goal-aware-backup.json');
    await goalBackupDownload.saveAs(goalBackupPath);
    const goalBackup = JSON.parse(await readFile(goalBackupPath, 'utf8'));
    assert.equal(goalBackup.schemaVersion, 4, 'private backup should use schema v4 and include saved goals and history');
    assert.equal(goalBackup.goals.length, 1, 'backup should include the saved goal collection');
    assert.equal(goalBackup.goals[0].name, 'Browser test emergency fund');
    assert.equal(goalBackup.goals[0].currentAmount, 125000);
    assert.equal(goalBackup.historicalSnapshots.length, 1, 'goal backup should also preserve historical snapshots');
    process.stdout.write('PASS: private backup includes saved goals and their current progress.\n');

    const priorWorkspaceBeforeHistoryFailure = await page.evaluate(() => ({
        records: globalThis.localStorage.getItem('pfo-os.dashboard.private.v1'),
        goals: globalThis.localStorage.getItem('pfo-os.dashboard.goals.v1'),
        history: globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1')
    }));
    await page.evaluate(() => {
        const originalSetItem = globalThis.Storage.prototype.setItem;
        globalThis.__pfoOriginalSetItem = originalSetItem;
        let failHistoryWriteOnce = true;
        globalThis.Storage.prototype.setItem = function (key, value) {
            if (failHistoryWriteOnce && key === 'pfo-os.historical-snapshots.v1') {
                failHistoryWriteOnce = false;
                throw new globalThis.DOMException('Simulated history storage quota failure', 'QuotaExceededError');
            }
            return originalSetItem.call(this, key, value);
        };
    });
    const failedHistoryRestoreConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-file').setInputFiles({
        name: 'history-write-failure.json', mimeType: 'application/json', buffer: await readFile(goalBackupPath)
    });
    assert.match(await failedHistoryRestoreConfirmation, /historical snapshots/i);
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.textContent.includes('Could not save historical snapshots.'));
    const afterFailedHistoryRestore = await page.evaluate(() => ({
        records: globalThis.localStorage.getItem('pfo-os.dashboard.private.v1'),
        goals: globalThis.localStorage.getItem('pfo-os.dashboard.goals.v1'),
        history: globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1')
    }));
    assert.deepEqual(afterFailedHistoryRestore, priorWorkspaceBeforeHistoryFailure,
        'failed history persistence must roll back records, goals, and historical snapshots together');
    await page.evaluate(() => {
        globalThis.Storage.prototype.setItem = globalThis.__pfoOriginalSetItem || globalThis.Storage.prototype.setItem;
        delete globalThis.__pfoOriginalSetItem;
    });
    process.stdout.write('PASS: a history storage failure rolls back the complete workspace restore.\n');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#switch-private-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund'));
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 1,
        'historical snapshot should persist across page reloads');
    assert.ok((await page.locator('#historical-snapshot-rows').innerText()).includes('31 Dec 2023'),
        'reloaded history should retain the explicitly captured valuation date');
    assert.match(await page.locator('#saved-goals-list').innerText(), /1,25,000 saved/,
        'saved goal progress should persist across reloads');
    await page.locator('[data-goal-edit]').click();
    assert.equal(await page.locator('#goal-save-button').innerText(), 'Update saved goal');
    await page.locator('#goal-current').fill('250000');
    await page.locator('#goal-save-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('2,50,000 saved'));
    process.stdout.write('PASS: saved goal can be edited and progress updates persist.\n');

    const cancelledDeleteConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.dismiss();
            resolve(message);
        });
    });
    await page.locator('[data-goal-delete]').click();
    assert.match(await cancelledDeleteConfirmation, /Delete saved goal "Browser test emergency fund"/);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund')
    );
    assert.match(await page.locator('#saved-goals-count').innerText(), /1 goal/,
        'cancelling deletion should leave the saved goal in the list');
    assert.match(await page.locator('#saved-goals-list').innerText(), /2,50,000 saved/,
        'cancelling deletion should preserve the saved goal progress');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#switch-private-button').click();
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund')
    );
    assert.match(await page.locator('#saved-goals-list').innerText(), /2,50,000 saved/,
        'a cancelled deletion must preserve the persisted goal across reload');
    process.stdout.write('PASS: cancelling saved-goal deletion preserves the goal and persisted progress.\n');

    const deleteGoalConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('[data-goal-delete]').click();
    assert.match(await deleteGoalConfirmation, /Delete saved goal "Browser test emergency fund"/);
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-empty')?.hidden === false);
    assert.match(await page.locator('#saved-goals-count').innerText(), /0 goals/);
    process.stdout.write('PASS: saved goal can be deleted after confirmation.\n');

    const restoreGoalConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-file').setInputFiles({
        name: 'goal-aware-backup.json',
        mimeType: 'application/json',
        buffer: await readFile(goalBackupPath)
    });
    assert.match(await restoreGoalConfirmation, /Importing replaces records, goals, cash-flow transactions, budgets, and historical snapshots in this browser/i);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund')
    );
    assert.match(await page.locator('#saved-goals-list').innerText(), /1,25,000 saved/,
        'restoring a backup should recover saved-goal progress');
    process.stdout.write('PASS: importing a goal-aware backup restores saved goals and progress.\n');

    const finalDeleteConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            await dialog.accept();
            resolve();
        });
    });
    await page.locator('[data-goal-delete]').click();
    await finalDeleteConfirmation;
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-empty')?.hidden === false);

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#switch-private-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-count')?.textContent === '0 goals');

    const customCategoryConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const message = dialog.message();
            await dialog.accept();
            resolve(message);
        });
    });
    await page.locator('#import-csv-file').setInputFiles({
        name: 'custom-category.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Name,Category,Type,Value,Currency\r\n"Private equity holding","Private equity","asset",1000,"INR"\r\n')
    });
    assert.match(await customCategoryConfirmation, /replace all financial records in your private workspace/i);
    await page.waitForFunction(() => globalThis.document.querySelector('#records-body')?.innerText.includes('Private equity holding'));
    await page.locator('[data-edit]').first().click();
    assert.equal(await page.locator('#record-category').inputValue(), 'Private equity',
        'editing an imported record must preserve its non-standard category');
    await page.locator('#record-name').fill('Private equity holding updated');
    await page.locator('#record-form button[type="submit"]').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#records-body')?.innerText.includes('Private equity holding updated'));
    assert.ok((await page.locator('#records-body').innerText()).includes('Private equity'),
        'saving an edited imported record must not silently replace its category');
    process.stdout.write('PASS: editing an imported record preserves its custom category.\n');

    let reachedFireInput = false;
    for (let index = 0; index < 40; index += 1) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => globalThis.document.activeElement?.id === 'fire-current-portfolio')) {
            reachedFireInput = true;
            break;
        }
    }
    assert.equal(reachedFireInput, true, 'keyboard tab order should reach the first FIRE planner input');
    await page.setViewportSize({ width: 320, height: 800 });
    const viewport = await page.evaluate(() => ({
        width: globalThis.window.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        offenders: [...globalThis.document.querySelectorAll('body *')]
            .map((element) => ({ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 80),
                left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }))
            .filter((element) => element.right > globalThis.window.innerWidth + 1 || element.left < -1)
            .slice(0, 12)
    }));
    assert.ok(viewport.documentWidth <= viewport.width,
        `narrow viewport should not cause page-level horizontal overflow (viewport ${viewport.width}, document ${viewport.documentWidth}, offenders ${JSON.stringify(viewport.offenders)})`);
    process.stdout.write('PASS: keyboard tab order reaches FIRE controls and 320px layout has no page-level horizontal overflow.\n');

    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.locator('#fire-annual-contribution').fill('500000');
    await page.getByLabel('Years until retirement').fill('0');
    await page.locator('#fire-return').fill('7');
    await page.getByLabel('Annual inflation (%)').fill('3');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByLabel('Initial withdrawal rate (%)').fill('4');
    await page.getByRole('button', { name: 'Calculate readiness' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fire-results').isVisible(), true,
        'zero years until retirement should be a valid boundary scenario');
    assert.equal((await page.locator('#fire-projected-portfolio').innerText()).replaceAll('₹', '').replaceAll(',', '').trim(), '10000000',
        'with zero years, projected portfolio should equal the current portfolio regardless of annual contribution');
    assert.equal((await page.locator('#fire-target-corpus').innerText()).replaceAll('₹', '').replaceAll(',', '').trim(), '15000000',
        'with zero years, target corpus should use current annual spending without future inflation');
    process.stdout.write('PASS: zero-year FIRE boundary preserves current portfolio and applies no future inflation.\n');

    await page.locator('#fire-reset-button').click();
    assert.equal(await page.locator('#fire-current-portfolio').inputValue(), '0',
        'reset should restore the current portfolio default');
    assert.equal(await page.locator('#fire-annual-contribution').inputValue(), '0',
        'reset should restore the annual contribution default');
    assert.equal(await page.locator('#fire-years').inputValue(), '10',
        'reset should restore the years-to-retirement default');
    assert.equal(await page.locator('#fire-return').inputValue(), '7',
        'reset should restore the expected return default');
    assert.equal(await page.locator('#fire-inflation').inputValue(), '3',
        'reset should restore the inflation default');
    assert.equal(await page.locator('#fire-spending').inputValue(), '0',
        'reset should restore the retirement spending default');
    assert.equal(await page.locator('#fire-withdrawal').inputValue(), '4',
        'reset should restore the withdrawal-rate default');
    assert.equal(await page.locator('#fire-contribution-timing').inputValue(), 'end',
        'reset should restore end-of-year contribution timing');
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'reset should clear the previous FIRE result');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'reset should clear the required-contribution result');
    assert.equal(await page.locator('#fire-compare-results').isHidden(), true,
        'reset should clear scenario-comparison results');
    assert.equal(await page.locator('#fire-download-report').isVisible(), false,
        'reset should hide the single-scenario report action');
    assert.equal(await page.locator('#fire-download-comparison-report').isVisible(), false,
        'reset should hide the comparison report action');
    assert.equal(await page.locator('#fire-validation').isHidden(), true,
        'reset should clear validation messages');
    process.stdout.write('PASS: FIRE reset restores defaults and clears stale results and report actions.\n');

    await page.locator('#cagr-beginning-value').fill('1000');
    await page.locator('#cagr-ending-value').fill('1331');
    await page.locator('#cagr-periods').fill('3');
    await page.locator('#cagr-form button[type="submit"]').click();
    assert.equal(await page.locator('#cagr-rate-result').innerText(), '10%',
        'CAGR calculator should annualize value growth over the stated period');
    assert.equal((await page.locator('#cagr-beginning-result').innerText()).replace(/[^0-9]/g, ''), '1000');
    assert.equal((await page.locator('#cagr-ending-result').innerText()).replace(/[^0-9]/g, ''), '1331');
    const [cagrCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cagr-export-csv').click()
    ]);
    assert.equal(cagrCsvDownload.suggestedFilename(), 'pfo-cagr-result.csv');
    const cagrCsvPath = join(temporaryDirectory, 'pfo-cagr-result.csv');
    await cagrCsvDownload.saveAs(cagrCsvPath);
    const cagrCsv = await readFile(cagrCsvPath, 'utf8');
    assert.ok(cagrCsv.includes('Beginning value,1000'), 'CAGR CSV should include beginning value');
    assert.ok(cagrCsv.includes('Ending value,1331'), 'CAGR CSV should include ending value');
    assert.ok(cagrCsv.includes('Elapsed years,3'), 'CAGR CSV should include elapsed years');
    assert.ok(cagrCsv.includes('Compound annual growth rate (%),10'), 'CAGR CSV should include annualized rate');

    // Keyboard submission must respect native required-field validation and never leave stale results visible.
    await page.locator('#cagr-beginning-value').fill('');
    assert.equal(await page.locator('#cagr-results').isHidden(), true,
        'editing the required beginning value should clear stale CAGR results');
    const calculateCagrButton = page.getByRole('button', { name: 'Calculate CAGR' });
    await calculateCagrButton.focus();
    await page.keyboard.press('Enter');
    assert.equal(
        await page.locator('#cagr-beginning-value').evaluate((input) => input === globalThis.document.activeElement),
        true,
        'keyboard submission should focus the invalid required beginning value'
    );
    assert.equal(await page.locator('#cagr-results').isHidden(), true,
        'invalid keyboard submission must not restore stale CAGR results');
    await page.locator('#cagr-beginning-value').fill('1000');
    process.stdout.write('PASS: invalid keyboard-submitted CAGR assumptions clear stale results and focus the required beginning value.\n');

    await page.locator('#cagr-ending-value').fill('1400');
    assert.equal(await page.locator('#cagr-results').isHidden(), true,
        'editing CAGR inputs should invalidate the previous result');
    assert.equal(await page.locator('#cagr-export-csv').isDisabled(), true,
        'editing CAGR inputs should disable stale CSV export');
    await page.locator('#cagr-reset').click();
    assert.equal(await page.locator('#cagr-results').isHidden(), true,
        'CAGR reset should clear previous results');

    await page.locator('#growth-initial-value').fill('100000');
    await page.locator('#growth-annual-contribution').fill('12000');
    await page.locator('#growth-annual-rate').fill('7');
    await page.locator('#growth-years').fill('10');
    await page.locator('#growth-contribution-timing').selectOption('end');
    await page.locator('#growth-projection-form button[type="submit"]').click();
    const endOfYearProjection = Number((await page.locator('#growth-projected-value').innerText()).replace(/[^0-9]/g, ''));
    assert.equal((await page.locator('#growth-total-contributions').innerText()).replace(/[^0-9]/g, ''), '220000',
        'growth projection should total the starting amount and annual contributions');
    assert.ok(Number((await page.locator('#growth-estimated-growth').innerText()).replace(/[^0-9]/g, '')) > 0,
        'growth projection should report growth above contributed capital for positive return assumptions');
    assert.equal(await page.locator('#growth-schedule-rows tr').count(), 11,
        '10-year projection should render year zero plus 10 annual rows');
    assert.equal((await page.locator('#growth-schedule-rows tr').last().locator('td').nth(1).innerText()).replace(/[^0-9]/g, ''),
        (await page.locator('#growth-projected-value').innerText()).replace(/[^0-9]/g, ''),
        'final schedule row should reconcile to the summary future value');
    const [growthCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#growth-export-csv').click()
    ]);
    assert.equal(growthCsvDownload.suggestedFilename(), 'pfo-growth-projection.csv');
    const growthCsvPath = join(temporaryDirectory, 'pfo-growth-projection.csv');
    await growthCsvDownload.saveAs(growthCsvPath);
    const growthCsv = await readFile(growthCsvPath, 'utf8');
    assert.equal(growthCsv.trim().split(/\r?\n/).length, 12,
        'growth schedule CSV should include a header and 11 annual rows');
    assert.ok(growthCsv.includes('Year,Projected value,Total contributed capital,Estimated growth'),
        'growth schedule CSV should have stable column headings');
    await page.locator('#growth-contribution-timing').selectOption('beginning');
    await page.locator('#growth-projection-form button[type="submit"]').click();
    const beginningOfYearProjection = Number((await page.locator('#growth-projected-value').innerText()).replace(/[^0-9]/g, ''));
    assert.ok(beginningOfYearProjection > endOfYearProjection,
        'beginning-of-year contributions should compound for one additional period');
    await page.locator('#growth-years').fill('0');
    await page.locator('#growth-projection-form button[type="submit"]').click();
    assert.equal((await page.locator('#growth-projected-value').innerText()).replace(/[^0-9]/g, ''), '100000',
        'zero years should preserve the starting amount without future contributions');
    await page.locator('#growth-reset').click();
    assert.equal(await page.locator('#growth-results').isHidden(), true,
        'growth projection reset should clear previous results');
    assert.equal(await page.locator('#growth-schedule-rows tr').count(), 0,
        'growth projection reset should clear annual schedule rows');
    assert.equal(await page.locator('#growth-export-csv').isDisabled(), true,
        'growth projection reset should disable CSV export until another calculation');

    const investmentFlow0 = page.locator('#investment-cash-flows .investment-flow-row').nth(0);
    await investmentFlow0.locator('.investment-flow-date').fill('2025-01-01');
    await investmentFlow0.locator('.investment-flow-amount').fill('-1000');
    await page.locator('#investment-add-flow').click();
    const investmentFlow1 = page.locator('#investment-cash-flows .investment-flow-row').nth(1);
    await investmentFlow1.locator('.investment-flow-date').fill('2026-01-01');
    await investmentFlow1.locator('.investment-flow-amount').fill('1100');
    const calculateInvestmentPerformanceButton = page.getByRole('button', { name: 'Calculate performance' });
    await calculateInvestmentPerformanceButton.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#investment-performance-results').isVisible(), true,
        'keyboard submission should display the calculated investment-performance results');
    assert.equal((await page.locator('#investment-gross-contributions').innerText()).replace(/[^0-9]/g, ''), '1000',
        'investment performance should total negative cash flows as contributions');
    assert.equal((await page.locator('#investment-gross-proceeds').innerText()).replace(/[^0-9]/g, ''), '1100',
        'investment performance should total positive cash flows as proceeds');
    assert.equal((await page.locator('#investment-net-gain').innerText()).replace(/[^0-9]/g, ''), '100',
        'investment performance should reconcile net gain');
    assert.equal(await page.locator('#investment-simple-return').innerText(), '10%',
        'investment performance should calculate simple return on contributions');
    assert.equal(await page.locator('#investment-xirr').innerText(), '10%',
        'investment performance should calculate annualized money-weighted return');
    const [investmentCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#investment-performance-export-csv').click()
    ]);
    assert.equal(investmentCsvDownload.suggestedFilename(), 'pfo-investment-performance.csv');
    const investmentCsvPath = join(temporaryDirectory, 'pfo-investment-performance.csv');
    await investmentCsvDownload.saveAs(investmentCsvPath);
    const investmentCsv = await readFile(investmentCsvPath, 'utf8');
    assert.ok(investmentCsv.includes('Gross contributions,1000'), 'investment CSV should include gross contributions');
    assert.ok(investmentCsv.includes('Annualized money-weighted return (XIRR %),10'), 'investment CSV should include annualized return');
    assert.ok(investmentCsv.includes('2025-01-01,-1000'), 'investment CSV should preserve dated contribution signs');
    assert.ok(investmentCsv.includes('2026-01-01,1100'), 'investment CSV should preserve dated receipt signs');
    const [investmentHtmlDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#investment-performance-export-html').click()
    ]);
    assert.equal(investmentHtmlDownload.suggestedFilename(), 'pfo-investment-performance.html');
    const investmentHtmlPath = join(temporaryDirectory, 'pfo-investment-performance.html');
    await investmentHtmlDownload.saveAs(investmentHtmlPath);
    const investmentHtml = await readFile(investmentHtmlPath, 'utf8');
    assert.ok(investmentHtml.includes('Investment performance'), 'HTML report should include the performance summary');
    assert.ok(investmentHtml.includes('Gross contributions'), 'HTML report should include contributions');
    assert.ok(investmentHtml.includes('2025-01-01'), 'HTML report should include the first dated cash flow');
    assert.ok(investmentHtml.includes('2026-01-01'), 'HTML report should include the terminal cash flow date');
    assert.doesNotMatch(investmentHtml, /<script\b|<iframe\b|https?:\/\//i,
        'HTML report must be self-contained and script-free');
    await assertOfflineReport(investmentHtmlDownload, 'pfo-investment-performance.html', 'Investment performance');
    await assertOpensWithoutNetwork(browser, investmentHtmlPath, 'Investment performance');
    process.stdout.write('PASS: investment performance HTML report opens offline with the exact signed cash flows.\\n');

    const [investmentCashFlowsDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#investment-cash-flows-export-csv').click()
    ]);
    assert.equal(investmentCashFlowsDownload.suggestedFilename(), 'pfo-investment-cash-flows.csv');
    const investmentCashFlowsPath = join(temporaryDirectory, 'pfo-investment-cash-flows.csv');
    await investmentCashFlowsDownload.saveAs(investmentCashFlowsPath);
    const investmentCashFlowsCsv = await readFile(investmentCashFlowsPath, 'utf8');
    assert.match(investmentCashFlowsCsv, /^"date","amount"\r\n/u,
        'cash-flow export should use the import-compatible date,amount schema');
    assert.ok(investmentCashFlowsCsv.includes('"2025-01-01","-1000"'),
        'cash-flow export should preserve negative contribution signs');
    assert.ok(investmentCashFlowsCsv.includes('"2026-01-01","1100"'),
        'cash-flow export should preserve positive receipt signs');
    await page.locator('#investment-add-flow').click();
    assert.equal(await page.locator('#investment-performance-export-csv').isDisabled(), true,
        'adding a cash flow should invalidate the prior result and disable export');
    assert.equal(await page.locator('#investment-cash-flows-export-csv').isDisabled(), true,
        'adding a cash flow should disable the reusable cash-flow export too');
    const investmentFlow2 = page.locator('#investment-cash-flows .investment-flow-row').nth(2);
    await investmentFlow2.locator('.investment-flow-date').fill('2026-06-01');
    await investmentFlow2.locator('.investment-flow-amount').fill('-100');
    await page.locator('#investment-performance-form button[type="submit"]').click();
    assert.equal(await page.locator('#investment-performance-validation').isVisible(), true,
        'investment performance should reject ambiguous multiple sign changes');
    await page.locator('#investment-performance-reset').click();
    assert.equal(await page.locator('#investment-performance-results').isHidden(), true,
        'investment performance reset should clear previous results');
    assert.equal(await page.locator('#investment-performance-export-csv').isDisabled(), true,
        'investment performance reset should disable CSV export');
    assert.equal(await page.locator('#investment-cash-flows .investment-flow-row').count(), 1,
        'investment performance reset should restore one empty cash-flow row');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#investment-import-csv').setInputFiles({
        name: 'investment-cash-flows.csv',
        mimeType: 'text/csv',
        buffer: await readFile(investmentCashFlowsPath)
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#investment-performance-import-status')?.innerText.includes('Imported 2 investment cash flows from CSV.'));
    assert.equal(await page.locator('#investment-cash-flows .investment-flow-row').count(), 2,
        'investment CSV import should replace inputs with the imported dated cash flows');
    assert.equal(await page.locator('#investment-cash-flows .investment-flow-row').nth(0).locator('.investment-flow-amount').inputValue(), '-1000',
        'investment CSV import should preserve negative contribution signs');
    await page.locator('#investment-performance-form button[type="submit"]').click();
    assert.equal(await page.locator('#investment-xirr').innerText(), '10%',
        'imported dated cash flows should calculate the same annualized return as manual entry');

    await page.locator('#investment-import-csv').setInputFiles({
        name: 'invalid-investment-cash-flows.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,amount\r\n2025-02-30,-100\r\n')
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#investment-performance-import-status')?.innerText.includes('invalid calendar date'));
    assert.equal(await page.locator('#investment-cash-flows .investment-flow-row').count(), 2,
        'invalid investment CSV must preserve the previously entered cash flows');

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('#investment-import-csv').setInputFiles({
        name: 'cancelled-investment-cash-flows.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,amount\r\n2025-01-01,-500\r\n')
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#investment-performance-import-status')?.innerText.includes('CSV import cancelled.'));
    assert.equal(await page.locator('#investment-cash-flows .investment-flow-row').count(), 2,
        'cancelling investment CSV replacement must preserve the existing cash flows');

    await page.locator('#loan-outstanding-principal').fill('1200');
    await page.locator('#loan-annual-rate').fill('0');
    await page.locator('#loan-monthly-payment').fill('500');
    await page.locator('#loan-first-payment-date').fill('2026-01-31');
    await page.locator('#loan-amortization-form button[type="submit"]').click();
    assert.equal((await page.locator('#loan-total-interest').innerText()).replace(/[^0-9]/g, ''), '0',
        'zero-interest loan should have no interest');
    assert.equal((await page.locator('#loan-total-payments').innerText()).replace(/[^0-9]/g, ''), '1200',
        'loan schedule should cap the final payment at the remaining balance');
    assert.equal((await page.locator('#loan-remaining-balance').innerText()).replace(/[^0-9]/g, ''), '0',
        'fully amortized loan should show no remaining balance');
    assert.equal(await page.locator('#loan-schedule-rows tr').count(), 3,
        'loan calculator should show each scheduled payment when fewer than 12 exist');
    const [loanScheduleDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#loan-export-schedule').click()
    ]);
    assert.equal(loanScheduleDownload.suggestedFilename(), 'pfo-loan-amortization.csv');
    const loanSchedulePath = join(temporaryDirectory, 'pfo-loan-amortization.csv');
    await loanScheduleDownload.saveAs(loanSchedulePath);
    const loanScheduleCsv = await readFile(loanSchedulePath, 'utf8');
    assert.ok(loanScheduleCsv.includes('2026-01-31T00:00:00.000Z'), 'loan CSV should preserve the first payment date');
    assert.ok(loanScheduleCsv.includes('"200"'), 'loan CSV should include the capped final payment');
    await page.locator('#loan-monthly-payment').fill('0');
    await page.locator('#loan-amortization-form button[type="submit"]').click();
    assert.equal(await page.locator('#loan-validation').isVisible(), true,
        'loan calculator should reject a payment that cannot amortize a non-zero balance');
    await page.locator('#loan-reset').click();
    assert.equal(await page.locator('#loan-estimate-results').isHidden(), true,
        'loan reset should clear prior results');

    await page.locator('#taxable-income').fill('100000');
    await page.locator('#tax-add-bracket').click();
    await page.locator('#tax-add-bracket').click();
    const firstTaxBracket = page.locator('#tax-brackets .tax-bracket-row').nth(0);
    await firstTaxBracket.locator('.tax-bracket-bound').fill('25000');
    await firstTaxBracket.locator('.tax-bracket-rate').fill('0');
    const secondTaxBracket = page.locator('#tax-brackets .tax-bracket-row').nth(1);
    await secondTaxBracket.locator('.tax-bracket-bound').fill('50000');
    await secondTaxBracket.locator('.tax-bracket-rate').fill('10');
    const finalTaxBracket = page.locator('#tax-brackets .tax-bracket-row').nth(2);
    await finalTaxBracket.locator('.tax-bracket-rate').fill('20');
    await page.locator('#tax-estimator-form button[type="submit"]').click();
    assert.equal((await page.locator('#tax-estimated-tax').innerText()).replace(/[^0-9]/g, ''), '12500',
        'tax estimator should apply marginal rates only within each supplied bracket');
    assert.equal(await page.locator('#tax-effective-rate').innerText(), '12.5%',
        'tax estimator should show the effective tax rate');
    const [taxCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#tax-export-csv').click()
    ]);
    assert.equal(taxCsvDownload.suggestedFilename(), 'pfo-tax-estimate.csv');
    const taxCsvPath = join(temporaryDirectory, 'pfo-tax-estimate.csv');
    await taxCsvDownload.saveAs(taxCsvPath);
    const taxCsv = await readFile(taxCsvPath, 'utf8');
    assert.ok(taxCsv.includes('Taxable income,100000'), 'tax CSV should include taxable income');
    assert.ok(taxCsv.includes('Estimated tax,12500'), 'tax CSV should include the estimate');
    assert.ok(taxCsv.includes('25000,0'), 'tax CSV should include supplied bracket assumptions');
    assert.ok(taxCsv.includes('No upper limit,20'), 'tax CSV should identify the final open-ended bracket');
    await secondTaxBracket.locator('.tax-bracket-bound').fill('10000');
    assert.equal(await page.locator('#tax-estimate-results').isHidden(), true,
        'editing tax inputs should invalidate the previously calculated result');
    assert.equal(await page.locator('#tax-export-csv').isDisabled(), true,
        'editing tax inputs should disable stale CSV export');
    await page.locator('#tax-estimator-form button[type="submit"]').click();
    assert.equal(await page.locator('#tax-validation').isVisible(), true,
        'tax estimator should reject non-increasing bracket thresholds');
    await page.locator('#tax-reset').click();
    assert.equal(await page.locator('#tax-estimate-results').isHidden(), true,
        'tax reset should clear previous results');
    assert.equal(await page.locator('#tax-export-csv').isDisabled(), true,
        'tax reset should disable export until another valid estimate');
    assert.equal(await page.locator('#tax-brackets .tax-bracket-row').count(), 1,
        'tax reset should restore a single final bracket');
    process.stdout.write('PASS: progressive tax estimator applies caller-supplied marginal brackets and validates bad schedules.\n');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#cash-flow-import-csv').setInputFiles({
        name: 'cash-flow-import.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,type,category,description,amount,recurring\r\n"2026-10-20","income","Salary","CSV import, test",50000,"true"\r\n')
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-message')?.innerText.includes('Imported 1 cash flow transactions from CSV'));
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '50000',
        'CSV import should replace the ledger with the validated imported income');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1,
        'CSV import should create exactly the imported transaction');
    assert.match(await page.locator('#cash-flow-rows').innerText(), /CSV import, test/,
        'CSV import should preserve quoted commas in transaction descriptions');
    assert.match(await page.locator('#cash-flow-message').innerText(), /Imported 1 cash flow transactions from CSV/,
        'CSV import should announce successful replacement');
    process.stdout.write('PASS: cash-flow CSV import validates exported schema, previews replacement, and preserves quoted fields.\n');

    const appendConfirmation = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
            const confirmationMessage = dialog.message();
            await dialog.accept();
            resolve(confirmationMessage);
        });
    });
    await page.locator('#cash-flow-append-csv').setInputFiles({
        name: 'cash-flow-append.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('date,type,category,description,amount,recurring\r\n"2026-10-20","income","Salary","CSV import, test",50000,"true"\r\n')
    });
    const appendConfirmationMessage = await appendConfirmation;
    assert.match(appendConfirmationMessage, /CSV append preview: 1 transaction/);
    assert.match(appendConfirmationMessage, /Potential exact duplicates against the existing ledger: 1/);
    assert.match(appendConfirmationMessage, /Existing transactions will be kept and the imported transactions appended/);
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-message')?.innerText.includes('Appended 1 cash flow transactions from CSV'));
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '100000',
        'CSV append should add to, not replace, the existing ledger total');
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2,
        'CSV append should preserve the original transaction and add the repeated transaction');
    assert.match(await page.locator('#cash-flow-message').innerText(), /Appended 1 cash flow transactions from CSV/);
    process.stdout.write('PASS: cash-flow CSV append preserves existing transactions and warns about potential duplicates.\n');

    await page.locator('#cash-flow-budget-month').fill('2026-10');
    await page.locator('#cash-flow-budget-category').fill('Groceries');
    await page.locator('#cash-flow-budget-amount').fill('10000');
    await page.locator('#cash-flow-budget-save').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-budget-message')?.innerText.includes('Monthly category budget saved'));
    assert.match(await page.locator('#cash-flow-budget-rows').innerText(), /Groceries[\s\S]*₹10,000[\s\S]*Not spent/,
        'saved budget should appear with zero actual spending');
    await page.locator('#cash-flow-date').fill('2026-10-20');
    await page.locator('#cash-flow-type').selectOption('expense');
    await page.locator('#cash-flow-category').fill('groceries');
    await page.locator('#cash-flow-description').fill('Budget smoke expense');
    await page.locator('#cash-flow-amount').fill('12000');
    await page.locator('#cash-flow-save').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-budget-rows')?.innerText.includes('₹12,000'));
    assert.match(await page.locator('#cash-flow-budget-rows').innerText(), /Groceries[\s\S]*₹10,000[\s\S]*₹12,000[\s\S]*-₹2,000[\s\S]*Over budget/,
        'budget comparison should aggregate category actuals case-insensitively and flag overspending');
    await page.locator('#cash-flow-budget-category').fill('Review <img src=x> category');
    await page.locator('#cash-flow-budget-amount').fill('10000');
    await page.locator('#cash-flow-budget-save').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-budget-message')?.innerText.includes('Monthly category budget saved'));
    await page.locator('#cash-flow-date').fill('2026-10-21');
    await page.locator('#cash-flow-type').selectOption('expense');
    await page.locator('#cash-flow-category').fill('Review <img src=x> category');
    await page.locator('#cash-flow-description').fill('HTML escaping regression expense');
    await page.locator('#cash-flow-amount').fill('12000');
    await page.locator('#cash-flow-save').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-budget-rows')?.innerText.includes('Review <img src=x> category'));
    assert.match(await page.locator('#cash-flow-budget-rows').innerText(), /Over budget/,
        'HTML-looking category text should still participate in normal budget calculations');
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('#cash-flow-budget-rows').innerText(), /Groceries[\s\S]*Over budget/,
        'budget and ledger values should remain available after reload');
    process.stdout.write('PASS: monthly category budgets persist, aggregate recorded expenses, and flag overspending.\n');


    if (await page.locator('#switch-private-button').isVisible()) {
        await page.locator('#switch-private-button').click();
    }
    await page.locator('#goal-name').fill('Monthly review <img src=x onerror=alert(1)> goal');
    await page.locator('#goal-target').fill('500000');
    await page.locator('#goal-current').fill('200000');
    await page.locator('#goal-date').fill('2027-12-31');
    await page.locator('#goal-save-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Monthly review <img src=x onerror=alert(1)> goal'));
    await page.locator('#monthly-review-month').fill('2026-10');
    const [monthlyReviewDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#monthly-review-export-button').click()
    ]);
    assert.equal(monthlyReviewDownload.suggestedFilename(), 'pfo-os-monthly-financial-review-2026-10.html',
        'monthly review export should include the explicitly selected reporting month');
    const monthlyReviewPath = join(temporaryDirectory, monthlyReviewDownload.suggestedFilename());
    await monthlyReviewDownload.saveAs(monthlyReviewPath);
    const monthlyReviewHtml = await readFile(monthlyReviewPath, 'utf8');
    assert.ok(monthlyReviewHtml.includes('Monthly financial review'), 'monthly review should include its report title');
    assert.ok(monthlyReviewHtml.includes('October 2026'), 'monthly review should disclose the selected month');
    assert.ok(monthlyReviewHtml.includes('Groceries'), 'monthly review should include the recorded budget category');
    assert.ok(monthlyReviewHtml.includes('Over budget'), 'monthly review should report the explicit budget overrun');
    assert.ok(monthlyReviewHtml.includes('Monthly review &lt;img src=x onerror=alert(1)&gt; goal'),
        'monthly review should render user-entered goal names as escaped text');
    assert.ok(monthlyReviewHtml.includes('Review &lt;img src=x&gt; category'),
        'monthly review should render user-entered budget and transaction categories as escaped text');
    assert.doesNotMatch(monthlyReviewHtml, /<img\b/i,
        'monthly review must not turn user-entered goal or category text into an HTML element');
    await assertOfflineReport(monthlyReviewDownload, 'pfo-os-monthly-financial-review-2026-10.html', 'Monthly financial review');
    await assertOpensWithoutNetwork(browser, monthlyReviewPath, 'Monthly financial review');
    process.stdout.write('PASS: monthly financial review opens offline and reconciles saved cash flow, budget, and goal data.\\n');

    await page.locator('#annual-review-year').fill('2026');
    const [annualReviewDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#annual-review-export-button').click()
    ]);
    assert.equal(annualReviewDownload.suggestedFilename(), 'pfo-os-annual-financial-review-2026.html',
        'annual review export should include the explicitly selected reporting year');
    const annualReviewPath = join(temporaryDirectory, annualReviewDownload.suggestedFilename());
    await annualReviewDownload.saveAs(annualReviewPath);
    const annualReviewHtml = await readFile(annualReviewPath, 'utf8');
    assert.ok(annualReviewHtml.includes('Annual financial review'), 'annual review should include its report title');
    assert.ok(annualReviewHtml.includes('Month-by-month cash flow'), 'annual review should include monthly totals');
    assert.ok(annualReviewHtml.includes('Groceries'), 'annual review should include recorded categories');
    assert.ok(annualReviewHtml.includes('Monthly review &lt;img src=x onerror=alert(1)&gt; goal'),
        'annual review should escape user-entered goal names');
    assert.doesNotMatch(annualReviewHtml, /<script\b|<iframe\b|<img\b/i,
        'annual review must not create executable or user-injected HTML elements');
    await assertOfflineReport(annualReviewDownload, 'pfo-os-annual-financial-review-2026.html', 'Annual financial review');
    await assertOpensWithoutNetwork(browser, annualReviewPath, 'Annual financial review');
    process.stdout.write('PASS: annual financial review opens offline and aggregates only recorded annual data.\n');

    assert.match(await page.locator('#financial-health-status').innerText(), /^Local data · /,
        'financial health HTML export should only be available after validated private data is displayed');
    const [financialHealthDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-financial-health-html').click()
    ]);
    const financialHealthPath = join(temporaryDirectory, financialHealthDownload.suggestedFilename());
    assert.equal(financialHealthDownload.suggestedFilename(), 'pfo-os-financial-health.html',
        'financial health export should use a stable HTML filename');
    await financialHealthDownload.saveAs(financialHealthPath);
    const financialHealthHtml = await readFile(financialHealthPath, 'utf8');
    assert.ok(financialHealthHtml.includes('Financial health overview'),
        'financial health report should include its title');
    assert.ok(financialHealthHtml.includes('Net worth'), 'financial health report should include balance-sheet summary');
    assert.ok(financialHealthHtml.includes('Savings rate'), 'financial health report should include recorded cash-flow metrics');
    assert.ok(financialHealthHtml.includes('Keep this file private'),
        'financial health report should include a privacy warning');
    assert.doesNotMatch(financialHealthHtml, /<script\\b|<iframe\\b|<img\\b/i,
        'financial health report must not contain executable scripts or injected elements');
    await assertOfflineReport(financialHealthDownload, 'pfo-os-financial-health.html', 'Financial health overview');
    await assertOpensWithoutNetwork(browser, financialHealthPath, 'Financial health overview');
    process.stdout.write('PASS: financial health HTML report exports validated private metrics and opens offline.\\n');

    assert.equal(await page.locator('#saved-goals-export-html').isEnabled(), true,
        'saved goal HTML export should be enabled for validated saved goals in the private workspace');
    const [goalReportDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#saved-goals-export-html').click()
    ]);
    assert.equal(goalReportDownload.suggestedFilename(), 'pfo-saved-goal-progress.html',
        'saved goal report should use a stable filename');
    const goalReportPath = join(temporaryDirectory, goalReportDownload.suggestedFilename());
    await goalReportDownload.saveAs(goalReportPath);
    const goalReportHtml = await readFile(goalReportPath, 'utf8');
    assert.ok(goalReportHtml.includes('Saved goal progress'), 'goal report should include its title');
    assert.ok(goalReportHtml.includes('Combined target'), 'goal report should include combined target totals');
    assert.ok(goalReportHtml.includes('Monthly review &lt;img src=x onerror=alert(1)&gt; goal'),
        'goal report should escape user-entered goal names');
    assert.ok(goalReportHtml.includes('no returns assumed'),
        'goal report should state the monthly pace does not assume returns');
    assert.doesNotMatch(goalReportHtml, /<script\b|<iframe\b|<img\b/i,
        'goal report must not include executable or injected elements');
    await assertOfflineReport(goalReportDownload, 'pfo-saved-goal-progress.html', 'Saved goal progress');
    await assertOpensWithoutNetwork(browser, goalReportPath, 'Saved goal progress');
    process.stdout.write('PASS: saved goal progress HTML report reconciles goals and opens offline.\n');

    const validHistoryBeforeCorruption = await page.evaluate(() => globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1'));
    assert.ok(validHistoryBeforeCorruption, 'private history should be available before the malformed-storage check');
    await page.evaluate(() => globalThis.localStorage.setItem('pfo-os.historical-snapshots.v1', '{invalid'));
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.locator('#switch-private-button').isVisible()) await page.locator('#switch-private-button').click();
    assert.equal(await page.locator('#historical-snapshots-error').isVisible(), true,
        'malformed saved history should produce an explicit recovery message');
    assert.match(await page.locator('#historical-snapshots-error').innerText(), /Saved history could not be validated/);
    assert.equal(await page.locator('#capture-historical-snapshot-button').isDisabled(), true,
        'snapshot capture should be paused while saved history is invalid');
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 0,
        'malformed history should not be presented as valid snapshot data');
    assert.equal(await page.evaluate(() => globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1')), '{invalid',
        'reading malformed history must not overwrite or silently clear the original storage value');
    const historyRecoveryDialogPromise = page.waitForEvent('dialog');
    await page.locator('#import-file').setInputFiles(backupPath);
    const historyRecoveryDialog = await historyRecoveryDialogPromise;
    assert.match(historyRecoveryDialog.message(), /Backup import preview/);
    assert.match(historyRecoveryDialog.message(), /Historical snapshots: 1/);
    await historyRecoveryDialog.accept();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.innerText.includes('Restored full workspace:'));
    assert.equal(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.historical-snapshots.v1') || '[]').length), 1,
        'restoring a valid full-workspace backup should recover history after malformed storage');
    assert.equal(await page.locator('#historical-snapshot-rows tr').count(), 1,
        'backup recovery should restore the historical snapshot row');
    assert.equal(await page.locator('#capture-historical-snapshot-button').isDisabled(), false,
        'snapshot capture should resume after valid history is restored');

    assert.deepEqual(pageErrors, [], 'browser should not report uncaught JavaScript errors');
    process.stdout.write('PASS: no uncaught browser JavaScript errors.\n');
    await context.close();
} catch (error) {
    process.stderr.write('FIRE planner browser smoke test failed.\n');
    throw error;
} finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
