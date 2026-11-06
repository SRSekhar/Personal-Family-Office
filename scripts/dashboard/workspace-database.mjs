import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateBackupPayload } from '../../apps/dashboard/backup.js';

const SCHEMA_VERSION = 7;
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
            'investmentInstruments', 'investmentTransactions', 'investmentValuations', 'investmentCashAccounts',
            'investmentCashMovements', 'investmentCashTransfers', 'investmentCashStatements', 'investmentAllocationPolicies'];
        if (!payload || payload.schemaVersion !== SCHEMA_VERSION || required.some((key) => !Array.isArray(payload[key]))) {
            throw new Error('SQLite workspace persistence requires a complete schema-v7 workspace backup.');
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
            investmentValuations: validated.investmentValuations, investmentCashAccounts: validated.investmentCashAccounts,
            investmentCashMovements: validated.investmentCashMovements, investmentCashTransfers: validated.investmentCashTransfers,
            investmentCashStatements: validated.investmentCashStatements,
            investmentAllocationPolicies: validated.investmentAllocationPolicies,
            ...(payload.allocationPoliciesMigratedFromV6 === true ? { allocationPoliciesMigratedFromV6: true } : {})
        };
    } catch (error) { throw new WorkspaceValidationError(error instanceof Error ? error.message : 'The supplied workspace is invalid.'); }
}
function createSnapshotTable(database, version = 5) {
    database.exec(`CREATE TABLE workspace_snapshot (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_version INTEGER NOT NULL CHECK (schema_version = ${version}),
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

/** Persist a portable schema-v5 recovery artifact before the additive v5 -> v6 migration. */
function writePreV6MigrationBackup(databasePath, payload) {
    const backupPayload = {
        schemaVersion: 5, currency: CURRENCY, exportedAt: payload.exportedAt,
        records: payload.records, goals: payload.goals, cashFlowEntries: payload.cashFlowEntries,
        budgets: payload.budgets, historicalSnapshots: payload.historicalSnapshots,
        investmentAccounts: payload.investmentAccounts, investmentInstruments: payload.investmentInstruments,
        investmentTransactions: payload.investmentTransactions, investmentValuations: payload.investmentValuations
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = databasePath + '.pre-v6-' + stamp;
    let backupPath; let descriptor;
    for (let suffix = 0; ; suffix += 1) {
        backupPath = basePath + (suffix ? '-' + suffix : '') + '.json';
        try { descriptor = openSync(backupPath, 'wx', 0o600); break; }
        catch (error) { if (error?.code !== 'EEXIST') throw error; }
    }
    try {
        writeFileSync(descriptor, JSON.stringify(backupPayload, null, 2) + '\n', 'utf8');
        fsyncSync(descriptor);
    } catch (error) {
        try { closeSync(descriptor); } catch { /* preserve original write error */ }
        try { unlinkSync(backupPath); } catch { /* incomplete recovery artifact remains visible */ }
        throw new Error('The required pre-migration v5 backup could not be completed; the database migration was cancelled.', { cause: error });
    }
    closeSync(descriptor);
    if (process.platform !== 'win32') chmodSync(backupPath, 0o600);
    return backupPath;
}

/** Transactional v5 -> v6 migration. No cash accounts or balances are inferred. */
function migrateSchemaV5(database, databasePath) {
    const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
    if (!table || !/schema_version\s*=\s*5/i.test(table.sql ?? '')) return;
    database.exec('BEGIN IMMEDIATE');
    try {
        const row = database.prepare('SELECT schema_version, currency, payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1').get();
        let migrated = null;
        if (row) {
            if (row.schema_version !== 5 || row.currency !== CURRENCY) throw new Error('The existing SQLite workspace has an unsupported schema or currency; migration was not applied.');
            const oldPayload = JSON.parse(row.payload_json);
            if (oldPayload.schemaVersion !== 5) throw new Error('The saved SQLite payload does not match its v5 database schema; migration was not applied.');
            const validated = validateBackupPayload(oldPayload, CURRENCY);
            writePreV6MigrationBackup(databasePath, oldPayload);
            migrated = {
                schemaVersion: 6, currency: CURRENCY, exportedAt: oldPayload.exportedAt,
                records: oldPayload.records, goals: validated.goals, cashFlowEntries: validated.cashFlowEntries,
                budgets: validated.budgets, historicalSnapshots: validated.historicalSnapshots,
                investmentAccounts: validated.investmentAccounts, investmentInstruments: validated.investmentInstruments,
                investmentTransactions: validated.investmentTransactions, investmentValuations: validated.investmentValuations,
                investmentCashAccounts: validated.investmentCashAccounts ?? [], investmentCashMovements: validated.investmentCashMovements ?? [],
                investmentCashTransfers: validated.investmentCashTransfers ?? [], investmentCashStatements: validated.investmentCashStatements ?? []
            };
        }
        database.exec('ALTER TABLE workspace_snapshot RENAME TO workspace_snapshot_v5_migration');
        createSnapshotTable(database, 6);
        if (migrated) database.prepare('INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at) VALUES (1, 6, ?, ?, ?)')
            .run(CURRENCY, JSON.stringify(migrated), row.updated_at);
        database.exec('DROP TABLE workspace_snapshot_v5_migration');
        database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
}


/** Persist the exact schema-v6 snapshot before the additive v6 -> v7 migration. */
function writePreV7MigrationBackup(databasePath, payload) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basePath = databasePath + '.pre-v7-' + stamp;
    let backupPath; let descriptor;
    for (let suffix = 0; ; suffix += 1) {
        backupPath = basePath + (suffix ? '-' + suffix : '') + '.json';
        try { descriptor = openSync(backupPath, 'wx', 0o600); break; }
        catch (error) { if (error?.code !== 'EEXIST') throw error; }
    }
    try {
        writeFileSync(descriptor, JSON.stringify(payload, null, 2) + '\n', 'utf8');
        fsyncSync(descriptor);
    } catch (error) {
        try { closeSync(descriptor); } catch { /* preserve original error */ }
        try { unlinkSync(backupPath); } catch { /* incomplete artifact remains visible */ }
        throw new Error('The required pre-migration v6 backup could not be completed; the database migration was cancelled.', { cause: error });
    }
    closeSync(descriptor);
    if (process.platform !== 'win32') chmodSync(backupPath, 0o600);
    return backupPath;
}

/** Transactional v6 -> v7 migration. Allocation policies start empty; none are inferred. */
function migrateSchemaV6(database, databasePath) {
    const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
    if (!table || !/schema_version\s*=\s*6/i.test(table.sql ?? '')) return;
    database.exec('BEGIN IMMEDIATE');
    try {
        const row = database.prepare('SELECT schema_version, currency, payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1').get();
        let migrated = null;
        if (row) {
            if (row.schema_version !== 6 || row.currency !== CURRENCY) throw new Error('The existing SQLite workspace has an unsupported schema or currency; migration was not applied.');
            const oldPayload = JSON.parse(row.payload_json);
            if (oldPayload.schemaVersion !== 6) throw new Error('The saved SQLite payload does not match its v6 database schema; migration was not applied.');
            const validated = validateBackupPayload(oldPayload, CURRENCY);
            writePreV7MigrationBackup(databasePath, {
                schemaVersion: 6, currency: CURRENCY, exportedAt: oldPayload.exportedAt,
                records: oldPayload.records, goals: validated.goals, cashFlowEntries: validated.cashFlowEntries,
                budgets: validated.budgets, historicalSnapshots: validated.historicalSnapshots,
                investmentAccounts: validated.investmentAccounts, investmentInstruments: validated.investmentInstruments,
                investmentTransactions: validated.investmentTransactions, investmentValuations: validated.investmentValuations,
                investmentCashAccounts: validated.investmentCashAccounts, investmentCashMovements: validated.investmentCashMovements,
                investmentCashTransfers: validated.investmentCashTransfers, investmentCashStatements: validated.investmentCashStatements
            });
            migrated = {
                schemaVersion: 7, currency: CURRENCY, exportedAt: oldPayload.exportedAt,
                records: oldPayload.records, goals: validated.goals, cashFlowEntries: validated.cashFlowEntries,
                budgets: validated.budgets, historicalSnapshots: validated.historicalSnapshots,
                investmentAccounts: validated.investmentAccounts, investmentInstruments: validated.investmentInstruments,
                investmentTransactions: validated.investmentTransactions, investmentValuations: validated.investmentValuations,
                investmentCashAccounts: validated.investmentCashAccounts, investmentCashMovements: validated.investmentCashMovements,
                investmentCashTransfers: validated.investmentCashTransfers, investmentCashStatements: validated.investmentCashStatements,
                investmentAllocationPolicies: [], allocationPoliciesMigratedFromV6: true
            };
        }
        database.exec('ALTER TABLE workspace_snapshot RENAME TO workspace_snapshot_v6_migration');
        createSnapshotTable(database, 7);
        if (migrated) database.prepare('INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at) VALUES (1, 7, ?, ?, ?)')
            .run(CURRENCY, JSON.stringify(migrated), row.updated_at);
        database.exec('DROP TABLE workspace_snapshot_v6_migration');
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
            migrateSchemaV5(this.#database, this.#databasePath);
            migrateSchemaV6(this.#database, this.#databasePath);
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
            investmentValuationCount: validated.investmentValuations.length, investmentCashAccountCount: validated.investmentCashAccounts.length,
            investmentCashMovementCount: validated.investmentCashMovements.length, investmentCashTransferCount: validated.investmentCashTransfers.length,
            investmentCashStatementCount: validated.investmentCashStatements.length,
            investmentAllocationPolicyCount: validated.investmentAllocationPolicies.length };
    }
    async createOnlineBackup() {
        if (!this.getWorkspace()) throw new Error('No committed SQLite workspace exists to back up.');
        const backupDirectory = this.#databasePath + '.backups';
        mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
        if (process.platform !== 'win32') chmodSync(backupDirectory, 0o700);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pfo-os-sqlite-${timestamp}-${randomUUID()}.sqlite`;
        const destinationPath = join(backupDirectory, filename);
        const temporaryPath = join(backupDirectory, `.${filename}.tmp`);
        let verificationDatabase;
        try {
            await sqliteBackup(this.#database, temporaryPath, { rate: 100 });
            verificationDatabase = new DatabaseSync(temporaryPath);
            const messages = verificationDatabase.prepare('PRAGMA quick_check').all().map((row) => String(row.quick_check));
            if (messages.length !== 1 || messages[0] !== 'ok') throw new Error('SQLite backup integrity verification failed.');
            const row = verificationDatabase.prepare('SELECT schema_version, currency, payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1').get();
            if (!row || row.schema_version !== SCHEMA_VERSION || row.currency !== CURRENCY) throw new Error('SQLite backup does not contain a schema-v7 workspace.');
            const payload = validateWorkspacePayload(JSON.parse(row.payload_json));
            verificationDatabase.close(); verificationDatabase = undefined;
            const descriptor = openSync(temporaryPath, 'r+');
            try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
            if (process.platform !== 'win32') chmodSync(temporaryPath, 0o600);
            renameSync(temporaryPath, destinationPath);
            if (process.platform !== 'win32') {
                const directoryDescriptor = openSync(backupDirectory, 'r');
                try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
            }
            const file = statSync(destinationPath);
            return {
                filename, directory: backupDirectory, path: destinationPath, bytes: file.size,
                updatedAt: row.updated_at, schemaVersion: SCHEMA_VERSION,
                collectionCounts: {
                    records: payload.records.length, goals: payload.goals.length, cashFlowEntries: payload.cashFlowEntries.length,
                    budgets: payload.budgets.length, historicalSnapshots: payload.historicalSnapshots.length,
                    investmentAccounts: payload.investmentAccounts.length, investmentInstruments: payload.investmentInstruments.length,
                    investmentTransactions: payload.investmentTransactions.length, investmentValuations: payload.investmentValuations.length,
                    investmentCashAccounts: payload.investmentCashAccounts.length, investmentCashMovements: payload.investmentCashMovements.length,
                    investmentCashTransfers: payload.investmentCashTransfers.length, investmentCashStatements: payload.investmentCashStatements.length,
                    investmentAllocationPolicies: payload.investmentAllocationPolicies.length
                }
            };
        } catch (error) {
            try { verificationDatabase?.close(); } catch { /* preserve original error */ }
            for (const candidate of [temporaryPath, temporaryPath + '-wal', temporaryPath + '-shm', temporaryPath + '-journal']) {
                try { unlinkSync(candidate); } catch { /* temporary artifact may not exist */ }
            }
            throw error;
        }
    }
    close() { this.#database.close(); }
}
