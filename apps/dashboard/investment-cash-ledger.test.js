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
        crossCurrency.investmentAccounts.push({ id: 'broker-usd', currency: 'USD' });
        crossCurrency.investmentCashAccounts.push({ id: 'cash-usd', investmentAccountId: 'broker-usd', name: 'USD', currency: 'USD', createdAt: date });
        crossCurrency.investmentCashTransfers.push({ id: 'fx-transfer', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-usd',
            amount: { amount: 10, currency: 'INR' }, effectiveAt: date, recordedAt: date });
        expect(() => validateInvestmentCashCollections(crossCurrency)).toThrow(/cross-currency/i);
    });

    it('reconciles only from explicit opening balance and statement evidence', () => {
        const value = fixture();
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value });
        expect(result.status).toBe('reconciled');
        expect(result.expectedBalance.amount).toBe(1400);
        expect(result.difference.amount).toBe(0);
    });

    it('accepts an explicit zero opening balance without treating it as an inferred balance', () => {
        const value = fixture();
        value.investmentCashMovements[0].amount.amount = 0;
        value.investmentCashStatements[0].closingBalance.amount = 400;
        const validated = validateInvestmentCashCollections(value);
        expect(validated.investmentCashMovements[0].amount.amount).toBe(0);
        expect(reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...validated, investmentTransactions: [] }).status).toBe('reconciled');
    });

    it('omits a zero opening balance from investor cash flows', () => {
        const value = fixture();
        value.investmentCashMovements[0].amount.amount = 0;
        const flows = buildInvestmentExternalCashFlows({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(flows.map((flow) => flow.amount)).toEqual([-500, 100]);
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

    it('includes append-only corrections in external investor flows with the inverse cash sign', () => {
        const value = fixture();
        value.investmentCashMovements.push({ id: 'correction', cashAccountId: 'cash-1', type: 'Correction',
            amount: { amount: -20, currency: 'INR' }, effectiveAt: '2026-01-04T00:00:00.000Z',
            recordedAt: '2026-01-04T00:00:00.000Z', reason: 'Corrected withdrawal', reversesMovementId: 'withdrawal' });
        const flows = buildInvestmentExternalCashFlows({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(flows.map((flow) => flow.amount)).toEqual([-1000, -500, 100, 20]);
    });

    it('does not reconcile against a statement recorded after the requested point-in-time', () => {
        const value = fixture();
        const result = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-01-15T00:00:00.000Z' });
        expect(result.status).toBe('incomplete');
        expect(result.statementBalance).toBeNull();
    });

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
        value.investmentCashStatements[0].closingBalance.amount = 1275;
        value.investmentCashStatements.push(
            { id: 'statement-2', cashAccountId: 'cash-2', closingBalance: { amount: 75, currency: 'INR' },
                periodStart: date, periodEnd: '2026-01-31T00:00:00.000Z', statementAsOf: '2026-01-31T00:00:00.000Z',
                recordedAt: '2026-01-31T00:00:00.000Z', sourceName: 'Second broker statement' }
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

        const backdated = fixture();
        backdated.investmentCashMovements.push({ id: 'correction', cashAccountId: 'cash-1', type: 'Correction',
            amount: { amount: 10, currency: 'INR' }, effectiveAt: '2025-12-31T00:00:00.000Z',
            recordedAt: '2026-01-04T00:00:00.000Z', reason: 'Backdated correction', reversesMovementId: 'withdrawal' });
        expect(() => validateInvestmentCashCollections(backdated)).toThrow(/cannot predate/i);
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

    it('rejects linked trades and transfers dated before the cash opening baseline', () => {
        const value = fixture();
        value.investmentTransactions.push({ id: 'historic-trade', accountId: 'broker-1', cashAccountId: 'cash-1',
            cashAmount: { amount: -20, currency: 'INR' }, date: '2025-12-31T00:00:00.000Z', recordedAt: date });
        expect(() => validateInvestmentCashCollections(value)).toThrow(/cannot predate the explicit cash opening/i);
    });
    it('treats a settlement link as unavailable until the link itself was recorded', () => {
        const value = fixture();
        value.investmentTransactions.push({ id: 'late-linked-trade', accountId: 'broker-1', cashAccountId: 'cash-1',
            cashAccountLinkedAt: '2026-01-20T00:00:00.000Z',
            cashAmount: { amount: -50, currency: 'INR' }, date: '2026-01-04T00:00:00.000Z',
            recordedAt: '2026-01-05T00:00:00.000Z' });
        value.investmentCashStatements[0].closingBalance.amount = 1350;
        value.investmentCashStatements[0].recordedAt = '2026-01-10T00:00:00.000Z';
        const beforeLink = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-01-15T00:00:00.000Z' });
        expect(beforeLink.status).toBe('incomplete');
        expect(beforeLink.unmatchedCount).toBe(1);
        const afterLink = reconcileInvestmentCashAccount({ cashAccountId: 'cash-1', ...value, recordedAt: '2026-01-31T00:00:00.000Z' });
        expect(afterLink.status).toBe('reconciled');
        expect(afterLink.expectedBalance.amount).toBe(1350);
    });


});
