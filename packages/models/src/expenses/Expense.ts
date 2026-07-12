import { Entity, Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';

export class Expense extends Entity {
    public constructor(
        id: Identifier,
        public readonly category: string,
        public readonly amount: Money,
        public readonly recurring: boolean,
        public readonly description?: string
    ) {
        super(id);

        if (category.trim().length === 0) {
            throw new Error('Expense category cannot be empty.');
        }
    }

    public updateAmount(amount: Money): Expense {
        return new Expense(
            this.id,
            this.category,
            amount,
            this.recurring,
            this.description
        );
    }
}