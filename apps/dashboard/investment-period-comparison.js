const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const METHODOLOGY = 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1';

function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function finite(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError(label + ' must be a finite number.');
    }
    return value;
}

function validatePeriod(period, index) {
    const label = 'Comparison period ' + (index + 1);
    if (!period || typeof period !== 'object' || typeof period.label !== 'string' || !period.label.trim()) {
        throw new TypeError(label + ' requires a non-empty label.');
    }
    const analysis = period.analysis;
    if (!analysis || !['available', 'unavailable'].includes(analysis.status)) {
        throw new TypeError(label + ' requires an available or unavailable drawdown analysis.');
    }
    if (!['portfolio', 'account'].includes(analysis.scope)) {
        throw new TypeError(label + ' has an unsupported scope.');
    }
    if (analysis.scope === 'account' && (typeof analysis.accountId !== 'string' || !analysis.accountId.trim())) {
        throw new TypeError(label + ' requires an account ID for account scope.');
    }
    if (analysis.scope === 'portfolio' && analysis.accountId !== undefined) {
        throw new TypeError(label + ' cannot specify an account ID for portfolio scope.');
    }
    if (!CURRENCIES.has(analysis.currency)) {
        throw new TypeError(label + ' has an unsupported currency.');
    }
    timestamp(analysis.startAt, label + ' start');
    timestamp(analysis.endAt, label + ' end');
    timestamp(analysis.recordedAtCutoff, label + ' recorded-at cutoff');
    if (analysis.startAt >= analysis.endAt) {
        throw new RangeError(label + ' must cover a positive time interval.');
    }
    if (analysis.methodology !== METHODOLOGY) {
        throw new RangeError(label + ' uses an unsupported drawdown methodology.');
    }
    if (typeof analysis.calendarId !== 'string' || !analysis.calendarId.trim()
        || !Number.isInteger(analysis.calendarVersion) || analysis.calendarVersion < 1) {
        throw new TypeError(label + ' requires persisted calendar provenance.');
    }
    if (!Array.isArray(analysis.points)) {
        throw new TypeError(label + ' points must be an array.');
    }
    if (!Number.isInteger(analysis.observationCount) || analysis.observationCount < 0
        || !Number.isInteger(analysis.flowBoundaryCount) || analysis.flowBoundaryCount < 0) {
        throw new TypeError(label + ' observation and flow-boundary counts must be non-negative integers.');
    }

    if (analysis.status === 'unavailable') {
        if (typeof analysis.reason !== 'string' || !analysis.reason.trim()) {
            throw new RangeError(label + ' must explain why the analysis is unavailable.');
        }
        if (analysis.points.length !== 0 || analysis.maximumDrawdown !== null
            || analysis.coverageStartAt !== null || analysis.coverageEndAt !== null) {
            throw new RangeError(label + ' unavailable analysis cannot contain partial statistics or points.');
        }
        return {
            label: period.label.trim(),
            status: 'unavailable',
            reason: analysis.reason,
            startAt: analysis.startAt,
            endAt: analysis.endAt,
            calendarId: analysis.calendarId,
            calendarVersion: analysis.calendarVersion,
            observationCount: analysis.observationCount,
            flowBoundaryCount: analysis.flowBoundaryCount,
            completeness: Array.isArray(analysis.completeness) ? analysis.completeness : [],
            limitations: Array.isArray(analysis.limitations) ? analysis.limitations : [],
            periodReturn: null,
            maximumDrawdown: null,
            peakAt: null,
            troughAt: null,
            recoveryAt: null,
            recovered: null,
            coverageStartAt: null,
            coverageEndAt: null,
            overlapsPrevious: false
        };
    }

    if (analysis.points.length < 2 || !Number.isFinite(analysis.maximumDrawdown)
        || analysis.maximumDrawdown > 0) {
        throw new RangeError(label + ' available analysis requires at least two points and a non-positive maximum drawdown.');
    }
    const first = analysis.points[0];
    const last = analysis.points[analysis.points.length - 1];
    if (!first || !last) {
        throw new RangeError(label + ' must contain endpoint wealth-index points.');
    }
    let previousPoint = null;
    for (const [pointIndex, point] of analysis.points.entries()) {
        const pointLabel = label + ' point ' + (pointIndex + 1);
        timestamp(point?.effectiveAt, pointLabel + ' timestamp');
        if (!['DailyClose', 'ExternalFlowPre', 'ExternalFlowPost'].includes(point?.kind)) {
            throw new TypeError(pointLabel + ' has an unsupported observation kind.');
        }
        const wealthIndex = finite(point?.wealthIndex, pointLabel + ' wealth index');
        if (wealthIndex <= 0) {
            throw new RangeError(pointLabel + ' wealth index must be positive.');
        }
        if (point.effectiveAt < analysis.startAt || point.effectiveAt > analysis.endAt) {
            throw new RangeError(pointLabel + ' falls outside the selected period.');
        }
        if (previousPoint) {
            if (point.effectiveAt < previousPoint.effectiveAt) {
                throw new RangeError(label + ' point timestamps must be ordered.');
            }
            if (point.effectiveAt === previousPoint.effectiveAt
                && !(previousPoint.kind === 'ExternalFlowPre' && point.kind === 'ExternalFlowPost')) {
                throw new RangeError(label + ' equal timestamps are permitted only for an ordered pre-flow/post-flow pair.');
            }
            if (previousPoint.kind === 'ExternalFlowPre'
                && (point.effectiveAt !== previousPoint.effectiveAt || point.kind !== 'ExternalFlowPost')) {
                throw new RangeError(label + ' external-flow pre/post observations must be adjacent at the same timestamp.');
            }
            if (point.kind === 'ExternalFlowPost'
                && !(previousPoint.kind === 'ExternalFlowPre' && point.effectiveAt === previousPoint.effectiveAt)) {
                throw new RangeError(label + ' external-flow post observation requires its immediately preceding pre-flow observation.');
            }
        }
        previousPoint = point;
    }
    if (analysis.coverageStartAt !== first.effectiveAt || analysis.coverageEndAt !== last.effectiveAt) {
        throw new RangeError(label + ' coverage must match the first and last observed points.');
    }
    if (analysis.maximumDrawdown === 0) {
        if (analysis.recovered !== null || analysis.peakAt !== null
            || analysis.troughAt !== null || analysis.recoveryAt !== null) {
            throw new TypeError(label + ' with no drawdown must have null peak, trough and recovery metadata.');
        }
    } else {
        if (analysis.recovered !== true && analysis.recovered !== false) {
            throw new TypeError(label + ' recovery state must be explicit when a drawdown exists.');
        }
        if (analysis.peakAt === null || analysis.troughAt === null) {
            throw new TypeError(label + ' with drawdown requires peak and trough timestamps.');
        }
        timestamp(analysis.peakAt, label + ' peak timestamp');
        timestamp(analysis.troughAt, label + ' trough timestamp');
        if (analysis.recoveryAt !== null) timestamp(analysis.recoveryAt, label + ' recovery timestamp');
        if (analysis.recovered && analysis.recoveryAt === null) {
            throw new TypeError(label + ' recovered drawdown requires a recovery timestamp.');
        }
        if (!analysis.recovered && analysis.recoveryAt !== null) {
            throw new TypeError(label + ' unrecovered drawdown cannot have a recovery timestamp.');
        }
    }

    return {
        label: period.label.trim(),
        status: 'available',
        reason: null,
        startAt: analysis.startAt,
        endAt: analysis.endAt,
        calendarId: analysis.calendarId,
        calendarVersion: analysis.calendarVersion,
        observationCount: analysis.observationCount,
        flowBoundaryCount: analysis.flowBoundaryCount,
        completeness: Array.isArray(analysis.completeness) ? analysis.completeness : [],
        limitations: Array.isArray(analysis.limitations) ? analysis.limitations : [],
        periodReturn: last.wealthIndex / first.wealthIndex - 1,
        maximumDrawdown: analysis.maximumDrawdown,
        peakAt: analysis.peakAt,
        troughAt: analysis.troughAt,
        recoveryAt: analysis.recoveryAt,
        recovered: analysis.recovered,
        coverageStartAt: analysis.coverageStartAt,
        coverageEndAt: analysis.coverageEndAt,
        overlapsPrevious: false
    };
}

/**
 * Compare separately validated flow-adjusted drawdown analyses.
 * The only derived return is the ratio of existing wealth-index endpoints.
 * This adapter never acquires observations or recalculates daily returns.
 */
export function compareInvestmentPerformancePeriods(input) {
    if (!input || !Array.isArray(input.periods) || input.periods.length < 1) {
        throw new TypeError('At least one historical performance period is required.');
    }
    const rows = input.periods.map(validatePeriod);
    const firstAnalysis = input.periods[0].analysis;
    const identity = {
        scope: firstAnalysis.scope,
        accountId: firstAnalysis.accountId,
        currency: firstAnalysis.currency,
        recordedAtCutoff: firstAnalysis.recordedAtCutoff,
        methodology: firstAnalysis.methodology
    };
    const labels = new Set();
    for (const row of rows) {
        if (labels.has(row.label)) throw new RangeError('Comparison period labels must be unique.');
        labels.add(row.label);
    }
    for (const period of input.periods) {
        const analysis = period.analysis;
        if (analysis.scope !== identity.scope || analysis.accountId !== identity.accountId
            || analysis.currency !== identity.currency
            || analysis.recordedAtCutoff !== identity.recordedAtCutoff
            || analysis.methodology !== identity.methodology) {
            throw new RangeError('All comparison periods must share the same scope, account, currency, methodology and recorded-at cutoff.');
        }
    }
    rows.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt));
    let furthestPreviousEnd = rows[0].endAt;
    for (let index = 1; index < rows.length; index += 1) {
        rows[index].overlapsPrevious = rows[index].startAt < furthestPreviousEnd;
        if (rows[index].endAt > furthestPreviousEnd) furthestPreviousEnd = rows[index].endAt;
    }
    return {
        status: rows.every((row) => row.status === 'available') ? 'available' : 'partially-unavailable',
        scope: identity.scope,
        ...(identity.accountId === undefined ? {} : { accountId: identity.accountId }),
        currency: identity.currency,
        recordedAtCutoff: identity.recordedAtCutoff,
        methodology: identity.methodology,
        periods: rows
    };
}
