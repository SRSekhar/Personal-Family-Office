import type { Identifier } from '@pfo/core';

import type { Currency } from '../common/Currency.js';
import { Money } from '../common/Money.js';
import { InvestmentTransactionType } from './InvestmentTransactionType.js';

export interface InvestmentTransactionInput {
    readonly id: Identifier;
    readonly accountId: string;
    readonly instrumentId: string;
    readonly type: InvestmentTransactionType;
    /** Signed cash movement from the investor's perspective: purchase/fee/tax negative; sale/income positive. */
    readonly cashAmount: Money;
    readonly date: Date;
    /** When this event was entered into the ledger; required for point-in-time analysis. */
    readonly recordedAt: Date;
    readonly quantity?: number;
    readonly unitPrice?: Money;
    readonly externalReference?: string;
    readonly notes?: string;
}

/**
 * Immutable, auditable investment ledger event.
 *
 * cashAmount is the actual signed cash movement for this event. Fees and taxes
 * should be recorded as separate negative events to avoid double-counting.
 */
export class InvestmentTransaction {
    public readonly id: Identifier;
    public readonly accountId: string;
    public readonly instrumentId: string;
    public readonly type: InvestmentTransactionType;
    public readonly cashAmount: Money;
    public readonly date: Date;
    public readonly recordedAt: Date;
    public readonly quantity: number | undefined;
    public readonly unitPrice: Money | undefined;
    public readonly externalReference: string | undefined;
    public readonly notes: string | undefined;

    public constructor(input: InvestmentTransactionInput) {
        if (!input.accountId.trim() || !input.instrumentId.trim()) {
            throw new RangeError('Investment transaction requires account and instrument IDs.');
        }
        if (!Object.values(InvestmentTransactionType).includes(input.type)) {
            throw new RangeError('Investment transaction type is not supported.');
        }
        if (!(input.cashAmount instanceof Money) || input.cashAmount.amount === 0) {
            throw new RangeError('Investment transaction cash amount must be a non-zero Money value.');
        }
        if (!(input.date instanceof Date) || !Number.isFinite(input.date.getTime())) {
            throw new RangeError('Investment transaction date must be valid.');
        }
        if (!(input.recordedAt instanceof Date) || !Number.isFinite(input.recordedAt.getTime())) {
            throw new RangeError('Investment transaction recorded-at date must be valid.');
        }

        const isTrade = input.type === InvestmentTransactionType.Purchase
            || input.type === InvestmentTransactionType.Sale;
        if (isTrade) {
            if (input.quantity === undefined || !Number.isFinite(input.quantity) || input.quantity <= 0) {
                throw new RangeError('Purchase and sale transactions require a positive finite quantity.');
            }
            if (!(input.unitPrice instanceof Money) || input.unitPrice.amount <= 0) {
                throw new RangeError('Purchase and sale transactions require a positive unit price.');
            }
            if (input.unitPrice.currency !== input.cashAmount.currency) {
                throw new RangeError('Transaction cash amount and unit price must use the same currency.');
            }
            const expectedCashAmount = input.quantity * input.unitPrice.amount;
            if (!Number.isFinite(expectedCashAmount)
                || Math.abs(Math.abs(input.cashAmount.amount) - expectedCashAmount) > 0.01) {
                throw new RangeError('Trade cash amount must reconcile to quantity multiplied by unit price; record fees and taxes as separate events.');
            }
            if (input.type === InvestmentTransactionType.Purchase && input.cashAmount.amount >= 0) {
                throw new RangeError('Purchase cash amount must be negative from the investor perspective.');
            }
            if (input.type === InvestmentTransactionType.Sale && input.cashAmount.amount <= 0) {
                throw new RangeError('Sale cash amount must be positive from the investor perspective.');
            }
        } else if (input.quantity !== undefined || input.unitPrice !== undefined) {
            throw new RangeError('Non-trade transactions cannot specify quantity or unit price.');
        }

        if ((input.type === InvestmentTransactionType.Fee || input.type === InvestmentTransactionType.Tax)
            && input.cashAmount.amount >= 0) {
            throw new RangeError('Fee and tax cash amounts must be negative from the investor perspective.');
        }
        if ((input.type === InvestmentTransactionType.Dividend || input.type === InvestmentTransactionType.Interest)
            && input.cashAmount.amount <= 0) {
            throw new RangeError('Dividend and interest cash amounts must be positive from the investor perspective.');
        }
        if (input.externalReference !== undefined && !input.externalReference.trim()) {
            throw new RangeError('External reference must be non-empty when provided.');
        }

        this.id = input.id;
        this.accountId = input.accountId.trim();
        this.instrumentId = input.instrumentId.trim();
        this.type = input.type;
        this.cashAmount = input.cashAmount;
        this.date = new Date(input.date.getTime());
        this.recordedAt = new Date(input.recordedAt.getTime());
        this.quantity = input.quantity;
        this.unitPrice = input.unitPrice;
        this.externalReference = input.externalReference?.trim();
        this.notes = input.notes?.trim();
    }

    public get currency(): Currency {
        return this.cashAmount.currency;
    }
}
