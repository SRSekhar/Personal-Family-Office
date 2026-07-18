import type { Money } from '@pfo/models';

export class NetWorthCalculationResult {
    public constructor(
        public readonly totalAssets: Money,
        public readonly totalLiabilities: Money,
        public readonly netWorth: Money
    ) {}
}