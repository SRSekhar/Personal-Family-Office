import type { Identifier } from '@pfo/core';
import { Entity } from '@pfo/core';

import type { Money } from '../common/Money.js';
import type { Portfolio } from '../portfolio/Portfolio.js';

export class FinancialSnapshot extends Entity {
    public constructor(
        id: Identifier,
        public readonly portfolio: Portfolio,
        public readonly capturedOn: Date,
        public readonly totalAssets: Money,
        public readonly totalLiabilities: Money,
        public readonly netWorth: Money
    ) {
        super(id);
    }

    public static create(
        id: Identifier,
        portfolio: Portfolio,
        capturedOn: Date,
        totalAssets: Money,
        totalLiabilities: Money
    ): FinancialSnapshot {

        const netWorth = totalAssets.subtract(totalLiabilities);

        return new FinancialSnapshot(
            id,
            portfolio,
            capturedOn,
            totalAssets,
            totalLiabilities,
            netWorth
        );
    }
}