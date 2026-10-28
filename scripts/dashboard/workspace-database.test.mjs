import { existsSync, statSync } from 'node:fs';
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
        schemaVersion: 4,
        currency: 'INR',
        exportedAt: '2026-10-28T00:00:00.000Z',
        records: [
            { id: 'record-1', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 125000 },
            { id: 'record-2', name: 'Home loan', category: 'Home loan', type: 'liability', value: 25000 }
        ],
        goals: [],
        cashFlowEntries: [
            { id: 'cash-1', date: '2026-10-01', type: 'income', category: 'Salary', description: 'Monthly salary', amount: 100000, recurring: true }
        ],
        budgets: [{ month: '2026-10', category: 'Groceries', amount: 12000 }],
        historicalSnapshots: [{
            date: '2026-09-30', currency: 'INR',
            records: [{ id: 'history-1', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 100000 }],
            totals: { assets: 100000, liabilities: 0, netWorth: 100000 }
        }],
        ...overrides
    };
}

afterEach(async () => {
    for (const database of databases.splice(0)) {
        try { database.close(); } catch { /* already closed by a reopen test */ }
    }
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite workspace persistence', () => {
    it('persists all five workspace collections in a single snapshot and preserves stable record IDs', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-reopen-'));
        directories.push(directory);
        const path = join(directory, 'workspace.sqlite');
        const first = new WorkspaceDatabase(path);
        databases.push(first);
        const saved = first.saveWorkspace(payload());
        expect(saved).toMatchObject({
            database: 'SQLite', configured: true, hasWorkspace: true,
            recordCount: 2, goalCount: 0, cashFlowTransactionCount: 1,
            budgetCount: 1, historicalSnapshotCount: 1
        });
        first.close();
        databases.splice(databases.indexOf(first), 1);

        const reopened = new WorkspaceDatabase(path);
        databases.push(reopened);
        const loaded = reopened.getWorkspace();
        expect(loaded.payload).toEqual(payload());
        expect(loaded.payload.records.map((record) => record.id)).toEqual(['record-1', 'record-2']);
        expect(loaded.payload.historicalSnapshots[0].records[0].id).toBe('history-1');
        expect(reopened.getStatus().updatedAt).toBe(saved.updatedAt);
    });

    it('rejects stale database versions without replacing a newer committed snapshot', async () => {
        const database = await createDatabase();
        const first = database.saveWorkspace(payload(), null);
        const secondPayload = payload({ records: [{ id: 'record-new', name: 'Updated savings', category: 'Cash & deposits', type: 'asset', value: 200000 }] });
        const second = database.saveWorkspace(secondPayload, first.updatedAt);
        expect(() => database.saveWorkspace(payload(), first.updatedAt)).toThrow(WorkspaceConflictError);
        expect(database.getWorkspace().payload).toEqual(secondPayload);
        expect(database.getStatus().updatedAt).toBe(second.updatedAt);
    });

    it('starts empty and reports no saved workspace', async () => {
        const database = await createDatabase();
        expect(database.getWorkspace()).toBeNull();
        expect(database.getStatus()).toMatchObject({
            database: 'SQLite', configured: true, hasWorkspace: false,
            schemaVersion: 4, currency: 'INR', updatedAt: null
        });
    });

    it('rejects incomplete, wrong-currency, duplicate-ID, and invalid-financial snapshots', async () => {
        const database = await createDatabase();
        expect(() => database.saveWorkspace({ schemaVersion: 4, currency: 'INR' }))
            .toThrow(WorkspaceValidationError);
        expect(() => database.saveWorkspace(payload({ currency: 'USD' })))
            .toThrow(/currency must be INR/i);
        expect(() => database.saveWorkspace(payload({
            records: [
                { id: 'same', name: 'Savings', category: 'Cash', type: 'asset', value: 10 },
                { id: 'same', name: 'Other', category: 'Other', type: 'asset', value: 20 }
            ]
        }))).toThrow(/unique, non-empty identifiers/i);
        expect(() => database.saveWorkspace(payload({
            records: [{ id: 'overflow-1', name: 'Huge', category: 'Other', type: 'asset', value: Number.MAX_VALUE },
                { id: 'overflow-2', name: 'Huge 2', category: 'Other', type: 'asset', value: Number.MAX_VALUE }]
        }))).toThrow();
        expect(database.getWorkspace()).toBeNull();
    });

    it('preserves the previous committed snapshot when a later write is invalid', async () => {
        const database = await createDatabase();
        database.saveWorkspace(payload());
        expect(() => database.saveWorkspace(payload({ budgets: [{ month: '2026-13', category: 'Invalid', amount: 10 }] })))
            .toThrow();
        expect(database.getWorkspace().payload).toEqual(payload());
    });


    it('restricts database and SQLite sidecar file permissions on POSIX systems', async () => {
        if (process.platform === 'win32') return;
        const directory = await mkdtemp(join(tmpdir(), 'pfo-sqlite-permissions-'));
        directories.push(directory);
        const path = join(directory, 'private.sqlite');
        const database = new WorkspaceDatabase(path);
        databases.push(database);
        database.saveWorkspace(payload());

        expect(statSync(path).mode & 0o777).toBe(0o600);
        for (const suffix of ['-wal', '-shm', '-journal']) {
            const sidecar = path + suffix;
            if (existsSync(sidecar)) {
                expect(statSync(sidecar).mode & 0o777).toBe(0o600);
            }
        }
    });

    it('resolves an explicit database path and keeps defaults outside the repository', () => {
        expect(resolveDatabasePath({ PFO_DATABASE_PATH: './private-data/pfo.sqlite' }, '/home/test', 'linux'))
            .toBe(join(process.cwd(), 'private-data', 'pfo.sqlite'));
        expect(resolveDatabasePath({}, '/home/test', 'linux'))
            .toBe('/home/test/.local/share/PFO-OS/pfo-os.sqlite');
        expect(resolveDatabasePath({ LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local' }, 'C:\\Users\\test', 'win32'))
            .toBe(join('C:\\Users\\test\\AppData\\Local', 'PFO-OS', 'pfo-os.sqlite'));
    });
});
