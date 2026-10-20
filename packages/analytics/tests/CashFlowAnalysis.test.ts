import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { analyzeCashFlow, type CashFlowTransaction } from '../src/CashFlowAnalysis.js';

function transaction(
    id: string,
    date: string,
    type: 'income' | 'expense',
    category: string,
    amount: number,
    currency = Currency.INR
): CashFlowTransaction {
    return { id, date, type, category, amount: new Money(amount, currency) };
}

describe('analyzeCashFlow', () => {
    it('calculates totals, savings rate, monthly trend, and category breakdown deterministically', () => {
        const result = analyzeCashFlow({
            currency: Currency.INR,
            transactions: [
                transaction('expense-feb', '2026-02-02', 'expense', 'Housing', 20),
                transaction('income-jan', '2026-01-01', 'income', 'Salary', 100),
                transaction('income-feb', '2026-02-01', 'income', 'Salary', 120),
                transaction('expense-jan', '2026-01-15', 'expense', 'Housing', 25),
                transaction('expense-food', '2026-02-03', 'expense', 'Food', 10)
            ]
        });

        expect(result.transactionCount).toBe(5);
        expect(result.totalIncome.amount).toBe(220);
        expect(result.totalExpenses.amount).toBe(55);
        expect(result.netCashFlow.amount).toBe(165);
        expect(result.savingsRate).toBe(75);
        expect(result.monthlyTrend.map((item) => item.period)).toEqual(['2026-01', '2026-02']);
        expect(result.monthlyTrend.map((item) => item.net.amount)).toEqual([75, 90]);
        expect(result.monthlyTrend.map((item) => item.transactionCount)).toEqual([2, 3]);
        expect(result.categoryBreakdown.map((item) => item.category)).toEqual(['Salary', 'Housing', 'Food']);
        expect(result.categoryBreakdown.map((item) => item.net.amount)).toEqual([220, -40, -10]);
    });

    it('returns zero totals and no trend for an empty ledger', () => {
        const result = analyzeCashFlow({ currency: Currency.INR, transactions: [] });
        expect(result.totalIncome.amount).toBe(0);
        expect(result.totalExpenses.amount).toBe(0);
        expect(result.netCashFlow.amount).toBe(0);
        expect(result.savingsRate).toBeNull();
        expect(result.monthlyTrend).toEqual([]);
        expect(result.categoryBreakdown).toEqual([]);
    });

    it('returns null savings rate for a month with zero income', () => {
        const result = analyzeCashFlow({
            currency: Currency.INR,
            transactions: [transaction('rent', '2026-01-01', 'expense', 'Housing', 100)]
        });
        expect(result.savingsRate).toBeNull();
        expect(result.monthlyTrend[0]?.savingsRate).toBeNull();
    });

    it('allows a negative savings rate when expenses exceed income', () => {
        const result = analyzeCashFlow({
            currency: Currency.INR,
            transactions: [
                transaction('salary', '2026-01-01', 'income', 'Salary', 100),
                transaction('rent', '2026-01-02', 'expense', 'Housing', 125)
            ]
        });
        expect(result.savingsRate).toBe(-25);
    });

    it('rejects mixed currencies', () => {
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [transaction('usd', '2026-01-01', 'income', 'Salary', 100, Currency.USD)]
        })).toThrow('requested currency');
    });

    it('rejects duplicate IDs, invalid dates, invalid types, and non-positive amounts', () => {
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [
                transaction('same', '2026-01-01', 'income', 'Salary', 10),
                transaction('same', '2026-01-02', 'expense', 'Housing', 5)
            ]
        })).toThrow('non-empty and unique');
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [transaction('bad-date', '2026-02-29', 'income', 'Salary', 10)]
        })).toThrow('valid YYYY-MM-DD');
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [{ ...transaction('bad-type', '2026-01-01', 'income', 'Salary', 10), type: 'transfer' }]
        })).toThrow('type must be income or expense');
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [transaction('zero', '2026-01-01', 'income', 'Salary', 0)]
        })).toThrow('positive finite Money');
    });

    it('rejects invalid currency, malformed arrays, and numeric overflow', () => {
        expect(() => analyzeCashFlow({ currency: 'XYZ' as Currency, transactions: [] }))
            .toThrow('supported currency');
        expect(() => analyzeCashFlow({ currency: Currency.INR, transactions: null as unknown as CashFlowTransaction[] }))
            .toThrow('must be an array');
        expect(() => analyzeCashFlow({
            currency: Currency.INR,
            transactions: [
                transaction('large-1', '2026-01-01', 'income', 'Salary', Number.MAX_VALUE),
                transaction('large-2', '2026-01-02', 'income', 'Salary', Number.MAX_VALUE)
            ]
        })).toThrow('supported numeric range');
    });
});
