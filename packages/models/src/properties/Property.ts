import { Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';
import { PropertyType } from './PropertyType.js';

export class Property extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly type: PropertyType,
        public readonly marketValue: Money,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateMarketValue(
        value: Money
    ): Property {
        return new Property(
            this.id,
            this.name,
            this.type,
            value,
            this.description
        );
    }
}