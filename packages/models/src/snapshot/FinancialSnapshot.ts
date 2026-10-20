import type { Identifier } from '@pfo/core';
import { Entity } from '@pfo/core';

import { Money } from '../common/Money.js';
import { Portfolio } from '../portfolio/Portfolio.js';

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

        if (!(portfolio instanceof Portfolio)) {
            throw new TypeError('A portfolio is required for a financial snapshot.');
        }
        if (!(capturedOn instanceof Date) || !Number.isFinite(capturedOn.getTime())) {
            throw new RangeError('Snapshot capture date must be a valid date.');
        }
        if (!(totalAssets instanceof Money) || !(totalLiabilities instanceof Money) || !(netWorth instanceof Money)) {
            throw new TypeError('Snapshot totals must be valid Money values.');
        }
        if (totalAssets.currency !== totalLiabilities.currency || totalAssets.currency !== netWorth.currency) {
            throw new RangeError('Snapshot totals must use the same currency.');
        }
        if (totalAssets.amount < 0 || totalLiabilities.amount < 0) {
            throw new RangeError('Snapshot assets and liabilities must be non-negative.');
        }

        const expectedNetWorth = totalAssets.amount - totalLiabilities.amount;
        const tolerance = Number.EPSILON * Math.max(
            1,
            Math.abs(totalAssets.amount),
            Math.abs(totalLiabilities.amount),
            Math.abs(netWorth.amount)
        ) * 4;
        if (!Number.isFinite(expectedNetWorth) || Math.abs(netWorth.amount - expectedNetWorth) > tolerance) {
            throw new RangeError('Snapshot net worth must equal total assets minus total liabilities.');
        }
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
