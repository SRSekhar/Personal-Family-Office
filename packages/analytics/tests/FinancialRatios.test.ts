import type { NetWorthResult } from '@pfo/calculators';
import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { calculateFinancialRatios } from '../src/FinancialRatios.js';

function netWorth(totalAssets: number, totalLiabilities: number): NetWorthResult {
    return {
        currency: Currency.INR,
        totalAssets: new Money(totalAssets, Currency.INR),
        totalLiabilities: new Money(totalLiabilities, Currency.INR),
        netWorth: new Money(totalAssets - totalLiabilities, Currency.INR)
    };
}

describe('calculateFinancialRatios', () => {
    it('calculates ratios from reconciled balance-sheet totals', () => {
        expect(calculateFinancialRatios(netWorth(1000, 250))).toEqual({
            liabilitiesToAssets: 0.25,
            netWorthToAssets: 0.75,
            assetsToLiabilities: 4
        });
    });

    it('returns null for ratios whose denominator is zero', () => {
        expect(calculateFinancialRatios(netWorth(0, 0))).toEqual({
            liabilitiesToAssets: null,
            netWorthToAssets: null,
            assetsToLiabilities: null
        });
        expect(calculateFinancialRatios(netWorth(0, 50))).toEqual({
            liabilitiesToAssets: null,
            netWorthToAssets: null,
            assetsToLiabilities: 0
        });
        expect(calculateFinancialRatios(netWorth(100, 0))).toEqual({
            liabilitiesToAssets: 0,
            netWorthToAssets: 1,
            assetsToLiabilities: null
        });
    });

    it('preserves a negative net-worth-to-assets ratio when liabilities exceed assets', () => {
        expect(calculateFinancialRatios(netWorth(100, 150)).netWorthToAssets).toBe(-0.5);
    });

    it('rejects unreconciled net worth', () => {
        expect(() => calculateFinancialRatios({
            ...netWorth(100, 25),
            netWorth: new Money(80, Currency.INR)
        })).toThrow('Net worth must equal total assets minus total liabilities.');
    });

    it('rejects negative asset or liability totals', () => {
        expect(() => calculateFinancialRatios({
            currency: Currency.INR,
            totalAssets: new Money(-1, Currency.INR),
            totalLiabilities: new Money(0, Currency.INR),
            netWorth: new Money(-1, Currency.INR)
        })).toThrow('must be non-negative');
    });

    it('rejects mixed-currency totals', () => {
        expect(() => calculateFinancialRatios({
            currency: Currency.INR,
            totalAssets: new Money(100, Currency.USD),
            totalLiabilities: new Money(25, Currency.INR),
            netWorth: new Money(75, Currency.INR)
        })).toThrow('finite amounts in one currency');
    });

    it('rejects ratio overflow instead of returning Infinity', () => {
        expect(() => calculateFinancialRatios(netWorth(1e-308, 1e308))).toThrow(
            'Financial ratio exceeds the supported numeric range.'
        );
    });
});
