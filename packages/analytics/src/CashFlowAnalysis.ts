import { Currency, Money } from '@pfo/models';

export type CashFlowTransactionType = 'income' | 'expense';

export interface CashFlowTransaction {
    readonly id: string;
    /** Calendar date of the transaction, in YYYY-MM-DD form. */
    readonly date: string;
    readonly type: CashFlowTransactionType;
    readonly category: string;
    /** Positive transaction amount; the type determines whether it is income or expense. */
    readonly amount: Money;
}

export interface CashFlowAnalysisInput {
    readonly currency: Currency;
    readonly transactions: readonly CashFlowTransaction[];
}

export interface CashFlowPeriodSummary {
    /** Calendar month in YYYY-MM form. */
    readonly period: string;
    readonly income: Money;
    readonly expenses: Money;
    readonly net: Money;
    /** Percentage of income remaining after expenses; null when income is zero. */
    readonly savingsRate: number | null;
    readonly transactionCount: number;
}

export interface CashFlowCategorySummary {
    readonly category: string;
    readonly income: Money;
    readonly expenses: Money;
    readonly net: Money;
    readonly transactionCount: number;
}

export interface CashFlowAnalysis {
    readonly currency: Currency;
    readonly transactionCount: number;
    readonly totalIncome: Money;
    readonly totalExpenses: Money;
    readonly netCashFlow: Money;
    readonly savingsRate: number | null;
    /** Months with at least one transaction, ordered oldest to newest; missing months are not synthesized. */
    readonly monthlyTrend: readonly CashFlowPeriodSummary[];
    readonly categoryBreakdown: readonly CashFlowCategorySummary[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function savingsRate(income: number, expenses: number): number | null {
    if (income === 0) return null;
    const result = ((income - expenses) / income) * 100;
    if (!Number.isFinite(result)) {
        throw new RangeError('Cash-flow savings rate exceeds the supported numeric range.');
    }
    return result;
}

function addAmount(current: number, amount: number, message: string): number {
    const next = current + amount;
    if (!Number.isFinite(next)) throw new RangeError(message);
    return next;
}

/**
 * Analyzes caller-supplied dated cash-flow transactions without persistence,
 * market-data acquisition, inferred recurrence, forecasts, or recommendations.
 * All transaction amounts must already use the explicitly requested currency.
 */
export function analyzeCashFlow({
    currency,
    transactions
}: CashFlowAnalysisInput): CashFlowAnalysis {
    if (!Object.values(Currency).includes(currency)) {
        throw new RangeError('Cash-flow analysis requires a supported currency.');
    }
    if (!Array.isArray(transactions)) {
        throw new TypeError('Cash-flow transactions must be an array.');
    }

    const seenIds = new Set<string>();
    let totalIncome = 0;
    let totalExpenses = 0;
    const monthly = new Map<string, { income: number; expenses: number; count: number }>();
    const categories = new Map<string, { income: number; expenses: number; count: number }>();

    for (const raw of transactions as readonly unknown[]) {
        if (typeof raw !== 'object' || raw === null) {
            throw new TypeError('Every cash-flow transaction must be an object.');
        }
        const transaction = raw as Partial<CashFlowTransaction>;
        if (typeof transaction.id !== 'string' || transaction.id.trim() === '' || seenIds.has(transaction.id)) {
            throw new RangeError('Cash-flow transaction IDs must be non-empty and unique.');
        }
        if (typeof transaction.date !== 'string' || !isValidCalendarDate(transaction.date)) {
            throw new RangeError('Every cash-flow transaction must have a valid YYYY-MM-DD date.');
        }
        if (transaction.type !== 'income' && transaction.type !== 'expense') {
            throw new RangeError('Cash-flow transaction type must be income or expense.');
        }
        if (typeof transaction.category !== 'string' || transaction.category.trim() === '') {
            throw new RangeError('Cash-flow transaction category cannot be empty.');
        }
        if (!(transaction.amount instanceof Money) || !Number.isFinite(transaction.amount.amount)
            || transaction.amount.amount <= 0) {
            throw new RangeError('Cash-flow transaction amounts must be positive finite Money values.');
        }
        if (transaction.amount.currency !== currency) {
            throw new RangeError('All cash-flow transactions must use the requested currency.');
        }

        seenIds.add(transaction.id);
        const amount = transaction.amount.amount;
        const period = transaction.date.slice(0, 7);
        const category = transaction.category.trim();
        const monthSummary = monthly.get(period) ?? { income: 0, expenses: 0, count: 0 };
        const categorySummary = categories.get(category) ?? { income: 0, expenses: 0, count: 0 };

        if (transaction.type === 'income') {
            totalIncome = addAmount(totalIncome, amount, 'Cash-flow income exceeds the supported numeric range.');
            monthSummary.income = addAmount(monthSummary.income, amount, 'Monthly income exceeds the supported numeric range.');
            categorySummary.income = addAmount(categorySummary.income, amount, 'Category income exceeds the supported numeric range.');
        } else {
            totalExpenses = addAmount(totalExpenses, amount, 'Cash-flow expenses exceed the supported numeric range.');
            monthSummary.expenses = addAmount(monthSummary.expenses, amount, 'Monthly expenses exceed the supported numeric range.');
            categorySummary.expenses = addAmount(categorySummary.expenses, amount, 'Category expenses exceed the supported numeric range.');
        }
        monthSummary.count += 1;
        categorySummary.count += 1;
        monthly.set(period, monthSummary);
        categories.set(category, categorySummary);
    }

    const netCashFlow = totalIncome - totalExpenses;
    if (!Number.isFinite(netCashFlow)) {
        throw new RangeError('Net cash flow exceeds the supported numeric range.');
    }

    const monthlyTrend = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, item]) => {
        const net = item.income - item.expenses;
        if (!Number.isFinite(net)) throw new RangeError('Monthly net cash flow exceeds the supported numeric range.');
        return {
            period,
            income: new Money(item.income, currency),
            expenses: new Money(item.expenses, currency),
            net: new Money(net, currency),
            savingsRate: savingsRate(item.income, item.expenses),
            transactionCount: item.count
        };
    });

    const categoryBreakdown = [...categories.entries()].map(([category, item]) => {
        const net = item.income - item.expenses;
        if (!Number.isFinite(net)) throw new RangeError('Category net cash flow exceeds the supported numeric range.');
        return {
            category,
            income: new Money(item.income, currency),
            expenses: new Money(item.expenses, currency),
            net: new Money(net, currency),
            transactionCount: item.count,
            activity: item.income + item.expenses
        };
    }).sort((a, b) => b.activity - a.activity || a.category.localeCompare(b.category))
        .map(({ activity: _activity, ...item }) => item);

    return {
        currency,
        transactionCount: transactions.length,
        totalIncome: new Money(totalIncome, currency),
        totalExpenses: new Money(totalExpenses, currency),
        netCashFlow: new Money(netCashFlow, currency),
        savingsRate: savingsRate(totalIncome, totalExpenses),
        monthlyTrend,
        categoryBreakdown
    };
}
