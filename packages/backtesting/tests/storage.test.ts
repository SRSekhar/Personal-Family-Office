import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { Currency } from '@pfo/models';

import type { BacktestDatasetCsvImportMetadata } from '../src/csv-import.js';
import { importBacktestDatasetCsv } from '../src/csv-import.js';
import { BacktestDatasetStore } from '../src/storage.js';

const manifest = '#PFO-BACKTEST-DATASET,1,OHLCV';
const headers = 'startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId';
const first = '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,100,110,95,105,1000,2026-01-01T10:05:00.000Z,2026-01-01T11:00:00.000Z,SYN-1';
const second = '2026-01-02T00:00:00.000Z,2026-01-02T10:00:00.000Z,110,120,108,115,1200,2026-01-02T10:05:00.000Z,2026-01-02T11:00:00.000Z,SYN-1';
const csv = [manifest, headers, first, second].join('\r\n') + '\r\n';
const metadata: BacktestDatasetCsvImportMetadata = {
    id: 'storage-fixture-1',
    version: 1,
    instrument: {
        instrumentId: 'instrument-1', name: 'Synthetic Instrument', currency: Currency.INR,
        symbol: 'SYN', exchange: 'NSE'
    },
    interval: '1d',
    adjustmentBasis: 'unadjusted',
    marketTimeZone: 'Asia/Kolkata',
    source: {
        kind: 'user-supplied', name: 'Synthetic fixture', licenseName: 'Synthetic fixture terms',
        licenseStatus: 'reviewed', attributionText: 'Synthetic test data; not live market data.',
        retrievedAt: '2026-01-01T00:00:00.000Z', licenseReviewedAt: '2026-01-01T00:00:00.000Z',
        pointInTimeStatus: 'per-observation'
    },
    recordedAt: '2026-01-03T12:00:00.000Z',
    coverage: {
        startAt: '2025-12-31T00:00:00.000Z', endAt: '2026-01-02T23:59:59.000Z',
        status: 'complete',
        expectedBarEndAt: ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']
    }
};

const directories: string[] = [];
const stores: BacktestDatasetStore[] = [];

async function createStore(): Promise<{ store: BacktestDatasetStore; root: string; artifactDirectory: string }> {
    const root = await mkdtemp(join(tmpdir(), 'pfo-backtest-store-'));
    directories.push(root);
    const catalogDirectory = join(root, 'catalog');
    const artifactDirectory = join(root, 'artifacts');
    await mkdir(catalogDirectory, { recursive: true });
    const store = new BacktestDatasetStore({
        catalogPath: join(catalogDirectory, 'datasets.sqlite'),
        artifactDirectory
    });
    stores.push(store);
    return { store, root, artifactDirectory };
}

afterEach(async () => {
    for (const store of stores.splice(0)) {
        store.close();
    }
    for (const directory of directories.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe('BacktestDatasetStore', () => {
    it('persists a validated dataset separately from the household workspace and reloads exact observations', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv, 'utf8'));

        expect(saved).toMatchObject({
            id: dataset.id, version: 1, rawArtifactDigest: createHash('sha256').update(csv).digest('hex'),
            normalizedContentDigest: dataset.contentDigest, byteLength: Buffer.byteLength(csv), observationCount: 2
        });
        expect(await store.loadDataset(dataset.id, 1)).toEqual(dataset);
        expect(store.listDatasets()).toHaveLength(1);
        expect(root).not.toBe(process.cwd());
        expect(await readFile(join(root, 'catalog', 'datasets.sqlite'))).toBeInstanceOf(Buffer);
        expect(await store.checkIntegrity()).toMatchObject({
            ok: true, referencedArtifacts: 1, verifiedArtifacts: 1,
            missingArtifacts: [], corruptArtifacts: [], orphanArtifacts: []
        });
    });

    it('deduplicates exact source bytes while preserving separate dataset-version provenance', async () => {
        const { store } = await createStore();
        const firstDataset = importBacktestDatasetCsv(csv, metadata);
        const secondDataset = importBacktestDatasetCsv(csv, {
            ...metadata, id: 'storage-fixture-2', source: { ...metadata.source, name: 'Second explicit import' }
        });
        const firstSaved = await store.importDataset(firstDataset, Buffer.from(csv));
        const secondSaved = await store.importDataset(secondDataset, Buffer.from(csv));

        expect(secondSaved.rawArtifactDigest).toBe(firstSaved.rawArtifactDigest);
        expect(store.listDatasets()).toHaveLength(2);
        expect((await store.checkIntegrity()).referencedArtifacts).toBe(1);
        expect((await store.loadDataset('storage-fixture-2', 1)).source.name).toBe('Second explicit import');
    });

    it('refuses to overwrite an existing immutable dataset version', async () => {
        const { store } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        await store.importDataset(dataset, Buffer.from(csv));
        await expect(store.importDataset(dataset, Buffer.from(csv))).rejects.toThrow(/unique constraint/i);
        expect(store.listDatasets()).toHaveLength(1);
    });

    it('rejects source bytes whose exact digest differs before catalog publication', async () => {
        const { store } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        await expect(store.importDataset(dataset, Buffer.from(csv + '#tampered'))).rejects.toThrow(/do not match/i);
        expect(store.listDatasets()).toHaveLength(0);
    });

    it('rejects catalog observations that no longer match the immutable CSV source', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        await store.importDataset(dataset, Buffer.from(csv));
        const connection = new DatabaseSync(join(root, 'catalog', 'datasets.sqlite'));
        try {
            const firstBar = dataset.bars[0];
            if (!firstBar) {
                throw new Error('Synthetic dataset fixture is missing its first observation.');
            }
            // Simulate offline catalog tampering by deliberately removing the database guard.
            connection.exec('DROP TRIGGER trg_dataset_bars_no_update;');
            connection.prepare(`
                UPDATE dataset_bars SET close_price = ?
                WHERE dataset_id = ? AND dataset_version = ? AND end_at = ?
            `).run(106, dataset.id, dataset.version, firstBar.endAt);
        } finally {
            connection.close();
        }
        await expect(store.loadDataset(dataset.id, dataset.version)).rejects.toThrow(/do not match the immutable source/i);
        const integrity = await store.checkIntegrity();
        expect(integrity.ok).toBe(false);
        expect(integrity.catalogErrors.some((error) => /do not match the immutable source/i.test(error))).toBe(true);
    });

    it('enforces append-only artifacts, dataset versions and observations at the SQLite boundary', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv));
        const connection = new DatabaseSync(join(root, 'catalog', 'datasets.sqlite'));
        try {
            const artifactUpdate = () => connection.prepare(
                'UPDATE dataset_artifacts SET byte_length = byte_length + 1 WHERE raw_digest = ?'
            ).run(saved.rawArtifactDigest);
            const artifactDelete = () => connection.prepare(
                'DELETE FROM dataset_artifacts WHERE raw_digest = ?'
            ).run(saved.rawArtifactDigest);
            const versionUpdate = () => connection.prepare(
                'UPDATE dataset_versions SET metadata_json = ? WHERE dataset_id = ? AND version = ?'
            ).run('{}', dataset.id, dataset.version);
            const versionDelete = () => connection.prepare(
                'DELETE FROM dataset_versions WHERE dataset_id = ? AND version = ?'
            ).run(dataset.id, dataset.version);
            const observationUpdate = () => connection.prepare(
                'UPDATE dataset_bars SET close_price = close_price + 1 WHERE dataset_id = ? AND dataset_version = ?'
            ).run(dataset.id, dataset.version);
            const observationDelete = () => connection.prepare(
                'DELETE FROM dataset_bars WHERE dataset_id = ? AND dataset_version = ?'
            ).run(dataset.id, dataset.version);

            expect(artifactUpdate).toThrow(/dataset artifacts are immutable/i);
            expect(artifactDelete).toThrow(/dataset artifacts are immutable/i);
            expect(versionUpdate).toThrow(/dataset versions are immutable/i);
            expect(versionDelete).toThrow(/dataset versions are immutable/i);
            expect(observationUpdate).toThrow(/dataset observations are immutable/i);
            expect(observationDelete).toThrow(/dataset observations are immutable/i);
        } finally {
            connection.close();
        }
        expect(await store.loadDataset(dataset.id, dataset.version)).toEqual(dataset);
    });

    it('reports a missing referenced artifact and blocks loading it', async () => {
        const { store, artifactDirectory } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv));
        const path = join(artifactDirectory, 'sha256', saved.rawArtifactDigest.slice(0, 2),
            saved.rawArtifactDigest.slice(2, 4), saved.rawArtifactDigest + '.csv');
        await unlink(path);

        await expect(store.loadDataset(dataset.id, dataset.version)).rejects.toThrow(/missing or corrupt/i);
        expect(await store.checkIntegrity()).toMatchObject({
            ok: false, missingArtifacts: [saved.rawArtifactDigest], corruptArtifacts: []
        });
    });

    it('detects unreferenced immutable objects without deleting them', async () => {
        const { store, artifactDirectory } = await createStore();
        const orphanBytes = Buffer.from('orphan fixture');
        const digest = createHash('sha256').update(orphanBytes).digest('hex');
        const path = join(artifactDirectory, 'sha256', digest.slice(0, 2), digest.slice(2, 4), digest + '.csv');
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, orphanBytes, { flag: 'wx', mode: 0o600 });

        const report = await store.checkIntegrity();
        expect(report.orphanArtifacts).toEqual([digest]);
        expect(await readFile(path)).toEqual(orphanBytes);
    });

    it('creates a verified standalone catalog-and-artifact backup without overwriting an existing bundle', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv));
        const backupPath = join(root, 'backup-bundle');

        const result = await store.createBackup(backupPath);
        expect(result).toMatchObject({ path: backupPath, datasetVersions: 1, artifacts: 1, artifactBytes: Buffer.byteLength(csv) });
        const manifest = JSON.parse(await readFile(join(backupPath, 'manifest.json'), 'utf8')) as unknown as {
            format: string; formatVersion: number; catalogSha256: string; artifacts: Array<{ digest: string; byteLength: number; relativePath: string }>;
        };
        expect(manifest).toMatchObject({ format: 'PFO-BACKTEST-BACKUP', formatVersion: 1, catalogSha256: result.catalogSha256 });
        expect(manifest.artifacts).toEqual([{
            digest: saved.rawArtifactDigest, byteLength: Buffer.byteLength(csv),
            relativePath: join('sha256', saved.rawArtifactDigest.slice(0, 2), saved.rawArtifactDigest.slice(2, 4), saved.rawArtifactDigest + '.csv')
        }]);
        const backedUpArtifact = manifest.artifacts[0];
        expect(backedUpArtifact).toBeDefined();
        if (!backedUpArtifact) {
            throw new Error('Backup manifest did not contain its source artifact.');
        }
        expect(await readFile(join(backupPath, 'artifacts', backedUpArtifact.relativePath), 'utf8')).toBe(csv);
        await expect(store.createBackup(backupPath)).rejects.toThrow(/already exists/i);
    });

    it('restores a verified bundle and makes the complete dataset available only after publication', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        await store.importDataset(dataset, Buffer.from(csv));
        const backupPath = join(root, 'restore-source');
        await store.createBackup(backupPath);

        const restoreRoot = join(root, 'restored');
        const restored = await BacktestDatasetStore.restoreBackup(backupPath, {
            catalogPath: join(restoreRoot, 'catalog', 'datasets.sqlite'),
            artifactDirectory: join(restoreRoot, 'artifacts')
        });
        stores.push(restored);
        expect(await restored.loadDataset(dataset.id, dataset.version)).toEqual(dataset);
        expect(await restored.checkIntegrity()).toMatchObject({ ok: true, referencedArtifacts: 1, verifiedArtifacts: 1 });
    });

    it('rejects an incomplete backup bundle without publishing a catalog', async () => {
        const { store, root } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv));
        const backupPath = join(root, 'incomplete-source');
        await store.createBackup(backupPath);
        await unlink(join(backupPath, 'artifacts', 'sha256', saved.rawArtifactDigest.slice(0, 2),
            saved.rawArtifactDigest.slice(2, 4), saved.rawArtifactDigest + '.csv'));

        const restoreRoot = join(root, 'rejected-restore');
        await expect(BacktestDatasetStore.restoreBackup(backupPath, {
            catalogPath: join(restoreRoot, 'catalog', 'datasets.sqlite'),
            artifactDirectory: join(restoreRoot, 'artifacts')
        })).rejects.toThrow();
        await expect(readFile(join(restoreRoot, 'catalog', 'datasets.sqlite'))).rejects.toThrow();
        await expect(readFile(join(restoreRoot, 'artifacts', 'sha256', saved.rawArtifactDigest.slice(0, 2),
            saved.rawArtifactDigest.slice(2, 4), saved.rawArtifactDigest + '.csv'))).rejects.toThrow();
    });

    it('refuses to back up a missing source artifact and does not publish a partial bundle', async () => {
        const { store, root, artifactDirectory } = await createStore();
        const dataset = importBacktestDatasetCsv(csv, metadata);
        const saved = await store.importDataset(dataset, Buffer.from(csv));
        await unlink(join(artifactDirectory, 'sha256', saved.rawArtifactDigest.slice(0, 2),
            saved.rawArtifactDigest.slice(2, 4), saved.rawArtifactDigest + '.csv'));
        const backupPath = join(root, 'must-not-publish');
        await expect(store.createBackup(backupPath)).rejects.toThrow(/integrity check failed/i);
        await expect(readFile(join(backupPath, 'manifest.json'))).rejects.toThrow();
    });

    it('rejects relative paths and paths inside the repository', () => {
        expect(() => new BacktestDatasetStore({
            catalogPath: './catalog.sqlite', artifactDirectory: '/tmp/pfo-artifacts'
        })).toThrow(/absolute/i);
        expect(() => new BacktestDatasetStore({
            catalogPath: join(process.cwd(), 'catalog', 'datasets.sqlite'),
            artifactDirectory: '/tmp/pfo-artifacts'
        })).toThrow(/outside the repository/i);
    });
});
