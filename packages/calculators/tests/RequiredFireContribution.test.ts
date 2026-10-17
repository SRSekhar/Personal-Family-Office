import { describe, expect, it } from 'vitest';

import { calculateRequiredFireContribution } from '../src/index.js';

const baseInput = {
    currentPortfolio: 1_000_000,
    yearsToRetirement: 10,
    expectedAnnualReturn: 0.07,
    annualInflationRate: 0.04,
    annualRetirementSpendingToday: 300_000,
    withdrawalRate: 0.04,
    contributionTiming: 'end' as const
};

describe('calculateRequiredFireContribution', () => {
    it('solves an annual contribution that reaches the target corpus', () => {
        const result = calculateRequiredFireContribution(baseInput);

        expect(result.requiredAnnualContribution).toBeGreaterThan(0);
        expect(result.readiness.projectedPortfolioAtRetirement)
            .toBeGreaterThanOrEqual(result.readiness.targetCorpusAtRetirement);
        expect(result.readiness.projectedPortfolioAtRetirement)
            .toBeCloseTo(result.readiness.targetCorpusAtRetirement, 4);
        expect(result.readiness.isOnTrack).toBe(true);
    });


    it('solves the contribution with a zero return assumption', () => {
        const result = calculateRequiredFireContribution({
            ...baseInput,
            currentPortfolio: 0,
            yearsToRetirement: 10,
            expectedAnnualReturn: 0,
            annualInflationRate: 0,
            annualRetirementSpendingToday: 100,
            withdrawalRate: 0.04
        });

        expect(result.requiredAnnualContribution).toBeCloseTo(250, 8);
        expect(result.readiness.isOnTrack).toBe(true);
    });

    it('supports a negative return assumption greater than -100%', () => {
        const result = calculateRequiredFireContribution({
            ...baseInput,
            currentPortfolio: 0,
            yearsToRetirement: 10,
            expectedAnnualReturn: -0.1,
            annualInflationRate: 0,
            annualRetirementSpendingToday: 100,
            withdrawalRate: 0.04
        });

        expect(result.requiredAnnualContribution).toBeGreaterThan(0);
        expect(result.readiness.isOnTrack).toBe(true);
    });

    it('returns zero contribution when the current portfolio is sufficient', () => {
        const result = calculateRequiredFireContribution({
            ...baseInput,
            currentPortfolio: 20_000_000,
            annualRetirementSpendingToday: 100_000
        });

        expect(result.requiredAnnualContribution).toBe(0);
        expect(result.readiness.isOnTrack).toBe(true);
    });

    it('supports beginning-of-period contribution timing', () => {
        const end = calculateRequiredFireContribution({ ...baseInput, contributionTiming: 'end' });
        const beginning = calculateRequiredFireContribution({ ...baseInput, contributionTiming: 'beginning' });

        expect(beginning.requiredAnnualContribution).toBeLessThan(end.requiredAnnualContribution);
        expect(beginning.readiness.isOnTrack).toBe(true);
    });

    it('rejects a shortfall when no years remain until retirement', () => {
        expect(() => calculateRequiredFireContribution({
            ...baseInput,
            yearsToRetirement: 0
        })).toThrow(RangeError);
    });

    it('returns zero contribution for an already-met target with zero years remaining', () => {
        const result = calculateRequiredFireContribution({
            ...baseInput,
            currentPortfolio: 20_000_000,
            yearsToRetirement: 0,
            annualRetirementSpendingToday: 100_000
        });

        expect(result.requiredAnnualContribution).toBe(0);
        expect(result.readiness.isOnTrack).toBe(true);
    });

    it.each([
        ['negative portfolio', { currentPortfolio: -1 }],
        ['fractional years', { yearsToRetirement: 2.5 }],
        ['invalid return', { expectedAnnualReturn: -1 }],
        ['negative inflation', { annualInflationRate: -0.01 }],
        ['zero withdrawal rate', { withdrawalRate: 0 }]
    ])('rejects invalid input: %s', (_description, overrides) => {
        expect(() => calculateRequiredFireContribution({
            ...baseInput,
            ...overrides
        })).toThrow(RangeError);
    });
});
