import type { AssetAllocationResult } from '@pfo/calculators';
import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { analyzeDiversification } from '../src/DiversificationAnalysis.js';

function allocation(values: readonly number[]): AssetAllocationResult {
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        currency: Currency.INR,
        totalValue: new Money(total, Currency.INR),
        allocations: values.map((value, index) => ({
            category: `Category ${index + 1}`,
            value: new Money(value, Currency.INR),
            weight: value / total
        }))
    };
}

describe('analyzeDiversification', () => {
    it('calculates HHI, effective category count, and largest share', () => {
        const result = analyzeDiversification(allocation([100, 100, 100, 100]));
        expect(result.categoryCount).toBe(4);
        expect(result.concentrationIndex).toBe(0.25);
        expect(result.effectiveCategoryCount).toBe(4);
        expect(result.largestCategoryShare).toBe(0.25);
    });

    it('shows greater concentration when one category dominates', () => {
        const result = analyzeDiversification(allocation([80, 20]));
        expect(result.concentrationIndex).toBeCloseTo(0.68);
        expect(result.effectiveCategoryCount).toBeCloseTo(1 / 0.68);
        expect(result.largestCategoryShare).toBe(0.8);
    });

    it('returns null concentration metrics for an empty allocation', () => {
        expect(analyzeDiversification({
            currency: Currency.INR,
            totalValue: Money.zero(Currency.INR),
            allocations: []
        })).toEqual({
            categoryCount: 0,
            concentrationIndex: null,
            effectiveCategoryCount: null,
            largestCategoryShare: null
        });
    });

    it('rejects weights or category values that do not reconcile', () => {
        const invalid = allocation([100, 100]);
        expect(() => analyzeDiversification({
            ...invalid,
            allocations: invalid.allocations.map((item, index) => ({
                ...item,
                weight: index === 0 ? 0.7 : 0.3
            }))
        })).toThrow('Allocation category values and weights must reconcile to the total.');
        expect(() => analyzeDiversification({
            ...invalid,
            allocations: invalid.allocations.map((item) => ({ ...item, value: new Money(40, Currency.INR) }))
        })).toThrow('Allocation category values and weights must reconcile to the total.');
    });

    it('rejects duplicate categories and mixed currencies', () => {
        const invalid = allocation([100, 100]);
        expect(() => analyzeDiversification({
            ...invalid,
            allocations: invalid.allocations.map((item) => ({ ...item, category: 'Same' }))
        })).toThrow('Duplicate allocation category');
        expect(() => analyzeDiversification({
            ...invalid,
            allocations: invalid.allocations.map((item, index) => index === 0
                ? { ...item, value: new Money(item.value.amount, Currency.USD) }
                : item)
        })).toThrow('Allocation category values and weights must be finite');
    });

    it('rejects empty non-zero allocations and non-finite inputs', () => {
        expect(() => analyzeDiversification({
            currency: Currency.INR,
            totalValue: new Money(100, Currency.INR),
            allocations: []
        })).toThrow('An empty allocation must have a zero total value.');
        expect(() => analyzeDiversification(null)).toThrow('An asset allocation result is required.');
    });
});
