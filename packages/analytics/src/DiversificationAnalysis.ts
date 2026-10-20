import type { AssetAllocationResult } from '@pfo/calculators';

export interface DiversificationAnalysisResult {
    readonly categoryCount: number;
    /** Herfindahl–Hirschman Index: sum of squared category weights. Null for an empty allocation. */
    readonly concentrationIndex: number | null;
    /** Reciprocal of the concentration index. Null for an empty allocation. */
    readonly effectiveCategoryCount: number | null;
    /** Largest supplied category weight, from 0 through 1. Null for an empty allocation. */
    readonly largestCategoryShare: number | null;
}

/**
 * Measures concentration within the categories already present in an asset allocation.
 *
 * This is not correlation-aware portfolio diversification, a risk score, or a
 * recommendation. The caller is responsible for selecting non-duplicated
 * holdings and meaningful categories before calculating asset allocation.
 */
export function analyzeDiversification(
    allocation: AssetAllocationResult | null | undefined
): DiversificationAnalysisResult {
    if (allocation === null || allocation === undefined || typeof allocation !== 'object') {
        throw new TypeError('An asset allocation result is required.');
    }

    const { currency, totalValue, allocations } = allocation;
    if (!isMoneyLike(totalValue) || totalValue.currency !== currency || totalValue.amount < 0
        || !Array.isArray(allocations)) {
        throw new RangeError('Asset allocation must contain a valid total and category list in one currency.');
    }

    if (allocations.length === 0) {
        if (totalValue.amount !== 0) {
            throw new RangeError('An empty allocation must have a zero total value.');
        }
        return {
            categoryCount: 0,
            concentrationIndex: null,
            effectiveCategoryCount: null,
            largestCategoryShare: null
        };
    }

    if (totalValue.amount <= 0) {
        throw new RangeError('A non-empty allocation must have a positive total value.');
    }

    const seenCategories = new Set<string>();
    let valueTotal = 0;
    let weightTotal = 0;
    let concentrationIndex = 0;
    let largestCategoryShare = 0;

    for (const item of allocations) {
        if (!item || typeof item.category !== 'string' || item.category.trim() === '') {
            throw new RangeError('Every allocation category must have a non-empty name.');
        }
        const category = item.category.trim();
        if (seenCategories.has(category)) {
            throw new RangeError(`Duplicate allocation category "${category}".`);
        }
        seenCategories.add(category);

        if (!isMoneyLike(item.value) || item.value.currency !== currency || item.value.amount < 0
            || !Number.isFinite(item.weight) || item.weight < 0 || item.weight > 1) {
            throw new RangeError('Allocation category values and weights must be finite, non-negative, and use one currency.');
        }

        valueTotal += item.value.amount;
        weightTotal += item.weight;
        concentrationIndex += item.weight * item.weight;
        largestCategoryShare = Math.max(largestCategoryShare, item.weight);
    }

    const amountTolerance = Number.EPSILON * Math.max(1, Math.abs(totalValue.amount), Math.abs(valueTotal))
        * Math.max(4, allocations.length * 2);
    const weightTolerance = Number.EPSILON * Math.max(8, allocations.length * 4);
    if (Math.abs(valueTotal - totalValue.amount) > amountTolerance
        || Math.abs(weightTotal - 1) > weightTolerance) {
        throw new RangeError('Allocation category values and weights must reconcile to the total.');
    }

    const effectiveCategoryCount = 1 / concentrationIndex;
    if (!Number.isFinite(concentrationIndex) || !Number.isFinite(effectiveCategoryCount)) {
        throw new RangeError('Diversification metrics exceed the supported numeric range.');
    }

    return {
        categoryCount: allocations.length,
        concentrationIndex,
        effectiveCategoryCount,
        largestCategoryShare
    };
}

function isMoneyLike(value: unknown): value is { readonly amount: number; readonly currency: unknown } {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as { readonly amount?: unknown; readonly currency?: unknown };
    return typeof candidate.amount === 'number' && Number.isFinite(candidate.amount)
        && 'currency' in candidate;
}
