import type { Portfolio } from '@pfo/models';

export class AssetAllocationCalculationInput {
    public constructor(
        public readonly portfolio: Portfolio
    ) {}
}