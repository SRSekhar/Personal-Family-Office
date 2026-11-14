import { validateInvestmentDrawdownSnapshots, buildInvestmentDrawdownObservations } from './investment-drawdown-snapshots.js';
import {
    buildInvestmentDrawdownExternalFlows,
    validateInvestmentDrawdownSnapshotCompleteness
} from './investment-drawdown-acquisition.js';

/**
 * Assemble the only supported end-to-end drawdown input from validated,
 * ledger-reconciled snapshots and authoritative cash-ledger external flows.
 *
 * The caller must supply the explicit daily-close calendar and the pure
 * calculator. No prices, dates, flows or missing observations are inferred.
 */
export function analyzeInvestmentDrawdownSeries(input) {
    const {
        analyzeInvestmentDrawdownMath,
        investmentDrawdownSnapshots,
        expectedDailyCloseAt,
        scope,
        accountId,
        currency,
        startAt,
        endAt,
        recordedAtCutoff
    } = input ?? {};

    if (typeof analyzeInvestmentDrawdownMath !== 'function') {
        throw new TypeError('The pure investment drawdown calculator must be supplied.');
    }
    if (!Array.isArray(expectedDailyCloseAt)) {
        throw new TypeError('An explicit daily-close calendar is required.');
    }
    if (!Array.isArray(investmentDrawdownSnapshots)) {
        throw new TypeError('Validated investment drawdown snapshots are required.');
    }

    const validated = validateInvestmentDrawdownSnapshots({
        ...input,
        investmentDrawdownSnapshots
    });
    const observations = buildInvestmentDrawdownObservations({
        investmentDrawdownSnapshots: validated.investmentDrawdownSnapshots,
        scope,
        accountId,
        currency,
        startAt,
        endAt,
        recordedAtCutoff
    });

    const completeness = [];
    for (const observation of observations) {
        const result = validateInvestmentDrawdownSnapshotCompleteness({
            ...input,
            investmentDrawdownSnapshots: validated.investmentDrawdownSnapshots,
            snapshotId: observation.id
        });
        completeness.push(result);
        if (!result.complete) {
            return {
                status: 'unavailable',
                reason: result.reasons.join(' '),
                scope,
                ...(accountId ? { accountId } : {}),
                currency,
                startAt,
                endAt,
                recordedAtCutoff,
                methodology: 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1',
                observationCount: observations.length,
                flowBoundaryCount: observations.filter((item) => item.kind !== 'DailyClose').length / 2,
                coverageStartAt: null,
                coverageEndAt: null,
                maximumDrawdown: null,
                peakAt: null,
                troughAt: null,
                recoveryAt: null,
                recovered: null,
                points: [],
                completeness
            };
        }
    }

    const flowResult = buildInvestmentDrawdownExternalFlows({
        ...input,
        scope,
        accountId,
        currency,
        startAt,
        endAt,
        recordedAtCutoff
    });
    if (flowResult.status !== 'available') {
        return {
            status: 'unavailable',
            reason: flowResult.reason,
            scope,
            ...(accountId ? { accountId } : {}),
            currency,
            startAt,
            endAt,
            recordedAtCutoff,
            methodology: 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1',
            observationCount: observations.length,
            flowBoundaryCount: 0,
            coverageStartAt: null,
            coverageEndAt: null,
            maximumDrawdown: null,
            peakAt: null,
            troughAt: null,
            recoveryAt: null,
            recovered: null,
            points: [],
            completeness,
            limitations: flowResult.limitations
        };
    }

    const result = analyzeInvestmentDrawdownMath({
        scopeId: scope === 'account' ? accountId : 'portfolio',
        currency,
        startAt,
        endAt,
        recordedAtCutoff,
        observations,
        expectedDailyCloseAt,
        externalFlows: flowResult.flows.map(({ id, effectiveAt, recordedAt }) => ({ id, effectiveAt, recordedAt }))
    });
    return {
        ...result,
        scope,
        ...(accountId ? { accountId } : {}),
        completeness,
        limitations: flowResult.limitations
    };
}
