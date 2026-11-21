import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { mkdir, open, link, unlink, readdir, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import type { BacktestBarObservation, BacktestDataset } from './contracts.js';
import { validateBacktestDataset } from './validation.js';

export interface BacktestDatasetStorageOptions {
    /** Absolute path to a dedicated catalog SQLite database, never the household workspace database. */
    readonly catalogPath: string;
    /** Absolute path to the immutable source-artifact directory, outside the repository. */
    readonly artifactDirectory: string;
}

export interface StoredBacktestDataset {
    readonly id: string;
    readonly version: number;
    readonly rawArtifactDigest: string;
    readonly normalizedContentDigest: string;
    readonly byteLength: number;
    readonly observationCount: number;
    readonly importedAt: string;
}

export interface BacktestStorageIntegrityReport {
    readonly ok: boolean;
    readonly referencedArtifacts: number;
    readonly verifiedArtifacts: number;
    readonly missingArtifacts: readonly string[];
    readonly corruptArtifacts: readonly string[];
    readonly orphanArtifacts: readonly string[];
    readonly stagingFiles: readonly string[];
}

interface DatasetMetadata extends Omit<BacktestDataset, 'bars'> {}

interface ArtifactRecord {
    readonly raw_digest: string;
    readonly byte_length: number;
    readonly relative_path: string;
}

interface StoredVersionRecord {
    readonly dataset_id: string;
    readonly version: number;
    readonly metadata_json: string;
    readonly raw_digest: string;
    readonly normalized_digest: string;
    readonly byte_length: number;
    readonly observation_count: number;
    readonly imported_at: string;
}

interface StoredBarRecord {
    readonly instrument_id: string;
    readonly provider_instrument_id: string | null;
    readonly interval: string;
    readonly start_at: string;
    readonly end_at: string;
    readonly open_price: number;
    readonly high_price: number;
    readonly low_price: number;
    readonly close_price: number;
    readonly currency: string;
    readonly volume: number | null;
    readonly adjustment_basis: string;
    readonly market_time_zone: string;
    readonly available_at: string | null;
    readonly recorded_at: string;
}

const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const SCHEMA_VERSION = 1;

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

async function hashFile(path: string): Promise<{ digest: string; byteLength: number }> {
    const hash = createHash('sha256');
    let byteLength = 0;
    for await (const chunk of createReadStream(path)) {
        byteLength += chunk.length;
        hash.update(chunk);
    }
    return { digest: hash.digest('hex'), byteLength };
}

function isWithin(parent: string, candidate: string): boolean {
    const path = relative(parent, candidate);
    return path === '' || (!path.startsWith('..' + sep) && path !== '..' && !isAbsolute(path));
}

function validatePaths(options: BacktestDatasetStorageOptions): { catalogPath: string; artifactDirectory: string } {
    if (!isAbsolute(options.catalogPath) || !isAbsolute(options.artifactDirectory)) {
        throw new RangeError('Backtest storage paths must be absolute.');
    }
    const catalogPath = resolve(options.catalogPath);
    const artifactDirectory = resolve(options.artifactDirectory);
    const repositoryRoot = resolve(process.cwd());
    if (isWithin(repositoryRoot, catalogPath) || isWithin(repositoryRoot, artifactDirectory)) {
        throw new RangeError('Backtest catalog and artifacts must be stored outside the repository.');
    }
    if (isWithin(dirname(catalogPath), artifactDirectory) || isWithin(artifactDirectory, dirname(catalogPath))) {
        throw new RangeError('Backtest catalog and artifact directories must have separate directory trees.');
    }
    return { catalogPath, artifactDirectory };
}

function artifactRelativePath(digest: string): string {
    if (!DIGEST_PATTERN.test(digest)) throw new RangeError('Invalid SHA-256 artifact digest.');
    return join('sha256', digest.slice(0, 2), digest.slice(2, 4), digest + '.csv');
}

function toMetadata(dataset: BacktestDataset): DatasetMetadata {
    const { bars: _bars, ...metadata } = dataset;
    return metadata;
}

function mapBar(row: StoredBarRecord): BacktestBarObservation {
    return {
        instrumentId: row.instrument_id,
        ...(row.provider_instrument_id === null ? {} : { providerInstrumentId: row.provider_instrument_id }),
        interval: row.interval as BacktestBarObservation['interval'],
        startAt: row.start_at,
        endAt: row.end_at,
        open: row.open_price,
        high: row.high_price,
        low: row.low_price,
        close: row.close_price,
        currency: row.currency as BacktestBarObservation['currency'],
        ...(row.volume === null ? {} : { volume: row.volume }),
        adjustmentBasis: row.adjustment_basis as BacktestBarObservation['adjustmentBasis'],
        marketTimeZone: row.market_time_zone,
        ...(row.available_at === null ? {} : { availableAt: row.available_at }),
        recordedAt: row.recorded_at
    };
}

/**
 * Local-first historical dataset persistence. This catalog is deliberately independent
 * from the household workspace database and never writes investment-ledger records.
 */
export class BacktestDatasetStore {
    private readonly database: DatabaseSync;
    private readonly catalogPath: string;
    private readonly artifactDirectory: string;
    private closed = false;

    constructor(options: BacktestDatasetStorageOptions) {
        const paths = validatePaths(options);
        this.catalogPath = paths.catalogPath;
        this.artifactDirectory = paths.artifactDirectory;
        mkdirSyncPrivate(dirname(this.catalogPath));
        mkdirSyncPrivate(this.artifactDirectory);
        mkdirSyncPrivate(join(this.artifactDirectory, '.staging'));
        mkdirSyncPrivate(join(this.artifactDirectory, 'sha256'));
        this.database = new DatabaseSync(this.catalogPath);
        this.database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
        this.initializeSchema();
    }

    private initializeSchema(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS backtest_storage_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            ) STRICT;
            CREATE TABLE IF NOT EXISTS dataset_artifacts (
                raw_digest TEXT PRIMARY KEY CHECK(length(raw_digest) = 64),
                byte_length INTEGER NOT NULL CHECK(byte_length >= 0),
                relative_path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            ) STRICT;
            CREATE TABLE IF NOT EXISTS dataset_versions (
                dataset_id TEXT NOT NULL,
                version INTEGER NOT NULL CHECK(version > 0),
                metadata_json TEXT NOT NULL,
                raw_digest TEXT NOT NULL REFERENCES dataset_artifacts(raw_digest),
                normalized_digest TEXT NOT NULL CHECK(length(normalized_digest) = 64),
                byte_length INTEGER NOT NULL CHECK(byte_length >= 0),
                observation_count INTEGER NOT NULL CHECK(observation_count > 0),
                imported_at TEXT NOT NULL,
                PRIMARY KEY(dataset_id, version)
            ) STRICT;
            CREATE TABLE IF NOT EXISTS dataset_bars (
                dataset_id TEXT NOT NULL,
                dataset_version INTEGER NOT NULL,
                instrument_id TEXT NOT NULL,
                provider_instrument_id TEXT,
                interval TEXT NOT NULL CHECK(interval = '1d'),
                start_at TEXT NOT NULL,
                end_at TEXT NOT NULL,
                open_price REAL NOT NULL,
                high_price REAL NOT NULL,
                low_price REAL NOT NULL,
                close_price REAL NOT NULL,
                currency TEXT NOT NULL,
                volume REAL,
                adjustment_basis TEXT NOT NULL,
                market_time_zone TEXT NOT NULL,
                available_at TEXT,
                recorded_at TEXT NOT NULL,
                PRIMARY KEY(dataset_id, dataset_version, instrument_id, end_at),
                FOREIGN KEY(dataset_id, dataset_version)
                    REFERENCES dataset_versions(dataset_id, version) ON DELETE RESTRICT
            ) STRICT;
            CREATE INDEX IF NOT EXISTS idx_backtest_bars_instrument_end
                ON dataset_bars(instrument_id, end_at);
        `);
        const existing = this.database.prepare(
            "SELECT value FROM backtest_storage_meta WHERE key = 'schema_version'"
        ).get() as { value?: string } | undefined;
        if (existing && Number(existing.value) !== SCHEMA_VERSION) {
            throw new RangeError('Unsupported backtest catalog schema version.');
        }
        this.database.prepare(
            "INSERT OR IGNORE INTO backtest_storage_meta(key, value) VALUES ('schema_version', ?)"
        ).run(String(SCHEMA_VERSION));
    }

    private assertOpen(): void {
        if (this.closed) throw new Error('Backtest dataset store is closed.');
    }

    private artifactPath(digest: string): string {
        return join(this.artifactDirectory, artifactRelativePath(digest));
    }

    private async verifyArtifact(path: string, expectedDigest: string, expectedLength: number): Promise<boolean> {
        try {
            const details = await stat(path);
            if (!details.isFile() || details.size !== expectedLength) return false;
            const actual = await hashFile(path);
            return actual.byteLength === expectedLength && actual.digest === expectedDigest;
        } catch {
            return false;
        }
    }

    private async publishArtifact(bytes: Uint8Array, digest: string): Promise<{ path: string; byteLength: number }> {
        const byteLength = bytes.byteLength;
        const relativePath = artifactRelativePath(digest);
        const destination = this.artifactPath(digest);
        await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
        if (await this.verifyArtifact(destination, digest, byteLength)) return { path: relativePath, byteLength };
        try {
            await stat(destination);
            throw new Error('An existing content-addressed artifact failed integrity verification; refusing to overwrite it.');
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        }

        const stagingPath = join(this.artifactDirectory, '.staging', randomUUID() + '.part');
        const handle = await open(stagingPath, 'wx', 0o600);
        try {
            await handle.writeFile(bytes);
            await handle.sync();
        } finally {
            await handle.close();
        }
        try {
            // A hard link publishes the fully flushed file atomically and never replaces an existing digest.
            await link(stagingPath, destination);
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
            if (!await this.verifyArtifact(destination, digest, byteLength)) {
                throw new Error('A concurrent content-addressed artifact failed integrity verification.');
            }
        } finally {
            await unlink(stagingPath).catch(() => undefined);
        }
        return { path: relativePath, byteLength };
    }

    /** Persist validated observations and the exact original UTF-8 CSV bytes as one immutable version. */
    async importDataset(dataset: BacktestDataset, rawCsvBytes: Uint8Array): Promise<StoredBacktestDataset> {
        this.assertOpen();
        validateBacktestDataset(dataset);
        if (dataset.instrument.exchange !== 'NSE' || dataset.interval !== '1d') {
            throw new RangeError('The first backtesting release accepts NSE daily datasets only.');
        }
        if (!(rawCsvBytes instanceof Uint8Array) || rawCsvBytes.byteLength === 0) {
            throw new RangeError('A non-empty original CSV byte artifact is required.');
        }
        const rawDigest = sha256(rawCsvBytes);
        if (dataset.source.contentDigest !== rawDigest) {
            throw new RangeError('Original CSV bytes do not match the dataset source content digest.');
        }
        if (!DIGEST_PATTERN.test(dataset.contentDigest)) {
            throw new RangeError('Dataset normalized content digest must be a SHA-256 value.');
        }

        const artifact = await this.publishArtifact(rawCsvBytes, rawDigest);
        const importedAt = new Date().toISOString();
        const metadataJson = JSON.stringify(toMetadata(dataset));
        this.database.exec('BEGIN IMMEDIATE;');
        try {
            this.database.prepare(`
                INSERT INTO dataset_artifacts(raw_digest, byte_length, relative_path, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(raw_digest) DO NOTHING
            `).run(rawDigest, artifact.byteLength, artifact.path, importedAt);
            const artifactRow = this.database.prepare(
                'SELECT byte_length, relative_path FROM dataset_artifacts WHERE raw_digest = ?'
            ).get(rawDigest) as { byte_length: number; relative_path: string } | undefined;
            if (!artifactRow || artifactRow.byte_length !== artifact.byteLength || artifactRow.relative_path !== artifact.path) {
                throw new Error('Catalog artifact metadata conflicts with the immutable source object.');
            }
            this.database.prepare(`
                INSERT INTO dataset_versions(
                    dataset_id, version, metadata_json, raw_digest, normalized_digest,
                    byte_length, observation_count, imported_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(dataset.id, dataset.version, metadataJson, rawDigest, dataset.contentDigest,
                artifact.byteLength, dataset.bars.length, importedAt);

            const insertBar = this.database.prepare(`
                INSERT INTO dataset_bars(
                    dataset_id, dataset_version, instrument_id, provider_instrument_id, interval,
                    start_at, end_at, open_price, high_price, low_price, close_price, currency,
                    volume, adjustment_basis, market_time_zone, available_at, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            for (const bar of dataset.bars) {
                insertBar.run(
                    dataset.id, dataset.version, bar.instrumentId, bar.providerInstrumentId ?? null, bar.interval,
                    bar.startAt, bar.endAt, bar.open, bar.high, bar.low, bar.close, bar.currency,
                    bar.volume ?? null, bar.adjustmentBasis, bar.marketTimeZone, bar.availableAt ?? null, bar.recordedAt
                );
            }
            this.database.exec('COMMIT;');
        } catch (error) {
            this.database.exec('ROLLBACK;');
            throw error;
        }

        if (!await this.verifyArtifact(this.artifactPath(rawDigest), rawDigest, artifact.byteLength)) {
            throw new Error('Published source artifact failed post-commit integrity verification.');
        }
        return {
            id: dataset.id,
            version: dataset.version,
            rawArtifactDigest: rawDigest,
            normalizedContentDigest: dataset.contentDigest,
            byteLength: artifact.byteLength,
            observationCount: dataset.bars.length,
            importedAt
        };
    }

    listDatasets(): readonly StoredBacktestDataset[] {
        this.assertOpen();
        const rows = this.database.prepare(`
            SELECT dataset_id, version, raw_digest, normalized_digest, byte_length,
                   observation_count, imported_at
            FROM dataset_versions ORDER BY dataset_id, version
        `).all() as unknown as Array<{
            dataset_id: string; version: number; raw_digest: string; normalized_digest: string;
            byte_length: number; observation_count: number; imported_at: string;
        }>;
        return rows.map((row) => ({
            id: row.dataset_id, version: row.version, rawArtifactDigest: row.raw_digest,
            normalizedContentDigest: row.normalized_digest, byteLength: row.byte_length,
            observationCount: row.observation_count, importedAt: row.imported_at
        }));
    }

    async loadDataset(id: string, version: number): Promise<BacktestDataset> {
        this.assertOpen();
        const row = this.database.prepare(`
            SELECT dataset_id, version, metadata_json, raw_digest, normalized_digest,
                   byte_length, observation_count, imported_at
            FROM dataset_versions WHERE dataset_id = ? AND version = ?
        `).get(id, version) as StoredVersionRecord | undefined;
        if (!row) throw new RangeError('Backtest dataset version was not found.');
        const artifactRow = this.database.prepare(
            'SELECT raw_digest, byte_length, relative_path FROM dataset_artifacts WHERE raw_digest = ?'
        ).get(row.raw_digest) as ArtifactRecord | undefined;
        if (!artifactRow || artifactRow.byte_length !== row.byte_length
            || !await this.verifyArtifact(this.artifactPath(row.raw_digest), row.raw_digest, row.byte_length)) {
            throw new Error('Backtest dataset source artifact is missing or corrupt; dataset is unavailable.');
        }
        const metadata = JSON.parse(row.metadata_json) as DatasetMetadata;
        const bars = this.database.prepare(`
            SELECT instrument_id, provider_instrument_id, interval, start_at, end_at,
                   open_price, high_price, low_price, close_price, currency, volume,
                   adjustment_basis, market_time_zone, available_at, recorded_at
            FROM dataset_bars WHERE dataset_id = ? AND dataset_version = ?
            ORDER BY end_at ASC
        `).all(id, version) as unknown as StoredBarRecord[];
        if (bars.length !== row.observation_count) {
            throw new Error('Backtest dataset observation count does not match its immutable catalog manifest.');
        }
        const dataset: BacktestDataset = { ...metadata, contentDigest: row.normalized_digest, bars: bars.map(mapBar) };
        validateBacktestDataset(dataset);
        return dataset;
    }

    /** Detect missing/corrupt references and unreferenced artifacts. Never deletes anything. */
    async checkIntegrity(): Promise<BacktestStorageIntegrityReport> {
        this.assertOpen();
        const artifactRows = this.database.prepare(
            'SELECT raw_digest, byte_length, relative_path FROM dataset_artifacts ORDER BY raw_digest'
        ).all() as unknown as ArtifactRecord[];
        const referenced = new Set(artifactRows.map((row) => row.raw_digest));
        const missingArtifacts: string[] = [];
        const corruptArtifacts: string[] = [];
        let verifiedArtifacts = 0;
        for (const row of artifactRows) {
            const path = this.artifactPath(row.raw_digest);
            try {
                await stat(path);
            } catch {
                missingArtifacts.push(row.raw_digest);
                continue;
            }
            if (!await this.verifyArtifact(path, row.raw_digest, row.byte_length)) {
                corruptArtifacts.push(row.raw_digest);
            } else {
                verifiedArtifacts += 1;
            }
        }

        const orphanArtifacts: string[] = [];
        const digestRoot = join(this.artifactDirectory, 'sha256');
        for (const first of await safeDirectories(digestRoot)) {
            for (const second of await safeDirectories(join(digestRoot, first))) {
                for (const file of await readdir(join(digestRoot, first, second), { withFileTypes: true })) {
                    if (!file.isFile() || !file.name.endsWith('.csv')) continue;
                    const digest = file.name.slice(0, -4);
                    if (DIGEST_PATTERN.test(digest) && !referenced.has(digest)) orphanArtifacts.push(digest);
                }
            }
        }
        const stagingFiles = (await readdir(join(this.artifactDirectory, '.staging'))).sort();
        return {
            ok: missingArtifacts.length === 0 && corruptArtifacts.length === 0,
            referencedArtifacts: artifactRows.length,
            verifiedArtifacts,
            missingArtifacts,
            corruptArtifacts,
            orphanArtifacts: orphanArtifacts.sort(),
            stagingFiles
        };
    }

    close(): void {
        if (this.closed) return;
        this.database.close();
        this.closed = true;
    }
}

function mkdirSyncPrivate(path: string): void {
    mkdirSync(path, { recursive: true, mode: 0o700 });
}

async function safeDirectories(path: string): Promise<string[]> {
    try {
        const entries = await readdir(path, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch {
        return [];
    }
}
