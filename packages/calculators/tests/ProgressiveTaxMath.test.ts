import { describe, expect, it } from 'vitest';
import { estimateProgressiveTaxMath, type ProgressiveTaxMathBracket } from '../src/ProgressiveTaxMath.js';

const brackets: readonly ProgressiveTaxMathBracket[] = [
    { upperBound: 25_000, marginalRatePercent: 0 },
    { upperBound: 50_000, marginalRatePercent: 10 },
    { upperBound: null, marginalRatePercent: 20 }
];

describe('estimateProgressiveTaxMath', () => {
    it('calculates marginal tax, after-tax income, and effective rate', () => {
        expect(estimateProgressiveTaxMath(100_000, brackets)).toEqual({ estimatedTax: 12_500, afterTaxIncome: 87_500, effectiveTaxRate: 12.5, marginalRatePercent: 20 });
    });
    it('handles zero income and bracket boundaries', () => {
        expect(estimateProgressiveTaxMath(0, brackets)).toEqual({ estimatedTax: 0, afterTaxIncome: 0, effectiveTaxRate: null, marginalRatePercent: 0 });
        expect(estimateProgressiveTaxMath(25_000, brackets).estimatedTax).toBe(0);
        expect(estimateProgressiveTaxMath(40_000, brackets).estimatedTax).toBe(1_500);
    });
    it('rejects invalid income, rates, bounds, and final brackets', () => {
        expect(() => estimateProgressiveTaxMath(-1, brackets)).toThrow('non-negative finite');
        expect(() => estimateProgressiveTaxMath(Number.POSITIVE_INFINITY, brackets)).toThrow('non-negative finite');
        expect(() => estimateProgressiveTaxMath(100, [])).toThrow('At least one tax bracket');
        expect(() => estimateProgressiveTaxMath(100, [{ upperBound: 100, marginalRatePercent: 20 }, { upperBound: null, marginalRatePercent: 10 }])).toThrow('non-decreasing');
        expect(() => estimateProgressiveTaxMath(100, [{ upperBound: null, marginalRatePercent: 0 }, { upperBound: null, marginalRatePercent: 10 }])).toThrow('final tax bracket');
        expect(() => estimateProgressiveTaxMath(100, [{ upperBound: 0, marginalRatePercent: 0 }, { upperBound: null, marginalRatePercent: 10 }])).toThrow('strictly increasing');
        expect(() => estimateProgressiveTaxMath(100, [{ upperBound: 100, marginalRatePercent: 0 }, { upperBound: null, marginalRatePercent: 101 }])).toThrow('between 0 and 100');
    });
});