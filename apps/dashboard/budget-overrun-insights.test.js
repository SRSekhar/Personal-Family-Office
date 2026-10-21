import { describe, expect, it } from 'vitest';
import { summarizeRepeatedOverruns } from './budget-overrun-insights.js';

describe('repeated budget overrun insights', () => {
    it('reports only categories over budget in at least two budgeted months', () => {
        const budgets = [
            { month: '2026-01', category: 'Groceries', amount: 100 },
            { month: '2026-02', category: 'groceries', amount: 100 },
            { month: '2026-03', category: 'Groceries', amount: 100 },
            { month: '2026-01', category: 'Rent', amount: 500 }
        ];
        const entries = [
            { date: '2026-01-10', type: 'expense', category: 'Groceries', amount: 125 },
            { date: '2026-02-10', type: 'expense', category: 'GROCERIES', amount: 150 },
            { date: '2026-03-10', type: 'expense', category: 'Groceries', amount: 90 },
            { date: '2026-01-01', type: 'expense', category: 'Rent', amount: 550 },
            { date: '2026-01-15', type: 'expense', category: 'Unbudgeted', amount: 900 }
        ];

        expect(summarizeRepeatedOverruns(budgets, entries)).toEqual([
            {
                category: 'Groceries',
                monthsBudgeted: 3,
                monthsOverBudget: 2,
                totalOverrun: 75,
                averageOverrun: 37.5
            }
        ]);
    });

    it('returns an empty list when no category repeatedly exceeds its saved budget', () => {
        const budgets = [
            { month: '2026-01', category: 'Travel', amount: 100 },
            { month: '2026-02', category: 'Travel', amount: 100 }
        ];
        const entries = [
            { date: '2026-01-10', type: 'expense', category: 'Travel', amount: 110 },
            { date: '2026-02-10', type: 'expense', category: 'Travel', amount: 90 }
        ];

        expect(summarizeRepeatedOverruns(budgets, entries)).toEqual([]);
    });
});
