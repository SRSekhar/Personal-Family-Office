import { Money } from '@pfo/models';

import type { Calculator } from '../common/Calculator.js';

import type { NetWorthCalculationInput } from './NetWorthCalculationInput.js';
import { NetWorthCalculationResult } from './NetWorthCalculationResult.js';

export class NetWorthCalculator
    implements Calculator<NetWorthCalculationInput, NetWorthCalculationResult> {

    public calculate(
        input: NetWorthCalculationInput
    ): NetWorthCalculationResult {

        const portfolio = input.portfolio;

        const totalAssets = this.sumAssets(portfolio);

        const totalLiabilities = this.sumLiabilities(portfolio);

        const netWorth = totalAssets.subtract(totalLiabilities);

        return new NetWorthCalculationResult(
            totalAssets,
            totalLiabilities,
            netWorth
        );
    }

    private sumAssets(
        portfolio: NetWorthCalculationInput['portfolio']
    ): Money {

        let total = Money.zero();

        for (const asset of portfolio.assets) {
            total = total.add(asset.value);
        }

        for (const investment of portfolio.investments) {
            total = total.add(investment.currentValue);
        }

        for (const property of portfolio.properties) {
            total = total.add(property.marketValue);
        }

        return total;
    }

    private sumLiabilities(
        portfolio: NetWorthCalculationInput['portfolio']
    ): Money {

        let total = Money.zero();

        for (const liability of portfolio.liabilities) {
            total = total.add(
                liability.outstandingAmount
            );
        }

        return total;
    }
}