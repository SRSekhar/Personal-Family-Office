import { describe, expect, it } from 'vitest';

import { calculateCagr } from '../src/index.js';

describe('calculateCagr', () => {
    it('calculates compound annual growth across multiple periods', () => {
        expect(calculateCagr({
            beginningValue: 1000,
            endingValue: 1331,
            periods: 3
        })).toBeCloseTo(0.1, 10);
    });

    it('avoids intermediate ratio overflow for extreme finite values', () => {
        const rate = calculateCagr({
            beginningValue: Number.MIN_VALUE,
            endingValue: Number.MAX_VALUE,
            periods: 1000
        });

        expect(Number.isFinite(rate)).toBe(true);
        expect(rate).toBeGreaterThan(0);
    });

    it('returns a negative rate when the ending value is lower', () => {
        expect(calculateCagr({
            beginningValue: 1000,
            endingValue: 729,
            periods: 3
        })).toBeCloseTo(-0.1, 10);
    });

    it('returns zero when the beginning and ending values match', () => {
        expect(calculateCagr({
            beginningValue: 500,
            endingValue: 500,
            periods: 8
        })).toBe(0);
    });

    it.each([
        ['zero beginning value', { beginningValue: 0, endingValue: 100, periods: 1 }],
        ['negative beginning value', { beginningValue: -1, endingValue: 100, periods: 1 }],
        ['zero ending value', { beginningValue: 100, endingValue: 0, periods: 1 }],
        ['negative ending value', { beginningValue: 100, endingValue: -1, periods: 1 }],
        ['zero periods', { beginningValue: 100, endingValue: 110, periods: 0 }],
        ['negative periods', { beginningValue: 100, endingValue: 110, periods: -1 }],
        ['non-finite beginning value', { beginningValue: Number.NaN, endingValue: 110, periods: 1 }],
        ['non-finite ending value', { beginningValue: 100, endingValue: Number.POSITIVE_INFINITY, periods: 1 }],
        ['non-finite periods', { beginningValue: 100, endingValue: 110, periods: Number.POSITIVE_INFINITY }]
    ])('rejects invalid input: %s', (_description, input) => {
        expect(() => calculateCagr(input)).toThrow(RangeError);
    });
});
