import type { Identifier } from '@pfo/core';

import type { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';
import type { LiabilityType } from './LiabilityType.js';

export class Liability extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly type: LiabilityType,
        public readonly outstandingAmount: Money,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateOutstandingAmount(
        amount: Money
    ): Liability {
        return new Liability(
            this.id,
            this.name,
            this.type,
            amount,
            this.description
        );
    }
}