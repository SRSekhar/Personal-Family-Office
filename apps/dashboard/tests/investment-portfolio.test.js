import { describe, expect, it } from 'vitest';
import { analyzeInvestmentPerformanceMath } from '../../../packages/calculators/src/InvestmentPerformanceMath.ts';
import { analyzeInvestmentPortfolio, analyzeInvestmentPortfolioPerformance } from '../investment-portfolio.js';
const asOfDate = new Date('2026-03-31T23:59:59.999Z');
function fixture() {
    return { accounts: [{ id: 'a1', name: 'Brokerage', currency: 'INR' }], instruments: [{ id: 'i1', name: 'Example equity', currency: 'INR' }],
        transactions: [
            { id: 't1', accountId: 'a1', instrumentId: 'i1', type: 'Purchase', cashAmount: { amount: -1000, currency: 'INR' }, quantity: 10, unitPrice: { amount: 100, currency: 'INR' }, date: '2026-01-01T00:00:00.000Z', recordedAt: '2026-01-01T00:00:00.000Z' },
            { id: 't2', accountId: 'a1', instrumentId: 'i1', type: 'Purchase', cashAmount: { amount: -1200, currency: 'INR' }, quantity: 10, unitPrice: { amount: 120, currency: 'INR' }, date: '2026-02-01T00:00:00.000Z', recordedAt: '2026-02-01T00:00:00.000Z' },
            { id: 't3', accountId: 'a1', instrumentId: 'i1', type: 'Sale', cashAmount: { amount: 1800, currency: 'INR' }, quantity: 12, unitPrice: { amount: 150, currency: 'INR' }, date: '2026-03-01T00:00:00.000Z', recordedAt: '2026-03-01T00:00:00.000Z' },
            { id: 't4', accountId: 'a1', instrumentId: 'i1', type: 'Dividend', cashAmount: { amount: 25, currency: 'INR' }, date: '2026-03-05T00:00:00.000Z', recordedAt: '2026-03-05T00:00:00.000Z' },
            { id: 't5', accountId: 'a1', instrumentId: 'i1', type: 'Interest', cashAmount: { amount: 3, currency: 'INR' }, date: '2026-03-06T00:00:00.000Z', recordedAt: '2026-03-06T00:00:00.000Z' },
            { id: 't6', accountId: 'a1', instrumentId: 'i1', type: 'Fee', cashAmount: { amount: -10, currency: 'INR' }, date: '2026-03-07T00:00:00.000Z', recordedAt: '2026-03-07T00:00:00.000Z' },
            { id: 't7', accountId: 'a1', instrumentId: 'i1', type: 'Tax', cashAmount: { amount: -5, currency: 'INR' }, date: '2026-03-08T00:00:00.000Z', recordedAt: '2026-03-08T00:00:00.000Z' }
        ],
        valuations: [{ instrumentId: 'i1', price: { amount: 160, currency: 'INR' }, asOf: '2026-03-31T00:00:00.000Z', recordedAt: '2026-03-31T00:00:00.000Z', sourceType: 'manual', sourceName: 'User-entered' }] };
}
describe('investment portfolio FIFO projection', () => {
    it('reconciles FIFO cost basis, realised/unrealised gains, income, fees and taxes', () => {
        expect(analyzeInvestmentPortfolio({ ...fixture(), asOfDate })[0]).toMatchObject({ quantity: 8, openLotCount: 1, costBasis: 960,
            realizedGain: 560, marketValue: 1280, unrealizedGain: 320, dividendIncome: 25, interestIncome: 3, fees: 10, taxes: 5, netGain: 893 });
    });
    it('does not invent market value or unrealised gain when no valuation exists', () => {
        const input = fixture(); input.valuations = [];
        expect(analyzeInvestmentPortfolio({ ...input, asOfDate })[0]).toMatchObject({ marketValue: null, unrealizedGain: null, netGain: null });
    });
    it('excludes later-recorded transactions and valuations from historical results', () => {
        const input = fixture();
        input.transactions.push({ id: 'later', accountId: 'a1', instrumentId: 'i1', type: 'Purchase', cashAmount: { amount: -500, currency: 'INR' },
            quantity: 5, unitPrice: { amount: 100, currency: 'INR' }, date: '2026-02-15T00:00:00.000Z', recordedAt: '2026-04-01T00:00:00.000Z' });
        input.valuations.push({ instrumentId: 'i1', price: { amount: 999, currency: 'INR' }, asOf: '2026-03-30T00:00:00.000Z',
            recordedAt: '2026-04-01T00:00:00.000Z', sourceType: 'manual', sourceName: 'Backfilled' });
        expect(analyzeInvestmentPortfolio({ ...input, asOfDate })[0]).toMatchObject({ quantity: 8, marketValue: 1280 });
    });
    it('rejects sales that exceed available FIFO lots', () => {
        const input = fixture();
        input.transactions.push({ id: 'oversell', accountId: 'a1', instrumentId: 'i1', type: 'Sale', cashAmount: { amount: 1500, currency: 'INR' },
            quantity: 10, unitPrice: { amount: 150, currency: 'INR' }, date: '2026-03-20T00:00:00.000Z', recordedAt: '2026-03-20T00:00:00.000Z' });
        expect(() => analyzeInvestmentPortfolio({ ...input, asOfDate })).toThrow(/exceeds the available FIFO position/i);
    });
    it('rejects currency mismatches rather than converting silently', () => {
        const input = fixture(); input.accounts[0].currency = 'USD';
        expect(() => analyzeInvestmentPortfolio({ ...input, asOfDate })).toThrow(/currencies must match/i);
    });
    it('excludes backfilled external cash events recorded after a historical as-of date', () => {
        const input = performanceFixture();
        input.investmentCashMovements.push({ id: 'late-backfill', cashAccountId: 'cash-1', type: 'ExternalContribution',
            amount: { amount: 5000, currency: 'INR' }, effectiveAt: '2026-03-15T00:00:00.000Z',
            recordedAt: '2026-04-01T00:00:00.000Z' });
        const result = analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt: new Date('2026-04-30T23:59:59.999Z'), performanceCalculator: analyzeInvestmentPerformanceMath })[0];
        expect(result.status).toBe('available');
        expect(result.cashBalance).toBe(10513);
        expect(result.cashFlowCount).toBe(4);
    });

});

function performanceFixture() {
    const input = fixture();
    input.transactions = input.transactions.map((item) => ({ ...item, cashAccountId: 'cash-1' }));
    input.investmentCashAccounts = [{ id: 'cash-1', investmentAccountId: 'a1', name: 'Broker cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' }];
    input.investmentCashMovements = [
        { id: 'opening', cashAccountId: 'cash-1', type: 'OpeningBalance', amount: { amount: 10000, currency: 'INR' },
            effectiveAt: '2026-01-01T00:00:00.000Z', recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'statement' },
        { id: 'contribution', cashAccountId: 'cash-1', type: 'ExternalContribution', amount: { amount: 1000, currency: 'INR' },
            effectiveAt: '2026-01-02T00:00:00.000Z', recordedAt: '2026-01-02T00:00:00.000Z' },
        { id: 'withdrawal', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' },
            effectiveAt: '2026-01-03T00:00:00.000Z', recordedAt: '2026-01-03T00:00:00.000Z' }
    ];
    input.investmentCashTransfers = [];
    input.investmentCashStatements = [{ id: 'statement', cashAccountId: 'cash-1', closingBalance: { amount: 10513, currency: 'INR' },
        periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-03-31T00:00:00.000Z',
        statementAsOf: '2026-03-31T00:00:00.000Z', recordedAt: '2026-03-31T12:00:00.000Z', sourceName: 'Broker statement' }];
    return input;
}
const recordedAt = new Date('2026-03-31T23:59:59.999Z');

describe('investment portfolio money-weighted performance', () => {
    it('calculates XIRR from external flows and complete terminal holdings plus reconciled cash', () => {
        const input = performanceFixture();
        const result = analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt, performanceCalculator: analyzeInvestmentPerformanceMath });
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ currency: 'INR', status: 'available', terminalValue: 11793,
            cashBalance: 10513, holdingsValue: 1280, cashFlowCount: 4 });
        expect(Number.isFinite(result[0].xirr)).toBe(true);
    });

    it('does not calculate a partial XIRR when an open position has no eligible valuation', () => {
        const input = performanceFixture();
        input.valuations = [];
        expect(analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt, performanceCalculator: analyzeInvestmentPerformanceMath })[0]).toMatchObject({
            status: 'unavailable', xirr: null, reason: expect.stringMatching(/no eligible valuation/i)
        });
    });

    it('does not calculate a partial XIRR when cash reconciliation is incomplete', () => {
        const input = performanceFixture();
        input.investmentCashStatements = [];
        expect(analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt, performanceCalculator: analyzeInvestmentPerformanceMath })[0]).toMatchObject({
            status: 'unavailable', xirr: null, reason: expect.stringMatching(/no statement/i)
        });
    });

    it('requires every visible investment transaction to link to an explicit cash account', () => {
        const input = performanceFixture();
        delete input.transactions[0].cashAccountId;
        expect(analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt, performanceCalculator: analyzeInvestmentPerformanceMath })[0]).toMatchObject({
            status: 'unavailable', xirr: null, reason: expect.stringMatching(/not linked/i)
        });
    });

    it('adds cash movements and trade settlements after the latest statement to terminal cash', () => {
        const input = performanceFixture();
        input.investmentCashStatements[0].statementAsOf = '2026-03-01T00:00:00.000Z';
        input.investmentCashStatements[0].periodEnd = '2026-03-01T00:00:00.000Z';
        input.investmentCashStatements[0].closingBalance.amount = 10000;
        input.investmentCashMovements.push({ id: 'late-contribution', cashAccountId: 'cash-1', type: 'ExternalContribution',
            amount: { amount: 200, currency: 'INR' }, effectiveAt: '2026-03-20T00:00:00.000Z', recordedAt: '2026-03-20T00:00:00.000Z' });
        const result = analyzeInvestmentPortfolioPerformance({ ...input, asOfDate, recordedAt, performanceCalculator: analyzeInvestmentPerformanceMath })[0];
        expect(result.status).toBe('available');
        expect(result.cashBalance).toBe(10213);
        expect(result.terminalValue).toBe(11493);
    });
});
