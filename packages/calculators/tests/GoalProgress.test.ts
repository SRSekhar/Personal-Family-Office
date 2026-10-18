import { describe, expect, it } from 'vitest';
import { calculateGoalProgress } from '../src/index.js';

describe('calculateGoalProgress', () => {
    const asOfDate = new Date('2026-10-18T12:00:00Z');

    it('calculates amount remaining, percentage, and days using calendar dates', () => {
        expect(calculateGoalProgress({ targetAmount: 1_000_000, currentAmount: 250_000, targetDate: '2027-10-18', asOfDate })).toEqual({
            targetAmount: 1_000_000, currentAmount: 250_000, amountRemaining: 750_000,
            progressPercent: 25, daysRemaining: 365, isComplete: false, isOverdue: false
        });
    });

    it('marks a goal complete at or above target without negative remaining amount', () => {
        const result = calculateGoalProgress({ targetAmount: 100, currentAmount: 120, targetDate: '2026-10-17', asOfDate });
        expect(result.amountRemaining).toBe(0);
        expect(result.progressPercent).toBe(120);
        expect(result.isComplete).toBe(true);
        expect(result.isOverdue).toBe(false);
    });

    it('flags an incomplete goal past its target date', () => {
        const result = calculateGoalProgress({ targetAmount: 100, currentAmount: 25, targetDate: '2026-10-17', asOfDate });
        expect(result.daysRemaining).toBe(-1);
        expect(result.isOverdue).toBe(true);
    });

    it.each([
        ['zero target', { targetAmount: 0 }],
        ['negative target', { targetAmount: -1 }],
        ['infinite target', { targetAmount: Number.POSITIVE_INFINITY }],
        ['negative current amount', { currentAmount: -1 }],
        ['non-finite current amount', { currentAmount: Number.NaN }],
        ['malformed date', { targetDate: '18-10-2027' }],
        ['impossible date', { targetDate: '2027-02-29' }],
        ['invalid as-of date', { asOfDate: new Date(Number.NaN) }]
    ])('rejects %s', (_label, overrides) => {
        expect(() => calculateGoalProgress({
            targetAmount: 100, currentAmount: 10, targetDate: '2027-10-18', asOfDate, ...overrides
        })).toThrow(RangeError);
    });
});
