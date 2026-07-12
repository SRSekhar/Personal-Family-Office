import type { Identifier } from '@pfo/core';

import type { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';
import type { InvestmentType } from './InvestmentType.js';

export class Investment extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly type: InvestmentType,
        public readonly currentValue: Money,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateCurrentValue(
        value: Money
    ): Investment {
        return new Investment(
            this.id,
            this.name,
            this.type,
            value,
            this.description
        );
    }
}