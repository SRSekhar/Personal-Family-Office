import { describe, expect, it } from 'vitest';
import {
    reconcileInvestmentStatement, reconcileInvestmentStatementEvidence, validateInvestmentStatementEvidence
} from './investment-statement-reconciliation.js';

const account = { id: 'account-1', name: 'Broker', institution: 'Broker Ltd', type: 'Brokerage', currency: 'INR' };
const instrument = { id: 'instrument-1', name: 'Example Equity', type: 'Equity', currency: 'INR', symbol: 'EXAMPLE' };
const transaction = {
    id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
    cashAmount: { amount: -1000, currency: 'INR' }, quantity: 10, unitPrice: { amount: 100, currency: 'INR' },
    date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-01T01:00:00.000Z', externalReference: 'BROKER-001'
};
const base = {
    investmentAccounts: [account], investmentInstruments: [instrument],
    investmentTransactions: [transaction], investmentValuations: [],
    recordedAtCutoff: '2026-11-10T00:00:00.000Z'
};
function statement(overrides = {}) {
    return {
        id: 'statement-1', kind: 'transactions', accountId: 'account-1', currency: 'INR',
        periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T23:59:59.000Z',
        statementAsOf: '2026-10-31T00:00:00.000Z', recordedAt: '2026-11-01T00:00:00.000Z',
        sourceName: 'Broker statement', statementReference: 'STMT-2026-10',
        rows: [{ sourceRowId: 'line-1', effectiveAt: transaction.date, instrumentId: 'instrument-1',
            type: 'Purchase', cashAmount: { amount: -1000, currency: 'INR' }, quantity: 10,
            unitPrice: { amount: 100, currency: 'INR' }, externalReference: 'BROKER-001' }],
        ...overrides
    };
}
describe('investment statement evidence contract', () => {
    it('validates and preserves source provenance and row identity', () => {
        expect(validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement()] }).investmentStatementEvidence[0])
            .toMatchObject({ id: 'statement-1', sourceName: 'Broker statement', statementReference: 'STMT-2026-10',
                rows: [{ sourceRowId: 'line-1', externalReference: 'BROKER-001' }] });
    });
    it('rejects unknown accounts, instruments, currencies and duplicate source rows', () => {
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({ accountId: 'missing' })] })).toThrow(/unknown investment account/i);
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({ rows: [{ ...statement().rows[0], instrumentId: 'missing' }] })] })).toThrow(/known instrument/i);
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({ currency: 'USD' })] })).toThrow(/currency/i);
        const row = statement().rows[0];
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({ rows: [row, row] })] })).toThrow(/source row IDs must be unique/i);
    });
    it('rejects invalid transaction arithmetic and rows outside the statement period', () => {
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({
            rows: [{ ...statement().rows[0], cashAmount: { amount: -999, currency: 'INR' } }]
        })] })).toThrow(/reconcile to quantity/i);
        expect(() => validateInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement({
            rows: [{ ...statement().rows[0], effectiveAt: '2026-11-01T00:00:00.000Z' }]
        })] })).toThrow(/inside the statement period/i);
    });
});
describe('investment transaction statement reconciliation', () => {
    it('matches by external reference and exact transaction details', () => {
        const result = reconcileInvestmentStatement({ ...base, statement: statement() });
        expect(result.status).toBe('reconciled');
        expect(result.rows).toEqual([{ sourceRowId: 'line-1', transactionId: 'transaction-1', status: 'matched' }]);
    });
    it('reports amount and quantity differences without mutating the ledger', () => {
        const before = structuredClone(base.investmentTransactions);
        const result = reconcileInvestmentStatement({ ...base, statement: statement({
            rows: [{ ...statement().rows[0], cashAmount: { amount: -1100, currency: 'INR' }, quantity: 11, unitPrice: { amount: 100, currency: 'INR' } }]
        }) });
        expect(result.status).toBe('difference');
        expect(result.rows[0]).toMatchObject({ status: 'mismatch', differences: ['amountMatches', 'quantityMatches'] });
        expect(base.investmentTransactions).toEqual(before);
    });
    it('reports unmatched statement and unmatched ledger rows', () => {
        const result = reconcileInvestmentStatement({ ...base, statement: statement({
            rows: [{ ...statement().rows[0], sourceRowId: 'line-2', externalReference: 'UNKNOWN' }]
        }) });
        expect(result.status).toBe('incomplete');
        expect(result.counts).toMatchObject({ unmatchedStatement: 1, unmatchedLedger: 1 });
    });
    it('does not silently choose between ambiguous same-day ledger transactions', () => {
        const duplicate = { ...transaction, id: 'transaction-2', externalReference: undefined };
        const original = { ...transaction, externalReference: undefined };
        const row = { ...statement().rows[0], externalReference: undefined };
        const result = reconcileInvestmentStatement({ ...base, investmentTransactions: [original, duplicate],
            statement: statement({ rows: [row] }) });
        expect(result.rows[0].status).toBe('ambiguous');
    });
    it('does not use evidence before its recorded-at cutoff', () => {
        const result = reconcileInvestmentStatement({ ...base, recordedAtCutoff: '2026-10-15T00:00:00.000Z', statement: statement() });
        expect(result.status).toBe('unavailable');
    });
});
describe('investment holdings statement reconciliation', () => {
    const holdingStatement = statement({
        id: 'holdings-1', kind: 'holdings', periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T23:59:59.000Z', statementAsOf: '2026-10-31T00:00:00.000Z',
        rows: [{ sourceRowId: 'holding-1', instrumentId: 'instrument-1', quantity: 10 }]
    });
    it('compares holdings quantities with the existing FIFO projection', () => {
        const result = reconcileInvestmentStatement({ ...base, statement: holdingStatement });
        expect(result.status).toBe('reconciled');
        expect(result.rows[0]).toMatchObject({ status: 'matched', statementQuantity: 10, ledgerQuantity: 10, difference: 0 });
    });
    it('reports holdings quantity differences and missing ledger positions', () => {
        const result = reconcileInvestmentStatement({ ...base, statement: {
            ...holdingStatement, rows: [{ sourceRowId: 'holding-1', instrumentId: 'instrument-1', quantity: 12 }]
        } });
        expect(result.status).toBe('difference');
        expect(result.rows[0]).toMatchObject({ status: 'quantity-mismatch', difference: 2 });
    });
    it('reports open ledger holdings absent from the statement', () => {
        const secondInstrument = { id: 'instrument-2', name: 'Other Equity', type: 'Equity', currency: 'INR' };
        const result = reconcileInvestmentStatement({ ...base, investmentInstruments: [instrument, secondInstrument], statement: { ...holdingStatement, rows: [
            { sourceRowId: 'holding-2', instrumentId: 'instrument-2', quantity: 0 }
        ] } });
        expect(result.status).toBe('incomplete');
        expect(result.rows[0].status).toBe('matched');
        expect(result.rows[1].status).toBe('unmatched-ledger');
    });
    it('keeps transaction and holdings statement results distinct in a batch', () => {
        const result = reconcileInvestmentStatementEvidence({ ...base, investmentStatementEvidence: [statement(), holdingStatement] });
        expect(result.summary).toEqual({ statementCount: 2, reconciled: 2, differences: 0, incomplete: 0 });
    });
});
