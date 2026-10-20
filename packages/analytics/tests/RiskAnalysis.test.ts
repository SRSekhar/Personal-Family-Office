import { describe, expect, it } from 'vitest';

import { analyzeReturnSeries } from '../src/RiskAnalysis.js';

describe('analyzeReturnSeries', () => {
    it('calculates annualized sample volatility, drawdown, and downside counts', () => {
        const result = analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [
                { date: '2026-01-31', returnRate: 0.1 },
                { date: '2026-02-28', returnRate: -0.2 },
                { date: '2026-03-31', returnRate: 0.05 }
            ]
        });
        const returns = [0.1, -0.2, 0.05];
        const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
        const sampleVariance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 2;

        expect(result.observationCount).toBe(3);
        expect(result.annualizedVolatility).toBeCloseTo(Math.sqrt(sampleVariance) * Math.sqrt(12));
        expect(result.maximumDrawdown).toBeCloseTo(0.2);
        expect(result.worstPeriodReturn).toBe(-0.2);
        expect(result.negativePeriodCount).toBe(1);
    });

    it('returns null metrics for empty input and volatility for one observation', () => {
        expect(analyzeReturnSeries({ periodsPerYear: 12, observations: [] })).toEqual({
            observationCount: 0,
            annualizedVolatility: null,
            maximumDrawdown: null,
            worstPeriodReturn: null,
            negativePeriodCount: 0
        });
        expect(analyzeReturnSeries({
            periodsPerYear: 252,
            observations: [{ date: '2026-01-02', returnRate: -1 }]
        })).toEqual({
            observationCount: 1,
            annualizedVolatility: null,
            maximumDrawdown: 1,
            worstPeriodReturn: -1,
            negativePeriodCount: 1
        });
    });

    it('returns zero drawdown for a non-negative rising series', () => {
        const result = analyzeReturnSeries({
            periodsPerYear: 2,
            observations: [
                { date: '2026-01-01', returnRate: 0.1 },
                { date: '2026-02-01', returnRate: 0.2 }
            ]
        });
        expect(result.maximumDrawdown).toBe(0);
        expect(result.negativePeriodCount).toBe(0);
    });

    it('requires a positive integer annualization frequency', () => {
        expect(() => analyzeReturnSeries({ periodsPerYear: 0, observations: [] }))
            .toThrow('Periods per year must be a positive integer.');
        expect(() => analyzeReturnSeries({ periodsPerYear: 12.5, observations: [] }))
            .toThrow('Periods per year must be a positive integer.');
    });

    it('rejects invalid dates, duplicate dates, and out-of-order observations', () => {
        expect(() => analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [{ date: '2026-02-30', returnRate: 0.1 }]
        })).toThrow('valid YYYY-MM-DD date');
        expect(() => analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [
                { date: '2026-01-31', returnRate: 0.1 },
                { date: '2026-01-31', returnRate: 0.2 }
            ]
        })).toThrow('unique dates in ascending order');
        expect(() => analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [
                { date: '2026-02-28', returnRate: 0.1 },
                { date: '2026-01-31', returnRate: 0.2 }
            ]
        })).toThrow('unique dates in ascending order');
    });

    it('rejects returns below negative 100 percent and non-finite returns', () => {
        expect(() => analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [{ date: '2026-01-31', returnRate: -1.01 }]
        })).toThrow('finite decimal values greater than or equal to -1');
        expect(() => analyzeReturnSeries({
            periodsPerYear: 12,
            observations: [{ date: '2026-01-31', returnRate: Number.POSITIVE_INFINITY }]
        })).toThrow('finite decimal values greater than or equal to -1');
    });

    it('rejects compounded wealth overflow and missing input', () => {
        expect(() => analyzeReturnSeries({
            periodsPerYear: 2,
            observations: [
                { date: '2026-01-01', returnRate: 1e308 },
                { date: '2026-02-01', returnRate: 1e308 }
            ]
        })).toThrow('Compounded wealth index exceeds the supported numeric range.');
        expect(() => analyzeReturnSeries(null)).toThrow('A return-series input is required.');
    });
});
