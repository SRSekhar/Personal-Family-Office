import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { Currency } from '@pfo/models';

import type { BacktestDatasetCsvImportMetadata } from '../src/csv-import.js';
import { BacktestDatasetWorkspace } from '../src/dataset-workspace.js';

const csv = [
    '#PFO-BACKTEST-DATASET,1,OHLCV',
    'startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId',
    '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,100,110,95,105,1000,2026-01-01T10:05:00.000Z,2026-01-01T11:00:00.000Z,SYN-1',
    '2026-01-02T00:00:00.000Z,2026-01-02T10:00:00.000Z,110,120,108,115,1200,2026-01-02T10:05:00.000Z,2026-01-02T11:00:00.000Z,SYN-1'
].join('\r\n') + '\r\n';

const metadata: BacktestDatasetCsvImportMetadata = {
    id: 'workspace-fixture',
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

const roots: string[] = [];
const workspaces: BacktestDatasetWorkspace[] = [];

function makeOptions(root: string, env: NodeJS.ProcessEnv = {}): {
    env: NodeJS.ProcessEnv;
    repositoryRoot: string;
} {
    const catalogPath = join(root, 'catalog', 'catalog.sqlite');
    const artifactDirectory = join(root, 'artifacts');
    return {
        env: {
            ...env,
            PFO_BACKTEST_CATALOG_PATH: catalogPath,
            PFO_BACKTEST_ARTIFACT_DIRECTORY: artifactDirectory
        },
        repositoryRoot: process.cwd()
    };
}

async function createWorkspace(): Promise<{ workspace: BacktestDatasetWorkspace; root: string }> {
    const root = await mkdtemp(join(tmpdir(), 'pfo-backtest-workflow-'));
    roots.push(root);
    const workspace = BacktestDatasetWorkspace.open(makeOptions(root));
    workspaces.push(workspace);
    return { workspace, root };
}

afterEach(async (): Promise<void> => {
    for (const workspace of workspaces.splice(0)) {
        workspace.close();
    }
    for (const root of roots.splice(0)) {
        await rm(root, { recursive: true, force: true });
    }
});

describe('BacktestDatasetWorkspace', () => {
    it('explicitly initializes storage, imports exact CSV bytes, lists and reloads the dataset', async (): Promise<void> => {
        const { workspace } = await createWorkspace();
        const bytes = Buffer.from(csv, 'utf8');
        const imported = await workspace.importCsv(bytes, metadata);

        expect(imported).toMatchObject({ id: metadata.id, version: 1, observationCount: 2 });
        expect(workspace.listDatasets()).toEqual([imported]);
        const loaded = await workspace.loadDataset(metadata.id, 1);
        expect(loaded).toMatchObject({ id: metadata.id, version: 1 });
        expect(loaded.bars).toHaveLength(2);
        expect(loaded.bars[0]?.close).toBe(105);
        expect(await workspace.checkIntegrity()).toMatchObject({ ok: true, referencedArtifacts: 1, verifiedArtifacts: 1 });
    });

    it('rejects malformed UTF-8 before creating a dataset version', async (): Promise<void> => {
        const { workspace } = await createWorkspace();
        await expect(workspace.importCsv(Uint8Array.from([0xc3, 0x28]), metadata))
            .rejects.toThrow('valid UTF-8');
        expect(workspace.listDatasets()).toEqual([]);
    });

    it('enforces NSE daily-only scope through the host import workflow', async (): Promise<void> => {
        const { workspace } = await createWorkspace();
        await expect(workspace.importCsv(Buffer.from(csv), {
            ...metadata, instrument: { ...metadata.instrument, exchange: 'BSE' }
        })).rejects.toThrow('NSE instruments only');
        expect(workspace.listDatasets()).toEqual([]);
    });

    it('creates and restores a standalone backup without overwriting either destination', async (): Promise<void> => {
        const { workspace, root } = await createWorkspace();
        await workspace.importCsv(Buffer.from(csv), metadata);
        const backupDirectory = join(root, 'backup-bundle');
        const backup = await workspace.createBackup(backupDirectory);
        expect(backup).toMatchObject({ datasetVersions: 1, artifacts: 1 });

        const restoreRoot = join(root, 'restored');
        const restored = await BacktestDatasetWorkspace.restoreBackup(
            backupDirectory, makeOptions(restoreRoot)
        );
        workspaces.push(restored);
        expect(restored.listDatasets()).toHaveLength(1);
        expect(await restored.loadDataset(metadata.id, 1)).toEqual(await workspace.loadDataset(metadata.id, 1));
        expect(await restored.checkIntegrity()).toMatchObject({ ok: true, referencedArtifacts: 1, verifiedArtifacts: 1 });

        await expect(BacktestDatasetWorkspace.restoreBackup(
            backupDirectory, makeOptions(restoreRoot)
        )).rejects.toThrow('already exists');
    });

    it('keeps catalog and artifact paths isolated from the repository and each other', async (): Promise<void> => {
        const root = await mkdtemp(join(tmpdir(), 'pfo-backtest-workflow-paths-'));
        roots.push(root);
        const nestedOptions = {
            env: {
                PFO_BACKTEST_CATALOG_PATH: join(root, 'catalog', 'catalog.sqlite'),
                PFO_BACKTEST_ARTIFACT_DIRECTORY: join(root, 'catalog', 'artifacts')
            },
            repositoryRoot: process.cwd()
        };
        expect(() => BacktestDatasetWorkspace.open(nestedOptions)).toThrow('separate directory trees');
    });
});
