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

    it('compares the selected month with the previous calendar month without inventing missing activity', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: [
                { date: '2026-10-02', type: 'income', amount: 500, category: 'Salary' },
                { date: '2026-10-03', type: 'expense', amount: 120, category: 'Food' },
                { date: '2026-09-30', type: 'income', amount: 900, category: 'Salary' },
                { date: '2026-09-15', type: 'expense', amount: 300, category: 'Rent' }
            ]
        });
        expect(result).toMatchObject({
            priorMonth: '2026-09',
            priorMonthTransactionCount: 2,
            priorIncome: 900,
            priorExpenses: 300,
            priorNetCashFlow: 600,
            priorSavingsRate: 66.66666666666666
        });
        expect(result.income - result.priorIncome).toBe(-400);
        expect(result.expenses - result.priorExpenses).toBe(-180);
        expect(result.netCashFlow - result.priorNetCashFlow).toBe(-300);
    });

    it('handles January reporting by comparing with December of the previous year', () => {
        const result = calculateFinancialHealth({
            ...base,
            month: '2026-01',
            cashFlowEntries: [{ date: '2025-12-31', type: 'income', amount: 1000, category: 'Salary' }]
        });
        expect(result.priorMonth).toBe('2025-12');
        expect(result.priorMonthTransactionCount).toBe(1);
        expect(result.priorIncome).toBe(1000);
        expect(result.priorNetCashFlow).toBe(1000);
    });

    it('exposes an empty prior month as zero transactions so the UI can mark comparison unavailable', () => {
        const result = calculateFinancialHealth({
            ...base,
            cashFlowEntries: base.cashFlowEntries.filter((entry) => entry.date.startsWith('2026-10'))
        });
        expect(result.priorMonth).toBe('2026-09');
        expect(result.priorMonthTransactionCount).toBe(0);
        expect(result.priorIncome).toBe(0);
        expect(result.priorExpenses).toBe(0);
        expect(result.priorSavingsRate).toBeNull();
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
