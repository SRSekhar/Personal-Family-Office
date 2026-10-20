import { calculateXirr, type XirrCashFlow } from '@pfo/calculators';
import { Currency, Money } from '@pfo/models';

export interface InvestmentCashFlow {
    /** Investor-perspective amount: negative for contributions and positive for receipts or terminal valuation. */
    readonly amount: Money;
    /** Exact cash-flow date; use explicit UTC timestamps when creating dates from strings. */
    readonly date: Date;
}

export interface InvestmentPerformanceInput {
    readonly currency: Currency;
    /** Include the current/terminal valuation as a positive cash flow on its valuation date when applicable. */
    readonly cashFlows: readonly InvestmentCashFlow[];
}

export interface InvestmentPerformanceAnalysis {
    readonly currency: Currency;
    readonly cashFlowCount: number;
    readonly startDate: string;
    readonly endDate: string;
    readonly grossContributions: Money;
    readonly grossProceeds: Money;
    readonly netGain: Money;
    /** Simple net gain divided by gross contributions; not annualized and not a substitute for XIRR. */
    readonly netReturnOnContributionsPercentage: number;
    /** Annualized money-weighted return as a decimal fraction (0.1 means 10%). */
    readonly annualizedMoneyWeightedReturn: number;
}

/**
 * Analyzes explicit investor-perspective investment cash flows using XIRR.
 * It performs no valuation lookup, FX conversion, tax/fee adjustment, or
 * investment recommendation. The caller is responsible for including a
 * terminal valuation cash flow when they want an as-of-date performance result.
 */
export function analyzeInvestmentPerformance({
    currency,
    cashFlows
}: InvestmentPerformanceInput): InvestmentPerformanceAnalysis {
    if (!Object.values(Currency).includes(currency)) {
        throw new RangeError('Investment performance requires a supported currency.');
    }
    if (!Array.isArray(cashFlows)) {
        throw new TypeError('Investment cash flows must be an array.');
    }

    let contributions = 0;
    let proceeds = 0;
    let firstTimestamp = Number.POSITIVE_INFINITY;
    let lastTimestamp = Number.NEGATIVE_INFINITY;
    const xirrCashFlows: XirrCashFlow[] = [];

    for (const raw of cashFlows as readonly unknown[]) {
        if (typeof raw !== 'object' || raw === null) {
            throw new TypeError('Every investment cash flow must be an object.');
        }
        const flow = raw as Partial<InvestmentCashFlow>;
        if (!(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every investment cash flow must have a valid date.');
        }
        if (!(flow.amount instanceof Money) || !Number.isFinite(flow.amount.amount)
            || flow.amount.amount === 0) {
            throw new RangeError('Investment cash-flow amounts must be non-zero finite Money values.');
        }
        if (flow.amount.currency !== currency) {
            throw new RangeError('All investment cash flows must use the requested currency.');
        }

        const amount = flow.amount.amount;
        if (amount < 0) {
            contributions += Math.abs(amount);
            if (!Number.isFinite(contributions)) {
                throw new RangeError('Gross contributions exceed the supported numeric range.');
            }
        } else {
            proceeds += amount;
            if (!Number.isFinite(proceeds)) {
                throw new RangeError('Gross proceeds exceed the supported numeric range.');
            }
        }
        firstTimestamp = Math.min(firstTimestamp, flow.date.getTime());
        lastTimestamp = Math.max(lastTimestamp, flow.date.getTime());
        xirrCashFlows.push({ amount, date: flow.date });
    }

    const netGain = proceeds - contributions;
    const netReturnOnContributionsPercentage = contributions === 0
        ? null
        : ((proceeds - contributions) / contributions) * 100;
    if (!Number.isFinite(netGain) || netReturnOnContributionsPercentage === null
        || !Number.isFinite(netReturnOnContributionsPercentage)) {
        throw new RangeError('Investment performance totals exceed the supported numeric range.');
    }

    const annualizedMoneyWeightedReturn = calculateXirr(xirrCashFlows);
    return {
        currency,
        cashFlowCount: cashFlows.length,
        startDate: new Date(firstTimestamp).toISOString(),
        endDate: new Date(lastTimestamp).toISOString(),
        grossContributions: new Money(contributions, currency),
        grossProceeds: new Money(proceeds, currency),
        netGain: new Money(netGain, currency),
        netReturnOnContributionsPercentage,
        annualizedMoneyWeightedReturn
    };
}
