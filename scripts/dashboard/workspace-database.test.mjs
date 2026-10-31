import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceConflictError, WorkspaceDatabase, WorkspaceValidationError, resolveDatabasePath } from './workspace-database.mjs';

const directories = [];
const databases = [];
async function createDatabase() {
    const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-test-'));
    directories.push(directory);
    const database = new WorkspaceDatabase(join(directory, 'workspace.sqlite'));
    databases.push(database);
    return database;
}
function payload(overrides = {}) {
    return {
        schemaVersion: 5, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
        records: [
            { id: 'record-1', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 125000 },
            { id: 'record-2', name: 'Home loan', category: 'Home loan', type: 'liability', value: 25000 }
        ],
        goals: [], cashFlowEntries: [{ id: 'cash-1', date: '2026-10-01', type: 'income', category: 'Salary', description: 'Monthly salary', amount: 100000, recurring: true }],
        budgets: [{ month: '2026-10', category: 'Groceries', amount: 12000 }],
        historicalSnapshots: [{ date: '2026-09-30', currency: 'INR',
            records: [{ id: 'history-1', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 100000 }],
            totals: { assets: 100000, liabilities: 0, netWorth: 100000 } }],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [{ id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
            cashAmount: { amount: -200, currency: 'INR' }, quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
            date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z' }],
        investmentValuations: [{ instrumentId: 'instrument-1', price: { amount: 110, currency: 'INR' },
            asOf: '2026-10-03T00:00:00.000Z', recordedAt: '2026-10-03T00:00:00.000Z', sourceType: 'manual', sourceName: 'User-entered' }],
        ...overrides
    };
}
afterEach(async () => {
    for (const database of databases.splice(0)) { try { database.close(); } catch { /* already closed */ } }
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite workspace persistence schema v5', () => {
    it('persists all nine collections atomically and preserves IDs and valuation provenance after reopen', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-reopen-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const first = new WorkspaceDatabase(path); databases.push(first);
        const saved = first.saveWorkspace(payload());
        expect(saved).toMatchObject({ database: 'SQLite', configured: true, hasWorkspace: true, schemaVersion: 5,
            recordCount: 2, goalCount: 0, cashFlowTransactionCount: 1, budgetCount: 1, historicalSnapshotCount: 1,
            investmentAccountCount: 1, investmentInstrumentCount: 1, investmentTransactionCount: 1, investmentValuationCount: 1 });
        first.close(); databases.splice(databases.indexOf(first), 1);
        const reopened = new WorkspaceDatabase(path); databases.push(reopened);
        expect(reopened.getWorkspace().payload).toEqual(payload());
        expect(reopened.getWorkspace().payload.investmentTransactions[0].id).toBe('transaction-1');
        expect(reopened.getWorkspace().payload.investmentValuations[0].sourceName).toBe('User-entered');
        expect(reopened.getStatus().updatedAt).toBe(saved.updatedAt);
    });
    it('migrates an existing v4 SQLite snapshot without losing legacy collections or stable IDs', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v4-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({ schemaVersion: 4 });
        delete legacy.investmentAccounts; delete legacy.investmentInstruments;
        delete legacy.investmentTransactions; delete legacy.investmentValuations;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 4),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 4, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();
        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        const result = migrated.getWorkspace();
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 5, updatedAt: '2026-10-28T12:00:00.000Z' });
        expect(result.payload.records.map((item) => item.id)).toEqual(['record-1', 'record-2']);
        expect(result.payload.cashFlowEntries).toEqual(legacy.cashFlowEntries);
        expect(result.payload.historicalSnapshots).toEqual(legacy.historicalSnapshots);
        expect(result.payload.investmentAccounts).toEqual([]);
        expect(result.payload.investmentTransactions).toEqual([]);
        const backupFiles = readdirSync(directory).filter((name) => name.includes('.pre-v5-') && name.endsWith('.json'));
        expect(backupFiles).toHaveLength(1);
        const recovery = JSON.parse(readFileSync(join(directory, backupFiles[0]), 'utf8'));
        expect(recovery).toMatchObject({ schemaVersion: 4, currency: 'INR', exportedAt: legacy.exportedAt });
        expect(recovery.records.map((item) => item.id)).toEqual(['record-1', 'record-2']);
        expect(recovery.cashFlowEntries).toEqual(legacy.cashFlowEntries);
        expect(recovery.historicalSnapshots).toEqual(legacy.historicalSnapshots);
        expect(recovery).not.toHaveProperty('investmentAccounts');
        if (process.platform !== 'win32') expect(statSync(join(directory, backupFiles[0])).mode & 0o777).toBe(0o600);
    });
    it('leaves a v4 database untouched when migration validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v4-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 4, currency: 'USD' });
        delete invalidLegacy.investmentAccounts; delete invalidLegacy.investmentInstruments;
        delete invalidLegacy.investmentTransactions; delete invalidLegacy.investmentValuations;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 4),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 4, ?, ?, ?)').run('USD', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        expect(() => new WorkspaceDatabase(path)).toThrow(/unsupported schema or currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 4/i);
        expect(row).toMatchObject({ schema_version: 4, currency: 'USD', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v5-'))).toHaveLength(0);
    });
    it('rejects stale database versions without replacing a newer committed snapshot', async () => {
        const database = await createDatabase();
        const first = database.saveWorkspace(payload(), null);
        const second = database.saveWorkspace(payload({ records: [{ id: 'record-new', name: 'Updated savings', category: 'Cash & deposits', type: 'asset', value: 200000 }] }), first.updatedAt);
        expect(() => database.saveWorkspace(payload(), first.updatedAt)).toThrow(WorkspaceConflictError);
        expect(database.getWorkspace().payload.records[0].id).toBe('record-new');
        expect(database.getStatus().updatedAt).toBe(second.updatedAt);
    });
    it('reports healthy integrity without changing its snapshot', async () => {
        const database = await createDatabase(); const saved = database.saveWorkspace(payload());
        expect(database.checkIntegrity()).toEqual({ ok: true, messages: ['ok'] });
        expect(database.getWorkspace().payload).toEqual(payload());
        expect(database.getStatus().updatedAt).toBe(saved.updatedAt);
    });
    it('starts empty and reports schema v5', async () => {
        const database = await createDatabase();
        expect(database.getWorkspace()).toBeNull();
        expect(database.getStatus()).toMatchObject({ database: 'SQLite', configured: true, hasWorkspace: false, schemaVersion: 5, currency: 'INR', updatedAt: null });
    });
    it('rejects incomplete, wrong-currency, duplicate-ID and invalid financial snapshots', async () => {
        const database = await createDatabase();
        expect(() => database.saveWorkspace({ schemaVersion: 5, currency: 'INR' })).toThrow(WorkspaceValidationError);
        expect(() => database.saveWorkspace(payload({ currency: 'USD' }))).toThrow(/currency must be INR/i);
        expect(() => database.saveWorkspace(payload({ records: [
            { id: 'same', name: 'Savings', category: 'Cash', type: 'asset', value: 10 },
            { id: 'same', name: 'Other', category: 'Other', type: 'asset', value: 20 }
        ] }))).toThrow(/unique, non-empty identifiers/i);
        expect(() => database.saveWorkspace(payload({ investmentTransactions: [{ id: 'bad', accountId: 'missing', instrumentId: 'missing', type: 'Purchase',
            cashAmount: { amount: -2, currency: 'INR' }, quantity: 1, unitPrice: { amount: 2, currency: 'INR' },
            date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-01T00:00:00.000Z' }] }))).toThrow(/unknown account or instrument/i);
        expect(database.getWorkspace()).toBeNull();
    });
    it('preserves the previous committed snapshot when a later write is invalid', async () => {
        const database = await createDatabase(); database.saveWorkspace(payload());
        expect(() => database.saveWorkspace(payload({ investmentValuations: [{ instrumentId: 'missing', price: { amount: 2, currency: 'INR' },
            asOf: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-01T00:00:00.000Z', sourceType: 'manual', sourceName: 'User' }] }))).toThrow();
        expect(database.getWorkspace().payload).toEqual(payload());
    });
    it('restricts database and sidecar permissions on POSIX systems', async () => {
        if (process.platform === 'win32') return;
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-permissions-')); directories.push(directory);
        const path = join(directory, 'private.sqlite'); const database = new WorkspaceDatabase(path); databases.push(database);
        database.saveWorkspace(payload());
        expect(statSync(path).mode & 0o777).toBe(0o600);
        for (const suffix of ['-wal', '-shm', '-journal']) if (existsSync(path + suffix)) expect(statSync(path + suffix).mode & 0o777).toBe(0o600);
    });
    it('resolves explicit paths and keeps defaults outside the repository', () => {
        expect(resolveDatabasePath({ PFO_DATABASE_PATH: './private-data/pfo.sqlite' }, '/home/test', 'linux')).toBe(join(process.cwd(), 'private-data', 'pfo.sqlite'));
        expect(resolveDatabasePath({}, '/home/test', 'linux')).toBe('/home/test/.local/share/PFO-OS/pfo-os.sqlite');
        expect(resolveDatabasePath({ LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local' }, 'C:\\Users\\test', 'win32'))
            .toBe(join('C:\\Users\\test\\AppData\\Local', 'PFO-OS', 'pfo-os.sqlite'));
    });
});
