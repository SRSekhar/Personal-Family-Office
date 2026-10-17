import { projectCompoundGrowth, type ContributionTiming } from './CompoundGrowth.js';

/**
 * Inputs for a deterministic financial-independence readiness scenario.
 *
 * Monetary inputs must use the same currency and unit. Rates are decimals:
 * 0.07 means 7%. Return and inflation rates are nominal annual assumptions.
 * Annual contributions are held constant in nominal terms and are added at
 * the selected point in each year.
 */
export interface FireReadinessInput {
    /** Current investable portfolio value, excluding illiquid assets unless the caller intends to spend them. */
    readonly currentPortfolio: number;
    /** Constant annual contribution, in the same monetary unit as currentPortfolio. */
    readonly annualContribution: number;
    /** Whole years until retirement. */
    readonly yearsToRetirement: number;
    /** Assumed nominal annual portfolio return, as a decimal greater than -1. */
    readonly expectedAnnualReturn: number;
    /** Assumed annual inflation rate, as a non-negative decimal. */
    readonly annualInflationRate: number;
    /** Annual retirement spending expressed in today's monetary terms. */
    readonly annualRetirementSpendingToday: number;
    /** Assumed initial withdrawal rate, as a decimal greater than 0 and at most 1. */
    readonly withdrawalRate: number;
    readonly contributionTiming?: ContributionTiming;
}

/**
 * Results of the deterministic financial-independence readiness scenario.
 *
 * A positive surplusOrShortfall means the projected portfolio exceeds the
 * target corpus; a negative value means a shortfall. This is a scenario
 * calculation, not a forecast, recommendation, or guarantee.
 */
export interface FireReadinessResult {
    readonly yearsToRetirement: number;
    readonly projectedPortfolioAtRetirement: number;
    readonly projectedAnnualRetirementSpending: number;
    readonly targetCorpusAtRetirement: number;
    readonly surplusOrShortfall: number;
    readonly isOnTrack: boolean;
    readonly contributionTiming: ContributionTiming;
}

/**
 * Estimates whether a portfolio may reach a target corpus by retirement.
 *
 * The target corpus is projected annual retirement spending divided by the
 * caller-supplied withdrawal rate. Portfolio growth uses nominal return and
 * constant nominal annual contributions; spending is inflated separately.
 *
 * Excludes taxes, fees, investment volatility, sequence-of-returns risk,
 * changing contributions, pension/benefit income, and longevity adjustments.
 * Callers must choose and disclose assumptions. This is not financial advice.
 *
 * @throws RangeError when an input is invalid or a result exceeds the finite
 * JavaScript number range.
 */
export function calculateFireReadiness({
    currentPortfolio,
    annualContribution,
    yearsToRetirement,
    expectedAnnualReturn,
    annualInflationRate,
    annualRetirementSpendingToday,
    withdrawalRate,
    contributionTiming = 'end'
}: FireReadinessInput): FireReadinessResult {
    assertFiniteNonNegative('currentPortfolio', currentPortfolio);
    assertFiniteNonNegative('annualContribution', annualContribution);
    assertFiniteNonNegative('annualRetirementSpendingToday', annualRetirementSpendingToday);

    if (!Number.isInteger(yearsToRetirement) || yearsToRetirement < 0) {
        throw new RangeError('yearsToRetirement must be a non-negative integer.');
    }

    if (!Number.isFinite(expectedAnnualReturn) || expectedAnnualReturn <= -1) {
        throw new RangeError('expectedAnnualReturn must be a finite decimal greater than -1.');
    }

    if (!Number.isFinite(annualInflationRate) || annualInflationRate < 0) {
        throw new RangeError('annualInflationRate must be a finite non-negative decimal.');
    }

    if (!Number.isFinite(withdrawalRate) || withdrawalRate <= 0 || withdrawalRate > 1) {
        throw new RangeError('withdrawalRate must be a finite decimal greater than 0 and at most 1.');
    }

    const projectedPortfolioAtRetirement = projectCompoundGrowth({
        initialValue: currentPortfolio,
        annualRate: expectedAnnualReturn,
        periods: yearsToRetirement,
        contributionPerPeriod: annualContribution,
        contributionTiming
    });

    // Preserve the exact zero-spending result without evaluating an inflation
    // factor that may overflow for extreme (but finite) assumptions.
    const projectedAnnualRetirementSpending = annualRetirementSpendingToday === 0
        ? 0
        : annualRetirementSpendingToday * Math.exp(yearsToRetirement * Math.log1p(annualInflationRate));
    const targetCorpusAtRetirement = projectedAnnualRetirementSpending / withdrawalRate;
    const surplusOrShortfall = projectedPortfolioAtRetirement - targetCorpusAtRetirement;

    if (![projectedAnnualRetirementSpending, targetCorpusAtRetirement, surplusOrShortfall].every(Number.isFinite)) {
        throw new RangeError('The FIRE readiness result is outside the supported numeric range.');
    }

    return {
        yearsToRetirement,
        projectedPortfolioAtRetirement,
        projectedAnnualRetirementSpending,
        targetCorpusAtRetirement,
        surplusOrShortfall,
        isOnTrack: surplusOrShortfall >= 0,
        contributionTiming
    };
}

function assertFiniteNonNegative(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite number greater than or equal to zero.`);
    }
}
