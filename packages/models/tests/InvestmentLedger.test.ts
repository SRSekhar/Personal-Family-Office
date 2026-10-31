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
} from '../src/index.js';

describe('InvestmentAccount', () => {
    it('creates a named account with institution and currency', () => {
        const account = new InvestmentAccount(
            Identifier.create(),
            'Long-term holdings',
            InvestmentAccountType.Brokerage,
            Currency.INR,
            'Example Securities'
        );

        expect(account.name).toBe('Long-term holdings');
        expect(account.institution).toBe('Example Securities');
        expect(account.currency).toBe(Currency.INR);
    });

    it('rejects a blank institution', () => {
        expect(() => new InvestmentAccount(
            Identifier.create(),
            'Account',
            InvestmentAccountType.Brokerage,
            Currency.INR,
            ' '
        )).toThrow('Investment account institution cannot be empty.');
    });
});

describe('InvestmentInstrument', () => {
    it('normalizes identifiers and preserves optional metadata', () => {
        const instrument = new InvestmentInstrument(
            Identifier.create(),
            'Example Equity',
            InvestmentType.Equity,
            Currency.INR,
            { symbol: ' ABC ', exchange: ' NSE ', isin: 'ine123a01016' }
        );

        expect(instrument.symbol).toBe('ABC');
        expect(instrument.exchange).toBe('NSE');
        expect(instrument.isin).toBe('INE123A01016');
    });

    it('supports instruments without market identifiers', () => {
        const instrument = new InvestmentInstrument(
            Identifier.create(),
            'Public Provident Fund',
            InvestmentType.PublicProvidentFund,
            Currency.INR
        );

        expect(instrument.symbol).toBeUndefined();
        expect(instrument.isin).toBeUndefined();
    });

    it('rejects malformed ISIN values', () => {
        expect(() => new InvestmentInstrument(
            Identifier.create(),
            'Invalid security',
            InvestmentType.Equity,
            Currency.INR,
            { isin: 'not-an-isin' }
        )).toThrow('ISIN must contain two country letters followed by ten alphanumeric characters.');
    });
});

describe('InvestmentTransaction', () => {
    const base = {
        id: Identifier.create(),
        accountId: 'account-1',
        instrumentId: 'instrument-1',
        date: new Date('2026-01-15T00:00:00.000Z')
    };

    it('creates a purchase with investor-perspective cash flow', () => {
        const transaction = new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Purchase,
            quantity: 10,
            unitPrice: new Money(100, Currency.INR),
            cashAmount: new Money(-1_000, Currency.INR)
        });

        expect(transaction.quantity).toBe(10);
        expect(transaction.cashAmount.amount).toBe(-1_000);
        expect(transaction.date).not.toBe(base.date);
    });

    it('creates dividend, fee and tax cash events without units', () => {
        const dividend = new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Dividend,
            cashAmount: new Money(125, Currency.INR)
        });
        const fee = new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Fee,
            cashAmount: new Money(-10, Currency.INR)
        });

        expect(dividend.cashAmount.amount).toBe(125);
        expect(fee.cashAmount.amount).toBe(-10);
    });

    it('rejects a purchase with positive cash movement', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Purchase,
            quantity: 1,
            unitPrice: new Money(100),
            cashAmount: new Money(100)
        })).toThrow('Purchase cash amount must be negative from the investor perspective.');
    });

    it('rejects a sale without a positive quantity', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Sale,
            quantity: 0,
            unitPrice: new Money(100),
            cashAmount: new Money(100)
        })).toThrow('Purchase and sale transactions require a positive finite quantity.');
    });

    it('rejects trade cash amounts that do not reconcile to units and price', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Purchase,
            quantity: 2,
            unitPrice: new Money(100),
            cashAmount: new Money(-150)
        })).toThrow('Trade cash amount must reconcile');
    });

    it('rejects mismatched transaction currencies', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Purchase,
            quantity: 1,
            unitPrice: new Money(100, Currency.USD),
            cashAmount: new Money(-100, Currency.INR)
        })).toThrow('Transaction cash amount and unit price must use the same currency.');
    });

    it('rejects trade fields on non-trade events', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Dividend,
            quantity: 1,
            cashAmount: new Money(100)
        })).toThrow('Non-trade transactions cannot specify quantity or unit price.');
    });

    it('rejects invalid dates and zero cash movements', () => {
        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Dividend,
            date: new Date(Number.NaN),
            cashAmount: new Money(100)
        })).toThrow('Investment transaction date must be valid.');

        expect(() => new InvestmentTransaction({
            ...base,
            type: InvestmentTransactionType.Dividend,
            cashAmount: Money.zero()
        })).toThrow('Investment transaction cash amount must be a non-zero Money value.');
    });
});
