import { describe, expect, it } from 'vitest';
import { investmentCashFlowsToCsv, investmentPerformanceToCsv } from '../investment-performance-export.js';

const cashFlows = [
    { date: new Date('2025-01-01T00:00:00.000Z'), amount: -1000 },
    { date: new Date('2026-01-01T00:00:00.000Z'), amount: 1100 }
];
const result = {
    cashFlowCount: 2,
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2026-01-01T00:00:00.000Z',
    grossContributions: 1000,
    grossProceeds: 1100,
    netGain: 100,
    netReturnOnContributionsPercentage: 10,
    annualizedMoneyWeightedReturn: 0.1
};

describe('investmentCashFlowsToCsv', () => {
    it('exports signed dated cash flows in the importer's exact schema', () => {
        expect(investmentCashFlowsToCsv(cashFlows)).toBe(
            '"date","amount"\r\n'
            + '"2025-01-01","-1000"\r\n'
            + '"2026-01-01","1100"\r\n'
        );
    });

    it.each([
        ['too few cash flows', [cashFlows[0]]],
        ['invalid date', [{ date: new Date('invalid'), amount: -1 }, cashFlows[1]]],
        ['zero amount', [{ ...cashFlows[0], amount: 0 }, cashFlows[1]]],
        ['infinite amount', [{ ...cashFlows[0], amount: Number.POSITIVE_INFINITY }, cashFlows[1]]]
    ])('rejects invalid cash-flow export data: %s', (_description, flows) => {
        expect(() => investmentCashFlowsToCsv(flows)).toThrow();
    });
});

describe('investmentPerformanceToCsv', () => {
    it('exports the summary and preserves dated cash-flow signs', () => {
        const csv = investmentPerformanceToCsv({ cashFlows, result });
        expect(csv).toContain('Gross contributions,1000\r\n');
        expect(csv).toContain('Gross proceeds,1100\r\n');
        expect(csv).toContain('Net gain/loss,100\r\n');
        expect(csv).toContain('Simple net return (%),10\r\n');
        expect(csv).toContain('Annualized money-weighted return (XIRR %),10\r\n');
        expect(csv).toContain('Start date,2025-01-01\r\n');
        expect(csv).toContain('2025-01-01,-1000\r\n');
        expect(csv).toContain('2026-01-01,1100\r\n');
        expect(csv.endsWith('\r\n')).toBe(true);
    });

    it.each([
        ['too few cash flows', { cashFlows: [cashFlows[0]], result }],
        ['invalid date', { cashFlows: [{ date: new Date('invalid'), amount: -1 }, cashFlows[1]], result }],
        ['zero amount', { cashFlows: [{ ...cashFlows[0], amount: 0 }, cashFlows[1]], result }],
        ['summary mismatch', { cashFlows, result: { ...result, grossContributions: 999 } }]
    ])('rejects invalid export data: %s', (_description, input) => {
        expect(() => investmentPerformanceToCsv(input)).toThrow();
    });
});
