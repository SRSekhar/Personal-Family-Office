import { describe, expect, it } from 'vitest';
import { validateBackupPayload } from '../backup.js';
import { parseRecordsCsv } from '../csv-import.js';
import { validateCashFlowBudgets, validateCashFlowEntries } from '../cashflow-ledger.js';
import { validateHistoricalSnapshots } from '../historical-snapshots.js';
import { persistJson, readJsonArray } from '../storage.js';

const record = (overrides = {}) => ({
    name: 'Savings account',
    category: 'Cash & deposits',
    type: 'asset',
    value: 125000,
    ...overrides
});

const goal = (overrides = {}) => ({
    id: 'goal-emergency-fund',
    name: 'Emergency fund',
    targetAmount: 500000,
    currentAmount: 125000,
    targetDate: '2027-12-31',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
});

const cashFlowEntry = (overrides = {}) => ({
    id: 'cash-flow-1',
    date: '2026-10-20',
    type: 'income',
    category: 'Salary',
    description: 'Monthly salary',
    amount: 50000,
    recurring: true,
    ...overrides
});

const historicalSnapshot = (overrides = {}) => ({
    date: '2025-12-31',
    currency: 'INR',
    records: [{
        id: 'snapshot-record-1',
        name: 'Savings account',
        category: 'Cash & deposits',
        type: 'asset',
        value: 100000
    }],
    ...overrides
});

const backupV4 = (overrides = {}) => ({
    schemaVersion: 4,
    currency: 'INR',
    records: [record()],
    goals: [goal()],
    cashFlowEntries: [cashFlowEntry()],
    budgets: [{ month: '2026-10', category: 'Groceries', amount: 12000 }],
    historicalSnapshots: [historicalSnapshot()],
    ...overrides
});

class MemoryStorage {
    #values = new Map();

    getItem(key) {
        return this.#values.has(key) ? this.#values.get(key) : null;
    }

    setItem(key, value) {
        this.#values.set(String(key), String(value));
    }

    removeItem(key) {
        this.#values.delete(key);
    }
}

describe('data integrity: records CSV import', () => {
    it('preserves quoted commas, escaped quotes, embedded newlines, BOM, and CRLF', () => {
        const csv = '\uFEFFName,Category,Type,Value,Currency\r\n'
            + '"Savings, emergency","Cash & deposits","asset",125000,"INR"\r\n'
            + '"Broker ""A""","Investments","asset",25000,"INR"\r\n'
            + '"Multiline\ndescription","Other","liability",0,"INR"\r\n';
        expect(parseRecordsCsv(csv)).toEqual([
            { name: 'Savings, emergency', category: 'Cash & deposits', type: 'asset', value: 125000 },
            { name: 'Broker "A"', category: 'Investments', type: 'asset', value: 25000 },
            { name: 'Multiline\ndescription', category: 'Other', type: 'liability', value: 0 }
        ]);
    });

    it.each([
        ['empty input', ''],
        ['header only', 'Name,Category,Type,Value,Currency\n'],
        ['unsupported header', 'name,category,type,value,currency\n'],
        ['unterminated quoted field', 'Name,Category,Type,Value,Currency\n"broken,category,asset,1,INR'],
        ['characters after closing quote', 'Name,Category,Type,Value,Currency\n"Name"x,category,asset,1,INR'],
        ['incomplete row', 'Name,Category,Type,Value,Currency\nName,category,asset,1'],
        ['invalid amount', 'Name,Category,Type,Value,Currency\nName,category,asset,Infinity,INR'],
        ['negative amount', 'Name,Category,Type,Value,Currency\nName,category,asset,-1,INR'],
        ['wrong currency', 'Name,Category,Type,Value,Currency\nName,category,asset,1,USD']
    ])('rejects %s without producing partial records', (_case, csv) => {
        expect(() => parseRecordsCsv(csv)).toThrow();
    });
});

describe('data integrity: backup validation', () => {
    it('keeps legacy schema v1 importable while declaring omitted collections', () => {
        expect(validateBackupPayload({
            schemaVersion: 1,
            currency: 'INR',
            records: [record()]
        }, 'INR')).toMatchObject({
            records: [record()],
            includesGoals: false,
            includesCashFlow: false,
            includesHistoricalSnapshots: false,
            goals: [],
            cashFlowEntries: [],
            budgets: [],
            historicalSnapshots: []
        });
    });

    it('validates and normalizes every schema-v4 collection', () => {
        const validated = validateBackupPayload(backupV4(), 'INR');
        expect(validated.records).toEqual([record()]);
        expect(validated.goals).toEqual([goal()]);
        expect(validated.cashFlowEntries).toEqual([cashFlowEntry()]);
        expect(validated.budgets).toEqual([{ month: '2026-10', category: 'Groceries', amount: 12000 }]);
        expect(validated.historicalSnapshots[0].totals).toEqual({
            assets: 100000, liabilities: 0, netWorth: 100000
        });
        expect(validated.includesGoals).toBe(true);
        expect(validated.includesCashFlow).toBe(true);
        expect(validated.includesHistoricalSnapshots).toBe(true);
    });

    it.each([
        ['unsupported schema', { schemaVersion: 99 }],
        ['wrong currency', { currency: 'USD' }],
        ['missing goals', { goals: undefined }],
        ['missing cash flow', { cashFlowEntries: undefined }],
        ['missing budgets', { budgets: undefined }],
        ['missing historical snapshots', { historicalSnapshots: undefined }],
        ['invalid record amount', { records: [record({ value: Number.MAX_VALUE }), record({ value: Number.MAX_VALUE })] }],
        ['duplicate goal IDs', { goals: [goal(), goal({ name: 'Second goal' })] }],
        ['duplicate transaction IDs', { cashFlowEntries: [cashFlowEntry(), cashFlowEntry({ description: 'Duplicate ID' })] }],
        ['duplicate budget month/category', { budgets: [
            { month: '2026-10', category: 'Groceries', amount: 12000 },
            { month: '2026-10', category: ' groceries ', amount: 1000 }
        ] }],
        ['duplicate snapshot date', { historicalSnapshots: [historicalSnapshot(), historicalSnapshot()] }],
        ['snapshot currency mismatch', { historicalSnapshots: [historicalSnapshot({ currency: 'USD' })] }],
        ['impossible snapshot date', { historicalSnapshots: [historicalSnapshot({ date: '2025-02-30' })] }]
    ])('rejects %s before any caller can persist it', (_case, override) => {
        const candidate = { ...backupV4(), ...override };
        expect(() => validateBackupPayload(candidate, 'INR')).toThrow();
    });

    it('rejects a backup with an invalid top-level currency before data can be imported', () => {
        expect(() => validateBackupPayload(backupV4({ currency: 'inr' }), 'INR')).toThrow(/currency/i);
    });
});

describe('data integrity: cash-flow and historical collections', () => {
    it('rejects duplicate transaction identifiers and impossible dates', () => {
        expect(() => validateCashFlowEntries([cashFlowEntry(), cashFlowEntry({ description: 'Duplicate' })]))
            .toThrow(/invalid or duplicate/i);
        expect(() => validateCashFlowEntries([cashFlowEntry({ date: '2026-02-30' })]))
            .toThrow(/invalid or duplicate/i);
    });

    it('rejects overflowed cash-flow totals and duplicate normalized budgets', () => {
        expect(() => validateCashFlowEntries([
            cashFlowEntry({ amount: Number.MAX_VALUE }),
            cashFlowEntry({ id: 'cash-flow-2', amount: Number.MAX_VALUE })
        ])).toThrow(/numeric range/i);
        expect(() => validateCashFlowBudgets([
            { month: '2026-10', category: 'Groceries', amount: 100 },
            { month: '2026-10', category: ' groceries ', amount: 200 }
        ])).toThrow(/duplicate/i);
    });

    it('rejects duplicate snapshot dates and duplicate record identifiers', () => {
        expect(() => validateHistoricalSnapshots([
            historicalSnapshot(),
            historicalSnapshot({ date: '2025-12-31' })
        ], 'INR')).toThrow(/duplicate date/i);
        expect(() => validateHistoricalSnapshots([historicalSnapshot({
            records: [
                { id: 'duplicate', name: 'One', category: 'Cash', type: 'asset', value: 1 },
                { id: 'duplicate', name: 'Two', category: 'Cash', type: 'asset', value: 2 }
            ]
        })], 'INR')).toThrow(/duplicate financial records/i);
    });
});

describe('data integrity: browser storage helpers', () => {
    it('round-trips serialized values and does not treat a missing key as corruption', () => {
        const storage = new MemoryStorage();
        expect(persistJson(storage, 'records', [{ id: 'one', value: 100 }])).toBe(true);
        expect(readJsonArray(storage, 'records', (item) => item?.id === 'one')).toEqual({
            ok: true,
            records: [{ id: 'one', value: 100 }]
        });
        expect(readJsonArray(storage, 'missing', () => true)).toEqual({ ok: true, records: [] });
    });

    it('fails closed on malformed serialized data without modifying the stored bytes', () => {
        const storage = new MemoryStorage();
        storage.setItem('records', '{not-json');
        expect(readJsonArray(storage, 'records', () => true)).toEqual({ ok: false, records: [] });
        expect(storage.getItem('records')).toBe('{not-json');
        storage.setItem('records', JSON.stringify([{ valid: true }, { valid: false }]));
        const original = storage.getItem('records');
        expect(readJsonArray(storage, 'records', (item) => item.valid)).toEqual({ ok: false, records: [] });
        expect(storage.getItem('records')).toBe(original);
    });

    it('reports storage write failures instead of claiming data was saved', () => {
        const storage = new MemoryStorage();
        storage.setItem = () => { throw new Error('quota exceeded'); };
        expect(persistJson(storage, 'records', [{ id: 'one' }])).toBe(false);
    });

    it('reports non-serializable values instead of throwing through the UI', () => {
        const storage = new MemoryStorage();
        const circular = {};
        circular.self = circular;
        expect(persistJson(storage, 'records', circular)).toBe(false);
    });
});
