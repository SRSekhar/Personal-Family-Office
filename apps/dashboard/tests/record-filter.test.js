import { describe, expect, it } from 'vitest';
import { filterFinancialRecords } from '../record-filter.js';

const records = [
    { id: '1', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 100 },
    { id: '2', name: 'Home loan', category: 'Home loan', type: 'liability', value: 50 },
    { id: '3', name: 'Mutual fund', category: 'Investments', type: 'asset', value: 200 }
];

describe('filterFinancialRecords', () => {
    it('returns all records when no filter is provided', () => {
        expect(filterFinancialRecords(records).map((record) => record.id)).toEqual(['1', '2', '3']);
    });

    it('filters by record type without changing source order', () => {
        expect(filterFinancialRecords(records, '', 'asset').map((record) => record.id)).toEqual(['1', '3']);
        expect(filterFinancialRecords(records, '', 'liability').map((record) => record.id)).toEqual(['2']);
    });

    it('searches names, categories, and types case-insensitively', () => {
        expect(filterFinancialRecords(records, 'INVEST').map((record) => record.id)).toEqual(['3']);
        expect(filterFinancialRecords(records, ' LIABILITY ').map((record) => record.id)).toEqual(['2']);
    });

    it('combines the search and type filters', () => {
        expect(filterFinancialRecords(records, 'account', 'asset').map((record) => record.id)).toEqual(['1']);
        expect(filterFinancialRecords(records, 'loan', 'asset')).toEqual([]);
    });

    it('filters by category and combines category with search and type', () => {
        expect(filterFinancialRecords(records, '', 'all', 'Investments').map((record) => record.id)).toEqual(['3']);
        expect(filterFinancialRecords(records, 'mutual', 'asset', 'Investments').map((record) => record.id)).toEqual(['3']);
        expect(filterFinancialRecords(records, '', 'liability', 'Investments')).toEqual([]);
    });

    it('rejects invalid filter arguments', () => {
        expect(() => filterFinancialRecords(null)).toThrow('Records must be an array');
        expect(() => filterFinancialRecords(records, 10)).toThrow('Search query must be a string');
        expect(() => filterFinancialRecords(records, '', 'property')).toThrow('Record type filter must be all, asset, or liability');
        expect(() => filterFinancialRecords(records, '', 'all', '')).toThrow('Record category filter must be a non-empty string');
    });
});
