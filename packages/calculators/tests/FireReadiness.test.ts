import { describe, expect, it } from 'vitest';

import { calculateFireReadiness } from '../src/index.js';

describe('calculateFireReadiness', () => {
    it('calculates an on-track scenario with explicit nominal assumptions', () => {
        const result = calculateFireReadiness({
            currentPortfolio: 1_000_000,
            annualContribution: 100_000,
            yearsToRetirement: 10,
            expectedAnnualReturn: 0.07,
            annualInflationRate: 0.04,
            annualRetirementSpendingToday: 300_000,
            withdrawalRate: 0.04,
            contributionTiming: 'end'
        });

        expect(result.projectedPortfolioAtRetirement).toBeCloseTo(3_076_781.3, 0);
        expect(result.projectedAnnualRetirementSpending).toBeCloseTo(444_073.6, 0);
        expect(result.targetCorpusAtRetirement).toBeCloseTo(11_101_840, -1);
        expect(result.surplusOrShortfall).toBeCloseTo(
            result.projectedPortfolioAtRetirement - result.targetCorpusAtRetirement,
            10
        );
        expect(result.isOnTrack).toBe(false);
        expect(result.contributionTiming).toBe('end');
    });

    it('supports zero years to retirement without adding future contributions', () => {
        const result = calculateFireReadiness({
            currentPortfolio: 500_000,
            annualContribution: 100_000,
            yearsToRetirement: 0,
            expectedAnnualReturn: 0.07,
            annualInflationRate: 0.04,
            annualRetirementSpendingToday: 20_000,
            withdrawalRate: 0.04
        });

        expect(result.projectedPortfolioAtRetirement).toBe(500_000);
        expect(result.projectedAnnualRetirementSpending).toBe(20_000);
        expect(result.targetCorpusAtRetirement).toBe(500_000);
        expect(result.surplusOrShortfall).toBe(0);
        expect(result.isOnTrack).toBe(true);
    });

    it('uses beginning-of-period contribution timing when requested', () => {
        const common = {
            currentPortfolio: 100,
            annualContribution: 10,
            yearsToRetirement: 2,
            expectedAnnualReturn: 0.1,
            annualInflationRate: 0,
            annualRetirementSpendingToday: 1,
            withdrawalRate: 0.04
        };

        const end = calculateFireReadiness({ ...common, contributionTiming: 'end' });
        const beginning = calculateFireReadiness({ ...common, contributionTiming: 'beginning' });

        expect(end.projectedPortfolioAtRetirement).toBeCloseTo(131, 10);
        expect(beginning.projectedPortfolioAtRetirement).toBeCloseTo(133.1, 10);
        expect(beginning.projectedPortfolioAtRetirement).toBeGreaterThan(end.projectedPortfolioAtRetirement);
    });

    it('detects a scenario with sufficient projected corpus', () => {
        const result = calculateFireReadiness({
            currentPortfolio: 10_000_000,
            annualContribution: 0,
            yearsToRetirement: 0,
            expectedAnnualReturn: 0.05,
            annualInflationRate: 0.03,
            annualRetirementSpendingToday: 300_000,
            withdrawalRate: 0.04
        });

        expect(result.targetCorpusAtRetirement).toBe(7_500_000);
        expect(result.surplusOrShortfall).toBe(2_500_000);
        expect(result.isOnTrack).toBe(true);
    });

    it.each([
        ['negative portfolio', { currentPortfolio: -1 }],
        ['non-finite contribution', { annualContribution: Number.NaN }],
        ['fractional years', { yearsToRetirement: 1.5 }],
        ['negative years', { yearsToRetirement: -1 }],
        ['return at or below -100%', { expectedAnnualReturn: -1 }],
        ['non-finite return', { expectedAnnualReturn: Number.POSITIVE_INFINITY }],
        ['negative inflation', { annualInflationRate: -0.01 }],
        ['non-finite inflation', { annualInflationRate: Number.NaN }],
        ['zero withdrawal rate', { withdrawalRate: 0 }],
        ['withdrawal rate above 100%', { withdrawalRate: 1.01 }]
    ])('rejects invalid input: %s', (_description, overrides) => {
        const input = {
            currentPortfolio: 100,
            annualContribution: 10,
            yearsToRetirement: 5,
            expectedAnnualReturn: 0.05,
            annualInflationRate: 0.03,
            annualRetirementSpendingToday: 20,
            withdrawalRate: 0.04,
            ...overrides
        };

        expect(() => calculateFireReadiness(input as Parameters<typeof calculateFireReadiness>[0]))
            .toThrow(RangeError);
    });

    it('rejects a result that overflows the numeric range', () => {
        expect(() => calculateFireReadiness({
            currentPortfolio: 1e308,
            annualContribution: 0,
            yearsToRetirement: 100,
            expectedAnnualReturn: 1,
            annualInflationRate: 0,
            annualRetirementSpendingToday: 0,
            withdrawalRate: 0.04
        })).toThrow(RangeError);
    });
});
