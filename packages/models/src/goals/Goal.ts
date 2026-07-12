import { Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';

export class Goal extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly targetAmount: Money,
        public readonly targetDate: Date,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateTargetAmount(
        amount: Money
    ): Goal {
        return new Goal(
            this.id,
            this.name,
            amount,
            this.targetDate,
            this.description
        );
    }

    public updateTargetDate(
        targetDate: Date
    ): Goal {
        return new Goal(
            this.id,
            this.name,
            this.targetAmount,
            targetDate,
            this.description
        );
    }
}