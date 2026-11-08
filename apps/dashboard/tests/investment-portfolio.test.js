import { describe, expect, it } from 'vitest';
import { analyzeInvestmentPortfolio } from '../investment-portfolio.js';
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
});
