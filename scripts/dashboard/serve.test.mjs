/* global fetch */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDashboardServer, parsePort } from './serve.mjs';

const temporaryDirectories = [];
const servers = [];

async function createRoot() {
    const directory = await mkdtemp(join(tmpdir(), 'pfo-dashboard-test-'));
    temporaryDirectories.push(directory);
    const root = join(directory, 'public');
    await mkdir(root);
    await writeFile(join(root, 'index.html'), '<!doctype html><title>Local PFO</title>', 'utf8');
    await writeFile(join(root, 'app.js'), 'export const localOnly = true;', 'utf8');
    await writeFile(join(directory, 'secret.txt'), 'outside the dashboard root', 'utf8');
    return root;
}

async function startServer(root, options = {}) {
    const server = createDashboardServer(root, options);
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port.');
    }
    return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })));
});

describe('local dashboard preview server', () => {
    it('serves the dashboard root with restrictive security headers', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
        expect(response.headers.get('content-security-policy')).toContain("style-src 'self' 'unsafe-inline'");
        expect(await response.text()).toContain('Local PFO');
    });

    it('persists a complete validated workspace through the local SQLite API', async () => {
        const root = await createRoot();
        const origin = await startServer(root, { databasePath: join(root, '..', 'api-workspace.sqlite') });
        const statusBefore = await fetch(`${origin}/api/v1/database/status`);
        expect(statusBefore.status).toBe(200);
        expect(await statusBefore.json()).toMatchObject({ database: 'SQLite', configured: true, hasWorkspace: false });

        const missing = await fetch(`${origin}/api/v1/workspace`);
        expect(missing.status).toBe(404);

        const payload = {
            schemaVersion: 9, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
            records: [{ id: 'api-record-1', name: 'Savings', category: 'Cash', type: 'asset', value: 1000 }],
            goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [], investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [], investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: []
        };
        const save = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(save.status).toBe(200);
        expect(await save.json()).toMatchObject({ database: 'SQLite', hasWorkspace: true, recordCount: 1 });

        const read = await fetch(`${origin}/api/v1/workspace`);
        expect(read.status).toBe(200);
        expect(await read.json()).toMatchObject({ payload, updatedAt: expect.any(String) });
        expect((await fetch(`${origin}/api/v1/database/status`)).headers.get('content-security-policy'))
            .toContain("connect-src 'self'");
        const integrity = await fetch(`${origin}/api/v1/database/integrity`);
        expect(integrity.status).toBe(200);
        expect(await integrity.json()).toEqual({ ok: true, messages: ['ok'] });
    });

    it('rejects stale multi-tab investment-ledger writes and preserves the latest committed valuation', async () => {
        const root = await createRoot();
        const origin = await startServer(root, { databasePath: join(root, '..', 'concurrency-workspace.sqlite') });
        // Two browser tabs read the same baseline snapshot and updatedAt token.
        const payload = {
            schemaVersion: 9, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
            records: [{ id: 'api-record-1', name: 'Savings', category: 'Cash', type: 'asset', value: 1000 }],
            goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [],
            investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
            investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
            investmentTransactions: [{
                id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1',
                type: 'Purchase', cashAmount: { amount: -200, currency: 'INR' },
                quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
                date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z'
            }],
            investmentValuations: [{
                instrumentId: 'instrument-1', price: { amount: 110, currency: 'INR' },
                asOf: '2026-10-03T00:00:00.000Z', recordedAt: '2026-10-03T00:00:00.000Z',
                sourceType: 'manual', sourceName: 'User-entered'
            }],
            investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: []
        };
        const firstSave = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(firstSave.status).toBe(200);
        const firstVersion = (await firstSave.json()).updatedAt;
        const updatedPayload = {
            ...payload,
            records: [{ ...payload.records[0], value: 2000 }],
            investmentValuations: [{ ...payload.investmentValuations[0], price: { amount: 120, currency: 'INR' } }]
        };
        const secondTabStalePayload = {
            ...payload,
            investmentValuations: [{ ...payload.investmentValuations[0], price: { amount: 130, currency: 'INR' } }]
        };
        const secondSave = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: updatedPayload, expectedUpdatedAt: firstVersion })
        });
        expect(secondSave.status).toBe(200);
        const staleSave = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: secondTabStalePayload, expectedUpdatedAt: firstVersion })
        });
        expect(staleSave.status).toBe(409);
        const latest = await (await fetch(`${origin}/api/v1/workspace`)).json();
        expect(latest.payload).toEqual(updatedPayload);
        expect(latest.payload.investmentValuations[0].price.amount).toBe(120);
        expect(latest.payload.investmentTransactions[0].id).toBe('transaction-1');
    });

    it('rejects invalid and cross-origin database writes without replacing saved data', async () => {
        const root = await createRoot();
        const origin = await startServer(root, { databasePath: join(root, '..', 'protected-workspace.sqlite') });
        const payload = {
            schemaVersion: 9, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
            records: [{ id: 'api-record-1', name: 'Savings', category: 'Cash', type: 'asset', value: 1000 }],
            goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [], investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [], investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: []
        };
        const save = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(save.status).toBe(200);

        const invalid = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: { ...payload, currency: 'USD' }, expectedUpdatedAt: null })
        });
        expect(invalid.status).toBe(400);
        expect((await fetch(`${origin}/api/v1/workspace`)).status).toBe(200);

        const crossOrigin = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
            body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(crossOrigin.status).toBe(403);
        expect((await fetch(`${origin}/api/v1/workspace`)).status).toBe(200);
    });

    it('rejects malformed and oversized SQLite API bodies without changing the committed snapshot', async () => {
        const root = await createRoot();
        const origin = await startServer(root, { databasePath: join(root, '..', 'request-boundary.sqlite') });
        const payload = {
            schemaVersion: 9, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
            records: [{ id: 'api-record-stable', name: 'Savings', category: 'Cash', type: 'asset', value: 123456 }],
            goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [], investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [], investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: []
        };
        const initial = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(initial.status).toBe(200);
        const committed = await (await fetch(`${origin}/api/v1/workspace`)).json();

        const malformed = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: '{"payload":'
        });
        expect(malformed.status).toBe(400);
        expect((await malformed.json()).error).toContain('valid JSON');

        const oversized = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: new Uint8Array(10 * 1024 * 1024 + 1).fill(0x20)
        });
        expect(oversized.status).toBe(413);
        expect((await oversized.json()).error).toContain('10 MiB limit');

        const after = await (await fetch(`${origin}/api/v1/workspace`)).json();
        expect(after).toEqual(committed);
        expect(after.payload).toEqual(payload);
    });

    it('serves JavaScript with the correct MIME type and supports HEAD', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/app.js`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/javascript');
        expect(await response.text()).toContain('localOnly');

        const head = await fetch(`${origin}/app.js`, { method: 'HEAD' });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe('');
    });

    it('rejects methods other than GET and HEAD', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/`, { method: 'POST' });
        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('GET, HEAD');
    });

    it('does not serve files outside the dashboard root or unknown extensions', async () => {
        const origin = await startServer(await createRoot());
        const traversal = await fetch(`${origin}/..%2fsecret.txt`);
        expect(traversal.status).toBe(404);

        const unsupported = await fetch(`${origin}/secret.txt`);
        expect(unsupported.status).toBe(404);
    });

    it('validates the configured port', () => {
        expect(parsePort(undefined)).toBe(4173);
        expect(parsePort('8080')).toBe(8080);
        expect(() => parsePort('0')).toThrow('between 1 and 65535');
        expect(() => parsePort('not-a-port')).toThrow('between 1 and 65535');
    });
});


describe('verified online SQLite backup API', () => {
    it('creates a verified local backup without changing the committed workspace and rejects cross-origin requests', async () => {
        const root = await createRoot();
        const databasePath = join(root, '..', 'online-backup.sqlite');
        const origin = await startServer(root, { databasePath });
        const payload = {
            schemaVersion: 9, currency: 'INR', exportedAt: '2026-10-28T00:00:00.000Z',
            records: [{ id: 'backup-record-1', name: 'Savings', category: 'Cash', type: 'asset', value: 1250 }],
            goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [],
            investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [],
            investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [], investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: []
        };
        const save = await fetch(`${origin}/api/v1/workspace`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload, expectedUpdatedAt: null })
        });
        expect(save.status).toBe(200);
        const before = await (await fetch(`${origin}/api/v1/workspace`)).json();
        const response = await fetch(`${origin}/api/v1/database/backup`, { method: 'POST' });
        expect(response.status).toBe(201);
        const backup = await response.json();
        expect(backup).toMatchObject({
            filename: expect.stringMatching(/^pfo-os-sqlite-.*\.sqlite$/),
            directory: databasePath + '.backups', path: expect.stringContaining('.backups'),
            bytes: expect.any(Number), updatedAt: before.updatedAt, schemaVersion: 9,
            collectionCounts: { records: 1, goals: 0, cashFlowEntries: 0, budgets: 0, historicalSnapshots: 0 }
        });
        expect(backup.bytes).toBeGreaterThan(0);
        expect(await (await fetch(`${origin}/api/v1/workspace`)).json()).toEqual(before);
        const crossOrigin = await fetch(`${origin}/api/v1/database/backup`, {
            method: 'POST', headers: { Origin: 'https://attacker.example' }
        });
        expect(crossOrigin.status).toBe(403);
    });

    it('rejects backup creation when no committed workspace exists', async () => {
        const root = await createRoot();
        const origin = await startServer(root, { databasePath: join(root, '..', 'empty-backup.sqlite') });
        const response = await fetch(`${origin}/api/v1/database/backup`, { method: 'POST' });
        expect(response.status).toBe(500);
        expect((await response.json()).error).toContain('verified online SQLite backup could not be created');
    });
});
