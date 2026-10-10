import { Currency, Money } from '@pfo/models';

import {
    validateFinancialPositions,
    type FinancialPositionContext
} from './FinancialPosition.js';

export interface NetWorthInput extends FinancialPositionContext {}

export interface NetWorthResult {
    readonly currency: Currency;
    readonly totalAssets: Money;
    readonly totalLiabilities: Money;
    readonly netWorth: Money;
}

/**
 * Calculates net worth from canonical, non-duplicated financial positions.
 *
 * All values must already be expressed in the requested currency. This
 * function intentionally performs no foreign-exchange conversion and does
 * not infer whether records in different source systems describe the same
 * economic holding.
 */
export function calculateNetWorth({
    currency,
    positions
}: NetWorthInput): NetWorthResult {
    validateFinancialPositions({ currency, positions });

    let totalAssets = Money.zero(currency);
    let totalLiabilities = Money.zero(currency);

    for (const position of positions) {
        if (position.kind === 'asset') {
            totalAssets = totalAssets.add(position.value);
        } else {
            totalLiabilities = totalLiabilities.add(position.value);
        }
    }

    return {
        currency,
        totalAssets,
        totalLiabilities,
        netWorth: totalAssets.subtract(totalLiabilities)
    };
}
