import type { Identifier } from '@pfo/core';

import type { Money } from '../common/Money.js';
import { NamedEntity } from '../common/NamedEntity.js';
import type { AssetType } from './AssetType.js';

export class Asset extends NamedEntity {
    public constructor(
        id: Identifier,
        name: string,
        public readonly type: AssetType,
        public readonly value: Money,
        description?: string
    ) {
        super(
            id,
            name,
            description
        );
    }

    public updateValue(value: Money): Asset {
        return new Asset(
            this.id,
            this.name,
            this.type,
            value,
            this.description
        );
    }
}