import { describe, expect, it } from 'vitest';
import {
    calculateCashFlowSavingsRate,
    cashFlowCategorySummaryToCsv,
    cashFlowFilteredSummaryToCsv,
    cashFlowMonthlySummaryToCsv,
    cashFlowToCsv,
    filterCashFlowEntries,
    isValidCashFlowEntry,
    sortCashFlowEntries,
    summarizeCashFlow,
    summarizeCashFlowByCategory,
    summarizeCashFlowByMonth,
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

describe('cash flow transaction sorting', () => {
    it('sorts by date, amount, and category with deterministic tie-breaking', () => {
        expect(sortCashFlowEntries(entries, 'date-newest').map((entry) => entry.id))
            .toEqual(['e-1', 'i-1', 'e-2']);
        expect(sortCashFlowEntries(entries, 'date-oldest').map((entry) => entry.id))
            .toEqual(['e-2', 'i-1', 'e-1']);
        expect(sortCashFlowEntries(entries, 'amount-high').map((entry) => entry.id))
            .toEqual(['i-1', 'e-1', 'e-2']);
        expect(sortCashFlowEntries(entries, 'amount-low').map((entry) => entry.id))
            .toEqual(['e-2', 'e-1', 'i-1']);
        expect(sortCashFlowEntries(entries, 'category-az').map((entry) => entry.id))
            .toEqual(['e-2', 'e-1', 'i-1']);
    });

    it('rejects unsupported sort orders and invalid transaction lists', () => {
        expect(() => sortCashFlowEntries(entries, 'random')).toThrow('Order must be');
        expect(() => sortCashFlowEntries([{}])).toThrow('invalid or duplicate');
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

    it('groups income and expenses by category for the selected period', () => {
        expect(summarizeCashFlowByCategory(entries, '2026-10')).toEqual([
            { category: 'Salary', income: 100000, expenses: 0, transactionCount: 1, net: 100000 },
            { category: 'Housing', income: 0, expenses: 20000, transactionCount: 1, net: -20000 }
        ]);
        expect(summarizeCashFlowByCategory(entries, 'all')).toHaveLength(3);
        expect(summarizeCashFlowByCategory([], 'all')).toEqual([]);
    });

    it('filters transactions by period, type, and case-insensitive text, then sorts deterministically', () => {
        expect(filterCashFlowEntries(entries, { period: '2026-10', type: 'expense' }).map((entry) => entry.id))
            .toEqual(['e-1']);
        expect(filterCashFlowEntries(entries, { search: 'GROCERIES' }).map((entry) => entry.id))
            .toEqual(['e-2']);
        expect(filterCashFlowEntries(entries, { search: '2026-10-01' }).map((entry) => entry.id))
            .toEqual(['i-1']);
        expect(filterCashFlowEntries(entries, { type: 'income' }).map((entry) => entry.id))
            .toEqual(['i-1']);
        expect(filterCashFlowEntries(entries, { recurring: 'recurring' }).map((entry) => entry.id))
            .toEqual(['e-1', 'i-1']);
        expect(filterCashFlowEntries(entries, { recurring: 'one-time' }).map((entry) => entry.id))
            .toEqual(['e-2']);
        expect(filterCashFlowEntries(entries, { category: 'Housing' }).map((entry) => entry.id))
            .toEqual(['e-1']);
        expect(filterCashFlowEntries(entries, { category: 'Housing', type: 'income' })).toEqual([]);
        expect(filterCashFlowEntries([{ ...entries[0], category: 'all' }], { category: 'all' }).map((entry) => entry.id))
            .toEqual(['i-1']);
        expect(filterCashFlowEntries(entries, { fromDate: '2026-10-01' }).map((entry) => entry.id))
            .toEqual(['e-1', 'i-1']);
        expect(filterCashFlowEntries(entries, { toDate: '2026-10-01' }).map((entry) => entry.id))
            .toEqual(['i-1', 'e-2']);
        expect(filterCashFlowEntries(entries, { fromDate: '2026-10-01', toDate: '2026-10-01' }).map((entry) => entry.id))
            .toEqual(['i-1']);
        expect(filterCashFlowEntries(entries, { search: 'no match' })).toEqual([]);
    });

    it('rejects invalid transaction filter options', () => {
        expect(() => filterCashFlowEntries(entries, { period: '2026-13' })).toThrow('valid YYYY-MM');
        expect(() => filterCashFlowEntries(entries, { type: 'transfer' })).toThrow('Type must be');
        expect(() => filterCashFlowEntries(entries, { recurring: 'sometimes' })).toThrow('Frequency must be');
        expect(() => filterCashFlowEntries(entries, { category: '' })).toThrow('Category must be');
        expect(() => filterCashFlowEntries(entries, { category: 12 })).toThrow('Category must be');
        expect(() => filterCashFlowEntries(entries, { fromDate: '2026-02-29' })).toThrow('Start date must be');
        expect(() => filterCashFlowEntries(entries, { toDate: '2026-13-01' })).toThrow('End date must be');
        expect(() => filterCashFlowEntries(entries, { fromDate: '2026-10-03', toDate: '2026-10-01' })).toThrow('on or before');
        expect(() => filterCashFlowEntries(entries, { search: 12 })).toThrow('Search must be a string');
    });

    it('rejects invalid category-summary periods and aggregate overflow', () => {
        expect(() => summarizeCashFlow(entries, '2026-13')).toThrow('valid YYYY-MM');
        expect(() => summarizeCashFlowByCategory(entries, '2026-13')).toThrow('valid YYYY-MM');
        expect(() => summarizeCashFlow([
            { ...entries[0], amount: Number.MAX_VALUE },
            { ...entries[1], type: 'income', amount: Number.MAX_VALUE, id: 'i-2' }
        ])).toThrow('supported numeric range');
        expect(() => summarizeCashFlowByCategory([
            { ...entries[0], amount: Number.MAX_VALUE },
            { ...entries[0], id: 'e-1', type: 'expense', amount: Number.MAX_VALUE }
        ])).toThrow('category totals');
    });
});

describe('cash flow monthly summaries', () => {
    it('groups dated transactions by month and sorts newest month first', () => {
        expect(summarizeCashFlowByMonth(entries)).toEqual([
            { month: '2026-10', income: 100000, expenses: 20000, transactionCount: 2, net: 80000 },
            { month: '2026-09', income: 0, expenses: 2500, transactionCount: 1, net: -2500 }
        ]);
    });

    it('returns no months for an empty ledger and rejects invalid ledger data', () => {
        expect(summarizeCashFlowByMonth([])).toEqual([]);
        expect(() => summarizeCashFlowByMonth([{ ...entries[0], amount: Number.POSITIVE_INFINITY }]))
            .toThrow('invalid or duplicate transaction');
    });
});

describe('cash flow savings rate', () => {
    it('calculates the net share of income and permits a negative rate', () => {
        expect(calculateCashFlowSavingsRate(100000, 20000)).toBe(80);
        expect(calculateCashFlowSavingsRate(100000, 125000)).toBe(-25);
    });

    it('returns null when income is zero and rejects invalid amounts', () => {
        expect(calculateCashFlowSavingsRate(0, 100)).toBeNull();
        expect(() => calculateCashFlowSavingsRate(-1, 0)).toThrow('finite, non-negative');
        expect(() => calculateCashFlowSavingsRate(100, Number.POSITIVE_INFINITY)).toThrow('finite, non-negative');
    });
});

describe('cash flow filtered summary CSV export', () => {
    it('exports totals for only the supplied visible entries with a machine-readable savings rate', () => {
        expect(cashFlowFilteredSummaryToCsv([entries[0], entries[1]])).toBe(
            '"income","expenses","net","savings_rate_percent","transaction_count"\r\n'
            + '"100000","20000","80000","80","2"\r\n'
        );
    });

    it('leaves the savings rate empty when filtered income is zero', () => {
        expect(cashFlowFilteredSummaryToCsv([entries[1]])).toBe(
            '"income","expenses","net","savings_rate_percent","transaction_count"\r\n'
            + '"0","20000","-20000","","1"\r\n'
        );
    });
});

describe('cash flow CSV export', () => {
    it('exports a month-grouped summary with fixed, machine-readable columns', () => {
        expect(cashFlowMonthlySummaryToCsv(entries)).toBe(
            '"month","income","expenses","net","savings_rate_percent","transaction_count"\r\n'
            + '"2026-10","100000","20000","80000","80","2"\r\n'
            + '"2026-09","0","2500","-2500","","1"\r\n'
        );
        expect(cashFlowMonthlySummaryToCsv([])).toBe(
            '"month","income","expenses","net","savings_rate_percent","transaction_count"\r\n'
        );
    });

    it('quotes fields and neutralizes spreadsheet formula-like text', () => {
        const csv = cashFlowToCsv([{ ...entries[0], description: '=IMPORTDATA("https://example.invalid")' }]);
        expect(csv).toContain('"date","type","category","description","amount","recurring"');
        expect(csv).toContain('"\'=IMPORTDATA(""https://example.invalid"")"');
    });
});

describe('cash flow category summary CSV export', () => {
    it('exports selected-period category totals and transaction counts in deterministic order', () => {
        expect(cashFlowCategorySummaryToCsv(entries, '2026-10')).toBe(
            '"category","income","expenses","expense_share_percent","net","transaction_count"\r\n'
            + '"Salary","100000","0","0","100000","1"\r\n'
            + '"Housing","0","20000","100","-20000","1"\r\n'
        );
    });

    it('exports an empty expense share when the selected period has no expenses', () => {
        expect(cashFlowCategorySummaryToCsv(entries.filter((entry) => entry.type === 'income'), 'all')).toBe(
            '"category","income","expenses","expense_share_percent","net","transaction_count"\r\n'
            + '"Salary","100000","0","","100000","1"\r\n'
        );
    });

    it('exports a header-only CSV for an empty category summary', () => {
        expect(cashFlowCategorySummaryToCsv([], 'all')).toBe(
            '"category","income","expenses","expense_share_percent","net","transaction_count"\r\n'
        );
    });

    it('neutralizes formula-like category text while preserving numeric net values', () => {
        const unsafe = [{ ...entries[0], category: '=HYPERLINK("https://example.invalid","x")' }];
        const csv = cashFlowCategorySummaryToCsv(unsafe, 'all');
        expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"",""x"")"');
        expect(csv).toContain('"100000"');
    });
});
