import { describe, expect, it } from 'vitest';
import { calculateFinancialTotals } from '../financial-totals.js';

describe('calculateFinancialTotals', () => {
    it('calculates assets, liabilities, and net worth', () => {
        expect(calculateFinancialTotals([
            { type: 'asset', value: 1250.5 },
            { type: 'asset', value: 249.5 },
            { type: 'liability', value: 300 }
        ])).toEqual({ assets: 1500, liabilities: 300, netWorth: 1200 });
    });

    it('returns zero totals for an empty workspace', () => {
        expect(calculateFinancialTotals([])).toEqual({ assets: 0, liabilities: 0, netWorth: 0 });
    });

    it('rejects non-array input and malformed values', () => {
        expect(() => calculateFinancialTotals(null)).toThrow('Financial records must be an array');
        expect(() => calculateFinancialTotals([{ type: 'asset', value: Infinity }]))
            .toThrow('valid type and a finite non-negative value');
        expect(() => calculateFinancialTotals([{ type: 'unknown', value: 1 }]))
            .toThrow('valid type and a finite non-negative value');
        expect(() => calculateFinancialTotals([{ type: 'liability', value: -1 }]))
            .toThrow('valid type and a finite non-negative value');
    });

    it('rejects asset totals that overflow even when individual values are finite', () => {
        expect(() => calculateFinancialTotals([
            { type: 'asset', value: Number.MAX_VALUE },
            { type: 'asset', value: Number.MAX_VALUE }
        ])).toThrow('Total assets exceed the supported numeric range');
    });

    it('rejects liability totals that overflow even when individual values are finite', () => {
        expect(() => calculateFinancialTotals([
            { type: 'liability', value: Number.MAX_VALUE },
            { type: 'liability', value: Number.MAX_VALUE }
        ])).toThrow('Total liabilities exceed the supported numeric range');
    });
});
