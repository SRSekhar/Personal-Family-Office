import type { Money, Percentage } from '@pfo/models';

export class AssetAllocationItem {
    public constructor(
        public readonly category: string,
        public readonly amount: Money,
        public readonly allocation: Percentage
    ) {}
}