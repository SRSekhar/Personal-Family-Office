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
    it('includes linked trade settlement and both sides of internal transfers in cash reconciliation', () => {
        const value = fixture();
        value.investmentAccounts.push({ id: 'broker-2', currency: 'INR' });
        value.investmentCashAccounts.push({ id: 'cash-2', investmentAccountId: 'broker-2', name: 'Second cash', currency: 'INR', createdAt: date });
        value.investmentCashMovements.push({ id: 'opening-2', cashAccountId: 'cash-2', type: 'OpeningBalance',
            amount: { amount: 50, currency: 'INR' }, effectiveAt: date, recordedAt: date, openingBalanceSource: 'statement' });
        value.investmentCashTransfers.push({ id: 'transfer-1', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-2',
            amount: { amount: 25, currency: 'INR' }, effectiveAt: '2026-01-04T00:00:00.000Z', recordedAt: '2026-01-04T00:00:00.000Z' });
        value.investmentTransactions.push({ id: 'purchase-1', accountId: 'broker-1', cashAccountId: 'cash-1',
            cashAmount: { amount: -100, currency: 'INR' }, date: '2026-01-05T00:00:00.000Z', recordedAt: '2026-01-05T00:00:00.000Z' });
        value.investmentCashStatements.push(
            { id: 'statement-2', cashAccountId: 'cash-2', closingBalance: { amount: 75, currency: 'INR' },
                periodStart: date, periodEnd: '2026-01-31T00:00:00.000Z', statementAsOf: '2026-01-31T00:00:00.000Z',
                recordedAt: '2026-01-31T00:00:00.000Z', sourceName: 'Second broker statement' },
            { id: 'statement-1', cashAccountId: 'cash-1', closingBalance: { amount: 1275, currency: 'INR' },
                periodStart: date, periodEnd: '2026-01-31T00:00:00.000Z', statementAsOf: '2026-01-31T00:00:00.000Z',
                recordedAt: '2026-01-31T00:00:00.000Z', sourceName: 'First broker statement' }
        );
        const first = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        const second = reconcileInvestmentCashAccount({ cashAccountId: 'cash-2', ...value });
        expect(first.status).toBe('reconciled');
        expect(first.expectedBalance.amount).toBe(1275);
        expect(second.status).toBe('reconciled');
        expect(second.expectedBalance.amount).toBe(75);
    });

    it('reports a statement difference rather than creating an automatic balancing movement', () => {
        const value = fixture();
        value.investmentCashStatements[0].closingBalance.amount = 1399;
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        expect(result.status).toBe('difference');
        expect(result.difference.amount).toBe(1);
        expect(value.investmentCashMovements).toHaveLength(3);
    });

    it('marks reconciliation incomplete when any transaction for the investment account is unlinked', () => {
        const value = fixture();
        value.investmentTransactions.push({ id: 'legacy-purchase', accountId: 'broker-1',
            cashAmount: { amount: -10, currency: 'INR' }, date: '2026-01-05T00:00:00.000Z', recordedAt: '2026-01-05T00:00:00.000Z' });
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        expect(result.status).toBe('incomplete');
        expect(result.unmatchedCount).toBe(1);
    });

    it('rejects corrections without a valid same-account original movement reference', () => {
        const value = fixture();
        value.investmentCashMovements.push({ id: 'correction', cashAccountId: 'cash-1', type: 'Correction',
            amount: { amount: 10, currency: 'INR' }, effectiveAt: '2026-01-04T00:00:00.000Z',
            recordedAt: '2026-01-04T00:00:00.000Z', reason: 'Correction', reversesMovementId: 'missing' });
        expect(() => validateInvestmentCashCollections(value)).toThrow(/unknown original movement/i);
        value.investmentCashMovements.at(-1).reversesMovementId = 'opening';
        expect(() => validateInvestmentCashCollections(value)).not.toThrow();

        value.investmentAccounts.push({ id: 'broker-2', currency: 'INR' });
        value.investmentCashAccounts.push({ id: 'cash-2', investmentAccountId: 'broker-2', name: 'Other cash', currency: 'INR', createdAt: date });
        value.investmentCashMovements.at(-1).cashAccountId = 'cash-2';
        expect(() => validateInvestmentCashCollections(value)).toThrow(/same cash account/i);
    });

    it('rejects multiple opening balances and movements before the opening baseline', () => {
        const duplicate = fixture();
        duplicate.investmentCashMovements.push({ id: 'opening-2', cashAccountId: 'cash-1', type: 'OpeningBalance',
            amount: { amount: 1, currency: 'INR' }, effectiveAt: '2026-01-02T00:00:00.000Z',
            recordedAt: '2026-01-02T00:00:00.000Z', openingBalanceSource: 'manual' });
        expect(() => validateInvestmentCashCollections(duplicate)).toThrow(/only one explicit opening/i);

        const before = fixture();
        before.investmentCashMovements[1].effectiveAt = '2025-12-31T00:00:00.000Z';
        expect(() => validateInvestmentCashCollections(before)).toThrow(/cannot predate/i);
    });

    it('does not reconcile against a statement recorded after the requested point-in-time', () => {
        const value = fixture();
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-01-15T00:00:00.000Z' });
        expect(result.status).toBe('incomplete');
        expect(result.statementBalance).toBeNull();
    });

    it('rejects linked trades and transfers dated before the cash opening baseline', () => {
        const value = fixture();
        value.investmentTransactions.push({ id: 'historic-trade', accountId: 'broker-1', cashAccountId: 'cash-1',
            cashAmount: { amount: -20, currency: 'INR' }, date: '2025-12-31T00:00:00.000Z', recordedAt: date });
        expect(() => validateInvestmentCashCollections(value)).toThrow(/cannot predate the explicit cash opening/i);
    });

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
        expect(flows.map((flow) => flow.amount)).toEqual([-1000, -500, 100]);
        expect(flows.every((flow) => flow.currency === 'INR')).toBe(true);
    });
    it('rejects cross-currency transfers and accepts only same-currency account pairs', () => {
        const value = fixture();
        value.investmentAccounts.push({ id: 'broker-usd', currency: 'USD' });
        value.investmentCashAccounts.push({ id: 'cash-usd', investmentAccountId: 'broker-usd', name: 'USD cash', currency: 'USD', createdAt: date });
        value.investmentCashTransfers.push({ id: 'fx-transfer', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-usd',
            amount: { amount: 10, currency: 'INR' }, effectiveAt: date, recordedAt: date });
        expect(() => validateInvestmentCashCollections(value)).toThrow(/cross-currency/i);
    });
    it('excludes backfilled entries recorded after the requested point-in-time cutoff', () => {
        const value = fixture();
        value.investmentCashMovements.push({ id: 'late', cashAccountId: 'cash-1', type: 'ExternalContribution',
            amount: { amount: 999, currency: 'INR' }, effectiveAt: '2026-01-04T00:00:00.000Z', recordedAt: '2026-02-02T00:00:00.000Z' });
        const flows = buildInvestmentExternalCashFlows({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(flows).toHaveLength(2);
    });
});
