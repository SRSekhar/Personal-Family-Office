import { describe, expect, it } from 'vitest';

import { projectCompoundGrowth } from '../src/index.js';

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

    it('rejects a projection that overflows the numeric range', () => {
        expect(() => projectCompoundGrowth({
            initialValue: 1e308,
            annualRate: 1,
            periods: 2
        })).toThrow(RangeError);
    });
});
