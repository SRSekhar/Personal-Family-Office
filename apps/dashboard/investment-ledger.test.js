import { describe, expect, it } from 'vitest';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const base = () => ({
    investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
    investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
    investmentTransactions: [{
        id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1',
        type: 'Purchase', cashAmount: { amount: -200, currency: 'INR' },
        quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
        date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z'
    }],
    investmentValuations: [{
        instrumentId: 'instrument-1', price: { amount: 110, currency: 'INR' },
        asOf: '2026-10-03T00:00:00.000Z', recordedAt: '2026-10-03T00:00:00.000Z',
        sourceType: 'manual', sourceName: 'User-entered'
    }]
});

describe('investment ledger backup validation', () => {
    it('accepts and normalizes a complete ledger without dropping IDs or provenance', () => {
        expect(validateInvestmentLedgerCollections(base())).toEqual(base());
    });
    it('rejects duplicate account, instrument, and transaction identifiers', () => {
        const value = base();
        value.investmentAccounts.push({ ...value.investmentAccounts[0], name: 'Duplicate' });
        expect(() => validateInvestmentLedgerCollections(value)).toThrow(/account IDs must be unique/i);
    });
    it('rejects unknown transaction references and currency mismatches', () => {
        const value = base();
        value.investmentTransactions[0].accountId = 'missing';
        expect(() => validateInvestmentLedgerCollections(value)).toThrow(/unknown account or instrument/i);
        const mismatch = base();
        mismatch.investmentTransactions[0].cashAmount.currency = 'USD';
        expect(() => validateInvestmentLedgerCollections(mismatch)).toThrow(/currencies must match/i);
    });
    it('enforces trade reconciliation, sign convention, and positive quantities', () => {
        const value = base();
        value.investmentTransactions[0].cashAmount.amount = 200;
        expect(() => validateInvestmentLedgerCollections(value)).toThrow(/purchase cash must be negative/i);
        const invalid = base();
        invalid.investmentTransactions[0].quantity = 0;
        expect(() => validateInvestmentLedgerCollections(invalid)).toThrow(/quantity must be positive/i);
    });
    it('rejects invalid valuation provenance, unknown instruments, and future-shaped dates', () => {
        const value = base();
        value.investmentValuations[0].sourceType = 'guess';
        expect(() => validateInvestmentLedgerCollections(value)).toThrow(/source type is unsupported/i);
        const unknown = base();
        unknown.investmentValuations[0].instrumentId = 'missing';
        expect(() => validateInvestmentLedgerCollections(unknown)).toThrow(/unknown instrument/i);
        const invalidDate = base();
        invalidDate.investmentTransactions[0].date = 'not-a-date';
        expect(() => validateInvestmentLedgerCollections(invalidDate)).toThrow(/canonical ISO-8601/i);
    });
});
