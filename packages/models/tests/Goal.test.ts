import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    Goal,
    Money
} from '../src/index.js';

describe('Goal', () => {
    it('should create a goal', () => {
        const date = new Date('2035-12-31');

        const goal = new Goal(
            Identifier.create(),
            'Financial Independence',
            new Money(100_000_000, Currency.INR),
            date
        );

        expect(goal.name).toBe('Financial Independence');
        expect(goal.targetAmount.amount).toBe(100_000_000);
        expect(goal.targetDate).toEqual(date);
    });

    it('should update target amount', () => {
        const goal = new Goal(
            Identifier.create(),
            'Retirement',
            new Money(50_000_000),
            new Date('2035-12-31')
        );

        const updated = goal.updateTargetAmount(
            new Money(75_000_000)
        );

        expect(updated.targetAmount.amount).toBe(75_000_000);
        expect(updated.id.equals(goal.id)).toBe(true);
    });

    it('should update target date', () => {
        const goal = new Goal(
            Identifier.create(),
            'Retirement',
            new Money(50_000_000),
            new Date('2035-12-31')
        );

        const updated = goal.updateTargetDate(
            new Date('2038-12-31')
        );

        expect(updated.targetDate.getFullYear()).toBe(2038);
    });
});