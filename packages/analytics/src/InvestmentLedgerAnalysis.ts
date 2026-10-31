import type { Currency } from '@pfo/models';

import type {
    InvestmentAccount,
    InvestmentInstrument,
    InvestmentTransaction
} from '@pfo/models';
import {
    InvestmentTransactionType,
    Money
} from '@pfo/models';

export type InvestmentValuationSourceType = 'manual' | 'provider';

export interface InvestmentValuationObservation {
    readonly instrumentId: string;
    readonly price: Money;
    readonly asOf: Date;
    readonly recordedAt: Date;
    readonly sourceType: InvestmentValuationSourceType;
    readonly sourceName: string;
}

export interface InvestmentLedgerAnalysisInput {
    readonly accounts: readonly InvestmentAccount[];
    readonly instruments: readonly InvestmentInstrument[];
    readonly transactions: readonly InvestmentTransaction[];
    readonly valuations: readonly InvestmentValuationObservation[];
    readonly asOfDate: Date;
}

export interface InvestmentLedgerPosition {
    readonly accountId: string;
    readonly instrumentId: string;
    readonly instrumentName: string;
    readonly currency: Currency;
    readonly quantity: number;
    readonly openLotCount: number;
    readonly costBasis: Money;
    readonly realizedGain: Money;
    readonly dividendIncome: Money;
    readonly interestIncome: Money;
    /** Positive expense totals, derived from negative ledger cash movements. */
    readonly fees: Money;
    readonly taxes: Money;
    readonly marketPrice: Money | null;
    readonly marketValue: Money | null;
    readonly unrealizedGain: Money | null;
    readonly valuationAsOf: string | null;
    readonly valuationSource: string | null;
    readonly valuationSourceType: InvestmentValuationSourceType | null;
}

interface CostLot {
    remainingQuantity: number;
    readonly unitCost: number;
}

interface MutablePosition {
    readonly account: InvestmentAccount;
    readonly instrument: InvestmentInstrument;
    readonly lots: CostLot[];
    realizedGain: number;
    dividendIncome: number;
    interestIncome: number;
    fees: number;
    taxes: number;
}

const QUANTITY_TOLERANCE = 1e-10;

/**
 * Builds deterministic account/instrument positions from immutable ledger
 * events using FIFO cost basis. Prices are selected only from observations
 * dated on or before asOfDate. No market-data lookup, FX conversion, tax
 * calculation, or investment recommendation is performed.
 */
export function analyzeInvestmentLedger({
    accounts,
    instruments,
    transactions,
    valuations,
    asOfDate
}: InvestmentLedgerAnalysisInput): InvestmentLedgerPosition[] {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) {
        throw new RangeError('Investment ledger analysis requires a valid as-of date.');
    }
    assertUnique(accounts.map((item) => item.id.toString()), 'account');
    assertUnique(instruments.map((item) => item.id.toString()), 'instrument');
    assertUnique(transactions.map((item) => item.id.toString()), 'transaction');

    const accountById = new Map(accounts.map((item) => [item.id.toString(), item] as const));
    const instrumentById = new Map(instruments.map((item) => [item.id.toString(), item] as const));
    const positions = new Map<string, MutablePosition>();

    const orderedTransactions = transactions
        .map((transaction, index) => ({ transaction, index }))
        .sort((left, right) =>
            left.transaction.date.getTime() - right.transaction.date.getTime()
            || left.index - right.index
        );

    for (const { transaction } of orderedTransactions) {
        if (!(transaction.date instanceof Date) || !Number.isFinite(transaction.date.getTime())
            || !(transaction.recordedAt instanceof Date) || !Number.isFinite(transaction.recordedAt.getTime())) {
            throw new RangeError('Investment transaction dates must be valid.');
        }
        const account = accountById.get(transaction.accountId);
        const instrument = instrumentById.get(transaction.instrumentId);
        if (account === undefined) {
            throw new RangeError(`Investment transaction references unknown account "${transaction.accountId}".`);
        }
        if (instrument === undefined) {
            throw new RangeError(`Investment transaction references unknown instrument "${transaction.instrumentId}".`);
        }
        if (account.currency !== instrument.currency || transaction.currency !== instrument.currency) {
            throw new RangeError('Investment account, instrument and transaction currencies must match; FX conversion is not performed.');
        }
        if (transaction.date.getTime() > asOfDate.getTime()
            || transaction.recordedAt.getTime() > asOfDate.getTime()) {
            continue;
        }

        const key = positionKey(transaction.accountId, transaction.instrumentId);
        let position = positions.get(key);
        if (position === undefined) {
            position = {
                account,
                instrument,
                lots: [],
                realizedGain: 0,
                dividendIncome: 0,
                interestIncome: 0,
                fees: 0,
                taxes: 0
            };
            positions.set(key, position);
        }

        switch (transaction.type) {
            case InvestmentTransactionType.Purchase: {
                const quantity = requiredQuantity(transaction);
                const unitPrice = requiredUnitPrice(transaction).amount;
                position.lots.push({ remainingQuantity: quantity, unitCost: unitPrice });
                break;
            }
            case InvestmentTransactionType.Sale: {
                const quantity = requiredQuantity(transaction);
                const salePrice = requiredUnitPrice(transaction).amount;
                const cost = consumeFifoLots(position.lots, quantity);
                position.realizedGain += (salePrice * quantity) - cost;
                break;
            }
            case InvestmentTransactionType.Dividend:
                position.dividendIncome += transaction.cashAmount.amount;
                break;
            case InvestmentTransactionType.Interest:
                position.interestIncome += transaction.cashAmount.amount;
                break;
            case InvestmentTransactionType.Fee:
                position.fees += -transaction.cashAmount.amount;
                break;
            case InvestmentTransactionType.Tax:
                position.taxes += -transaction.cashAmount.amount;
                break;
            default: {
                const exhaustiveType: never = transaction.type;
                throw new RangeError(`Unsupported investment transaction type: ${String(exhaustiveType)}`);
            }
        }
    }

    const latestValuation = selectLatestValuations(valuations, instrumentById, asOfDate);
    return [...positions.values()]
        .map((position) => toPositionResult(position, latestValuation.get(position.instrument.id.toString())))
        .sort((left, right) =>
            left.instrumentName.localeCompare(right.instrumentName)
            || left.accountId.localeCompare(right.accountId)
        );
}

function selectLatestValuations(
    valuations: readonly InvestmentValuationObservation[],
    instruments: ReadonlyMap<string, InvestmentInstrument>,
    asOfDate: Date
): Map<string, InvestmentValuationObservation> {
    const selected = new Map<string, InvestmentValuationObservation>();
    for (const valuation of valuations) {
        const instrument = instruments.get(valuation.instrumentId);
        if (instrument === undefined) {
            throw new RangeError(`Valuation references unknown instrument "${valuation.instrumentId}".`);
        }
        if (!(valuation.price instanceof Money) || !Number.isFinite(valuation.price.amount)
            || valuation.price.amount < 0) {
            throw new RangeError('Investment valuation price must be a non-negative finite Money value.');
        }
        if (valuation.price.currency !== instrument.currency) {
            throw new RangeError('Investment valuation currency must match the instrument currency.');
        }
        if (!(valuation.asOf instanceof Date) || !Number.isFinite(valuation.asOf.getTime())
            || !(valuation.recordedAt instanceof Date) || !Number.isFinite(valuation.recordedAt.getTime())) {
            throw new RangeError('Investment valuation dates must be valid.');
        }
        const sourceType: unknown = valuation.sourceType;
        if (sourceType !== 'manual' && sourceType !== 'provider') {
            throw new RangeError('Investment valuation source type must be manual or provider.');
        }
        if (typeof valuation.sourceName !== 'string' || valuation.sourceName.trim().length === 0) {
            throw new RangeError('Investment valuation source name cannot be empty.');
        }
        // Both the valuation's effective date and the date it entered the
        // system must be visible at the requested point in time.
        if (valuation.asOf.getTime() > asOfDate.getTime()
            || valuation.recordedAt.getTime() > asOfDate.getTime()) {
            continue;
        }

        const current = selected.get(valuation.instrumentId);
        if (current === undefined
            || valuation.asOf.getTime() > current.asOf.getTime()
            || (valuation.asOf.getTime() === current.asOf.getTime()
                && valuation.recordedAt.getTime() > current.recordedAt.getTime())) {
            selected.set(valuation.instrumentId, valuation);
        }
    }
    return selected;
}

function toPositionResult(
    position: MutablePosition,
    valuation: InvestmentValuationObservation | undefined
): InvestmentLedgerPosition {
    const quantity = position.lots.reduce((total, lot) => total + lot.remainingQuantity, 0);
    const costBasisAmount = position.lots.reduce(
        (total, lot) => total + (lot.remainingQuantity * lot.unitCost),
        0
    );
    const currency = position.instrument.currency;
    const marketValueAmount = valuation === undefined
        ? null
        : quantity * valuation.price.amount;
    const costBasis = new Money(costBasisAmount, position.instrument.currency);

    return {
        accountId: position.account.id.toString(),
        instrumentId: position.instrument.id.toString(),
        instrumentName: position.instrument.name,
        currency,
        quantity: normalizeQuantity(quantity),
        openLotCount: position.lots.filter((lot) => lot.remainingQuantity > QUANTITY_TOLERANCE).length,
        costBasis,
        realizedGain: new Money(position.realizedGain, currency),
        dividendIncome: new Money(position.dividendIncome, currency),
        interestIncome: new Money(position.interestIncome, currency),
        fees: new Money(position.fees, currency),
        taxes: new Money(position.taxes, currency),
        marketPrice: valuation?.price ?? null,
        marketValue: marketValueAmount === null ? null : new Money(marketValueAmount, currency),
        unrealizedGain: marketValueAmount === null
            ? null
            : new Money(marketValueAmount - costBasisAmount, currency),
        valuationAsOf: valuation?.asOf.toISOString() ?? null,
        valuationSource: valuation?.sourceName ?? null,
        valuationSourceType: valuation?.sourceType ?? null
    };
}

function consumeFifoLots(lots: CostLot[], quantity: number): number {
    const available = lots.reduce((total, lot) => total + lot.remainingQuantity, 0);
    if (quantity - available > QUANTITY_TOLERANCE) {
        throw new RangeError('Investment sale quantity exceeds the available FIFO position.');
    }

    let remaining = quantity;
    let costBasis = 0;
    for (const lot of lots) {
        if (remaining <= QUANTITY_TOLERANCE) {
            break;
        }
        const consumed = Math.min(lot.remainingQuantity, remaining);
        costBasis += consumed * lot.unitCost;
        lot.remainingQuantity -= consumed;
        remaining -= consumed;
    }
    return costBasis;
}

function requiredQuantity(transaction: InvestmentTransaction): number {
    if (transaction.quantity === undefined) {
        throw new RangeError('Trade transaction is missing quantity.');
    }
    return transaction.quantity;
}

function requiredUnitPrice(transaction: InvestmentTransaction): Money {
    if (transaction.unitPrice === undefined) {
        throw new RangeError('Trade transaction is missing unit price.');
    }
    return transaction.unitPrice;
}

function assertUnique(values: readonly string[], label: string): void {
    if (new Set(values).size !== values.length) {
        throw new RangeError(`Investment ledger contains duplicate ${label} IDs.`);
    }
}

function positionKey(accountId: string, instrumentId: string): string {
    return `${accountId}::${instrumentId}`;
}

function normalizeQuantity(quantity: number): number {
    return Math.abs(quantity) <= QUANTITY_TOLERANCE ? 0 : quantity;
}
