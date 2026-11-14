import { validateInvestmentDrawdownSnapshots, buildInvestmentDrawdownObservations } from './investment-drawdown-snapshots.js';
import { selectInvestmentDrawdownCalendar } from './investment-drawdown-calendars.js';
import {
    buildInvestmentDrawdownExternalFlows,
    validateInvestmentDrawdownSnapshotCompleteness
} from './investment-drawdown-acquisition.js';

/**
 * Assemble the only supported end-to-end drawdown input from validated,
 * ledger-reconciled snapshots and authoritative cash-ledger external flows.
 *
 * The caller must supply the persisted calendar collection and pure calculator.
 * Calendar selection is bitemporal; no dates, prices, flows or missing closes are inferred.
 */
export function analyzeInvestmentDrawdownSeries(input) {
    const {
        analyzeInvestmentDrawdownMath,
        investmentDrawdownSnapshots,
        investmentDrawdownCalendars,
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
    if (!Array.isArray(investmentDrawdownCalendars)) {
        throw new TypeError('A persisted daily-close calendar collection is required.');
    }
    const selectedCalendar = selectInvestmentDrawdownCalendar({
        scope, accountId, currency, startAt, endAt, recordedAtCutoff,
        investmentAccounts: input?.investmentAccounts,
        investmentDrawdownCalendars
    });
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
            calendarId: selectedCalendar.calendarId,
            calendarVersion: selectedCalendar.version,
                calendarId: selectedCalendar.calendarId,
                calendarVersion: selectedCalendar.version,
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
        expectedDailyCloseAt: selectedCalendar.expectedDailyCloseAt,
        externalFlows: flowResult.flows.map(({ id, effectiveAt, recordedAt }) => ({ id, effectiveAt, recordedAt }))
    });
    return {
        ...result,
        scope,
        ...(accountId ? { accountId } : {}),
        calendarId: selectedCalendar.calendarId,
        calendarVersion: selectedCalendar.version,
        completeness,
        limitations: flowResult.limitations
    };
}
