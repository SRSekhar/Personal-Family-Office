import { DatabaseSync } from 'node:sqlite';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { validateBackupPayload } from '../../apps/dashboard/backup.js';

const SCHEMA_VERSION = 5;
const CURRENCY = 'INR';
export class WorkspaceValidationError extends Error { constructor(message) { super(message); this.name = 'WorkspaceValidationError'; } }
export class WorkspaceConflictError extends Error {
    constructor(message = 'The SQLite workspace changed since this browser last read it. Refresh and review the latest snapshot before saving again.') {
        super(message); this.name = 'WorkspaceConflictError'; this.statusCode = 409;
    }
}
export function resolveDatabasePath(env = process.env, home = homedir(), platform = process.platform) {
    if (typeof env.PFO_DATABASE_PATH === 'string' && env.PFO_DATABASE_PATH.trim()) return resolve(env.PFO_DATABASE_PATH.trim());
    if (platform === 'win32') {
        const base = typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA.trim() ? env.LOCALAPPDATA : join(home, 'AppData', 'Local');
        return join(base, 'PFO-OS', 'pfo-os.sqlite');
    }
    return join(home, '.local', 'share', 'PFO-OS', 'pfo-os.sqlite');
}
function validateWorkspacePayload(payload) {
    try {
        const required = ['records', 'goals', 'cashFlowEntries', 'budgets', 'historicalSnapshots', 'investmentAccounts',
            'investmentInstruments', 'investmentTransactions', 'investmentValuations'];
        if (!payload || payload.schemaVersion !== SCHEMA_VERSION || required.some((key) => !Array.isArray(payload[key]))) {
            throw new Error('SQLite workspace persistence requires a complete schema-v5 workspace backup.');
        }
        if (payload.currency !== CURRENCY) throw new Error(`Workspace currency must be ${CURRENCY}; this snapshot uses ${String(payload.currency ?? 'no currency')}.`);
        const ids = new Set();
        for (const record of payload.records) {
            if (!record || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)) throw new Error('Financial records must have unique, non-empty identifiers before database persistence.');
            ids.add(record.id);
        }
        const validated = validateBackupPayload(payload, CURRENCY);
        return {
            schemaVersion: SCHEMA_VERSION, currency: CURRENCY,
            exportedAt: typeof payload.exportedAt === 'string' && Number.isFinite(Date.parse(payload.exportedAt)) ? payload.exportedAt : new Date().toISOString(),
            records: validated.records.map((record, index) => ({ id: payload.records[index].id.trim(), ...record })),
            goals: validated.goals, cashFlowEntries: validated.cashFlowEntries, budgets: validated.budgets,
            historicalSnapshots: validated.historicalSnapshots, investmentAccounts: validated.investmentAccounts,
            investmentInstruments: validated.investmentInstruments, investmentTransactions: validated.investmentTransactions,
            investmentValuations: validated.investmentValuations
        };
    } catch (error) { throw new WorkspaceValidationError(error instanceof Error ? error.message : 'The supplied workspace is invalid.'); }
}
function createSnapshotTable(database) {
    database.exec(`CREATE TABLE workspace_snapshot (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_version INTEGER NOT NULL CHECK (schema_version = 5),
        currency TEXT NOT NULL CHECK (currency = 'INR'),
        payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
}
/** Persist a portable v4 JSON recovery artifact before changing the live database. */
function writePreMigrationBackup(databasePath, oldPayload, validated) {
    const backupPayload = {
        schemaVersion: 4, currency: CURRENCY, exportedAt: oldPayload.exportedAt,
        records: validated.records.map((record, index) => ({ id: oldPayload.records[index].id, ...record })),
        goals: validated.goals, cashFlowEntries: validated.cashFlowEntries, budgets: validated.budgets,
        historicalSnapshots: validated.historicalSnapshots
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = databasePath + '.pre-v5-' + stamp;
    let backupPath;
    let descriptor;
    for (let suffix = 0; ; suffix += 1) {
        backupPath = basePath + (suffix ? '-' + suffix : '') + '.json';
        try { descriptor = openSync(backupPath, 'wx', 0o600); break; }
        catch (error) { if (error?.code !== 'EEXIST') throw error; }
    }
    try {
        writeFileSync(descriptor, JSON.stringify(backupPayload, null, 2) + '\n', 'utf8');
        fsyncSync(descriptor);
    } catch (error) {
        try { closeSync(descriptor); } catch { /* preserve the original write error */ }
        try { unlinkSync(backupPath); } catch { /* keep an incomplete artifact visible */ }
        throw new Error('The required pre-migration v4 backup could not be completed; the database migration was cancelled.', { cause: error });
    }
    closeSync(descriptor);
    if (process.platform !== 'win32') chmodSync(backupPath, 0o600);
    return backupPath;
}

/** Transactional v4 -> v5 migration. Existing five collections and IDs are retained. */
function migrateSchemaV4(database, databasePath) {
    const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
    if (!table) { createSnapshotTable(database); return; }
    if (!/schema_version\s*=\s*4/i.test(table.sql ?? '')) return;
    database.exec('BEGIN IMMEDIATE');
    try {
        const row = database.prepare('SELECT schema_version, currency, payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1').get();
        let migrated = null;
        if (row) {
            if (row.schema_version !== 4 || row.currency !== CURRENCY) throw new Error('The existing SQLite workspace has an unsupported schema or currency; migration was not applied.');
            const oldPayload = JSON.parse(row.payload_json);
            if (oldPayload.schemaVersion !== 4) throw new Error('The saved SQLite payload does not match its v4 database schema; migration was not applied.');
            const validated = validateBackupPayload(oldPayload, CURRENCY);
            writePreMigrationBackup(databasePath, oldPayload, validated);
            migrated = {
                schemaVersion: 5, currency: CURRENCY, exportedAt: oldPayload.exportedAt,
                records: validated.records.map((record, index) => ({ id: oldPayload.records[index].id, ...record })),
                goals: validated.goals, cashFlowEntries: validated.cashFlowEntries, budgets: validated.budgets,
                historicalSnapshots: validated.historicalSnapshots, investmentAccounts: [], investmentInstruments: [],
                investmentTransactions: [], investmentValuations: []
            };
        }
        database.exec('ALTER TABLE workspace_snapshot RENAME TO workspace_snapshot_v4_migration');
        createSnapshotTable(database);
        if (migrated) database.prepare('INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at) VALUES (1, 5, ?, ?, ?)')
            .run(CURRENCY, JSON.stringify(migrated), row.updated_at);
        database.exec('DROP TABLE workspace_snapshot_v4_migration');
        database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
}
/** SQLite persistence stores a complete validated workspace snapshot atomically. */
export class WorkspaceDatabase {
    #database; #databasePath;
    constructor(databasePath) {
        if (typeof databasePath !== 'string' || !databasePath.trim()) throw new TypeError('A SQLite database path is required.');
        const path = resolve(databasePath); this.#databasePath = path;
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        this.#database = new DatabaseSync(path);
        try {
            this.#secureFilePermissions();
            this.#database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
            migrateSchemaV4(this.#database, this.#databasePath);
            this.#secureFilePermissions();
        } catch (error) { this.#database.close(); throw error; }
    }
    #secureFilePermissions() {
        if (process.platform === 'win32') return;
        for (const filePath of [this.#databasePath, this.#databasePath + '-wal', this.#databasePath + '-shm', this.#databasePath + '-journal']) if (existsSync(filePath)) chmodSync(filePath, 0o600);
    }
    getStatus() {
        const row = this.#database.prepare('SELECT schema_version, currency, updated_at, length(payload_json) AS payload_bytes FROM workspace_snapshot WHERE singleton = 1').get();
        return { database: 'SQLite', configured: true, hasWorkspace: Boolean(row), schemaVersion: row?.schema_version ?? SCHEMA_VERSION,
            currency: row?.currency ?? CURRENCY, updatedAt: row?.updated_at ?? null, payloadBytes: row?.payload_bytes ?? 0 };
    }
    checkIntegrity() {
        const messages = this.#database.prepare('PRAGMA quick_check').all().map((row) => String(row.quick_check));
        return { ok: messages.length === 1 && messages[0] === 'ok', messages };
    }
    getWorkspace() {
        const row = this.#database.prepare('SELECT payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1').get();
        if (!row) return null;
        let parsed; try { parsed = JSON.parse(row.payload_json); }
        catch { throw new Error('The saved SQLite workspace is unreadable. The database was not modified.'); }
        return { payload: validateWorkspacePayload(parsed), updatedAt: row.updated_at };
    }
    saveWorkspace(payload, expectedUpdatedAt = null) {
        const validated = validateWorkspacePayload(payload);
        if (expectedUpdatedAt !== null && (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))) throw new WorkspaceValidationError('Expected database version must be null or a valid saved timestamp.');
        const serialized = JSON.stringify(validated);
        if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) throw new WorkspaceValidationError('The workspace exceeds the 10 MiB database request limit.');
        let updatedAt = new Date().toISOString();
        this.#database.exec('BEGIN IMMEDIATE');
        try {
            const current = this.#database.prepare('SELECT updated_at FROM workspace_snapshot WHERE singleton = 1').get();
            if ((current?.updated_at ?? null) !== expectedUpdatedAt) throw new WorkspaceConflictError();
            if (current?.updated_at && updatedAt <= current.updated_at) updatedAt = new Date(Date.parse(current.updated_at) + 1).toISOString();
            this.#database.prepare(`INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at)
                VALUES (1, ?, ?, ?, ?) ON CONFLICT(singleton) DO UPDATE SET schema_version = excluded.schema_version,
                currency = excluded.currency, payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
                .run(SCHEMA_VERSION, CURRENCY, serialized, updatedAt);
            this.#secureFilePermissions(); this.#database.exec('COMMIT');
        } catch (error) { this.#database.exec('ROLLBACK'); throw error; }
        const status = this.getStatus();
        return { ...status, updatedAt, recordCount: validated.records.length, goalCount: validated.goals.length,
            cashFlowTransactionCount: validated.cashFlowEntries.length, budgetCount: validated.budgets.length,
            historicalSnapshotCount: validated.historicalSnapshots.length, investmentAccountCount: validated.investmentAccounts.length,
            investmentInstrumentCount: validated.investmentInstruments.length, investmentTransactionCount: validated.investmentTransactions.length,
            investmentValuationCount: validated.investmentValuations.length };
    }
    close() { this.#database.close(); }
}
