import { Entity, Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';

export class Income extends Entity {
    public constructor(
        id: Identifier,
        public readonly source: string,
        public readonly amount: Money,
        public readonly recurring: boolean,
        public readonly description?: string
    ) {
        super(id);

        if (source.trim().length === 0) {
            throw new Error('Income source cannot be empty.');
        }
    }

    public updateAmount(amount: Money): Income {
        return new Income(
            this.id,
            this.source,
            amount,
            this.recurring,
            this.description
        );
    }
}