import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createDashboardServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
let server;
let browser;
let temporaryDirectory;

try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-statement-browser-'));
    server = createDashboardServer(undefined, { databasePath: join(temporaryDirectory, 'pfo-os.sqlite') });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = 'http://127.0.0.1:' + address.port + '/';

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => {
        // Sandboxed report-preview frames intentionally lack same-origin storage access.
        if (error.message.includes("document is sandboxed and lacks the 'allow-same-origin' flag")) return;
        pageErrors.push(error.message);
    });
    await context.addInitScript(() => {
        const collections = {
            'pfo-os.investment-accounts.v1': [{
                id: 'account-1', name: 'Synthetic brokerage', institution: 'Synthetic broker',
                type: 'Brokerage', currency: 'INR'
            }],
            'pfo-os.investment-instruments.v1': [{
                id: 'instrument-1', name: 'Synthetic equity', type: 'Equity', currency: 'INR'
            }],
            'pfo-os.investment-transactions.v1': [{
                id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
                cashAmount: { amount: -200, currency: 'INR' }, quantity: 2,
                unitPrice: { amount: 100, currency: 'INR' }, date: '2026-10-01T00:00:00.000Z',
                recordedAt: '2026-10-02T00:00:00.000Z'
            }],
            'pfo-os.investment-valuations.v1': []
        };
        for (const [key, value] of Object.entries(collections)) globalThis.localStorage.setItem(key, JSON.stringify(value));
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const controls = page.locator('#investment-statement-evidence-form').locator('input, textarea, button');
    assert.ok(await page.locator('#investment-statement-demo-note').isVisible(),
        'statement evidence must show a private-workspace notice in the hosted/sample workspace');
    assert.equal(await controls.evaluateAll((items) => items.every((item) => item.disabled)), true,
        'statement evidence import controls must be disabled in sample mode');

    await page.locator('#switch-private-button').click();
    assert.equal(await page.locator('#workspace-label').innerText(), 'PRIVATE WORKSPACE');
    await page.waitForFunction(() => globalThis.document.querySelector('#database-storage-status')?.textContent.includes('SQLite ready'));
    assert.equal(await controls.evaluateAll((items) => items.every((item) => !item.disabled)), true,
        'statement evidence controls should be enabled only in the local private workspace');

    const statement = {
        id: 'browser-statement-1', kind: 'transactions', accountId: 'account-1', currency: 'INR',
        periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T23:59:59.000Z',
        statementAsOf: '2026-10-31T00:00:00.000Z', recordedAt: '2026-11-01T00:00:00.000Z',
        sourceName: 'Synthetic browser acceptance statement', statementReference: 'SYNTHETIC-OCT-2026',
        rows: [{
            sourceRowId: 'line-1', effectiveAt: '2026-10-01T00:00:00.000Z',
            instrumentId: 'instrument-1', type: 'Purchase',
            cashAmount: { amount: -200, currency: 'INR' }, quantity: 2, unitPrice: { amount: 100, currency: 'INR' }
        }]
    };
    const ledgerBefore = await page.evaluate(() => ({
        accounts: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-accounts.v1') || '[]'),
        instruments: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-instruments.v1') || '[]'),
        transactions: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-transactions.v1') || '[]'),
        valuations: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-valuations.v1') || '[]')
    }));
    await page.locator('#investment-statement-json').fill(JSON.stringify(statement));
    await page.locator('#investment-statement-evidence-form button[type="submit"]').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#investment-statement-status')?.textContent.includes('saved.'));
    assert.equal(await page.locator('#investment-statement-evidence-rows tr').count(), 1,
        'the immutable statement evidence should appear in the saved evidence table');
    await page.locator('#investment-statement-run').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#investment-statement-result-summary')?.textContent.includes('1 reconciled'));
    assert.match(await page.locator('#investment-statement-result-rows').innerText(), /matched/);
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#investment-statement-export-csv').click()
    ]);
    assert.equal(download.suggestedFilename(), 'pfo-investment-statement-reconciliation.csv');
    const csvPath = join(temporaryDirectory, download.suggestedFilename());
    await download.saveAs(csvPath);
    const csv = await readFile(csvPath, 'utf8');
    assert.match(csv, /browser-statement-1/);
    assert.match(csv, /transaction-1/);
    assert.match(csv, /matched/);
    process.stdout.write('PASS: normalized transaction evidence imports privately, reconciles, and exports CSV.\n');

    const ledgerAfter = await page.evaluate(() => ({
        accounts: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-accounts.v1') || '[]'),
        instruments: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-instruments.v1') || '[]'),
        transactions: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-transactions.v1') || '[]'),
        valuations: JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-valuations.v1') || '[]')
    }));
    assert.deepEqual(ledgerAfter, ledgerBefore, 'statement reconciliation must not mutate the investment ledger');

    await page.locator('#database-save-button').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.textContent.includes('Complete private workspace saved'));
    const saved = await page.evaluate(async () => {
        const response = await globalThis.fetch('/api/v1/workspace');
        if (!response.ok) throw new Error('Could not read the saved SQLite workspace.');
        return (await response.json()).payload;
    });
    assert.equal(saved.schemaVersion, 13);
    assert.deepEqual(saved.investmentStatementEvidence, [statement],
        'SQLite schema v13 should persist the exact immutable statement evidence');
    const restoreDialogPromise = page.waitForEvent('dialog');
    await page.locator('#database-restore-button').click();
    const restoreDialog = await restoreDialogPromise;
    assert.match(restoreDialog.message(), /Backup import preview/);
    await restoreDialog.accept();
    await page.waitForFunction(() => globalThis.document.querySelector('#toast')?.textContent.includes('Restored full workspace from the local SQLite database'));
    assert.deepEqual(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-statement-evidence.v1') || '[]')),
        [statement], 'SQLite restore should preserve the statement evidence collection');
    assert.deepEqual(await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem('pfo-os.investment-transactions.v1') || '[]')), [{
        id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
        cashAmount: { amount: -200, currency: 'INR' }, quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
        date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z'
    }], 'SQLite round-trip must not change existing ledger transactions');
    process.stdout.write('PASS: SQLite schema v13 save/restore round-trips statement evidence without ledger mutation.\n');

    await page.locator('#switch-demo-button').click();
    assert.ok(await page.locator('#investment-statement-demo-note').isVisible());
    assert.equal(await controls.evaluateAll((items) => items.every((item) => item.disabled)), true,
        'switching back to sample mode must disable statement evidence import');
    assert.deepEqual(pageErrors, [], 'statement reconciliation browser workflow must not produce uncaught JavaScript errors');
    process.stdout.write('PASS: statement reconciliation remains isolated from the sample workspace.\n');
    await context.close();
} catch (error) {
    process.stderr.write('Investment statement reconciliation browser smoke test failed.\n');
    throw error;
} finally {
    if (browser) await browser.close();
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
