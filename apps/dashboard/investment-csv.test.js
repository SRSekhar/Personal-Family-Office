import { describe, expect, it } from 'vitest';
import { INVESTMENT_CSV_COLLECTIONS, exportInvestmentCollectionCsv, parseInvestmentCollectionCsv, parseInvestmentCollectionCsvDetailed, exportInvestmentCsvErrorReport, previewInvestmentCsvImport, validateInvestmentCsvWorkspace } from './investment-csv.js';

const empty = {
    investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [],
    investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: []
};
const account = { id: 'a-1', name: 'Broker, "A"', institution: 'Bank\nIndia', type: 'Brokerage', currency: 'INR', description: '=1+1' };
const instrument = { id: 'i-1', name: 'தமிழ் Equity', type: 'Equity', currency: 'INR', symbol: 'ABC' };

describe('investment CSV interchange', () => {
    it('declares all eight ledger and cash collections', () => expect(INVESTMENT_CSV_COLLECTIONS).toHaveLength(8));
    it('round-trips Unicode, commas, quotes, multiline and formula-like text safely', () => {
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]);
        expect(csv).not.toContain('=1+1');
        expect(csv).toContain('Broker, ""A""');
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

    it('round-trips every cash collection with exact timestamps and money values', () => {
        const fixtures = {
            investmentCashAccounts: [{ id: 'ca-1', investmentAccountId: 'a-1', name: 'Broker cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' }],
            investmentCashMovements: [{ id: 'm-1', cashAccountId: 'ca-1', type: 'OpeningBalance', amount: { amount: 0, currency: 'INR' },
                effectiveAt: '2026-01-01T00:00:00.000Z', recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'manual' }],
            investmentCashTransfers: [{ id: 'tr-1', sourceCashAccountId: 'ca-1', destinationCashAccountId: 'ca-2',
                amount: { amount: 25, currency: 'INR' }, effectiveAt: '2026-01-02T00:00:00.000Z', recordedAt: '2026-01-02T00:00:00.000Z' }],
            investmentCashStatements: [{ id: 's-1', cashAccountId: 'ca-1', closingBalance: { amount: 25, currency: 'INR' },
                periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-31T00:00:00.000Z',
                statementAsOf: '2026-01-31T00:00:00.000Z', recordedAt: '2026-02-01T00:00:00.000Z', sourceName: 'Bank statement' }]
        };
        for (const [collection, records] of Object.entries(fixtures)) {
            expect(parseInvestmentCollectionCsv(exportInvestmentCollectionCsv(collection, records), collection)).toEqual(records);
        }
    });
    it('round-trips instruments and valuation observations', () => {
        const fixtures = {
            investmentInstruments: [instrument],
            investmentValuations: [{ instrumentId: 'i-1', price: { amount: 120.5, currency: 'INR' },
                asOf: '2026-01-31T00:00:00.000Z', recordedAt: '2026-02-01T00:00:00.000Z',
                sourceType: 'manual', sourceName: 'User-entered observation' }]
        };
        for (const [collection, records] of Object.entries(fixtures)) {
            expect(parseInvestmentCollectionCsv(exportInvestmentCollectionCsv(collection, records), collection)).toEqual(records);
        }
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
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]).replace(/~pfo64~[^"]+/u, '=1+1');
        expect(() => parseInvestmentCollectionCsv(csv, 'investmentAccounts')).toThrow(/safe-text encoding/i);
    });
    it('previews only after whole-workspace validation and does not mutate input', () => {
        const before = structuredClone(empty);
        const preview = previewInvestmentCsvImport(empty, { investmentAccounts: [account], investmentInstruments: [instrument] }, 'append');
        expect(preview.confirmed).toBe(false);
        expect(preview.counts.investmentAccounts).toEqual({ imported: 1, resulting: 1, mode: 'append' });
        expect(empty).toEqual(before);
        expect(() => validateInvestmentCsvWorkspace(empty, { investmentCashAccounts: [{ id: 'cash-1', investmentAccountId: 'missing-account', name: 'Cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' }] }, 'append')).toThrow(/unknown investment account/i);
    });
    it('accepts UTF-8 BOM and LF line endings and preserves empty collections', () => {
        const csv = exportInvestmentCollectionCsv('investmentAccounts', [account]).replace(/\r\n/gu, '\n');
        expect(parseInvestmentCollectionCsv('\uFEFF' + csv, 'investmentAccounts')).toEqual([account]);
        const emptyCsv = exportInvestmentCollectionCsv('investmentAccounts', []);
        expect(parseInvestmentCollectionCsv(emptyCsv, 'investmentAccounts')).toEqual([]);
    });
    it('rejects invalid nested JSON and non-finite numeric cells', () => {
        const transaction = { id: 't-2', accountId: 'a-1', instrumentId: 'i-1', type: 'Purchase',
            cashAmount: { amount: -10, currency: 'INR' }, date: '2026-01-01T00:00:00.000Z',
            recordedAt: '2026-01-01T00:00:00.000Z', quantity: 1 };
        const csv = exportInvestmentCollectionCsv('investmentTransactions', [transaction]);
        expect(() => parseInvestmentCollectionCsv(csv.replace('""amount"":-10', '""amount"":oops'), 'investmentTransactions')).toThrow(/invalid JSON/i);
        expect(() => parseInvestmentCollectionCsv(csv.replace(',"1",', ',"Infinity",'), 'investmentTransactions')).toThrow(/finite number/i);
    });

    it('collects row-level field and column errors and exports a spreadsheet-safe diagnostic report', () => {
        const valid = exportInvestmentCollectionCsv('investmentAccounts', [account]);
        const rows = valid.split('\r\n');
        rows[2] = rows[2].replace('"Broker, ""A"""', '"=HYPERLINK(1)"');
        rows[3] = '"short"';
        const detailed = parseInvestmentCollectionCsvDetailed(rows.join('\r\n'), 'investmentAccounts');
        expect(detailed.records).toEqual([]);
        expect(detailed.errors).toHaveLength(2);
        expect(detailed.errors[0]).toMatchObject({ rowNumber: 3, field: 'name' });
        expect(detailed.errors[1]).toMatchObject({ rowNumber: 4, field: '' });
        const report = exportInvestmentCsvErrorReport(detailed.errors.map((error) => ({
            ...error, file: 'bad.csv', collection: 'investmentAccounts'
        })));
        expect(report).toContain('rawRowJson');
        expect(report).not.toContain('=HYPERLINK(1)');
        expect(parseInvestmentCollectionCsvDetailed(valid, 'investmentAccounts').errors).toEqual([]);
    });
    it('rejects duplicate IDs in append mode before returning a candidate', () => {
        const current = { ...empty, investmentAccounts: [account] };
        expect(() => validateInvestmentCsvWorkspace(current, { investmentAccounts: [account] }, 'append')).toThrow(/unique/i);
    });
});
