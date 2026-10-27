import { describe, expect, it } from 'vitest';
import { buildAnnualFinancialReview, renderAnnualFinancialReviewHtml } from '../annual-financial-review.js';

const entries = [
    { id: 'income-jan', date: '2026-01-01', type: 'income', category: 'Salary', description: 'Synthetic salary', amount: 1000, recurring: true },
    { id: 'expense-jan', date: '2026-01-05', type: 'expense', category: 'Food', description: 'Synthetic food', amount: 300, recurring: false },
    { id: 'income-feb', date: '2026-02-01', type: 'income', category: 'salary', description: 'Synthetic salary', amount: 1000, recurring: true },
    { id: 'expense-feb', date: '2026-02-04', type: 'expense', category: 'Food', description: 'Synthetic food', amount: 400, recurring: false },
    { id: 'expense-outside', date: '2025-12-31', type: 'expense', category: 'Food', description: 'Outside year', amount: 900, recurring: false }
];
const budgets = [
    { month: '2026-01', category: 'Food', amount: 250 },
    { month: '2026-02', category: 'Food', amount: 500 },
    { month: '2025-12', category: 'Food', amount: 100 }
];
const goals = [
    { id: 'goal-1', name: 'Emergency fund', targetAmount: 2000, currentAmount: 500, targetDate: '2027-12-31' }
];

describe('annual financial review', () => {
    it('aggregates recorded transactions by month, category, and explicitly budgeted month', () => {
        const review = buildAnnualFinancialReview({ entries, budgets, goals, year: '2026', generatedAt: new Date('2026-12-31T12:00:00.000Z') });
        expect(review.summary).toEqual({ income: 2000, expenses: 700, net: 1300, savingsRate: 65, transactionCount: 4 });
        expect(review.comparison).toEqual({
            year: '2025',
            summary: { income: 0, expenses: 900, net: -900, savingsRate: null, transactionCount: 1 },
            change: { income: 2000, expenses: -200, net: 2200, transactionCount: 3, incomePercent: null, expensesPercent: -200 / 9 },
            hasTransactions: true
        });
        expect(review.months).toHaveLength(12);
        expect(review.months[0]).toMatchObject({ month: '2026-01', income: 1000, expenses: 300, net: 700, transactionCount: 2 });
        expect(review.months[1]).toMatchObject({ month: '2026-02', income: 1000, expenses: 400, net: 600, transactionCount: 2 });
        expect(review.months[2]).toMatchObject({ month: '2026-03', income: 0, expenses: 0, net: 0, savingsRate: null, transactionCount: 0 });
        expect(review.categories.find((item) => item.category === 'Food')).toMatchObject({ income: 0, expenses: 700, net: -700, transactionCount: 2 });
        expect(review.budgets).toEqual([{
            category: 'Food', budgetedMonths: 2, overBudgetMonths: 1,
            totalBudget: 750, totalActual: 700, totalOverrun: 50, remaining: 50
        }]);
        expect(review.goals[0]).toMatchObject({ name: 'Emergency fund', progress: 25, remaining: 1500 });
    });

    it('keeps zero-activity months visible and handles zero annual income', () => {
        const review = buildAnnualFinancialReview({
            entries: [{ id: 'expense', date: '2024-02-29', type: 'expense', category: 'Travel', description: 'Synthetic', amount: 100, recurring: false }],
            budgets: [], goals: [], year: '2024', generatedAt: new Date('2024-12-31T00:00:00.000Z')
        });
        expect(review.months[1]).toMatchObject({ month: '2024-02', expenses: 100, savingsRate: null });
        expect(review.summary).toMatchObject({ income: 0, expenses: 100, net: -100, savingsRate: null, transactionCount: 1 });
        expect(review.comparison).toMatchObject({
            year: '2023', summary: { income: 0, expenses: 0, net: 0, savingsRate: null, transactionCount: 0 },
            change: { incomePercent: null, expensesPercent: null }, hasTransactions: false
        });
    });

    it('rejects malformed years, invalid inputs, and invalid timestamps', () => {
        expect(() => buildAnnualFinancialReview({ entries, budgets, goals, year: '26' })).toThrow(/YYYY/);
        expect(() => buildAnnualFinancialReview({ entries, budgets, goals, year: '0000' })).toThrow(/YYYY/);
        expect(() => buildAnnualFinancialReview({ entries, budgets, goals, year: '2026', generatedAt: new Date('invalid') })).toThrow(/timestamp/);
        expect(() => buildAnnualFinancialReview({ entries: [{ ...entries[0], amount: -1 }], budgets: [], goals: [], year: '2026' })).toThrow(/invalid or duplicate/);
        expect(() => buildAnnualFinancialReview({ entries, budgets: [...budgets, budgets[0]], goals, year: '2026' })).toThrow(/duplicate month\/category/);
    });

    it('renders a self-contained HTML report and escapes user-controlled text', () => {
        const review = buildAnnualFinancialReview({
            entries: [{ ...entries[0], category: '<img src=x onerror=alert(1)>' }],
            budgets: [], goals: [{ ...goals[0], name: '<script>alert(1)</script>' }],
            year: '2026', generatedAt: new Date('2026-12-31T12:00:00.000Z')
        });
        const html = renderAnnualFinancialReviewHtml(review);
        expect(html).toContain('Annual financial review');
        expect(html).toContain('Month-by-month cash flow');
        expect(html).toContain('Year-over-year comparison');
        expect(html).toContain('No transactions were recorded in the comparison year');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).not.toMatch(/<script\b|<iframe\b|<img\b/i);
        expect(html).not.toContain('https://');
        expect(() => renderAnnualFinancialReviewHtml({ ...review, year: 'invalid' })).toThrow(/invalid/);
    });
});
