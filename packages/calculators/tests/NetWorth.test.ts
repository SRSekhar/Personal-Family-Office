import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { calculateNetWorth, type FinancialPosition } from '../src/index.js';

const position = (
    id: string,
    kind: FinancialPosition['kind'],
    amount: number,
    category = 'General',
    currency = Currency.INR
): FinancialPosition => ({
    id,
    kind,
    category,
    value: new Money(amount, currency)
});

describe('calculateNetWorth', () => {
    it('calculates assets, liabilities, and net worth', () => {
        const result = calculateNetWorth({
            currency: Currency.INR,
            positions: [
                position('cash', 'asset', 100_000, 'Cash'),
                position('equity', 'asset', 450_000, 'Investments'),
                position('home-loan', 'liability', 200_000, 'Loans')
            ]
        });

        expect(result.totalAssets.amount).toBe(550_000);
        expect(result.totalLiabilities.amount).toBe(200_000);
        expect(result.netWorth.amount).toBe(350_000);
        expect(result.currency).toBe(Currency.INR);
    });

    it('supports negative net worth when liabilities exceed assets', () => {
        const result = calculateNetWorth({
            currency: Currency.INR,
            positions: [
                position('cash', 'asset', 100),
                position('loan', 'liability', 250)
            ]
        });

        expect(result.netWorth.amount).toBe(-150);
    });

    it('returns zero totals for an empty position list', () => {
        const result = calculateNetWorth({
            currency: Currency.USD,
            positions: []
        });

        expect(result.totalAssets.amount).toBe(0);
        expect(result.totalLiabilities.amount).toBe(0);
        expect(result.netWorth.amount).toBe(0);
        expect(result.currency).toBe(Currency.USD);
    });

    it('rejects duplicate canonical position IDs', () => {
        expect(() => calculateNetWorth({
            currency: Currency.INR,
            positions: [
                position('same-position', 'asset', 100),
                position(' same-position ', 'liability', 20)
            ]
        })).toThrow(/Duplicate financial position ID/);
    });

    it('rejects mixed currencies instead of performing implicit conversion', () => {
        expect(() => calculateNetWorth({
            currency: Currency.INR,
            positions: [
                position('inr', 'asset', 100, 'Cash', Currency.INR),
                position('usd', 'asset', 100, 'Cash', Currency.USD)
            ]
        })).toThrow(/Convert currencies explicitly/);
    });

    it('rejects negative asset or liability values', () => {
        expect(() => calculateNetWorth({
            currency: Currency.INR,
            positions: [position('negative', 'asset', -1)]
        })).toThrow(/non-negative value/);
    });

    it('rejects missing IDs and categories', () => {
        expect(() => calculateNetWorth({
            currency: Currency.INR,
            positions: [position('  ', 'asset', 10)]
        })).toThrow(/non-empty ID/);

        expect(() => calculateNetWorth({
            currency: Currency.INR,
            positions: [position('cash', 'asset', 10, '  ')]
        })).toThrow(/non-empty category/);
    });
});
