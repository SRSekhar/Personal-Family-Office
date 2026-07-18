import type { Portfolio } from '@pfo/models';

export class NetWorthCalculationInput {
    public constructor(
        public readonly portfolio: Portfolio
    ) {}
}