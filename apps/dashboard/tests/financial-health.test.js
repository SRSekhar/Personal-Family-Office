import { describe, expect, it } from 'vitest';
import { calculateFinancialHealth } from '../financial-health.js';

const base = {
    month: '2026-10',
    records: [
        { type: 'asset', value: 1000 },
        { type: 'liability', value: 250 }
    ],
    cashFlowEntries: [
        { date: '2026-10-02', type: 'income', amount: 500, category: 'Salary' },
        { date: '2026-10-03', type: 'expense', amount: 120, category: 'Food' },
        { date: '2026-10-04', type: 'expense', amount: 80, category: 'food' },
        { date: '2026-09-30', type: 'income', amount: 900, category: 'Salary' }
    ],
    budgets: [
        { month: '2026-10', category: 'Food', amount: 150 },
        { month: '2026-10', category: 'Transport', amount: 100 }
    ],
    goals: [
        { targetAmount: 1000, currentAmount: 400 },
        { targetAmount: 500, currentAmount: 500 }
    ]
};

describe('financial health aggregation', () => {
    it('combines balance sheet, recorded monthly cash flow, budget overruns, and goal progress', () => {
        expect(calculateFinancialHealth(base)).toMatchObject({
            assets: 1000, liabilities: 250, netWorth: 750,
            income: 500, expenses: 200, netCashFlow: 300, savingsRate: 60,
            transactionCount: 3, budgetTotal: 250, actualInBudgetedCategories: 200,
            budgetedCategoryCount: 2, overBudgetCategoryCount: 1, totalPositiveOverrun: 50,
            goalCount: 2, completedGoals: 1, goalTargetTotal: 1500, goalCurrentTotal: 900,
            goalProgressPercent: 60
        });
    });

    it('marks savings rate unavailable when recorded income is zero', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: [{ date: '2026-10-03', type: 'expense', amount: 10, category: 'Food' }]
        });
        expect(result.income).toBe(0);
        expect(result.savingsRate).toBeNull();
    });

    it('does not treat expenses outside budgeted categories as budget overruns', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: [...base.cashFlowEntries, { date: '2026-10-05', type: 'expense', amount: 999, category: 'Unbudgeted' }]
        });
        expect(result.expenses).toBe(1199);
        expect(result.actualInBudgetedCategories).toBe(200);
        expect(result.totalPositiveOverrun).toBe(50);
    });

    it('reports budget coverage by recorded expense amount and category count', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: [
                { date: '2026-10-03', type: 'expense', amount: 120, category: 'Food' },
                { date: '2026-10-04', type: 'expense', amount: 80, category: 'food' },
                { date: '2026-10-05', type: 'expense', amount: 50, category: 'Misc' }
            ]
        });
        expect(result).toMatchObject({
            expenses: 250,
            actualInBudgetedCategories: 200,
            coveredExpenseCategoryCount: 1,
            expenseCategoryCount: 2,
            unbudgetedExpenses: 50,
            expenseCoverageRate: 80
        });
    });

    it('marks budget coverage unavailable when no expenses are recorded', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: [{ date: '2026-10-02', type: 'income', amount: 500, category: 'Salary' }]
        });
        expect(result.expenseCoverageRate).toBeNull();
        expect(result.unbudgetedExpenses).toBe(0);
        expect(result.expenseCategoryCount).toBe(0);
        expect(result.coveredExpenseCategoryCount).toBe(0);
    });

    it('rejects invalid month values and non-finite aggregate totals', () => {
        expect(() => calculateFinancialHealth({ ...base, month: '2026-13' })).toThrow(/reporting month/);
        expect(() => calculateFinancialHealth({
            ...base,
            records: [{ type: 'asset', value: Number.MAX_VALUE }, { type: 'asset', value: Number.MAX_VALUE }]
        })).toThrow(/numeric range/);
    });
});
