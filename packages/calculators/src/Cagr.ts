/**
 * Inputs for an annualized compound growth calculation.
 *
 * Values must use the same unit and currency. The period count is commonly
 * expressed in years when calculating CAGR.
 */
export interface CagrInput {
    readonly beginningValue: number;
    readonly endingValue: number;
    readonly periods: number;
}

/**
 * Calculates the compound annual growth rate (CAGR).
 *
 * @returns A decimal rate, where 0.1 represents 10%.
 * @throws RangeError when a value is non-finite, either value is not positive,
 * or the period count is not positive.
 *
 * This function is deterministic and has no side effects. It does not account
 * for deposits, withdrawals, taxes, fees, inflation, or interim cash flows.
 */
export function calculateCagr({
    beginningValue,
    endingValue,
    periods
}: CagrInput): number {
    assertFinitePositive('beginningValue', beginningValue);
    assertFinitePositive('endingValue', endingValue);

    if (!Number.isFinite(periods) || periods <= 0) {
        throw new RangeError('periods must be a finite number greater than zero.');
    }

    // Using a difference of logarithms avoids overflowing endingValue / beginningValue.
    const logarithmicGrowth = (Math.log(endingValue) - Math.log(beginningValue)) / periods;
    const rate = Math.expm1(logarithmicGrowth);

    if (!Number.isFinite(rate)) {
        throw new RangeError('The calculated CAGR is outside the supported numeric range.');
    }

    return rate;
}

function assertFinitePositive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite number greater than zero.`);
    }
}
