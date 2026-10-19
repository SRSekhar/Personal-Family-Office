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

    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.locator('#fire-annual-contribution').fill('300000');
    await page.getByLabel('Years until retirement').fill('10');
    await page.getByLabel('Expected annual return (%)').fill('7');
    await page.getByLabel('Annual inflation (%)').fill('3');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByLabel('Initial withdrawal rate (%)').fill('4');

    await page.getByRole('button', { name: 'Calculate readiness' }).click();
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

    const [singleDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download offline HTML report' }).click()
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
    await page.locator('#fire-compare-run').click();
    assert.equal(await page.locator('#fire-compare-results').isVisible(), true, 'comparison results should appear');
    assert.equal(await page.locator('#fire-compare-body tr').count(), 3, 'comparison should render all three scenarios');
    assert.match(await page.locator('#fire-compare-body').innerText(), /Conservative[\s\S]*Baseline[\s\S]*Higher saving/);
    process.stdout.write('PASS: three-scenario comparison renders each scenario in entered order.\n');

    const [comparisonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download comparison report' }).click()
    ]);
    await assertOfflineReport(comparisonDownload, 'pfo-fire-comparison-report.html', 'Conservative');
    const comparisonHtml = await readFile(join(temporaryDirectory, 'pfo-fire-comparison-report.html'), 'utf8');
    assert.ok(comparisonHtml.includes('Baseline') && comparisonHtml.includes('Higher saving'),
        'comparison report should include all three scenario names');
    process.stdout.write('PASS: comparison report downloads with all scenario assumptions and no remote dependencies.\n');

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
    process.stdout.write('PASS: narrow comparison layout contains table overflow without widening the page.\\n');
    await page.setViewportSize({ width: 1280, height: 800 });

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
    await page.getByRole('button', { name: 'Clear form' }).click();
    assert.equal(await page.locator('#goal-results').isHidden(), true, 'reset should clear goal results');
    process.stdout.write('PASS: goal tracker calculates accessible progress and reset clears its results.\n');

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
    process.stdout.write('PASS: a financial goal can be saved with calculated progress in the private workspace.\\n');

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
