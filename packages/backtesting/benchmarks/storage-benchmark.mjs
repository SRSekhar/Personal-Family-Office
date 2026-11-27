import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { Currency } from '@pfo/models';
import { BacktestDatasetStore, importBacktestDatasetCsv } from '../dist/index.js';

const requestedRows = Number(process.env.PFO_BACKTEST_BENCHMARK_ROWS ?? 10_000);
const rows = Number.isSafeInteger(requestedRows) ? Math.min(Math.max(requestedRows, 1), 100_000) : 10_000;
const manifest = '#PFO-BACKTEST-DATASET,1,OHLCV';
const headers = 'startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId';
const expectedBarEndAt = [];
const dataRows = [];
const base = Date.UTC(2000, 0, 1);
for (let index = 0; index < rows; index += 1) {
    const day = new Date(base + index * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const startAt = date + 'T00:00:00.000Z';
    const endAt = date + 'T10:00:00.000Z';
    expectedBarEndAt.push(endAt);
    dataRows.push([startAt, endAt, 100, 101, 99, 100.5, 1000 + index,
        date + 'T10:05:00.000Z', '2040-01-01T00:00:00.000Z', 'BENCH-' + index].join(','));
}
const csv = [manifest, headers, ...dataRows].join('\r\n') + '\r\n';
const source = {
    kind: 'user-supplied',
    name: 'Synthetic storage benchmark',
    licenseName: 'Synthetic benchmark fixture',
    licenseStatus: 'reviewed',
    attributionText: 'Generated synthetic benchmark data; not market data.',
    retrievedAt: '2040-01-01T00:00:00.000Z',
    licenseReviewedAt: '2040-01-01T00:00:00.000Z',
    pointInTimeStatus: 'per-observation'
};
const dataset = importBacktestDatasetCsv(csv, {
    id: 'storage-benchmark',
    version: 1,
    instrument: { instrumentId: 'benchmark-instrument', name: 'Synthetic benchmark', currency: Currency.INR, symbol: 'BENCH', exchange: 'NSE' },
    interval: '1d',
    adjustmentBasis: 'unadjusted',
    marketTimeZone: 'Asia/Kolkata',
    source,
    recordedAt: '2040-01-01T00:00:00.000Z',
    coverage: {
        startAt: '2000-01-01T00:00:00.000Z',
        endAt: expectedBarEndAt.at(-1) ?? '2000-01-01T10:00:00.000Z',
        status: 'complete',
        expectedBarEndAt
    }
});
const root = await mkdtemp(join(tmpdir(), 'pfo-backtest-benchmark-'));
const store = new BacktestDatasetStore({
    catalogPath: join(root, 'catalog', 'datasets.sqlite'),
    artifactDirectory: join(root, 'artifacts')
});
const elapsed = async (operation) => {
    const start = performance.now();
    const value = await operation();
    return { value, milliseconds: Number((performance.now() - start).toFixed(2)) };
};
try {
    const rawBytes = Buffer.from(csv, 'utf8');
    const imported = await elapsed(() => store.importDataset(dataset, rawBytes));
    const loaded = await elapsed(() => store.loadDataset(dataset.id, dataset.version));
    const integrity = await elapsed(() => store.checkIntegrity());
    const backup = await elapsed(() => store.createBackup(join(root, 'backup')));
    const report = {
        benchmark: 'PFO backtest local storage',
        fixture: 'synthetic only; not representative market data',
        observations: rows,
        sourceBytes: rawBytes.byteLength,
        import: {
            milliseconds: imported.milliseconds,
            observationsPerSecond: Math.round(rows / (imported.milliseconds / 1000))
        },
        load: { milliseconds: loaded.milliseconds, observations: loaded.value.bars.length },
        integrity: { milliseconds: integrity.milliseconds, ok: integrity.value.ok },
        backup: { milliseconds: backup.milliseconds, bytes: backup.value.artifactBytes },
        environment: { node: process.version, platform: process.platform, arch: process.arch }
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
    store.close();
    await rm(root, { recursive: true, force: true });
}
