import { describe, expect, it } from 'vitest';
import { sortFinancialRecords } from '../record-sort.js';

const records = [
    { id: '1', name: 'Savings', category: 'Cash', type: 'asset', value: 100 },
    { id: '2', name: 'Home loan', category: 'Loan', type: 'liability', value: 500 },
    { id: '3', name: 'Mutual fund', category: 'Investments', type: 'asset', value: 100 },
    { id: '4', name: 'checking', category: 'Cash', type: 'asset', value: 25 }
];

describe('sortFinancialRecords', () => {
    it('preserves the current order by default and never mutates the input', () => {
        expect(sortFinancialRecords(records).map((record) => record.id)).toEqual(['1', '2', '3', '4']);
        expect(records.map((record) => record.id)).toEqual(['1', '2', '3', '4']);
    });

    it('sorts names case-insensitively and keeps ties stable', () => {
        expect(sortFinancialRecords(records, 'name-asc').map((record) => record.id)).toEqual(['4', '2', '3', '1']);
    });

    it('sorts values from high to low and keeps ties stable', () => {
        expect(sortFinancialRecords(records, 'value-desc').map((record) => record.id)).toEqual(['2', '1', '3', '4']);
    });

    it('sorts values from low to high and keeps ties stable', () => {
        expect(sortFinancialRecords(records, 'value-asc').map((record) => record.id)).toEqual(['4', '1', '3', '2']);
    });

    it('rejects invalid arguments', () => {
        expect(() => sortFinancialRecords(null)).toThrow('Records must be an array');
        expect(() => sortFinancialRecords(records, 'category')).toThrow('Sort order must be default, name-asc, value-desc, or value-asc');
    });
});
