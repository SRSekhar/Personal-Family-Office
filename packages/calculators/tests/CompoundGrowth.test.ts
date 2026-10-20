import { describe, expect, it } from 'vitest';

import {
    MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS,
    projectCompoundGrowth,
    projectCompoundGrowthSchedule
} from '../src/index.js';

describe('projectCompoundGrowthSchedule', () => {
    it('includes year zero and produces a consistent annual breakdown', () => {
        const rows = projectCompoundGrowthSchedule({
            initialValue: 1000,
            annualRate: 0.1,
            periods: 2,
            contributionPerPeriod: 100,
            contributionTiming: 'end'
        });
        expect(rows).toHaveLength(3);
        expect(rows[0]).toEqual({
            year: 0, projectedValue: 1000, totalContributions: 1000, estimatedGrowth: 0
        });
        expect(rows[1].projectedValue).toBeCloseTo(1200, 10);
        expect(rows[2].projectedValue).toBeCloseTo(1420, 10);
        expect(rows[2].totalContributions).toBe(1200);
        expect(rows[2].estimatedGrowth).toBeCloseTo(220, 10);
    });

    it('applies beginning-of-year timing consistently in every row', () => {
        const rows = projectCompoundGrowthSchedule({
            initialValue: 1000, annualRate: 0.1, periods: 2,
            contributionPerPeriod: 100, contributionTiming: 'beginning'
        });
        expect(rows[2].projectedValue).toBeCloseTo(1441, 10);
    });

    it('handles zero years and rejects schedules longer than the supported cap', () => {
        expect(projectCompoundGrowthSchedule({ initialValue: 50, annualRate: 0, periods: 0 }))
            .toEqual([{ year: 0, projectedValue: 50, totalContributions: 50, estimatedGrowth: 0 }]);
        expect(MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS).toBe(100);
        expect(() => projectCompoundGrowthSchedule({
            initialValue: 1, annualRate: 0.05, periods: MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS + 1
        })).toThrow('must not exceed 100');
    });

    it('rejects yearly totals that exceed the numeric range', () => {
        expect(() => projectCompoundGrowthSchedule({
            initialValue: Number.MAX_VALUE, annualRate: 0, periods: 1,
            contributionPerPeriod: Number.MAX_VALUE
        })).toThrow(RangeError);
    });
});

describe('projectCompoundGrowth', () => {
    it('compounds an initial value without recurring contributions', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: 0.1,
            periods: 2
        })).toBeCloseTo(1210, 10);
    });

    it('adds end-of-period contributions', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: 0.1,
            periods: 2,
            contributionPerPeriod: 100,
            contributionTiming: 'end'
        })).toBeCloseTo(1420, 10);
    });

    it('adds beginning-of-period contributions with an extra period of growth', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: 0.1,
            periods: 2,
            contributionPerPeriod: 100,
            contributionTiming: 'beginning'
        })).toBeCloseTo(1441, 10);
    });

    it('handles a zero growth rate without division by zero', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: 0,
            periods: 3,
            contributionPerPeriod: 100
        })).toBe(1300);
    });

    it('returns the initial value when there are zero periods', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: 0.07,
            periods: 0,
            contributionPerPeriod: 500
        })).toBe(1000);
    });

    it('supports a negative rate greater than -100%', () => {
        expect(projectCompoundGrowth({
            initialValue: 1000,
            annualRate: -0.1,
            periods: 2
        })).toBeCloseTo(810, 10);
    });

    it.each([
        ['negative initial value', { initialValue: -1, annualRate: 0.05, periods: 1 }],
        ['non-finite initial value', { initialValue: Number.NaN, annualRate: 0.05, periods: 1 }],
        ['rate at or below -100%', { initialValue: 100, annualRate: -1, periods: 1 }],
        ['non-finite rate', { initialValue: 100, annualRate: Number.POSITIVE_INFINITY, periods: 1 }],
        ['negative periods', { initialValue: 100, annualRate: 0.05, periods: -1 }],
        ['fractional periods', { initialValue: 100, annualRate: 0.05, periods: 1.5 }],
        ['negative contribution', { initialValue: 100, annualRate: 0.05, periods: 1, contributionPerPeriod: -1 }],
        ['non-finite contribution', { initialValue: 100, annualRate: 0.05, periods: 1, contributionPerPeriod: Number.NaN }]
    ])('rejects invalid input: %s', (_description, input) => {
        expect(() => projectCompoundGrowth(input)).toThrow(RangeError);
    });

    it('rejects an unsupported contribution timing at runtime', () => {
        const input = {
            initialValue: 100,
            annualRate: 0.05,
            periods: 1,
            contributionTiming: 'monthly' as never
        };

        expect(() => projectCompoundGrowth(input)).toThrow(RangeError);
    });

    it('rejects a projection that overflows the numeric range', () => {
        expect(() => projectCompoundGrowth({
            initialValue: 1e308,
            annualRate: 1,
            periods: 2
        })).toThrow(RangeError);
    });
});
