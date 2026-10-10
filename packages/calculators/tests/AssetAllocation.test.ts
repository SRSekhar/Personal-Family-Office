import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { calculateAssetAllocation, type FinancialPosition } from '../src/index.js';

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

describe('calculateAssetAllocation', () => {
    it('groups assets by category and calculates weights', () => {
        const result = calculateAssetAllocation({
            currency: Currency.INR,
            positions: [
                position('cash', 'asset', 25, 'Cash'),
                position('equity-a', 'asset', 50, 'Equity'),
                position('equity-b', 'asset', 25, 'Equity'),
                position('loan', 'liability', 500, 'Loans')
            ]
        });

        expect(result.totalValue.amount).toBe(100);
        expect(result.allocations).toHaveLength(2);
        expect(result.allocations.map((item) => item.category)).toEqual(['Cash', 'Equity']);
        expect(result.allocations[0]?.value.amount).toBe(25);
        expect(result.allocations[0]?.weight).toBeCloseTo(0.25, 12);
        expect(result.allocations[1]?.value.amount).toBe(75);
        expect(result.allocations[1]?.weight).toBeCloseTo(0.75, 12);
        expect(result.allocations.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1, 12);
    });

    it('normalizes whitespace in category labels', () => {
        const result = calculateAssetAllocation({
            currency: Currency.INR,
            positions: [
                position('cash-a', 'asset', 10, ' Cash '),
                position('cash-b', 'asset', 20, 'Cash')
            ]
        });

        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0]?.category).toBe('Cash');
        expect(result.allocations[0]?.value.amount).toBe(30);
    });

    it('returns an empty allocation when there are no asset positions', () => {
        const result = calculateAssetAllocation({
            currency: Currency.INR,
            positions: [position('loan', 'liability', 100, 'Loans')]
        });

        expect(result.totalValue.amount).toBe(0);
        expect(result.allocations).toEqual([]);
    });

    it('rejects asset positions with zero total value', () => {
        expect(() => calculateAssetAllocation({
            currency: Currency.INR,
            positions: [position('zero', 'asset', 0, 'Cash')]
        })).toThrow(/positive total asset value/);
    });

    it('rejects duplicate IDs and currency mismatches', () => {
        expect(() => calculateAssetAllocation({
            currency: Currency.INR,
            positions: [
                position('same', 'asset', 10),
                position('same', 'asset', 20)
            ]
        })).toThrow(/Duplicate financial position ID/);

        expect(() => calculateAssetAllocation({
            currency: Currency.INR,
            positions: [position('usd', 'asset', 10, 'Cash', Currency.USD)]
        })).toThrow(/Convert currencies explicitly/);
    });
});
