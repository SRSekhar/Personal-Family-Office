import { describe, expect, it } from 'vitest';
import { buildMonthlyFinancialReview, renderMonthlyFinancialReviewHtml } from '../monthly-financial-review.js';

const entries = [
    { id: 'income-prior', date: '2026-08-01', type: 'income', category: 'Salary', description: 'Monthly salary', amount: 80000, recurring: true },
    { id: 'expense-prior', date: '2026-08-03', type: 'expense', category: 'Groceries', description: 'Food', amount: 40000, recurring: false },
    { id: 'income-current', date: '2026-09-01', type: 'income', category: 'Salary', description: 'Monthly salary', amount: 100000, recurring: true },
    { id: 'expense-current', date: '2026-09-04', type: 'expense', category: 'Groceries', description: 'Food', amount: 15000, recurring: false },
    { id: 'expense-other', date: '2026-09-05', type: 'expense', category: 'Utilities', description: 'Power', amount: 35000, recurring: false }
];
const budgets = [
    { month: '2026-09', category: 'Groceries', amount: 10000 },
    { month: '2026-09', category: 'Utilities', amount: 40000 },
    { month: '2026-08', category: 'Groceries', amount: 20000 }
];
const goals = [
    { id: 'goal-1', name: 'Emergency fund', targetAmount: 200000, currentAmount: 100000, targetDate: '2026-12-31' }
];

describe('monthly financial review', () => {
    it('compares recorded selected-month cash flow with the prior month and calculates savings rate', () => {
        const review = buildMonthlyFinancialReview({ entries, budgets, goals, month: '2026-09', generatedAt: new Date('2026-10-21T08:00:00.000Z') });
        expect(review.current).toMatchObject({ income: 100000, expenses: 50000, net: 50000, savingsRate: 50, transactionCount: 3 });
        expect(review.prior).toMatchObject({ income: 80000, expenses: 40000, net: 40000, savingsRate: 50, transactionCount: 2 });
        expect(review.hasCurrentTransactions).toBe(true);
        expect(review.hasPriorTransactions).toBe(true);
        expect(review.categoryComparison.find((item) => item.category === 'Groceries')).toMatchObject({
            currentIncome: 0, currentExpenses: 15000, priorIncome: 0, priorExpenses: 40000,
            incomeChange: 0, expenseChange: -25000
        });
        expect(review.categoryComparison.find((item) => item.category === 'Utilities')).toMatchObject({
            currentExpenses: 35000, priorExpenses: 0, expenseChange: 35000
        });
        expect(review.categoryComparison.find((item) => item.category === 'Salary')).toMatchObject({
            currentIncome: 100000, priorIncome: 80000, incomeChange: 20000
        });
    });

    it('uses only explicit budgets and saved goals, with positive overrun and bounded goal progress', () => {
        const review = buildMonthlyFinancialReview({ entries, budgets, goals, month: '2026-09', generatedAt: new Date('2026-10-21T08:00:00.000Z') });
        expect(review.budgets).toEqual([
            { category: 'Groceries', budget: 10000, actual: 15000, remaining: -5000, overrun: 5000, status: 'Over budget' },
            { category: 'Utilities', budget: 40000, actual: 35000, remaining: 5000, overrun: 0, status: 'Within budget' }
        ]);
        expect(review.goals[0]).toMatchObject({ name: 'Emergency fund', progress: 50, remaining: 100000, status: 'In progress' });
    });

    it('separates recorded expenses that have no explicit budget for the selected month', () => {
        const review = buildMonthlyFinancialReview({
            entries: [...entries, { id: 'expense-unbudgeted', date: '2026-09-06', type: 'expense', category: 'Transport', description: 'Bus and taxi', amount: 12000, recurring: false }],
            budgets, goals: [], month: '2026-09', generatedAt: new Date('2026-10-21T08:00:00.000Z')
        });
        expect(review.unbudgetedExpenses).toEqual([{ category: 'Transport', actual: 12000, transactionCount: 1 }]);
        const html = renderMonthlyFinancialReviewHtml(review);
        expect(html).toContain('Expenses without a saved budget');
        expect(html).toContain('Total expenses without a saved budget: ₹12,000.');
    });

    it('handles a month without transactions and zero-income savings rates explicitly', () => {
        const review = buildMonthlyFinancialReview({ entries, budgets: [], goals: [], month: '2026-07', generatedAt: new Date('2026-10-21T08:00:00.000Z') });
        expect(review.current).toMatchObject({ income: 0, expenses: 0, net: 0, savingsRate: null, transactionCount: 0 });
        expect(review.hasCurrentTransactions).toBe(false);
        expect(review.hasPriorTransactions).toBe(false);
    });

    it('rejects malformed month, duplicate budgets, and invalid transactions without changing input', () => {
        expect(() => buildMonthlyFinancialReview({ entries, budgets, goals, month: '2026-13' })).toThrow(/YYYY-MM/);
        expect(() => buildMonthlyFinancialReview({ entries, budgets: [...budgets, budgets[0]], goals, month: '2026-09' })).toThrow(/duplicate month\/category/);
        expect(() => buildMonthlyFinancialReview({ entries: [{ ...entries[0], amount: -1 }], budgets: [], goals: [], month: '2026-09' })).toThrow(/invalid or duplicate/);
        expect(entries[0].amount).toBe(80000);
    });

    it('renders a self-contained report and escapes user-controlled category and goal names', () => {
        const review = buildMonthlyFinancialReview({
            entries: [{ ...entries[0], date: '2026-09-01', category: '<script>alert(1)</script>' }],
            budgets: [], goals: [{ ...goals[0], name: '<img src=x onerror=alert(1)>' }],
            month: '2026-09', generatedAt: new Date('2026-10-21T08:00:00.000Z')
        });
        const html = renderMonthlyFinancialReviewHtml(review);
        expect(html).toContain('Monthly financial review');
        expect(html).toContain('prior month');
        expect(html).toContain('Category changes vs prior month');
        expect(html).toContain('Expense change');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).not.toMatch(/<script\b|<iframe\b/i);
        expect(html).not.toContain('https://');
    });
});
