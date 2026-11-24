import type { BacktestDataset } from './contracts.js';
import type { BacktestDatasetCsvImportMetadata } from './csv-import.js';
import { importBacktestDatasetCsv } from './csv-import.js';
import { resolveBacktestStoragePaths } from './host-storage-paths.js';
import type { ResolveBacktestStoragePathsOptions } from './host-storage-paths.js';
import { BACKTEST_STORAGE_LIMITS, BacktestDatasetStore } from './storage.js';
import type {
    BacktestDatasetBackupResult,
    BacktestDatasetStorageOptions,
    BacktestStorageIntegrityReport,
    StoredBacktestDataset
} from './storage.js';

/**
 * Explicit host-facing workflow for managing local historical datasets.
 * Opening this workspace initializes its dedicated catalog; importing, listing,
 * integrity checks, backup and restore never touch household-ledger records.
 */
export class BacktestDatasetWorkspace {
    private constructor(private readonly store: BacktestDatasetStore) {}

    /** Explicitly initialize/open the dedicated local dataset catalog and artifact store. */
    static open(options: ResolveBacktestStoragePathsOptions = {}): BacktestDatasetWorkspace {
        return new BacktestDatasetWorkspace(new BacktestDatasetStore(resolveBacktestStoragePaths(options)));
    }

    /** Restore into unused, explicitly resolved destinations; existing data is never overwritten. */
    static async restoreBackup(
        backupDirectory: string,
        options: ResolveBacktestStoragePathsOptions = {}
    ): Promise<BacktestDatasetWorkspace> {
        const paths = resolveBacktestStoragePaths(options);
        const storeOptions: BacktestDatasetStorageOptions = paths;
        const store = await BacktestDatasetStore.restoreBackup(backupDirectory, storeOptions);
        return new BacktestDatasetWorkspace(store);
    }

    /**
     * Import original CSV bytes with explicit provenance, instrument, coverage and
     * knowledge-time metadata. The byte snapshot is preserved exactly as supplied.
     */
    async importCsv(
        sourceCsvBytes: Uint8Array,
        metadata: BacktestDatasetCsvImportMetadata
    ): Promise<StoredBacktestDataset> {
        if (!(sourceCsvBytes instanceof Uint8Array) || sourceCsvBytes.byteLength === 0) {
            throw new RangeError('A non-empty original CSV byte artifact is required.');
        }
        if (sourceCsvBytes.byteLength > BACKTEST_STORAGE_LIMITS.maxSourceCsvBytes) {
            throw new RangeError('Original CSV exceeds the 64 MiB first-release import limit.');
        }
        const immutableBytes = Uint8Array.from(sourceCsvBytes);
        let csv: string;
        try {
            csv = new TextDecoder('utf-8', { fatal: true }).decode(immutableBytes);
        } catch {
            throw new RangeError('Original CSV artifact must contain valid UTF-8.');
        }
        const dataset: BacktestDataset = importBacktestDatasetCsv(csv, metadata);
        return this.store.importDataset(dataset, immutableBytes);
    }

    listDatasets(): readonly StoredBacktestDataset[] {
        return this.store.listDatasets();
    }

    loadDataset(id: string, version: number): Promise<BacktestDataset> {
        return this.store.loadDataset(id, version);
    }

    checkIntegrity(): Promise<BacktestStorageIntegrityReport> {
        return this.store.checkIntegrity();
    }

    createBackup(destinationDirectory: string): Promise<BacktestDatasetBackupResult> {
        return this.store.createBackup(destinationDirectory);
    }

    close(): void {
        this.store.close();
    }
}
