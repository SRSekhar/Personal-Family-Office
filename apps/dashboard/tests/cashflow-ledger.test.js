import { describe, expect, it } from 'vitest';
import {
    cashFlowToCsv,
    isValidCashFlowEntry,
    summarizeCashFlow,
    validateCashFlowEntries
} from '../cashflow-ledger.js';

const entries = [
    { id: 'i-1', date: '2026-10-01', type: 'income', category: 'Salary', description: 'Monthly salary', amount: 100000, recurring: true },
    { id: 'e-1', date: '2026-10-03', type: 'expense', category: 'Housing', description: 'Rent', amount: 20000, recurring: true },
    { id: 'e-2', date: '2026-09-28', type: 'expense', category: 'Food', description: 'Groceries', amount: 2500, recurring: false }
];

describe('cash flow ledger validation', () => {
    it('accepts valid transaction records', () => {
        expect(entries.every(isValidCashFlowEntry)).toBe(true);
        expect(validateCashFlowEntries(entries)).toEqual(entries);
    });

    it.each([
        ['invalid date', { date: '2026-02-29' }],
        ['empty category', { category: '  ' }],
        ['zero amount', { amount: 0 }],
        ['negative amount', { amount: -1 }],
        ['invalid type', { type: 'transfer' }],
        ['invalid recurring flag', { recurring: 'yes' }]
    ])('rejects an entry with %s', (_label, change) => {
        expect(isValidCashFlowEntry({ ...entries[0], ...change })).toBe(false);
        expect(() => validateCashFlowEntries([{ ...entries[0], ...change }])).toThrow('invalid or duplicate');
    });

    it('rejects duplicate IDs and non-array imports', () => {
        expect(() => validateCashFlowEntries([entries[0], entries[0]])).toThrow('invalid or duplicate');
        expect(() => validateCashFlowEntries({})).toThrow('must be an array');
    });
});

describe('cash flow summaries', () => {
    it('summarizes the selected month without mixing other months', () => {
        expect(summarizeCashFlow(entries, '2026-10')).toEqual({
            period: '2026-10', income: 100000, expenses: 20000, net: 80000, transactionCount: 2
        });
    });

    it('summarizes all entries and supports empty ledgers', () => {
        expect(summarizeCashFlow(entries)).toMatchObject({ income: 100000, expenses: 22500, net: 77500, transactionCount: 3 });
        expect(summarizeCashFlow([])).toMatchObject({ income: 0, expenses: 0, net: 0, transactionCount: 0 });
    });

    it('rejects invalid month filters and aggregate overflow', () => {
        expect(() => summarizeCashFlow(entries, '2026-13')).toThrow('valid YYYY-MM');
        expect(() => summarizeCashFlow([
            { ...entries[0], amount: Number.MAX_VALUE },
            { ...entries[1], type: 'income', amount: Number.MAX_VALUE, id: 'i-2' }
        ])).toThrow('supported numeric range');
    });
});

describe('cash flow CSV export', () => {
    it('quotes fields and neutralizes spreadsheet formula-like text', () => {
        const csv = cashFlowToCsv([{ ...entries[0], description: '=IMPORTDATA("https://example.invalid")' }]);
        expect(csv).toContain('"date","type","category","description","amount","recurring"');
        expect(csv).toContain('"\'=IMPORTDATA(""https://example.invalid"")"');
    });
});
