import { calculateFireReadiness, type FireReadinessInput, type FireReadinessResult } from './FireReadiness.js';
import { projectCompoundGrowth } from './CompoundGrowth.js';

/**
 * Assumptions for solving the constant annual contribution needed to reach
 * the caller's FIRE target by retirement.
 *
 * All monetary inputs must use the same currency and unit. Rates are nominal
 * annual decimals. Contributions are constant in nominal terms.
 */
export interface RequiredFireContributionInput {
    readonly currentPortfolio: number;
    readonly yearsToRetirement: number;
    readonly expectedAnnualReturn: number;
    readonly annualInflationRate: number;
    readonly annualRetirementSpendingToday: number;
    readonly withdrawalRate: number;
    readonly contributionTiming?: FireReadinessInput['contributionTiming'];
}

/** Required contribution and the resulting deterministic readiness scenario. */
export interface RequiredFireContributionResult {
    /** Constant annual contribution required under the supplied assumptions. */
    readonly requiredAnnualContribution: number;
    /** Existing FIRE scenario result evaluated with the solved contribution. */
    readonly readiness: FireReadinessResult;
}

/**
 * Solves the constant annual contribution needed for the projected portfolio
 * to reach the inflation-adjusted FIRE target at retirement.
 *
 * Uses the existing calculator for input validation and target calculation,
 * then solves the contribution linearly from the compound-growth contribution
 * factor. If the current portfolio alone is sufficient under the assumptions,
 * the required contribution is zero.
 *
 * This deterministic result is not a forecast, investment recommendation, or
 * guarantee. It excludes taxes, fees, volatility, sequence-of-returns risk,
 * changing contributions, pension/benefit income, and longevity adjustments.
 *
 * @throws RangeError when inputs are invalid, numeric limits are exceeded, or
 * a shortfall cannot be closed because there are zero years until retirement.
 */
export function calculateRequiredFireContribution({
    currentPortfolio,
    yearsToRetirement,
    expectedAnnualReturn,
    annualInflationRate,
    annualRetirementSpendingToday,
    withdrawalRate,
    contributionTiming = 'end'
}: RequiredFireContributionInput): RequiredFireContributionResult {
    const baselineInput: FireReadinessInput = {
        currentPortfolio,
        annualContribution: 0,
        yearsToRetirement,
        expectedAnnualReturn,
        annualInflationRate,
        annualRetirementSpendingToday,
        withdrawalRate,
        contributionTiming
    };
    const baseline = calculateFireReadiness(baselineInput);

    if (baseline.isOnTrack) {
        return {
            requiredAnnualContribution: 0,
            readiness: baseline
        };
    }

    if (yearsToRetirement === 0) {
        throw new RangeError(
            'A FIRE target shortfall cannot be closed with future contributions when yearsToRetirement is zero.'
        );
    }

    const contributionFactor = projectCompoundGrowth({
        initialValue: 0,
        annualRate: expectedAnnualReturn,
        periods: yearsToRetirement,
        contributionPerPeriod: 1,
        contributionTiming
    });
    const shortfall = baseline.targetCorpusAtRetirement - baseline.projectedPortfolioAtRetirement;
    const solvedContribution = shortfall / contributionFactor;

    if (!Number.isFinite(solvedContribution) || solvedContribution < 0) {
        throw new RangeError('The required annual contribution is outside the supported numeric range.');
    }

    // Add a tiny relative rounding cushion so floating-point arithmetic does
    // not report a false shortfall for a mathematically exact solution.
    const requiredAnnualContribution = solvedContribution === 0
        ? 0
        : solvedContribution + (Math.abs(solvedContribution) * 1e-12);
    const readiness = calculateFireReadiness({
        ...baselineInput,
        annualContribution: requiredAnnualContribution
    });

    if (!readiness.isOnTrack) {
        throw new RangeError('The required annual contribution could not be represented accurately enough.');
    }

    return {
        requiredAnnualContribution,
        readiness
    };
}
