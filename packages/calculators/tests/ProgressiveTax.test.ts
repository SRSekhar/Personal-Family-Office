import { Currency, Money, Percentage } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { estimateProgressiveTax, type ProgressiveTaxBracket } from '../src/ProgressiveTax.js';

const brackets: readonly ProgressiveTaxBracket[] = [
    { upperBound: new Money(25_000, Currency.INR), marginalRate: new Percentage(0) },
    { upperBound: new Money(50_000, Currency.INR), marginalRate: new Percentage(10) },
    { upperBound: null, marginalRate: new Percentage(20) }
];

describe('estimateProgressiveTax', () => {
    it('calculates tax by marginal bracket and reports effective rate', () => {
        const result = estimateProgressiveTax({
            taxableIncome: new Money(100_000, Currency.INR),
            brackets
        });
        expect(result.estimatedTax.amount).toBe(12_500);
        expect(result.afterTaxIncome.amount).toBe(87_500);
        expect(result.effectiveTaxRate).toBe(12.5);
        expect(result.marginalRate.value).toBe(20);
    });

    it('handles income inside the first bracket and at a bracket boundary', () => {
        const first = estimateProgressiveTax({ taxableIncome: new Money(20_000), brackets });
        expect(first.estimatedTax.amount).toBe(0);
        expect(first.effectiveTaxRate).toBe(0);
        expect(first.marginalRate.value).toBe(0);

        const boundary = estimateProgressiveTax({ taxableIncome: new Money(25_000), brackets });
        expect(boundary.estimatedTax.amount).toBe(0);
        expect(boundary.marginalRate.value).toBe(0);
    });

    it('returns null effective rate for zero taxable income', () => {
        const result = estimateProgressiveTax({ taxableIncome: new Money(0), brackets });
        expect(result.estimatedTax.amount).toBe(0);
        expect(result.afterTaxIncome.amount).toBe(0);
        expect(result.effectiveTaxRate).toBeNull();
    });

    it('rejects invalid income and malformed bracket schedules', () => {
        expect(() => estimateProgressiveTax({ taxableIncome: new Money(-1), brackets }))
            .toThrow('non-negative finite');
        expect(() => estimateProgressiveTax({ taxableIncome: new Money(100), brackets: [] }))
            .toThrow('At least one tax bracket');
        expect(() => estimateProgressiveTax({
            taxableIncome: new Money(100),
            brackets: [
                { upperBound: new Money(100), marginalRate: new Percentage(20) },
                { upperBound: null, marginalRate: new Percentage(10) }
            ]
        })).toThrow('non-decreasing');
        expect(() => estimateProgressiveTax({
            taxableIncome: new Money(100),
            brackets: [
                { upperBound: null, marginalRate: new Percentage(10) },
                { upperBound: null, marginalRate: new Percentage(20) }
            ]
        })).toThrow('final tax bracket');
        expect(() => estimateProgressiveTax({
            taxableIncome: new Money(100, Currency.INR),
            brackets: [
                { upperBound: new Money(50, Currency.USD), marginalRate: new Percentage(0) },
                { upperBound: null, marginalRate: new Percentage(10) }
            ]
        })).toThrow('same currency');
    });
});
