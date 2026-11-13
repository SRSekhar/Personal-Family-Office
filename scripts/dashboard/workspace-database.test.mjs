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
    const schemaVersion = overrides.schemaVersion ?? 10;
    return {
        schemaVersion, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
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
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [],
        ...(schemaVersion >= 8 ? { investmentConcentrationPolicies: [] } : {}),
        ...(schemaVersion >= 9 ? { investmentExposureClassifications: [] } : {}),
        ...(schemaVersion >= 10 ? { investmentExposurePolicies: [] } : {}),
        ...overrides
    };
}
afterEach(async () => {
    for (const database of databases.splice(0)) { try { database.close(); } catch { /* already closed */ } }
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite workspace persistence schema v10', () => {
    it('persists all seventeen collections atomically and preserves IDs and valuation provenance after reopen', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-reopen-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const first = new WorkspaceDatabase(path); databases.push(first);
        const saved = first.saveWorkspace(payload());
        expect(saved).toMatchObject({ database: 'SQLite', configured: true, hasWorkspace: true, schemaVersion: 10,
            recordCount: 2, goalCount: 0, cashFlowTransactionCount: 1, budgetCount: 1, historicalSnapshotCount: 1,
            investmentAccountCount: 1, investmentInstrumentCount: 1, investmentTransactionCount: 1, investmentValuationCount: 1, investmentCashAccountCount: 0, investmentCashMovementCount: 0,
            investmentCashTransferCount: 0, investmentCashStatementCount: 0, investmentAllocationPolicyCount: 0, investmentConcentrationPolicyCount: 0, investmentExposureClassificationCount: 0, investmentExposurePolicyCount: 0 });
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
        delete legacy.investmentCashAccounts; delete legacy.investmentCashMovements; delete legacy.investmentCashTransfers; delete legacy.investmentCashStatements; delete legacy.investmentAllocationPolicies;
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
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
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
        delete invalidLegacy.investmentCashAccounts; delete invalidLegacy.investmentCashMovements; delete invalidLegacy.investmentCashTransfers; delete invalidLegacy.investmentCashStatements;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 4),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 4, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        expect(() => new WorkspaceDatabase(path)).toThrow(/currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 4/i);
        expect(row).toMatchObject({ schema_version: 4, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v5-'))).toHaveLength(0);
    });

    it('migrates a v5 SQLite workspace through v6 to v7 with exact recovery backups and no inferred cash', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v5-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({ schemaVersion: 5 });
        delete legacy.investmentCashAccounts; delete legacy.investmentCashMovements;
        delete legacy.investmentCashTransfers; delete legacy.investmentCashStatements; delete legacy.investmentAllocationPolicies;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 5),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 5, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
        const saved = migrated.getWorkspace().payload;
        expect(saved.schemaVersion).toBe(10);
        expect(saved.investmentTransactions).toEqual(legacy.investmentTransactions);
        expect(saved.investmentValuations).toEqual(legacy.investmentValuations);
        expect(saved.investmentCashAccounts).toEqual([]);
        expect(saved.investmentCashMovements).toEqual([]);
        expect(saved.investmentCashTransfers).toEqual([]);
        expect(saved.investmentCashStatements).toEqual([]);
        expect(saved.allocationPoliciesMigratedFromV6).toBe(true);
        expect(saved.investmentConcentrationPolicies).toEqual([]);
        expect(saved.investmentExposureClassifications).toEqual([]);
        expect(saved.exposureClassificationsMigratedFromV8).toBe(true);
        expect(saved.investmentExposurePolicies).toEqual([]);
        expect(saved.exposurePoliciesMigratedFromV9).toBe(true);
        expect(saved.concentrationPoliciesMigratedFromV7).toBe(true);

        const backupFiles = readdirSync(directory).filter((name) => name.includes('.pre-v6-') && name.endsWith('.json'));
        expect(backupFiles).toHaveLength(1);
        const recovery = JSON.parse(readFileSync(join(directory, backupFiles[0]), 'utf8'));
        expect(recovery).toEqual(legacy);
        if (process.platform !== 'win32') expect(statSync(join(directory, backupFiles[0])).mode & 0o777).toBe(0o600);
    });

    it('leaves a v5 database untouched when v6 validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v5-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 5, currency: 'USD' });
        delete invalidLegacy.investmentCashAccounts; delete invalidLegacy.investmentCashMovements;
        delete invalidLegacy.investmentCashTransfers; delete invalidLegacy.investmentCashStatements;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 5),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 5, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        expect(() => new WorkspaceDatabase(path)).toThrow(/currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 5/i);
        expect(row).toMatchObject({ schema_version: 5, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v6-'))).toHaveLength(0);
    });

    it('migrates a v6 SQLite workspace to v7 with an exact v6 recovery backup and empty policy collection', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v6-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({ schemaVersion: 6 });
        delete legacy.investmentAllocationPolicies;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 6),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 6, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();
        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
        const saved = migrated.getWorkspace().payload;
        expect(saved.schemaVersion).toBe(9);
        expect(saved.investmentAllocationPolicies).toEqual([]);
        expect(saved.allocationPoliciesMigratedFromV6).toBe(true);
        expect(saved.investmentTransactions).toEqual(legacy.investmentTransactions);
        const backupFiles = readdirSync(directory).filter((name) => name.includes('.pre-v7-') && name.endsWith('.json'));
        expect(backupFiles).toHaveLength(1);
        const recovery = JSON.parse(readFileSync(join(directory, backupFiles[0]), 'utf8'));
        expect(recovery).toEqual(legacy);
        if (process.platform !== 'win32') expect(statSync(join(directory, backupFiles[0])).mode & 0o777).toBe(0o600);
    });
    it('leaves a v6 database untouched when schema-v7 migration validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v6-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 6, currency: 'USD' });
        delete invalidLegacy.investmentAllocationPolicies;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 6),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 6, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();
        expect(() => new WorkspaceDatabase(path)).toThrow(/currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 6/i);
        expect(row).toMatchObject({ schema_version: 6, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v7-'))).toHaveLength(0);
    });

    it('migrates a v7 workspace to v8 with a verified recovery artifact and no inferred concentration limits', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v7-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({
            schemaVersion: 7,
            investmentAllocationPolicies: [{
                id: 'allocation-existing-v1', policySetId: 'existing-allocation', version: 1, name: 'Existing allocation',
                currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType', effectiveFrom: '2026-01-01',
                recordedAt: '2026-01-01T00:00:00.000Z', targets: [{ key: 'MutualFund', weightPercent: 100 }]
            }]
        });
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 7),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 7, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
        const saved = migrated.getWorkspace().payload;
        expect(saved.schemaVersion).toBe(9);
        expect(saved.investmentAllocationPolicies).toEqual(legacy.investmentAllocationPolicies);
        expect(saved.investmentConcentrationPolicies).toEqual([]);
        expect(saved.concentrationPoliciesMigratedFromV7).toBe(true);

        const backups = readdirSync(directory).filter((name) => name.includes('.pre-v8-') && name.endsWith('.json'));
        expect(backups).toHaveLength(1);
        expect(JSON.parse(readFileSync(join(directory, backups[0]), 'utf8'))).toEqual(legacy);
        if (process.platform !== 'win32') expect(statSync(join(directory, backups[0])).mode & 0o777).toBe(0o600);
    });

    it('leaves a v7 database untouched when concentration-policy migration validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v7-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 7, currency: 'USD' });
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 7),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 7, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        expect(() => new WorkspaceDatabase(path)).toThrow(/currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 7/i);
        expect(row).toMatchObject({ schema_version: 7, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v8-'))).toHaveLength(0);
    });

    it('migrates a v8 workspace through v9 to v10 with verified recovery artifacts and no inferred classifications or policies', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v8-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({ schemaVersion: 8, investmentConcentrationPolicies: [{
            id: 'concentration-v1', policySetId: 'existing-limits', version: 1, name: 'Existing limits',
            currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType', effectiveFrom: '2026-01-01',
            recordedAt: '2026-01-01T00:00:00.000Z', rules: [{ key: 'MutualFund', maxWeightPercent: 70, operator: '>' }]
        }] });
        delete legacy.investmentExposureClassifications;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 8),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 8, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
        const saved = migrated.getWorkspace().payload;
        expect(saved.schemaVersion).toBe(9);
        expect(saved.investmentConcentrationPolicies).toEqual(legacy.investmentConcentrationPolicies);
        expect(saved.investmentExposureClassifications).toEqual([]);
        expect(saved.exposureClassificationsMigratedFromV8).toBe(true);
        expect(saved.investmentExposurePolicies).toEqual([]);
        expect(saved.exposurePoliciesMigratedFromV9).toBe(true);

        const preV9 = readdirSync(directory).filter((name) => name.includes('.pre-v9-') && name.endsWith('.json'));
        const preV10 = readdirSync(directory).filter((name) => name.includes('.pre-v10-') && name.endsWith('.json'));
        expect(preV9).toHaveLength(1);
        expect(preV10).toHaveLength(1);
        expect(JSON.parse(readFileSync(join(directory, preV9[0]), 'utf8'))).toEqual(legacy);
        expect(JSON.parse(readFileSync(join(directory, preV10[0]), 'utf8'))).toMatchObject({
            schemaVersion: 9, investmentExposureClassifications: [], exposureClassificationsMigratedFromV8: true
        });
        if (process.platform !== 'win32') {
            expect(statSync(join(directory, preV9[0])).mode & 0o777).toBe(0o600);
            expect(statSync(join(directory, preV10[0])).mode & 0o777).toBe(0o600);
        }
    });

    it('leaves a v8 database untouched when exposure-classification migration validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v8-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 8, currency: 'USD' });
        delete invalidLegacy.investmentExposureClassifications;
        const raw = new DatabaseSync(path);
        raw.exec(`CREATE TABLE workspace_snapshot (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            schema_version INTEGER NOT NULL CHECK (schema_version = 8),
            currency TEXT NOT NULL CHECK (currency = 'INR'),
            payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
        raw.prepare('INSERT INTO workspace_snapshot VALUES (1, 8, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();

        expect(() => new WorkspaceDatabase(path)).toThrow(/currency/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 8/i);
        expect(row).toMatchObject({ schema_version: 8, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        unchanged.close();
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v9-'))).toHaveLength(0);
    });

    it('migrates a v9 workspace to v10 with a verified pre-v10 recovery artifact and no inferred limits', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v9-migration-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const legacy = payload({ schemaVersion: 9 });
        const raw = new DatabaseSync(path);
        raw.exec("CREATE TABLE workspace_snapshot (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL CHECK (schema_version = 9), currency TEXT NOT NULL CHECK (currency = 'INR'), payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
        raw.prepare('INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at) VALUES (1, 9, ?, ?, ?)').run('INR', JSON.stringify(legacy), '2026-10-28T12:00:00.000Z');
        raw.close();
        const migrated = new WorkspaceDatabase(path); databases.push(migrated);
        expect(migrated.getStatus()).toMatchObject({ schemaVersion: 10, updatedAt: '2026-10-28T12:00:00.000Z' });
        const saved = migrated.getWorkspace().payload;
        expect(saved.investmentExposurePolicies).toEqual([]);
        expect(saved.exposurePoliciesMigratedFromV9).toBe(true);
        const backups = readdirSync(directory).filter((name) => name.includes('.pre-v10-') && name.endsWith('.json'));
        expect(backups).toHaveLength(1);
        expect(JSON.parse(readFileSync(join(directory, backups[0]), 'utf8'))).toEqual(legacy);
    });
    it('leaves a v9 database untouched when exposure-policy migration validation fails', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-v9-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const invalidLegacy = payload({ schemaVersion: 9, currency: 'USD' });
        const raw = new DatabaseSync(path);
        raw.exec("CREATE TABLE workspace_snapshot (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), schema_version INTEGER NOT NULL CHECK (schema_version = 9), currency TEXT NOT NULL CHECK (currency = 'INR'), payload_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
        raw.prepare('INSERT INTO workspace_snapshot (singleton, schema_version, currency, payload_json, updated_at) VALUES (1, 9, ?, ?, ?)').run('INR', JSON.stringify(invalidLegacy), '2026-10-28T12:00:00.000Z');
        raw.close();
        expect(() => new WorkspaceDatabase(path)).toThrow(/workspace currency must be INR/i);
        const unchanged = new DatabaseSync(path);
        const table = unchanged.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_snapshot'").get();
        const row = unchanged.prepare('SELECT schema_version, currency, payload_json FROM workspace_snapshot WHERE singleton = 1').get();
        expect(table.sql).toMatch(/schema_version = 9/i);
        expect(row).toMatchObject({ schema_version: 9, currency: 'INR', payload_json: JSON.stringify(invalidLegacy) });
        expect(readdirSync(directory).filter((name) => name.includes('.pre-v10-'))).toHaveLength(0);
        unchanged.close();
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
    it('starts empty and reports schema v10', async () => {
        const database = await createDatabase();
        expect(database.getWorkspace()).toBeNull();
        expect(database.getStatus()).toMatchObject({ database: 'SQLite', configured: true, hasWorkspace: false, schemaVersion: 10, currency: 'INR', updatedAt: null });
    });
    it('rejects incomplete, wrong-currency, duplicate-ID and invalid financial snapshots', async () => {
        const database = await createDatabase();
        expect(() => database.saveWorkspace({ schemaVersion: 10, currency: 'INR' })).toThrow(WorkspaceValidationError);
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
    it('rolls back a failed SQLite update and retains the previous committed snapshot', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-write-rollback-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const database = new WorkspaceDatabase(path); databases.push(database);
        const firstPayload = payload();
        const saved = database.saveWorkspace(firstPayload, null);

        const triggerConnection = new DatabaseSync(path);
        triggerConnection.exec(`CREATE TRIGGER reject_workspace_snapshot_update
            BEFORE UPDATE ON workspace_snapshot
            BEGIN
                SELECT RAISE(ABORT, 'simulated SQLite write failure');
            END;`);
        triggerConnection.close();

        const changedPayload = payload({
            records: [{ id: 'record-revised', name: 'Revised savings', category: 'Cash & deposits', type: 'asset', value: 999 }]
        });
        expect(() => database.saveWorkspace(changedPayload, saved.updatedAt)).toThrow(/simulated SQLite write failure/i);
        expect(database.getWorkspace()).toEqual({ payload: firstPayload, updatedAt: saved.updatedAt });
        expect(database.getStatus().updatedAt).toBe(saved.updatedAt);
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
    it('creates and restores a verified online SQLite backup across all 17 collections with stable IDs', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-recovery-drill-')); directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const original = payload({
            goals: [{
                id: 'goal-recovery-1', name: 'Emergency reserve', targetAmount: 500000, currentAmount: 125000,
                targetDate: '2027-12-31', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z'
            }],
            investmentCashAccounts: [
                { id: 'cash-recovery-1', investmentAccountId: 'account-1', name: 'Primary cash', currency: 'INR', createdAt: '2026-10-01T00:00:00.000Z' },
                { id: 'cash-recovery-2', investmentAccountId: 'account-1', name: 'Secondary cash', currency: 'INR', createdAt: '2026-10-01T00:00:00.000Z' }
            ],
            investmentCashMovements: [
                { id: 'cash-opening-1', cashAccountId: 'cash-recovery-1', type: 'OpeningBalance',
                    amount: { amount: 1000, currency: 'INR' }, effectiveAt: '2026-10-01T00:00:00.000Z',
                    recordedAt: '2026-10-01T00:00:00.000Z', openingBalanceSource: 'statement' },
                { id: 'cash-opening-2', cashAccountId: 'cash-recovery-2', type: 'OpeningBalance',
                    amount: { amount: 250, currency: 'INR' }, effectiveAt: '2026-10-01T00:00:00.000Z',
                    recordedAt: '2026-10-01T00:00:00.000Z', openingBalanceSource: 'statement' }
            ],
            investmentCashTransfers: [{
                id: 'cash-transfer-recovery-1', sourceCashAccountId: 'cash-recovery-1', destinationCashAccountId: 'cash-recovery-2',
                amount: { amount: 100, currency: 'INR' }, effectiveAt: '2026-10-02T00:00:00.000Z',
                recordedAt: '2026-10-02T00:00:00.000Z'
            }],
            investmentAllocationPolicies: [{
                id: 'allocation-policy-recovery-1', policySetId: 'recovery-policy', version: 1, name: 'Recovery allocation',
                currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType', effectiveFrom: '2026-01-01',
                recordedAt: '2026-10-01T00:00:00.000Z', targets: [{ key: 'MutualFund', weightPercent: 100 }]
            }],
            investmentConcentrationPolicies: [{
                id: 'concentration-policy-recovery-1', policySetId: 'recovery-concentration', version: 1, name: 'Recovery concentration',
                currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType', effectiveFrom: '2026-01-01',
                recordedAt: '2026-10-01T00:00:00.000Z',
                rules: [{ key: 'MutualFund', maxWeightPercent: 65, operator: '>' }]
            }],
            investmentCashStatements: [
                { id: 'cash-statement-1', cashAccountId: 'cash-recovery-1', closingBalance: { amount: 900, currency: 'INR' },
                    periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T00:00:00.000Z',
                    statementAsOf: '2026-10-31T00:00:00.000Z', recordedAt: '2026-10-31T00:00:00.000Z', sourceName: 'Primary statement' },
                { id: 'cash-statement-2', cashAccountId: 'cash-recovery-2', closingBalance: { amount: 350, currency: 'INR' },
                    periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T00:00:00.000Z',
                    statementAsOf: '2026-10-31T00:00:00.000Z', recordedAt: '2026-10-31T00:00:00.000Z', sourceName: 'Secondary statement' }
            ]
        });
        const first = new WorkspaceDatabase(path); databases.push(first);
        const committed = first.saveWorkspace(original, null);
        const backup = await first.createOnlineBackup();
        expect(backup).toMatchObject({
            filename: expect.stringMatching(/^pfo-os-sqlite-.*\.sqlite$/), directory: path + '.backups',
            path: expect.stringContaining('.backups'), bytes: expect.any(Number), updatedAt: committed.updatedAt,
            schemaVersion: 10, collectionCounts: {
                records: 2, goals: 1, cashFlowEntries: 1, budgets: 1, historicalSnapshots: 1,
                investmentAccounts: 1, investmentInstruments: 1, investmentTransactions: 1, investmentValuations: 1,
                investmentCashAccounts: 2, investmentCashMovements: 2, investmentCashTransfers: 1, investmentCashStatements: 2, investmentAllocationPolicies: 1, investmentConcentrationPolicies: 1, investmentExposureClassifications: 0, investmentExposurePolicies: 0
            }
        });
        expect(backup.bytes).toBeGreaterThan(0);
        expect(existsSync(backup.path)).toBe(true);
        if (process.platform !== 'win32') expect(statSync(backup.path).mode & 0o777).toBe(0o600);
        expect(committed).toMatchObject({
            recordCount: 2, goalCount: 1, cashFlowTransactionCount: 1, budgetCount: 1, historicalSnapshotCount: 1,
            investmentAccountCount: 1, investmentInstrumentCount: 1, investmentTransactionCount: 1, investmentValuationCount: 1,
            investmentCashAccountCount: 2, investmentCashMovementCount: 2, investmentCashTransferCount: 1, investmentCashStatementCount: 2, investmentAllocationPolicyCount: 1, investmentConcentrationPolicyCount: 1, investmentExposureClassificationCount: 0
        });
        first.close(); databases.splice(databases.indexOf(first), 1);

        const restored = new WorkspaceDatabase(backup.path); databases.push(restored);
        const recovered = restored.getWorkspace();
        expect(recovered.updatedAt).toBe(committed.updatedAt);
        expect(restored.checkIntegrity()).toEqual({ ok: true, messages: ['ok'] });
        const stableIds = {
            records: recovered.payload.records.map((item) => item.id),
            goals: recovered.payload.goals.map((item) => item.id),
            cashFlowEntries: recovered.payload.cashFlowEntries.map((item) => item.id),
            budgets: recovered.payload.budgets.map((item) => item.month + ':' + item.category),
            historicalSnapshots: recovered.payload.historicalSnapshots.map((item) => item.date),
            investmentAccounts: recovered.payload.investmentAccounts.map((item) => item.id),
            investmentInstruments: recovered.payload.investmentInstruments.map((item) => item.id),
            investmentTransactions: recovered.payload.investmentTransactions.map((item) => item.id),
            investmentValuations: recovered.payload.investmentValuations.map((item) => item.instrumentId + ':' + item.asOf),
            investmentCashAccounts: recovered.payload.investmentCashAccounts.map((item) => item.id),
            investmentCashMovements: recovered.payload.investmentCashMovements.map((item) => item.id),
            investmentCashTransfers: recovered.payload.investmentCashTransfers.map((item) => item.id),
            investmentCashStatements: recovered.payload.investmentCashStatements.map((item) => item.id),
            investmentAllocationPolicies: recovered.payload.investmentAllocationPolicies.map((item) => item.id),
            investmentConcentrationPolicies: recovered.payload.investmentConcentrationPolicies.map((item) => item.id),
            investmentExposureClassifications: recovered.payload.investmentExposureClassifications.map((item) => item.id)
        };
        expect(stableIds).toEqual({
            records: ['record-1', 'record-2'], goals: ['goal-recovery-1'], cashFlowEntries: ['cash-1'],
            budgets: ['2026-10:Groceries'], historicalSnapshots: ['2026-09-30'],
            investmentAccounts: ['account-1'], investmentInstruments: ['instrument-1'],
            investmentTransactions: ['transaction-1'], investmentValuations: ['instrument-1:2026-10-03T00:00:00.000Z'],
            investmentCashAccounts: ['cash-recovery-1', 'cash-recovery-2'],
            investmentCashMovements: ['cash-opening-1', 'cash-opening-2'],
            investmentCashTransfers: ['cash-transfer-recovery-1'],
            investmentCashStatements: ['cash-statement-1', 'cash-statement-2'],
            investmentAllocationPolicies: ['allocation-policy-recovery-1'],
            investmentConcentrationPolicies: ['concentration-policy-recovery-1'], investmentExposureClassifications: []
        });
        expect(recovered.payload.investmentCashTransfers[0].amount).toEqual({ amount: 100, currency: 'INR' });
        expect(recovered.payload.investmentValuations[0].sourceName).toBe('User-entered');
    });

});
