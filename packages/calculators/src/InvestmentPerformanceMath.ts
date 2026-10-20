import { calculateXirr, type XirrCashFlow } from './Xirr.js';

export interface InvestmentPerformanceMathInput {
    /** Negative for contributions; positive for receipts or an explicitly supplied terminal valuation. */
    readonly cashFlows: readonly XirrCashFlow[];
}

export interface InvestmentPerformanceMathResult {
    readonly cashFlowCount: number;
    readonly startDate: string;
    readonly endDate: string;
    readonly grossContributions: number;
    readonly grossProceeds: number;
    readonly netGain: number;
    readonly netReturnOnContributionsPercentage: number;
    /** Annualized money-weighted return as a decimal fraction (0.1 means 10%). */
    readonly annualizedMoneyWeightedReturn: number;
}

/** Pure numeric investment-performance analysis shared by domain and browser adapters. */
export function analyzeInvestmentPerformanceMath({ cashFlows }: InvestmentPerformanceMathInput): InvestmentPerformanceMathResult {
    if (!Array.isArray(cashFlows)) {
        throw new TypeError('Investment cash flows must be an array.');
    }
    let contributions = 0;
    let proceeds = 0;
    let firstTimestamp = Number.POSITIVE_INFINITY;
    let lastTimestamp = Number.NEGATIVE_INFINITY;
    for (const raw of cashFlows as readonly unknown[]) {
        if (typeof raw !== 'object' || raw === null) {
            throw new TypeError('Every investment cash flow must be an object.');
        }
        const flow = raw as Partial<XirrCashFlow>;
        if (!(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every investment cash flow must have a valid date.');
        }
        if (!Number.isFinite(flow.amount) || flow.amount === 0) {
            throw new RangeError('Investment cash-flow amounts must be non-zero finite values.');
        }
        if (flow.amount < 0) {
            contributions += Math.abs(flow.amount);
            if (!Number.isFinite(contributions)) {
                throw new RangeError('Gross contributions exceed the supported numeric range.');
            }
        } else {
            proceeds += flow.amount;
            if (!Number.isFinite(proceeds)) {
                throw new RangeError('Gross proceeds exceed the supported numeric range.');
            }
        }
        firstTimestamp = Math.min(firstTimestamp, flow.date.getTime());
        lastTimestamp = Math.max(lastTimestamp, flow.date.getTime());
    }
    const annualizedMoneyWeightedReturn = calculateXirr(cashFlows);
    const netGain = proceeds - contributions;
    const netReturnOnContributionsPercentage = ((proceeds - contributions) / contributions) * 100;
    if (!Number.isFinite(netGain) || !Number.isFinite(netReturnOnContributionsPercentage)) {
        throw new RangeError('Investment performance totals exceed the supported numeric range.');
    }
    return {
        cashFlowCount: cashFlows.length,
        startDate: new Date(firstTimestamp).toISOString(),
        endDate: new Date(lastTimestamp).toISOString(),
        grossContributions: contributions,
        grossProceeds: proceeds,
        netGain,
        netReturnOnContributionsPercentage,
        annualizedMoneyWeightedReturn
    };
}