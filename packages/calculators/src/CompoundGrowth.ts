/**
 * Timing for recurring contributions in a compound-growth projection.
 *
 * - end: contribution is added at the end of each period.
 * - beginning: contribution is added at the beginning of each period.
 */
export type ContributionTiming = 'beginning' | 'end';

/**
 * Inputs for a deterministic compound-growth projection.
 *
 * The annual rate is a decimal (0.07 means 7%). Periods and contributions
 * are annual. All monetary values must use the same currency and unit.
 */
export interface CompoundGrowthInput {
    readonly initialValue: number;
    readonly annualRate: number;
    readonly periods: number;
    readonly contributionPerPeriod?: number;
    readonly contributionTiming?: ContributionTiming;
}

export interface CompoundGrowthScheduleRow {
    readonly year: number;
    readonly projectedValue: number;
    readonly totalContributions: number;
    readonly estimatedGrowth: number;
}

/** Maximum supported annual rows in a browser-facing schedule. */
export const MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS = 100;

/**
 * Builds an annual breakdown by reusing the canonical projection calculation
 * for each year. The first row is year zero and contains only the initial value.
 *
 * @throws RangeError when the requested schedule exceeds the supported length
 * or any yearly total exceeds the supported numeric range.
 */
export function projectCompoundGrowthSchedule(input: CompoundGrowthInput): CompoundGrowthScheduleRow[] {
    if (!Number.isInteger(input.periods) || input.periods < 0) {
        throw new RangeError('periods must be a non-negative integer.');
    }
    if (input.periods > MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS) {
        throw new RangeError(`periods must not exceed ${String(MAX_COMPOUND_GROWTH_SCHEDULE_PERIODS)} for an annual schedule.`);
    }

    const rows: CompoundGrowthScheduleRow[] = [];
    for (let year = 0; year <= input.periods; year += 1) {
        const projectedValue = projectCompoundGrowth({ ...input, periods: year });
        const totalContributions = input.initialValue + (input.contributionPerPeriod ?? 0) * year;
        const estimatedGrowth = projectedValue - totalContributions;
        if (![totalContributions, estimatedGrowth].every(Number.isFinite)) {
            throw new RangeError('Growth projection totals exceed the supported numeric range.');
        }
        rows.push({ year, projectedValue, totalContributions, estimatedGrowth });
    }
    return rows;
}

/**
 * Projects the future value of an initial amount and optional recurring
 * contributions, compounded annually.
 *
 * This is a mathematical scenario calculator, not a forecast or guarantee.
 * It excludes taxes, fees, inflation, volatility, and changes in contribution
 * amounts. Callers must choose and disclose the assumptions they supply.
 *
 * @throws RangeError when inputs are non-finite, invalid, or the result
 * cannot be represented as a finite JavaScript number.
 */
export function projectCompoundGrowth({
    initialValue,
    annualRate,
    periods,
    contributionPerPeriod = 0,
    contributionTiming = 'end'
}: CompoundGrowthInput): number {
    assertFiniteNonNegative('initialValue', initialValue);
    assertFiniteNonNegative('contributionPerPeriod', contributionPerPeriod);

    if (!Number.isFinite(annualRate) || annualRate <= -1) {
        throw new RangeError('annualRate must be a finite decimal greater than -1.');
    }

    if (!Number.isInteger(periods) || periods < 0) {
        throw new RangeError('periods must be a non-negative integer.');
    }

    const allowedContributionTimings: readonly string[] = ['beginning', 'end'];
    if (!allowedContributionTimings.includes(contributionTiming)) {
        throw new RangeError('contributionTiming must be "beginning" or "end".');
    }

    if (periods === 0) {
        return initialValue;
    }

    const logarithmicGrowth = periods * Math.log1p(annualRate);
    const growthFactor = Math.exp(logarithmicGrowth);

    let contributionFactor: number;

    if (annualRate === 0) {
        contributionFactor = periods;
    } else {
        // expm1/log1p improves precision when the annual rate is close to zero.
        contributionFactor = Math.expm1(logarithmicGrowth) / annualRate;
    }

    if (contributionTiming === 'beginning') {
        contributionFactor *= 1 + annualRate;
    }

    const projectedValue = (initialValue * growthFactor) +
        (contributionPerPeriod * contributionFactor);

    if (!Number.isFinite(projectedValue)) {
        throw new RangeError('The projected value is outside the supported numeric range.');
    }

    return projectedValue;
}

function assertFiniteNonNegative(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite number greater than or equal to zero.`);
    }
}
