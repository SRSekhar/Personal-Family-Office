const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;
const RATE_TOLERANCE = 1e-12;
const MAX_BISECTION_ITERATIONS = 200;
const MAX_BRACKET_EXPANSIONS = 64;

export interface XirrCashFlow {
    /** Negative for cash outflows/investments; positive for cash inflows/receipts. */
    readonly amount: number;
    /** A valid Date instance; use explicit UTC timestamps when constructing dates from strings. */
    readonly date: Date;
}

interface DatedAmount {
    readonly timestamp: number;
    readonly amount: number;
}

/**
 * Calculates an annualized money-weighted return for irregularly dated cash flows.
 *
 * The solver uses ACT/365 day fractions and bisection. To avoid silently
 * choosing among multiple possible IRRs, the dated cash-flow series must have
 * exactly one sign change after same-date flows are netted.
 *
 * @returns A decimal rate, where 0.1 represents 10% per year.
 * @throws RangeError for invalid cash flows, ambiguous sign patterns, an
 * unbracketable root, or a solution outside the supported numeric range.
 */
export function calculateXirr(cashFlows: readonly XirrCashFlow[]): number {
    if (cashFlows.length < 2) {
        throw new RangeError('At least two cash flows are required.');
    }

    const aggregatedFlows = aggregateCashFlows(cashFlows);
    if (aggregatedFlows.length < 2) {
        throw new RangeError('At least two non-zero cash-flow dates are required.');
    }

    const hasPositive = aggregatedFlows.some((flow) => flow.amount > 0);
    const hasNegative = aggregatedFlows.some((flow) => flow.amount < 0);
    if (!hasPositive || !hasNegative) {
        throw new RangeError('Cash flows must include at least one positive and one negative amount.');
    }

    let signChanges = 0;
    for (let index = 1; index < aggregatedFlows.length; index++) {
        const previousFlow = aggregatedFlows[index - 1];
        const currentFlow = aggregatedFlows[index];

        if (previousFlow === undefined || currentFlow === undefined) {
            throw new RangeError('Unable to inspect the complete cash-flow sequence.');
        }

        if (Math.sign(previousFlow.amount) !== Math.sign(currentFlow.amount)) {
            signChanges++;
        }
    }

    if (signChanges !== 1) {
        throw new RangeError(
            'Cash flows must have exactly one sign change; multiple sign changes can produce ambiguous IRRs.'
        );
    }

    const firstFlow = aggregatedFlows[0];
    if (firstFlow === undefined) {
        throw new RangeError('At least two non-zero cash-flow dates are required.');
    }

    const maxAbsoluteAmount = aggregatedFlows.reduce(
        (maximum, flow) => Math.max(maximum, Math.abs(flow.amount)),
        0
    );
    const baseTimestamp = firstFlow.timestamp;
    const normalizedFlows = aggregatedFlows.map((flow) => ({
        amount: flow.amount / maxAbsoluteAmount,
        years: (flow.timestamp - baseTimestamp) / MILLISECONDS_PER_DAY / DAYS_PER_YEAR
    }));

    const netPresentValue = (rate: number): number => {
        const growthBase = 1 + rate;
        if (!Number.isFinite(rate) || growthBase <= 0) {
            return Number.NaN;
        }

        let value = 0;
        for (const flow of normalizedFlows) {
            const discountFactor = Math.pow(growthBase, flow.years);
            value += flow.amount / discountFactor;
        }

        return value;
    };

    let lowerRate = -0.5;
    let upperRate = 0.1;
    let lowerValue = netPresentValue(lowerRate);
    let upperValue = netPresentValue(upperRate);

    if (Number.isNaN(lowerValue) || Number.isNaN(upperValue)) {
        throw new RangeError('Unable to evaluate cash flows in the supported numeric range.');
    }

    if (lowerValue === 0) {
        return lowerRate;
    }
    if (upperValue === 0) {
        return upperRate;
    }

    let bracketed = hasOppositeSigns(lowerValue, upperValue);

    // Search toward -100% for a negative root. Stop if floating-point
    // precision or discounting makes the NPV numerically indeterminate.
    for (let attempt = 0; !bracketed && attempt < MAX_BRACKET_EXPANSIONS; attempt++) {
        const candidateRate = (lowerRate - 1) / 2;
        if (candidateRate <= -1 || candidateRate === lowerRate) {
            break;
        }

        const candidateValue = netPresentValue(candidateRate);
        if (Number.isNaN(candidateValue)) {
            break;
        }

        lowerRate = candidateRate;
        lowerValue = candidateValue;

        if (lowerValue === 0) {
            return lowerRate;
        }

        bracketed = hasOppositeSigns(lowerValue, upperValue);
    }

    // Expand the positive side until the root is bracketed or the supported
    // numeric range is exhausted.
    for (let attempt = 0; !bracketed && attempt < MAX_BRACKET_EXPANSIONS; attempt++) {
        const candidateRate = (upperRate * 2) + 1;
        if (!Number.isFinite(candidateRate) || candidateRate === upperRate) {
            break;
        }

        const candidateValue = netPresentValue(candidateRate);
        if (Number.isNaN(candidateValue)) {
            break;
        }

        upperRate = candidateRate;
        upperValue = candidateValue;

        if (upperValue === 0) {
            return upperRate;
        }

        bracketed = hasOppositeSigns(lowerValue, upperValue);
    }

    if (!bracketed) {
        throw new RangeError('Unable to bracket a stable XIRR root for these cash flows.');
    }

    for (let iteration = 0; iteration < MAX_BISECTION_ITERATIONS; iteration++) {
        const midpoint = lowerRate + ((upperRate - lowerRate) / 2);
        const midpointValue = netPresentValue(midpoint);

        if (Number.isNaN(midpointValue)) {
            throw new RangeError('XIRR calculation became numerically indeterminate.');
        }

        if (midpointValue === 0 || (upperRate - lowerRate) <= RATE_TOLERANCE) {
            return midpoint;
        }

        if (hasOppositeSigns(lowerValue, midpointValue)) {
            upperRate = midpoint;
        } else {
            lowerRate = midpoint;
            lowerValue = midpointValue;
        }
    }

    throw new RangeError('XIRR did not converge within the iteration limit.');
}

function aggregateCashFlows(cashFlows: readonly XirrCashFlow[]): DatedAmount[] {
    const sortedFlows = cashFlows.map((flow) => {
        if (!(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Each cash flow must have a valid Date.');
        }

        if (!Number.isFinite(flow.amount)) {
            throw new RangeError('Each cash-flow amount must be finite.');
        }

        return {
            timestamp: flow.date.getTime(),
            amount: flow.amount
        };
    }).sort((left, right) => left.timestamp - right.timestamp);

    const aggregated: DatedAmount[] = [];

    for (const flow of sortedFlows) {
        const previous = aggregated[aggregated.length - 1];

        if (previous?.timestamp === flow.timestamp) {
            const combinedAmount = previous.amount + flow.amount;
            if (!Number.isFinite(combinedAmount)) {
                throw new RangeError('Combined cash flows on the same date exceed the numeric range.');
            }

            aggregated[aggregated.length - 1] = {
                timestamp: flow.timestamp,
                amount: combinedAmount
            };
        } else {
            aggregated.push(flow);
        }
    }

    return aggregated.filter((flow) => flow.amount !== 0);
}

function hasOppositeSigns(left: number, right: number): boolean {
    return (left < 0 && right > 0) || (left > 0 && right < 0);
}
