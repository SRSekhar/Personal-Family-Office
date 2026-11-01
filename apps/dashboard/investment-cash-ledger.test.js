import { describe, expect, it } from 'vitest';
import { buildInvestmentExternalCashFlows, reconcileInvestmentCashAccount, validateInvestmentCashCollections } from './investment-cash-ledger.js';

const date = '2026-01-01T00:00:00.000Z';
const fixture = () => ({
    investmentAccounts: [{ id: 'broker-1', currency: 'INR' }],
    investmentCashAccounts: [{ id: 'cash-1', investmentAccountId: 'broker-1', name: 'Broker cash', currency: 'INR', createdAt: date }],
    investmentCashMovements: [
        { id: 'opening', cashAccountId: 'cash-1', type: 'OpeningBalance', amount: { amount: 1000, currency: 'INR' }, effectiveAt: date, recordedAt: date, openingBalanceSource: 'statement' },
        { id: 'contribution', cashAccountId: 'cash-1', type: 'ExternalContribution', amount: { amount: 500, currency: 'INR' }, effectiveAt: '2026-01-02T00:00:00.000Z', recordedAt: '2026-01-02T00:00:00.000Z' },
        { id: 'withdrawal', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' }, effectiveAt: '2026-01-03T00:00:00.000Z', recordedAt: '2026-01-03T00:00:00.000Z' }
    ],
    investmentCashTransfers: [],
    investmentCashStatements: [{ id: 'statement-1', cashAccountId: 'cash-1', closingBalance: { amount: 1400, currency: 'INR' }, periodStart: date, periodEnd: '2026-01-31T00:00:00.000Z', statementAsOf: '2026-01-31T00:00:00.000Z', recordedAt: '2026-01-31T00:00:00.000Z', sourceName: 'Bank statement' }],
    investmentTransactions: []
});

describe('investment cash ledger', () => {
    it('validates explicit cash accounts, opening balances, movements and statements', () => {
        const value = fixture();
        expect(validateInvestmentCashCollections(value).investmentCashAccounts).toHaveLength(1);
    });
    it('rejects inferred cross-currency cash accounts, invalid contribution signs and invalid transfers', () => {
        const wrongCurrency = fixture();
        wrongCurrency.investmentCashAccounts[0].currency = 'USD';
        expect(() => validateInvestmentCashCollections(wrongCurrency)).toThrow(/must match its owning/i);
        const wrongSign = fixture();
        wrongSign.investmentCashMovements[1].amount.amount = -500;
        expect(() => validateInvestmentCashCollections(wrongSign)).toThrow(/contribution must increase/i);
        const crossCurrency = fixture();
        crossCurrency.investmentCashAccounts.push({ id: 'cash-usd', investmentAccountId: 'broker-1', name: 'USD', currency: 'USD', createdAt: date });
        expect(() => validateInvestmentCashCollections(crossCurrency)).toThrow(/must match its owning/i);
    });
    it('reconciles only from explicit opening balance and statement evidence', () => {
        const value = fixture();
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        expect(result.status).toBe('reconciled');
        expect(result.expectedBalance.amount).toBe(1400);
        expect(result.difference.amount).toBe(0);
    });
    it('marks missing opening balance as incomplete instead of assuming zero', () => {
        const value = fixture();
        value.investmentCashMovements.shift();
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        expect(result.status).toBe('incomplete');
        expect(result.expectedBalance).toBeNull();
    });
    it('uses investor-perspective signs and excludes internal transfer records', () => {
        const value = fixture();
        const flows = buildInvestmentExternalCashFlows({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(flows.map((flow) => flow.amount)).toEqual([-500, 100]);
        expect(flows.every((flow) => flow.currency === 'INR')).toBe(true);
    });
    it('excludes backfilled entries recorded after the requested point-in-time cutoff', () => {
        const value = fixture();
        value.investmentCashMovements.push({ id: 'late', cashAccountId: 'cash-1', type: 'ExternalContribution',
            amount: { amount: 999, currency: 'INR' }, effectiveAt: '2026-01-04T00:00:00.000Z', recordedAt: '2026-02-02T00:00:00.000Z' });
        const flows = buildInvestmentExternalCashFlows({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(flows).toHaveLength(2);
    });
});
