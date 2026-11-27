import assert from 'node:assert/strict';
/* global fetch */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import process from 'node:process';
import { createDashboardServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
let server;
let browser;
let temporaryDirectory;

try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-backtesting-backup-browser-'));
    const backupDirectory = join(temporaryDirectory, 'managed-backups');
    const dataset = {
        id: 'synthetic-nse-daily-fixture',
        version: 1,
        observationCount: 2,
        byteLength: 256,
        importedAt: '2026-11-26T00:00:00.000Z',
        rawArtifactDigest: 'a'.repeat(64),
        normalizedContentDigest: 'b'.repeat(64)
    };
    const workspace = {
        listDatasets: () => [dataset],
        checkIntegrity: async () => ({ ok: true, messages: ['ok'] }),
        importCsv: async () => { throw new Error('Import is outside this browser acceptance test.'); },
        close: () => {}
    };
    const backupCalls = [];
    const restoreCalls = [];
    server = createDashboardServer(undefined, {
        backtestWorkspace: workspace,
        backtestBackupDirectory: backupDirectory,
        createBacktestBackup: async (destination) => {
            backupCalls.push(destination);
            await mkdir(destination, { recursive: true });
            await writeFile(join(destination, 'manifest.json'), JSON.stringify({
                format: 'PFO-BACKTEST-BACKUP',
                formatVersion: 1,
                createdAt: '2026-11-27T00:00:00.000Z',
                datasetVersions: [{ dataset_id: dataset.id, version: dataset.version }],
                artifacts: [{ digest: 'a'.repeat(64) }]
            }));
            return {
                datasetVersions: 1,
                artifacts: 1,
                artifactBytes: 256,
                catalogSha256: 'c'.repeat(64)
            };
        },
        restoreBacktestBackup: async (backupId) => {
            restoreCalls.push(backupId);
            return {
                backupId,
                verified: true,
                catalogPath: join(temporaryDirectory, 'restore-candidate', 'catalog.sqlite'),
                artifactDirectory: join(temporaryDirectory, 'restore-candidate', 'artifacts'),
                powershell: '$env:PFO_BACKTEST_CATALOG_PATH = \'C:\\PFO Candidate\\catalog.sqlite\'; pnpm dashboard:serve',
                bash: 'export PFO_BACKTEST_CATALOG_PATH=\'/tmp/PFO Candidate/catalog.sqlite\' && pnpm dashboard:serve'
            };
        }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = 'http://127.0.0.1:' + address.port + '/';

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
        const status = globalThis.document.querySelector('#backtesting-status');
        return status?.textContent.includes('Storage enabled');
    });

    assert.equal(await page.locator('#backtesting-dataset-list article').count(), 1,
        'the browser should render the persisted dataset from the injected workspace');
    assert.equal(await page.locator('#backtesting-backup-list').innerText(), 'No managed backups are available.');
    assert.equal(await page.locator('#backtesting-create-backup').isEnabled(), true,
        'managed backup creation should be enabled only after the workspace is available');

    await page.locator('#backtesting-create-backup').click();
    await page.waitForFunction(() => globalThis.document.querySelector('#backtesting-status')?.textContent.includes('Backup verified'));
    assert.equal(backupCalls.length, 1, 'the create control should issue exactly one backup operation');
    assert.equal(await page.locator('#backtesting-backup-list article').count(), 1,
        'the newly-created managed backup should appear in the browser list');
    const backupId = await page.locator('#backtesting-backup-list article strong').innerText();
    assert.match(backupId, /^backup-[0-9]{13}-[0-9a-f-]{36}$/u);
    assert.match(await page.locator('#backtesting-backup-list article').innerText(), /1 dataset version\(s\)[\s\S]*1 source artifact\(s\)/u);

    const restoreButton = page.locator('#backtesting-backup-list article button');
    assert.equal(await restoreButton.innerText(), 'Validate restore to new location');
    await restoreButton.click();
    await page.waitForFunction(() => globalThis.document.querySelector('#backtesting-restore-result')?.textContent.includes('Restore candidate verified'));

    assert.deepEqual(restoreCalls, [backupId], 'restore must send the generated backup ID, not a browser-supplied path');
    assert.match(await page.locator('#backtesting-restore-result').innerText(), /Existing datasets were not changed/u);
    assert.match(await page.locator('#backtesting-restore-result pre').first().innerText(), /PFO_BACKTEST_CATALOG_PATH/u);
    assert.match(await page.locator('#backtesting-restore-result pre').nth(1).innerText(), /PFO_BACKTEST_CATALOG_PATH/u);
    assert.equal(await page.locator('#backtesting-dataset-list article').count(), 1,
        'restoring a candidate must not replace or mutate the active dataset listing');

    const crossOrigin = await fetch(baseUrl + 'api/v1/backtesting/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
        body: JSON.stringify({ backupId })
    });
    assert.equal(crossOrigin.status, 403, 'restore must remain protected by the local-origin guard');
    assert.deepEqual(restoreCalls, [backupId], 'a rejected cross-origin request must not invoke restore');

    assert.deepEqual(pageErrors, [], 'backup and restore UI interactions must not produce uncaught browser errors');
    process.stdout.write('PASS: managed historical dataset backup creation, listing, candidate restore and UI isolation.\\n');
    await context.close();
} catch (error) {
    process.stderr.write('Historical dataset backup/restore browser smoke test failed.\\n');
    throw error;
} finally {
    if (browser) await browser.close();
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
