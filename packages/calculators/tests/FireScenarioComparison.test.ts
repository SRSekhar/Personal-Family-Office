import { describe, expect, it } from 'vitest';

import { compareFireReadinessScenarios } from '../src/index.js';
import type { FireReadinessScenario } from '../src/FireScenarioComparison.js';

const baseInput = {
    currentPortfolio: 1_000_000,
    annualContribution: 100_000,
    yearsToRetirement: 10,
    expectedAnnualReturn: 0.07,
    annualInflationRate: 0.04,
    annualRetirementSpendingToday: 300_000,
    withdrawalRate: 0.04,
    contributionTiming: 'end' as const
};

describe('compareFireReadinessScenarios', () => {
    it('compares independently specified scenarios in input order and preserves assumptions', () => {
        const scenarios: FireReadinessScenario[] = [
            { id: 'base', name: 'Base case', input: baseInput },
            {
                id: 'lower-return',
                name: 'Lower return',
                input: { ...baseInput, expectedAnnualReturn: 0.04 }
            }
        ];

        const results = compareFireReadinessScenarios(scenarios);

        expect(results.map(({ id }) => id)).toEqual(['base', 'lower-return']);
        expect(results[0]?.name).toBe('Base case');
        expect(results[0]?.input).toEqual(baseInput);
        expect(results[0]?.result).toEqual(expect.objectContaining({
            yearsToRetirement: 10,
            contributionTiming: 'end'
        }));
        expect(results[1]?.input.expectedAnnualReturn).toBe(0.04);
        expect(results[1]?.result.projectedPortfolioAtRetirement)
            .toBeLessThan(results[0]!.result.projectedPortfolioAtRetirement);
        expect(results[1]?.result.targetCorpusAtRetirement)
            .toBe(results[0]?.result.targetCorpusAtRetirement);
    });

    it('returns an empty list for an empty comparison', () => {
        expect(compareFireReadinessScenarios([])).toEqual([]);
    });

    it.each([
        ['blank ID', [{ id: '  ', name: 'Base', input: baseInput }]],
        ['blank name', [{ id: 'base', name: '  ', input: baseInput }]],
        ['duplicate IDs', [
            { id: 'same', name: 'First', input: baseInput },
            { id: 'same', name: 'Second', input: baseInput }
        ]]
    ])('rejects %s', (_description, scenarios) => {
        expect(() => compareFireReadinessScenarios(scenarios as FireReadinessScenario[]))
            .toThrow(RangeError);
    });

    it('propagates invalid assumptions from the underlying calculator', () => {
        expect(() => compareFireReadinessScenarios([{
            id: 'invalid',
            name: 'Invalid return',
            input: { ...baseInput, expectedAnnualReturn: -1 }
        }])).toThrow(RangeError);
    });
});
