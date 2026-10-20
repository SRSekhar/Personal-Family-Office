export interface PeriodReturn {
    /** Calendar date for this return observation, in YYYY-MM-DD form. */
    readonly date: string;
    /** Simple period return as a decimal fraction; 0.05 represents +5%. */
    readonly returnRate: number;
}

export interface RiskAnalysisInput {
    readonly observations: readonly PeriodReturn[];
    /** Number of regular return periods represented by one year (for example, 12 for monthly). */
    readonly periodsPerYear: number;
    /** Optional risk-free return per period as a decimal fraction; required to calculate an annualized Sharpe ratio. */
    readonly riskFreeRatePerPeriod?: number;
}

export interface RiskAnalysisResult {
    readonly observationCount: number;
    /** Sample standard deviation of returns annualized by sqrt(periodsPerYear); null with fewer than two observations. */
    readonly annualizedVolatility: number | null;
    /** Largest peak-to-trough decline in the compounded wealth index; null when no observations exist. */
    readonly maximumDrawdown: number | null;
    /** Lowest observed simple period return; null when no observations exist. */
    readonly worstPeriodReturn: number | null;
    /** Annualized Sharpe ratio; null without a risk-free rate, two observations, or non-zero excess-return volatility. */
    readonly annualizedSharpeRatio: number | null;
    readonly negativePeriodCount: number;
}

/**
 * Calculates descriptive historical-return risk metrics from caller-supplied
 * observations. Observations must be chronologically ordered and represent
 * regular intervals consistent with periodsPerYear. No market data is fetched,
 * and the result is not a forecast, risk rating, or investment recommendation.
 */
export function analyzeReturnSeries(
    input: RiskAnalysisInput | null | undefined
): RiskAnalysisResult {
    if (input === null || input === undefined || typeof input !== 'object') {
        throw new TypeError('A return-series input is required.');
    }

    const { observations, periodsPerYear, riskFreeRatePerPeriod } = input;
    if (!Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
        throw new RangeError('Periods per year must be a positive integer.');
    }
    if (riskFreeRatePerPeriod !== undefined
        && (!Number.isFinite(riskFreeRatePerPeriod) || riskFreeRatePerPeriod < -1)) {
        throw new RangeError('Risk-free return per period must be finite and greater than or equal to -1.');
    }
    if (!Array.isArray(observations)) {
        throw new TypeError('Return observations must be an array.');
    }

    let previousDate: string | null = null;
    let wealthIndex = 1;
    let peakWealth = 1;
    let maximumDrawdown = 0;
    let worstPeriodReturn = Number.POSITIVE_INFINITY;
    let negativePeriodCount = 0;
    const returns: number[] = [];

    for (const rawObservation of observations as readonly unknown[]) {
        if (typeof rawObservation !== 'object' || rawObservation === null) {
            throw new RangeError('Every return observation must be an object.');
        }
        const observation = rawObservation as { readonly date?: unknown; readonly returnRate?: unknown };
        if (typeof observation.date !== 'string' || !isValidDate(observation.date)) {
            throw new RangeError('Every return observation must have a valid YYYY-MM-DD date.');
        }
        if (previousDate !== null && observation.date <= previousDate) {
            throw new RangeError('Return observations must have unique dates in ascending order.');
        }
        if (typeof observation.returnRate !== 'number' || !Number.isFinite(observation.returnRate)
            || observation.returnRate < -1) {
            throw new RangeError('Period returns must be finite decimal values greater than or equal to -1.');
        }

        previousDate = observation.date;
        returns.push(observation.returnRate);
        worstPeriodReturn = Math.min(worstPeriodReturn, observation.returnRate);
        if (observation.returnRate < 0) {
            negativePeriodCount += 1;
        }

        wealthIndex *= 1 + observation.returnRate;
        if (!Number.isFinite(wealthIndex)) {
            throw new RangeError('Compounded wealth index exceeds the supported numeric range.');
        }
        peakWealth = Math.max(peakWealth, wealthIndex);
        maximumDrawdown = Math.max(maximumDrawdown, peakWealth === 0 ? 0 : 1 - wealthIndex / peakWealth);
    }

    const annualizedVolatility = returns.length < 2
        ? null
        : calculateAnnualizedSampleVolatility(returns, periodsPerYear);
    const annualizedSharpeRatio = riskFreeRatePerPeriod === undefined || returns.length < 2
        ? null
        : calculateAnnualizedSharpeRatio(returns, riskFreeRatePerPeriod, periodsPerYear);

    return {
        observationCount: returns.length,
        annualizedVolatility,
        maximumDrawdown: returns.length === 0 ? null : maximumDrawdown,
        worstPeriodReturn: returns.length === 0 ? null : worstPeriodReturn,
        annualizedSharpeRatio,
        negativePeriodCount
    };
}

function calculateAnnualizedSampleVolatility(returns: readonly number[], periodsPerYear: number): number {
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const squaredDeviationTotal = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    const sampleVariance = squaredDeviationTotal / (returns.length - 1);
    const annualizedVolatility = Math.sqrt(sampleVariance) * Math.sqrt(periodsPerYear);
    if (!Number.isFinite(annualizedVolatility)) {
        throw new RangeError('Annualized volatility exceeds the supported numeric range.');
    }
    return annualizedVolatility;
}

function calculateAnnualizedSharpeRatio(
    returns: readonly number[],
    riskFreeRatePerPeriod: number,
    periodsPerYear: number
): number | null {
    const excessReturns = returns.map((value) => value - riskFreeRatePerPeriod);
    const meanExcessReturn = excessReturns.reduce((sum, value) => sum + value, 0) / excessReturns.length;
    const squaredDeviationTotal = excessReturns.reduce((sum, value) => sum + (value - meanExcessReturn) ** 2, 0);
    const sampleVariance = squaredDeviationTotal / (excessReturns.length - 1);
    const sampleStandardDeviation = Math.sqrt(sampleVariance);
    if (!Number.isFinite(meanExcessReturn) || !Number.isFinite(sampleStandardDeviation)) {
        throw new RangeError('Sharpe ratio inputs exceed the supported numeric range.');
    }
    if (sampleStandardDeviation === 0) {
        return null;
    }

    const ratio = (meanExcessReturn / sampleStandardDeviation) * Math.sqrt(periodsPerYear);
    if (!Number.isFinite(ratio)) {
        throw new RangeError('Annualized Sharpe ratio exceeds the supported numeric range.');
    }
    return ratio;
}

function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
