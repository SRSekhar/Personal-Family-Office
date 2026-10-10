import { describe, expect, it } from 'vitest';

import { calculateXirr, type XirrCashFlow } from '../src/index.js';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

describe('calculateXirr', () => {
    it('calculates an annualized return for a one-year investment', () => {
        expect(calculateXirr([
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -1000 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 1210 }
        ])).toBeCloseTo(0.21, 9);
    });

    it('supports a negative return close to -100%', () => {
        expect(calculateXirr([
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -1000 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 100 }
        ])).toBeCloseTo(-0.9, 9);
    });

    it('handles multiple contributions before a terminal inflow', () => {
        const cashFlows: XirrCashFlow[] = [
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -500 },
            { date: new Date('2021-07-02T00:00:00.000Z'), amount: -500 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 1100 }
        ];

        const rate = calculateXirr(cashFlows);
        expect(Math.abs(calculateNetPresentValue(cashFlows, rate))).toBeLessThan(1e-7);
    });

    it('nets cash flows that occur on the same date', () => {
        expect(calculateXirr([
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 },
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: 25 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 100 }
        ])).toBeCloseTo(1 / 3, 9);
    });

    it('expands the bracket to solve a high positive return', () => {
        expect(calculateXirr([
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 1100 }
        ])).toBeCloseTo(10, 8);
    });

    it('rejects cash flows with multiple sign changes to avoid ambiguous IRRs', () => {
        expect(() => calculateXirr([
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 },
            { date: new Date('2021-07-02T00:00:00.000Z'), amount: 200 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: -110 }
        ])).toThrow(/exactly one sign change/);
    });

    it.each([
        ['fewer than two cash flows', [{ date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 }]],
        ['no positive cash flow', [
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: -110 }
        ]],
        ['no negative cash flow', [
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: 100 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 110 }
        ]],
        ['invalid date', [
            { date: new Date('not-a-date'), amount: -100 },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 110 }
        ]],
        ['non-finite amount', [
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: Number.NaN },
            { date: new Date('2022-01-01T00:00:00.000Z'), amount: 110 }
        ]],
        ['all cash flows on one date', [
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: -100 },
            { date: new Date('2021-01-01T00:00:00.000Z'), amount: 110 }
        ]]
    ])('rejects invalid input: %s', (_description, cashFlows) => {
        expect(() => calculateXirr(cashFlows)).toThrow(RangeError);
    });
});

function calculateNetPresentValue(cashFlows: readonly XirrCashFlow[], rate: number): number {
    const baseTimestamp = Math.min(...cashFlows.map((flow) => flow.date.getTime()));

    return cashFlows.reduce((value, flow) => {
        const years = (flow.date.getTime() - baseTimestamp) / DAY_IN_MILLISECONDS / DAYS_PER_YEAR;
        return value + (flow.amount / Math.pow(1 + rate, years));
    }, 0);
}
