import type { Identifier } from '@pfo/core';
import { Entity } from '@pfo/core';

import type { Asset } from '../assets/Asset.js';
import type { Investment } from '../investments/Investment.js';
import type { Liability } from '../liabilities/Liability.js';
import type { Property } from '../properties/Property.js';

export class Portfolio extends Entity {
    public constructor(
        id: Identifier,
        public readonly name: string,
        public readonly assets: readonly Asset[],
        public readonly investments: readonly Investment[],
        public readonly liabilities: readonly Liability[],
        public readonly properties: readonly Property[],
        public readonly description?: string
    ) {
        super(id);

        if (name.trim().length === 0) {
            throw new Error('Portfolio name cannot be empty.');
        }
    }

    public addAsset(asset: Asset): Portfolio {
        return new Portfolio(
            this.id,
            this.name,
            [...this.assets, asset],
            this.investments,
            this.liabilities,
            this.properties,
            this.description
        );
    }

    public addInvestment(
        investment: Investment
    ): Portfolio {
        return new Portfolio(
            this.id,
            this.name,
            this.assets,
            [...this.investments, investment],
            this.liabilities,
            this.properties,
            this.description
        );
    }

    public addLiability(
        liability: Liability
    ): Portfolio {
        return new Portfolio(
            this.id,
            this.name,
            this.assets,
            this.investments,
            [...this.liabilities, liability],
            this.properties,
            this.description
        );
    }

    public addProperty(
        property: Property
    ): Portfolio {
        return new Portfolio(
            this.id,
            this.name,
            this.assets,
            this.investments,
            this.liabilities,
            [...this.properties, property],
            this.description
        );
    }
}