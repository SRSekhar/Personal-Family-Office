import { describe, expect, it } from 'vitest';
import { Identifier } from '@pfo/core';
import {
    Currency,
    InvestmentAccount,
    InvestmentAccountType,
    InvestmentInstrument,
    InvestmentTransaction,
    InvestmentTransactionType,
    InvestmentType,
    Money
} from '@pfo/models';

import { analyzeInvestmentLedger, type InvestmentValuationObservation } from '../src/InvestmentLedgerAnalysis.js';

function setup(): { account: InvestmentAccount; instrument: InvestmentInstrument; accountId: string; instrumentId: string } {
    const accountId = Identifier.create();
    const instrumentId = Identifier.create();
    const account = new InvestmentAccount(
        accountId,
        'Brokerage',
        InvestmentAccountType.Brokerage,
        Currency.INR,
        'Example Broker'
    );
    const instrument = new InvestmentInstrument(
        instrumentId,
        'Example Equity',
        InvestmentType.Equity,
        Currency.INR,
        { symbol: 'EXAMPLE', exchange: 'NSE' }
    );
    return {
        account,
        instrument,
        accountId: accountId.toString(),
        instrumentId: instrumentId.toString()
    };
}

function transaction(
    ids: ReturnType<typeof setup>,
    type: InvestmentTransactionType,
    date: string,
    cash: number,
    quantity?: number,
    unitPrice?: number
): InvestmentTransaction {
    return new InvestmentTransaction({
        id: Identifier.create(),
        accountId: ids.accountId,
        instrumentId: ids.instrumentId,
        type,
        date: new Date(date),
        recordedAt: new Date(date),
        cashAmount: new Money(cash, Currency.INR),
        ...(quantity === undefined ? {} : { quantity }),
        ...(unitPrice === undefined ? {} : { unitPrice: new Money(unitPrice, Currency.INR) })
    });
}

function valuation(
    instrumentId: string,
    price: number,
    asOf: string,
    recordedAt = asOf
): InvestmentValuationObservation {
    return {
        instrumentId,
        price: new Money(price, Currency.INR),
        asOf: new Date(asOf),
        recordedAt: new Date(recordedAt),
        sourceType: 'manual',
        sourceName: 'User-entered valuation'
    };
}

describe('analyzeInvestmentLedger', () => {
    it('projects FIFO holdings, realised and unrealised gains, income and expenses', () => {
        const ids = setup();
        const result = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -1_000, 10, 100),
                transaction(ids, InvestmentTransactionType.Purchase, '2025-02-01T00:00:00.000Z', -1_200, 10, 120),
                transaction(ids, InvestmentTransactionType.Sale, '2025-03-01T00:00:00.000Z', 1_800, 12, 150),
                transaction(ids, InvestmentTransactionType.Dividend, '2025-03-05T00:00:00.000Z', 25),
                transaction(ids, InvestmentTransactionType.Interest, '2025-03-06T00:00:00.000Z', 3),
                transaction(ids, InvestmentTransactionType.Fee, '2025-03-07T00:00:00.000Z', -10),
                transaction(ids, InvestmentTransactionType.Tax, '2025-03-08T00:00:00.000Z', -5)
            ],
            valuations: [valuation(ids.instrumentId, 160, '2025-03-31T00:00:00.000Z')],
            asOfDate: new Date('2025-03-31T00:00:00.000Z')
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            accountId: ids.accountId,
            instrumentId: ids.instrumentId,
            quantity: 8,
            openLotCount: 1,
            valuationSource: 'User-entered valuation',
            valuationSourceType: 'manual'
        });
        expect(result[0]?.costBasis.amount).toBe(960);
        expect(result[0]?.realizedGain.amount).toBe(560);
        expect(result[0]?.marketValue?.amount).toBe(1_280);
        expect(result[0]?.unrealizedGain?.amount).toBe(320);
        expect(result[0]?.dividendIncome.amount).toBe(25);
        expect(result[0]?.interestIncome.amount).toBe(3);
        expect(result[0]?.fees.amount).toBe(10);
        expect(result[0]?.taxes.amount).toBe(5);
    });

    it('uses the latest valuation available at the requested as-of date', () => {
        const ids = setup();
        const result = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -1_000, 10, 100)
            ],
            valuations: [
                valuation(ids.instrumentId, 110, '2025-02-01T00:00:00.000Z'),
                valuation(ids.instrumentId, 120, '2025-03-01T00:00:00.000Z'),
                valuation(ids.instrumentId, 999, '2025-04-01T00:00:00.000Z')
            ],
            asOfDate: new Date('2025-03-15T00:00:00.000Z')
        });

        expect(result[0]?.marketPrice?.amount).toBe(120);
        expect(result[0]?.valuationAsOf).toBe('2025-03-01T00:00:00.000Z');
    });

    it('does not invent market value when no valuation exists', () => {
        const ids = setup();
        const result = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -1_000, 10, 100)
            ],
            valuations: [],
            asOfDate: new Date('2025-02-01T00:00:00.000Z')
        });

        expect(result[0]?.marketPrice).toBeNull();
        expect(result[0]?.marketValue).toBeNull();
        expect(result[0]?.unrealizedGain).toBeNull();
    });

    it('excludes transactions after the requested as-of date', () => {
        const ids = setup();
        const result = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -1_000, 10, 100),
                transaction(ids, InvestmentTransactionType.Purchase, '2025-04-01T00:00:00.000Z', -500, 5, 100)
            ],
            valuations: [],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        });

        expect(result[0]?.quantity).toBe(10);
    });

    it('does not use transactions or backfilled valuations recorded after the as-of date', () => {
        const ids = setup();
        const backfilledPurchase = new InvestmentTransaction({
            id: Identifier.create(),
            accountId: ids.accountId,
            instrumentId: ids.instrumentId,
            type: InvestmentTransactionType.Purchase,
            date: new Date('2025-01-01T00:00:00.000Z'),
            recordedAt: new Date('2025-04-01T00:00:00.000Z'),
            quantity: 1,
            unitPrice: new Money(100),
            cashAmount: new Money(-100)
        });
        const result = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [backfilledPurchase],
            valuations: [valuation(ids.instrumentId, 150, '2025-02-01T00:00:00.000Z', '2025-04-01T00:00:00.000Z')],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        });

        expect(result).toHaveLength(0);
    });

    it('rejects a sale that exceeds the available FIFO quantity', () => {
        const ids = setup();
        expect(() => analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -100, 1, 100),
                transaction(ids, InvestmentTransactionType.Sale, '2025-02-01T00:00:00.000Z', 200, 2, 100)
            ],
            valuations: [],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        })).toThrow('sale quantity exceeds the available FIFO position');
    });

    it('rejects unknown accounts, instruments, duplicate transaction IDs and mixed currencies', () => {
        const ids = setup();
        const purchase = transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -100, 1, 100);
        expect(() => analyzeInvestmentLedger({
            accounts: [],
            instruments: [ids.instrument],
            transactions: [purchase],
            valuations: [],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        })).toThrow('unknown account');

        expect(() => analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [purchase, purchase],
            valuations: [],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        })).toThrow('duplicate transaction IDs');

        const usdAccount = new InvestmentAccount(
            Identifier.create(),
            'USD Account',
            InvestmentAccountType.Brokerage,
            Currency.USD,
            'Foreign Broker'
        );
        expect(() => analyzeInvestmentLedger({
            accounts: [usdAccount],
            instruments: [ids.instrument],
            transactions: [purchase],
            valuations: [],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        })).toThrow('currencies must match');
    });

    it('rejects invalid valuation provenance and a future valuation is unavailable', () => {
        const ids = setup();
        expect(() => analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -100, 1, 100)
            ],
            valuations: [{
                ...valuation(ids.instrumentId, 100, '2025-02-01T00:00:00.000Z'),
                sourceName: ' '
            }],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        })).toThrow('source name cannot be empty');

        const futureOnly = analyzeInvestmentLedger({
            accounts: [ids.account],
            instruments: [ids.instrument],
            transactions: [
                transaction(ids, InvestmentTransactionType.Purchase, '2025-01-01T00:00:00.000Z', -100, 1, 100)
            ],
            valuations: [valuation(ids.instrumentId, 200, '2025-04-01T00:00:00.000Z')],
            asOfDate: new Date('2025-03-01T00:00:00.000Z')
        });
        expect(futureOnly[0]?.marketValue).toBeNull();
    });
});
