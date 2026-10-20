import { calculateXirr } from '@pfo/calculators';
import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { analyzeInvestmentPerformance, type InvestmentCashFlow } from '../src/InvestmentPerformanceAnalysis.js';

function flow(amount: number, date: string, currency = Currency.INR): InvestmentCashFlow {
    return { amount: new Money(amount, currency), date: new Date(date) };
}

describe('analyzeInvestmentPerformance', () => {
    it('calculates money-weighted annualized return and gross cash-flow totals', () => {
        const result = analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [
                flow(-1000, '2025-01-01T00:00:00.000Z'),
                flow(1100, '2026-01-01T00:00:00.000Z')
            ]
        });

        expect(result.cashFlowCount).toBe(2);
        expect(result.startDate).toBe('2025-01-01T00:00:00.000Z');
        expect(result.endDate).toBe('2026-01-01T00:00:00.000Z');
        expect(result.grossContributions.amount).toBe(1000);
        expect(result.grossProceeds.amount).toBe(1100);
        expect(result.netGain.amount).toBe(100);
        expect(result.netReturnOnContributionsPercentage).toBe(10);
        expect(result.annualizedMoneyWeightedReturn).toBeCloseTo(calculateXirr([
            { amount: -1000, date: new Date('2025-01-01T00:00:00.000Z') },
            { amount: 1100, date: new Date('2026-01-01T00:00:00.000Z') }
        ]));
    });

    it('handles contributions and proceeds that occur on different dates', () => {
        const result = analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [
                flow(-500, '2025-01-01T00:00:00.000Z'),
                flow(-500, '2025-07-01T00:00:00.000Z'),
                flow(1200, '2026-01-01T00:00:00.000Z')
            ]
        });
        expect(result.grossContributions.amount).toBe(1000);
        expect(result.grossProceeds.amount).toBe(1200);
        expect(result.netGain.amount).toBe(200);
        expect(Number.isFinite(result.annualizedMoneyWeightedReturn)).toBe(true);
    });

    it('rejects mixed currencies, zero amounts, and invalid dates', () => {
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [flow(-100, '2025-01-01T00:00:00.000Z', Currency.USD), flow(110, '2026-01-01T00:00:00.000Z')]
        })).toThrow('requested currency');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [{ amount: new Money(0, Currency.INR), date: new Date('2025-01-01T00:00:00.000Z') }]
        })).toThrow('non-zero finite');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [{ amount: new Money(-100, Currency.INR), date: new Date(Number.NaN) }]
        })).toThrow('valid date');
    });

    it('rejects cash-flow series that cannot produce an unambiguous XIRR', () => {
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: []
        })).toThrow('At least two cash flows are required.');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [flow(100, '2025-01-01T00:00:00.000Z'), flow(110, '2026-01-01T00:00:00.000Z')]
        })).toThrow('positive and negative');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [flow(-100, '2025-01-01T00:00:00.000Z'), flow(-110, '2026-01-01T00:00:00.000Z')]
        })).toThrow('positive and negative');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [
                flow(-100, '2025-01-01T00:00:00.000Z'),
                flow(200, '2025-06-01T00:00:00.000Z'),
                flow(-110, '2026-01-01T00:00:00.000Z')
            ]
        })).toThrow('exactly one sign change');
    });

    it('rejects malformed input and numeric overflow', () => {
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: null as unknown as InvestmentCashFlow[]
        })).toThrow('must be an array');
        expect(() => analyzeInvestmentPerformance({
            currency: Currency.INR,
            cashFlows: [
                flow(-Number.MAX_VALUE, '2025-01-01T00:00:00.000Z'),
                flow(-Number.MAX_VALUE, '2025-01-02T00:00:00.000Z'),
                flow(Number.MAX_VALUE, '2026-01-01T00:00:00.000Z')
            ]
        })).toThrow('Gross contributions exceed');
    });
});
