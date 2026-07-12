import { Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';
import { InsuranceType } from './InsuranceType.js';

export class Insurance extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly type: InsuranceType,
        public readonly annualPremium: Money,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateAnnualPremium(
        premium: Money
    ): Insurance {
        return new Insurance(
            this.id,
            this.name,
            this.type,
            premium,
            this.description
        );
    }
}