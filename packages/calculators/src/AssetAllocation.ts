import { Currency, Money } from '@pfo/models';

import {
    validateFinancialPositions,
    type FinancialPositionContext
} from './FinancialPosition.js';

export interface AssetAllocationInput extends FinancialPositionContext {}

export interface AssetAllocationCategory {
    readonly category: string;
    readonly value: Money;
    /** Fraction of total assets, from 0 through 1. */
    readonly weight: number;
}

export interface AssetAllocationResult {
    readonly currency: Currency;
    readonly totalValue: Money;
    readonly allocations: readonly AssetAllocationCategory[];
}

/**
 * Groups asset positions by category and calculates each category's share.
 *
 * Liability positions are validated but excluded from allocation. Categories
 * are trimmed and sorted lexicographically so output is stable across runs.
 * If there are no asset positions, an empty allocation and zero total are
 * returned. If asset positions exist but their total is zero, a RangeError is
 * thrown because category weights would be undefined.
 */
export function calculateAssetAllocation({
    currency,
    positions
}: AssetAllocationInput): AssetAllocationResult {
    validateFinancialPositions({ currency, positions });

    const assetPositions = positions.filter((position) => position.kind === 'asset');
    const categoryTotals = new Map<string, Money>();
    let totalValue = Money.zero(currency);

    for (const position of assetPositions) {
        const category = position.category.trim();
        const currentValue = categoryTotals.get(category) ?? Money.zero(currency);
        categoryTotals.set(category, currentValue.add(position.value));
        totalValue = totalValue.add(position.value);
    }

    if (assetPositions.length > 0 && totalValue.amount === 0) {
        throw new RangeError('Asset allocation requires a positive total asset value.');
    }

    const allocations = [...categoryTotals.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([category, value]) => ({
            category,
            value,
            weight: value.amount / totalValue.amount
        }));

    return {
        currency,
        totalValue,
        allocations
    };
}
