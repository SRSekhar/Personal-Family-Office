import type { Identifier } from '@pfo/core';

import { Currency } from '../common/Currency.js';
import { NamedEntity } from '../common/NamedEntity.js';
import { InvestmentType } from './InvestmentType.js';

export interface InvestmentInstrumentIdentifiers {
    readonly symbol?: string;
    readonly exchange?: string;
    readonly isin?: string;
}

export class InvestmentInstrument extends NamedEntity {
    public readonly symbol: string | undefined;
    public readonly exchange: string | undefined;
    public readonly isin: string | undefined;

    public constructor(
        id: Identifier,
        name: string,
        public readonly type: InvestmentType,
        public readonly currency: Currency,
        identifiers: InvestmentInstrumentIdentifiers = {},
        description?: string
    ) {
        super(id, name, description);

        if (!Object.values(InvestmentType).includes(type)) {
            throw new RangeError('Investment instrument type is not supported.');
        }
        if (!Object.values(Currency).includes(currency)) {
            throw new RangeError('Investment instrument currency is not supported.');
        }

        this.symbol = normalizeOptional(identifiers.symbol, 'symbol');
        this.exchange = normalizeOptional(identifiers.exchange, 'exchange');
        this.isin = normalizeOptional(identifiers.isin, 'ISIN')?.toUpperCase();

        if (this.isin !== undefined && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(this.isin)) {
            throw new RangeError('ISIN must contain two country letters followed by ten alphanumeric characters.');
        }
    }
}

function normalizeOptional(value: string | undefined, label: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new RangeError(`${label} must be a non-empty string when provided.`);
    }
    return value.trim();
}
