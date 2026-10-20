import { Identifier } from '@pfo/core';
import { Currency, Goal, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { analyzeGoalProgress } from '../src/GoalProgressAnalysis.js';

function createGoal(targetAmount = 1000, targetDate = new Date('2028-01-01T00:00:00Z')): Goal {
    return new Goal(
        Identifier.create('goal-progress'),
        'Emergency fund',
        new Money(targetAmount, Currency.INR),
        targetDate
    );
}

describe('analyzeGoalProgress', () => {
    it('calculates progress, remaining amount, and UTC calendar days', () => {
        const result = analyzeGoalProgress({
            goal: createGoal(),
            currentAmount: new Money(250, Currency.INR),
            asOf: new Date('2026-12-31T23:30:00-08:00')
        });

        expect(result.goalId).toBe('goal-progress');
        expect(result.progressPercentage).toBe(25);
        expect(result.remainingAmount.amount).toBe(750);
        expect(result.daysUntilTarget).toBe(365);
        expect(result.targetReached).toBe(false);
        expect(result.overdue).toBe(false);
    });

    it('preserves progress above 100 percent and clamps remaining amount to zero', () => {
        const result = analyzeGoalProgress({
            goal: createGoal(100, new Date('2027-12-31T00:00:00Z')),
            currentAmount: new Money(125, Currency.INR),
            asOf: new Date('2028-01-01T00:00:00Z')
        });

        expect(result.progressPercentage).toBe(125);
        expect(result.remainingAmount.amount).toBe(0);
        expect(result.targetReached).toBe(true);
        expect(result.overdue).toBe(false);
        expect(result.daysUntilTarget).toBe(-1);
    });

    it('marks an unachieved goal overdue after the target date', () => {
        const result = analyzeGoalProgress({
            goal: createGoal(100, new Date('2027-12-31T00:00:00Z')),
            currentAmount: new Money(20, Currency.INR),
            asOf: new Date('2028-01-01T00:00:00Z')
        });
        expect(result.overdue).toBe(true);
        expect(result.daysUntilTarget).toBe(-1);
    });

    it('treats the target date as due today regardless of time of day', () => {
        const result = analyzeGoalProgress({
            goal: createGoal(100, new Date('2027-12-31T00:00:00Z')),
            currentAmount: new Money(20, Currency.INR),
            asOf: new Date('2027-12-31T23:59:59Z')
        });
        expect(result.daysUntilTarget).toBe(0);
        expect(result.overdue).toBe(false);
    });

    it('rejects invalid targets, current amounts, currencies, and dates', () => {
        expect(() => analyzeGoalProgress({
            goal: createGoal(0),
            currentAmount: new Money(0, Currency.INR),
            asOf: new Date('2026-01-01T00:00:00Z')
        })).toThrow('target amount must be a positive');
        expect(() => analyzeGoalProgress({
            goal: createGoal(),
            currentAmount: new Money(-1, Currency.INR),
            asOf: new Date('2026-01-01T00:00:00Z')
        })).toThrow('non-negative');
        expect(() => analyzeGoalProgress({
            goal: createGoal(),
            currentAmount: new Money(1, Currency.USD),
            asOf: new Date('2026-01-01T00:00:00Z')
        })).toThrow('same currency');
        expect(() => analyzeGoalProgress({
            goal: createGoal(100, new Date(Number.NaN)),
            currentAmount: new Money(1, Currency.INR),
            asOf: new Date('2026-01-01T00:00:00Z')
        })).toThrow('valid dates');
        expect(() => analyzeGoalProgress({
            goal: createGoal(),
            currentAmount: new Money(1, Currency.INR),
            asOf: new Date(Number.NaN)
        })).toThrow('valid dates');
    });
});
