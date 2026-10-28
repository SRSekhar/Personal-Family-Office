import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { validateBackupPayload } from '../../apps/dashboard/backup.js';

const SCHEMA_VERSION = 4;
const CURRENCY = 'INR';

export class WorkspaceValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WorkspaceValidationError';
    }
}

/** Resolve the private SQLite file outside the Git checkout by default. */
export function resolveDatabasePath(env = process.env, home = homedir(), platform = process.platform) {
    if (typeof env.PFO_DATABASE_PATH === 'string' && env.PFO_DATABASE_PATH.trim()) {
        return resolve(env.PFO_DATABASE_PATH.trim());
    }
    if (platform === 'win32') {
        const base = typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA.trim()
            ? env.LOCALAPPDATA
            : join(home, 'AppData', 'Local');
        return join(base, 'PFO-OS', 'pfo-os.sqlite');
    }
    return join(home, '.local', 'share', 'PFO-OS', 'pfo-os.sqlite');
}

function validateWorkspacePayload(payload) {
    try {
        if (!payload || payload.schemaVersion !== SCHEMA_VERSION
            || !Array.isArray(payload.records) || !Array.isArray(payload.goals)
            || !Array.isArray(payload.cashFlowEntries) || !Array.isArray(payload.budgets)
            || !Array.isArray(payload.historicalSnapshots)) {
            throw new Error('SQLite workspace persistence requires a complete schema-v4 workspace backup.');
        }
        if (payload.currency !== CURRENCY) {
            throw new Error(`Workspace currency must be ${CURRENCY}; this snapshot uses ${String(payload.currency ?? 'no currency')}.`);
        }
        const ids = new Set();
        for (const record of payload.records) {
            if (!record || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)) {
                throw new Error('Financial records must have unique, non-empty identifiers before database persistence.');
            }
            ids.add(record.id);
        }
        const validated = validateBackupPayload(payload, CURRENCY);
        return {
            schemaVersion: SCHEMA_VERSION,
            currency: CURRENCY,
            exportedAt: typeof payload.exportedAt === 'string' && Number.isFinite(Date.parse(payload.exportedAt))
                ? payload.exportedAt
                : new Date().toISOString(),
            records: validated.records.map((record, index) => ({
                id: payload.records[index].id.trim(),
                ...record
            })),
            goals: validated.goals,
            cashFlowEntries: validated.cashFlowEntries,
            budgets: validated.budgets,
            historicalSnapshots: validated.historicalSnapshots
        };
    } catch (error) {
        throw new WorkspaceValidationError(error instanceof Error
            ? error.message
            : 'The supplied workspace is invalid.');
    }
}

/**
 * SQLite persistence stores one complete validated workspace snapshot.
 * A single row plus a transaction keeps all five collections atomic.
 */
export class WorkspaceDatabase {
    #database;

    constructor(databasePath) {
        if (typeof databasePath !== 'string' || !databasePath.trim()) {
            throw new TypeError('A SQLite database path is required.');
        }
        const path = resolve(databasePath);
        mkdirSync(dirname(path), { recursive: true });
        this.#database = new DatabaseSync(path);
        this.#database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
        this.#database.exec(`
            CREATE TABLE IF NOT EXISTS workspace_snapshot (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                schema_version INTEGER NOT NULL CHECK (schema_version = 4),
                currency TEXT NOT NULL CHECK (currency = 'INR'),
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
    }

    getStatus() {
        const row = this.#database.prepare(
            'SELECT schema_version, currency, updated_at, length(payload_json) AS payload_bytes FROM workspace_snapshot WHERE singleton = 1'
        ).get();
        return {
            database: 'SQLite',
            configured: true,
            hasWorkspace: Boolean(row),
            schemaVersion: row?.schema_version ?? SCHEMA_VERSION,
            currency: row?.currency ?? CURRENCY,
            updatedAt: row?.updated_at ?? null,
            payloadBytes: row?.payload_bytes ?? 0
        };
    }

    getWorkspace() {
        const row = this.#database.prepare(
            'SELECT payload_json, updated_at FROM workspace_snapshot WHERE singleton = 1'
        ).get();
        if (!row) return null;
        let parsed;
        try {
            parsed = JSON.parse(row.payload_json);
        } catch {
            throw new Error('The saved SQLite workspace is unreadable. The database was not modified.');
        }
        const payload = validateWorkspacePayload(parsed);
        return { payload, updatedAt: row.updated_at };
    }

    saveWorkspace(payload) {
        const validated = validateWorkspacePayload(payload);
        const serialized = JSON.stringify(validated);
        if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) {
            throw new WorkspaceValidationError('The workspace exceeds the 10 MiB database request limit.');
        }
        const updatedAt = new Date().toISOString();
        this.#database.exec('BEGIN IMMEDIATE');
        try {
            this.#database.prepare(`
                INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at)
                VALUES (1, ?, ?, ?, ?)
                ON CONFLICT(singleton) DO UPDATE SET
                    schema_version = excluded.schema_version,
                    currency = excluded.currency,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
            `).run(SCHEMA_VERSION, CURRENCY, serialized, updatedAt);
            this.#database.exec('COMMIT');
        } catch (error) {
            this.#database.exec('ROLLBACK');
            throw error;
        }
        const status = this.getStatus();
        return { ...status, updatedAt, recordCount: validated.records.length,
            goalCount: validated.goals.length, cashFlowTransactionCount: validated.cashFlowEntries.length,
            budgetCount: validated.budgets.length, historicalSnapshotCount: validated.historicalSnapshots.length };
    }

    close() {
        this.#database.close();
    }
}
