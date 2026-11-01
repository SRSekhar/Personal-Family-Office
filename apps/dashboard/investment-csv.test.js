import { describe, expect, it } from 'vitest';
import { INVESTMENT_CSV_COLLECTIONS, exportInvestmentCollectionCsv, parseInvestmentCollectionCsv, previewInvestmentCsvImport, validateInvestmentCsvWorkspace } from './investment-csv.js';

const empty = {
    investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [],
    investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: []
};
const account = { id: 'a-1', name: 'Broker, "A"', institution: 'Bank\nIndia', type: 'Brokerage', currency: 'INR', description: 'safe =1+1' };
const instrument = { id: 'i-1', name: 'தமிழ் Equity', type: 'Equity', currency: 'INR', symbol: 'ABC' };

describe('investment CSV interchange', () => {
    it('declares all eight ledger and cash collections', () => expect(INVESTMENT_CSV_COLLECTIONS).toHaveLength(8));
    it('round-trips Unicode, commas, quotes, multiline and formula-like text safely', () => {
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]);
        expect(csv).not.toContain('=1+1');
        expect(parseInvestmentCollectionCsv(csv, 'investmentAccounts')).toEqual([account]);
    });
    it('round-trips nested money values and optional bitemporal settlement fields', () => {
        const row = { id: 't-1', accountId: 'a-1', instrumentId: 'i-1', type: 'Purchase',
            cashAmount: { amount: -100, currency: 'INR' }, date: '2026-01-01T00:00:00.000Z',
            recordedAt: '2026-01-01T00:00:00.000Z', cashAccountId: 'cash-1',
            cashAccountLinkedAt: '2026-01-02T00:00:00.000Z', quantity: 1,
            unitPrice: { amount: 100, currency: 'INR' }, notes: 'purchase' };
        expect(parseInvestmentCollectionCsv(exportInvestmentCollectionCsv('investmentTransactions', [row]), 'investmentTransactions')).toEqual([row]);
    });
    it('rejects wrong manifests, reordered or duplicate headers and incomplete rows', () => {
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]);
        expect(() => parseInvestmentCollectionCsv(csv, 'investmentInstruments')).toThrow(/manifest/i);
        expect(() => parseInvestmentCollectionCsv(csv.replace('"id","name"', '"name","id"'), 'investmentAccounts')).toThrow(/columns/i);
        expect(() => parseInvestmentCollectionCsv(csv.replace('"id","name"', '"id","id"'), 'investmentAccounts')).toThrow(/columns/i);
        const rows = csv.split('\r\n');
        rows[2] = '"short"';
        expect(() => parseInvestmentCollectionCsv(rows.join('\r\n'), 'investmentAccounts')).toThrow(/columns/i);
    });
    it('rejects malformed quoting and unencoded text', () => {
        expect(() => parseInvestmentCollectionCsv('#PFO-INVESTMENT-CSV,1,investmentAccounts\r\n"id","name","institution","type","currency","description\r\n', 'investmentAccounts')).toThrow(/unterminated/i);
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]).replace(/~pfo64~[^"]+/u, 'plain text');
        expect(() => parseInvestmentCollectionCsv(csv, 'investmentAccounts')).toThrow(/encoded/i);
    });
    it('previews only after whole-workspace validation and does not mutate input', () => {
        const before = structuredClone(empty);
        const preview = previewInvestmentCsvImport(empty, { investmentAccounts: [account], investmentInstruments: [instrument] }, 'append');
        expect(preview.confirmed).toBe(false);
        expect(preview.counts.investmentAccounts).toEqual({ imported: 1, resulting: 1, mode: 'append' });
        expect(empty).toEqual(before);
        expect(() => validateInvestmentCsvWorkspace(empty, { investmentAccounts: [account] }, 'append')).toThrow(/unknown account|references/i);
    });
    it('rejects duplicate IDs in append mode before returning a candidate', () => {
        const current = { ...empty, investmentAccounts: [account] };
        expect(() => validateInvestmentCsvWorkspace(current, { investmentAccounts: [account] }, 'append')).toThrow(/unique/i);
    });
});
