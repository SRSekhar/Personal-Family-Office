import { describe, expect, it } from 'vitest';
import { analyzeInvestmentPerformanceMath } from '../src/InvestmentPerformanceMath.js';

describe('analyzeInvestmentPerformanceMath', () => {
    it('calculates gross totals, simple return, and annualized XIRR', () => {
        const result = analyzeInvestmentPerformanceMath({ cashFlows: [
            { amount: -1000, date: new Date('2025-01-01T00:00:00.000Z') },
            { amount: 1100, date: new Date('2026-01-01T00:00:00.000Z') }
        ] });
        expect(result.grossContributions).toBe(1000);
        expect(result.grossProceeds).toBe(1100);
        expect(result.netGain).toBe(100);
        expect(result.netReturnOnContributionsPercentage).toBe(10);
        expect(result.annualizedMoneyWeightedReturn).toBeCloseTo(0.1, 9);
        expect(result.cashFlowCount).toBe(2);
    });
    it('supports multiple contributions and a terminal receipt', () => {
        const result = analyzeInvestmentPerformanceMath({ cashFlows: [
            { amount: -500, date: new Date('2025-01-01T00:00:00.000Z') },
            { amount: -500, date: new Date('2025-07-01T00:00:00.000Z') },
            { amount: 1200, date: new Date('2026-01-01T00:00:00.000Z') }
        ] });
        expect(result.grossContributions).toBe(1000);
        expect(result.grossProceeds).toBe(1200);
        expect(result.netGain).toBe(200);
    });
    it('rejects zero amounts, invalid dates, and ambiguous XIRR sign patterns', () => {
        expect(() => analyzeInvestmentPerformanceMath({ cashFlows: [{ amount: 0, date: new Date('2025-01-01T00:00:00.000Z') }] })).toThrow('non-zero finite');
        expect(() => analyzeInvestmentPerformanceMath({ cashFlows: [{ amount: -100, date: new Date(Number.NaN) }, { amount: 110, date: new Date('2026-01-01T00:00:00.000Z') }] })).toThrow('valid date');
        expect(() => analyzeInvestmentPerformanceMath({ cashFlows: [
            { amount: -100, date: new Date('2025-01-01T00:00:00.000Z') },
            { amount: 200, date: new Date('2025-06-01T00:00:00.000Z') },
            { amount: -110, date: new Date('2026-01-01T00:00:00.000Z') }
        ] })).toThrow('exactly one sign change');
    });
});