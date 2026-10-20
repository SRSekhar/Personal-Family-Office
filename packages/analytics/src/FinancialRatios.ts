import type { NetWorthResult } from '@pfo/calculators';

export interface FinancialRatiosResult {
    /** Total liabilities divided by total assets; null when total assets are zero. */
    readonly liabilitiesToAssets: number | null;
    /** Net worth divided by total assets; null when total assets are zero. */
    readonly netWorthToAssets: number | null;
    /** Total assets divided by total liabilities; null when total liabilities are zero. */
    readonly assetsToLiabilities: number | null;
}

/**
 * Calculates descriptive balance-sheet ratios from a reconciled net-worth result.
 *
 * Ratios are dimensionless numbers, not percentages. Zero denominators produce
 * null rather than Infinity or an invented zero. No thresholds, forecasts, or
 * recommendations are inferred.
 */
export function calculateFinancialRatios(
    netWorth: NetWorthResult | null | undefined
): FinancialRatiosResult {
    if (netWorth === null || netWorth === undefined || typeof netWorth !== 'object') {
        throw new TypeError('A net-worth result is required.');
    }

    const { currency, totalAssets, totalLiabilities, netWorth: netWorthAmount } = netWorth;
    const values: unknown[] = [totalAssets, totalLiabilities, netWorthAmount];
    if (values.some((value) => !isMoneyLike(value) || value.currency !== currency)) {
        throw new RangeError('Financial ratio inputs must contain finite amounts in one currency.');
    }
    if (totalAssets.amount < 0 || totalLiabilities.amount < 0) {
        throw new RangeError('Total assets and total liabilities must be non-negative.');
    }

    const expectedNetWorth = totalAssets.amount - totalLiabilities.amount;
    const tolerance = Number.EPSILON * Math.max(
        1,
        Math.abs(totalAssets.amount),
        Math.abs(totalLiabilities.amount),
        Math.abs(netWorthAmount.amount)
    ) * 4;
    if (Math.abs(netWorthAmount.amount - expectedNetWorth) > tolerance) {
        throw new RangeError('Net worth must equal total assets minus total liabilities.');
    }

    return {
        liabilitiesToAssets: divideOrNull(totalLiabilities.amount, totalAssets.amount),
        netWorthToAssets: divideOrNull(netWorthAmount.amount, totalAssets.amount),
        assetsToLiabilities: divideOrNull(totalAssets.amount, totalLiabilities.amount)
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

function divideOrNull(numerator: number, denominator: number): number | null {
    if (denominator === 0) {
        return null;
    }
    const result = numerator / denominator;
    if (!Number.isFinite(result)) {
        throw new RangeError('Financial ratio exceeds the supported numeric range.');
    }
    return result;
}
