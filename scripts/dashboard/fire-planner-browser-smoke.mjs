import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-fire-browser-'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/`;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
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
    process.stdout.write('PASS: financial summary report downloads with totals, records, and valuation-date limitation.\\n');

    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-required-result').isVisible(), true,
        'required-contribution result should be visible before editing assumptions');
    await page.locator('#fire-inflation').fill('3.5');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'editing a shared assumption must hide the stale required-contribution result');
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'editing a shared assumption must hide stale readiness results');
    process.stdout.write('PASS: editing FIRE assumptions invalidates stale required-contribution and readiness results.\\n');

    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.locator('#fire-annual-contribution').fill('300000');
    await page.getByLabel('Years until retirement').fill('10');
    await page.getByLabel('Expected annual return (%)').fill('7');
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
    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'an invalid required-contribution solve must clear stale results');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'an invalid solve must clear the previous required-contribution message');
    process.stdout.write('PASS: invalid required-contribution submission clears stale results.\n');

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
    process.stdout.write('PASS: narrow comparison layout contains table overflow without widening the page.\\n');
    process.stdout.write('PASS: comparison recalculation and report-action keyboard focus work at 320px.\\n');
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
    await page.getByRole('button', { name: 'Calculate readiness' }).click();
    assert.equal(await page.locator('#fire-results').isVisible(), true,
        'FIRE readiness should remain operable at a 400%-zoom-equivalent viewport');
    assert.equal(await page.locator('#fire-projected-portfolio').isVisible(), true,
        'FIRE results should remain available at a 400%-zoom-equivalent viewport');
    await page.setViewportSize({ width: initialCssViewportWidth, height: 800 });
    process.stdout.write('PASS: FIRE planner reflows and remains operable at a 320 CSS-pixel viewport (400% zoom equivalent from 1280px); this is not a browser-chrome zoom test.\\n');

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.locator('#goal-name').fill('Emergency fund');
    await page.locator('#goal-target').fill('1000000');
    await page.locator('#goal-current').fill('250000');
    await page.locator('#goal-date').fill(futureDate.toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Calculate goal progress' }).click();
    assert.equal(await page.locator('#goal-results').isVisible(), true, 'goal progress results should appear');
    assert.equal((await page.locator('#goal-progress-percent').innerText()).trim(), '25%',
        'goal progress should reflect accumulated amount divided by target');
    assert.equal(await page.locator('#goal-progress-bar').getAttribute('aria-valuetext'), '25 percent of target');
    assert.ok((await page.locator('#goal-monthly-pace-result').innerText()).includes('62,500'),
        'goal results should show an approximate monthly savings pace');
    await page.getByRole('button', { name: 'Clear form' }).click();
    assert.equal(await page.locator('#goal-results').isHidden(), true, 'reset should clear goal results');
    process.stdout.write('PASS: goal tracker calculates accessible progress and reset clears its results.\n');

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
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 2, 'cash flow should list both transactions');
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
    assert.equal(await page.locator('#cash-flow-category-rows tr').count(), 2,
        'cash flow should summarize each category for the selected period');
    const housingCategory = page.locator('#cash-flow-category-rows tr').filter({ hasText: 'Housing' });
    assert.equal((await housingCategory.locator('td').nth(2).innerText()).replace(/[^0-9]/g, ''), '20000',
        'category summary should show expenses in the correct category');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await page.locator('#cash-flow-income-total').innerText()).replace(/[^0-9]/g, ''), '100000',
        'cash flow transactions should persist across reloads');
    const salaryRow = page.locator('#cash-flow-rows tr').filter({ hasText: 'Browser test salary' });
    await salaryRow.getByRole('button', { name: 'Edit Browser test salary' }).click();
    await page.locator('#cash-flow-amount').fill('110000');
    await page.locator('#cash-flow-save').click();
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '90000',
        'editing a transaction should recalculate net cash flow');
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
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#cash-flow-import-json').setInputFiles({
        name: 'cash-flow-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(cashFlowBackup))
    });
    await page.waitForFunction(() => globalThis.document.querySelector('#cash-flow-count')?.innerText === '2 transactions');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '90000',
        'restoring the cash flow backup should replace all transactions with the validated backup');
    const rentRow = page.locator('#cash-flow-rows tr').filter({ hasText: 'Browser test rent' });
    page.once('dialog', (dialog) => dialog.accept());
    await rentRow.getByRole('button', { name: 'Delete Browser test rent' }).click();
    assert.equal(await page.locator('#cash-flow-rows tr').count(), 1, 'deleting a transaction should remove it');
    assert.equal((await page.locator('#cash-flow-net-total').innerText()).replace(/[^0-9]/g, ''), '110000',
        'deleting an expense should recalculate net cash flow');
    process.stdout.write('PASS: local cash flow add, persistence, edit, delete, summaries, and JSON backup/restore work in Chromium.\\n');
    const [cashFlowCsvDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#cash-flow-export-csv').click()
    ]);
    assert.equal(cashFlowCsvDownload.suggestedFilename(), 'pfo-cash-flow.csv');
    const cashFlowCsvPath = join(temporaryDirectory, 'pfo-cash-flow.csv');
    await cashFlowCsvDownload.saveAs(cashFlowCsvPath);
    const cashFlowCsv = await readFile(cashFlowCsvPath, 'utf8');
    assert.match(cashFlowCsv, /"date","type","category","description","amount","recurring"/);
    assert.ok(cashFlowCsv.includes('Browser test salary'));
    process.stdout.write('PASS: cash flow CSV export downloads the current ledger.\\n');

    // Cash-flow tests do not depend on the asset/liability workspace; switch back explicitly for its backup assertions.
    await page.locator('#switch-private-button').click();
    const [backupDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-button').click()
    ]);
    assert.equal(backupDownload.suggestedFilename(), 'pfo-os-financial-records.json');
    const backupPath = join(temporaryDirectory, 'pfo-os-financial-records.json');
    await backupDownload.saveAs(backupPath);
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    assert.equal(backup.schemaVersion, 2, 'private JSON backup should use the goal-aware schema version');
    assert.equal(backup.currency, 'INR', 'JSON backup should declare the workspace currency');
    assert.ok(Array.isArray(backup.records), 'JSON backup should contain a records array');
    assert.deepEqual(backup.goals, [], 'private JSON backup should include an empty goals array when no goals are saved');
    assert.equal(typeof backup.exportedAt, 'string', 'JSON backup should include an export timestamp');
    process.stdout.write('PASS: private workspace JSON backup downloads and contains a valid versioned payload.\n');

    const validBackup = {
        schemaVersion: 1,
        currency: 'INR',
        exportedAt: new Date().toISOString(),
        records: [{ name: 'Imported browser asset', category: 'Investments', type: 'asset', value: 123456 }]
    };
    await page.locator('#import-file').setInputFiles({
        name: 'valid-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(validBackup))
    });
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#records-body')?.innerText.includes('Imported browser asset')
    );
    assert.match(await page.locator('#net-worth').innerText(), /1,23,456/,
        'imported financial records should update the dashboard totals');
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
    assert.match(await dismissedConfirmation, /replace all financial records/i);
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
    assert.match(await acceptedConfirmation, /replace all financial records/i);
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
    process.stdout.write('PASS: a financial goal can be saved with calculated progress and monthly pace in the private workspace.\\n');

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
    process.stdout.write('PASS: CSV import replaces financial records, recalculates totals, and preserves saved goals.\\n');

    await page.locator('#import-csv-file').setInputFiles({
        name: 'invalid-records.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Name,Value\\nCash,1')
    });
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#toast')?.textContent.includes('Unsupported CSV format')
    );
    assert.ok((await page.locator('#records-body').innerText()).includes('Savings account'),
        'invalid CSV must not overwrite imported records');
    assert.ok((await page.locator('#saved-goals-list').innerText()).includes('Browser test emergency fund'),
        'invalid CSV must not alter saved goals');
    process.stdout.write('PASS: malformed CSV is rejected without changing records or saved goals.\\n');

    const [goalBackupDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#export-button').click()
    ]);
    const goalBackupPath = join(temporaryDirectory, 'goal-aware-backup.json');
    await goalBackupDownload.saveAs(goalBackupPath);
    const goalBackup = JSON.parse(await readFile(goalBackupPath, 'utf8'));
    assert.equal(goalBackup.schemaVersion, 2, 'private backup should include saved goals');
    assert.equal(goalBackup.goals.length, 1, 'backup should include the saved goal collection');
    assert.equal(goalBackup.goals[0].name, 'Browser test emergency fund');
    assert.equal(goalBackup.goals[0].currentAmount, 125000);
    process.stdout.write('PASS: private backup includes saved goals and their current progress.\\n');

    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#switch-private-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund'));
    assert.match(await page.locator('#saved-goals-list').innerText(), /1,25,000 saved/,
        'saved goal progress should persist across reloads');
    await page.locator('[data-goal-edit]').click();
    assert.equal(await page.locator('#goal-save-button').innerText(), 'Update saved goal');
    await page.locator('#goal-current').fill('250000');
    await page.locator('#goal-save-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('2,50,000 saved'));
    process.stdout.write('PASS: saved goal can be edited and progress updates persist.\\n');

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
    process.stdout.write('PASS: cancelling saved-goal deletion preserves the goal and persisted progress.\\n');

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
    process.stdout.write('PASS: saved goal can be deleted after confirmation.\\n');

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
    assert.match(await restoreGoalConfirmation, /replace all records and saved goals in your private workspace/i);
    await page.waitForFunction(() =>
        globalThis.document.querySelector('#saved-goals-list')?.innerText.includes('Browser test emergency fund')
    );
    assert.match(await page.locator('#saved-goals-list').innerText(), /1,25,000 saved/,
        'restoring a backup should recover saved-goal progress');
    process.stdout.write('PASS: importing a goal-aware backup restores saved goals and progress.\\n');

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
    process.stdout.write('PASS: editing an imported record preserves its custom category.\\n');

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
    await page.getByLabel('Expected annual return (%)').fill('7');
    await page.getByLabel('Annual inflation (%)').fill('3');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByLabel('Initial withdrawal rate (%)').fill('4');
    await page.getByRole('button', { name: 'Calculate readiness' }).click();
    assert.equal(await page.locator('#fire-results').isVisible(), true,
        'zero years until retirement should be a valid boundary scenario');
    assert.equal((await page.locator('#fire-projected-portfolio').innerText()).replaceAll('₹', '').replaceAll(',', '').trim(), '10000000',
        'with zero years, projected portfolio should equal the current portfolio regardless of annual contribution');
    assert.equal((await page.locator('#fire-target-corpus').innerText()).replaceAll('₹', '').replaceAll(',', '').trim(), '15000000',
        'with zero years, target corpus should use current annual spending without future inflation');
    process.stdout.write('PASS: zero-year FIRE boundary preserves current portfolio and applies no future inflation.\\n');

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
    process.stdout.write('PASS: FIRE reset restores defaults and clears stale results and report actions.\\n');

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
