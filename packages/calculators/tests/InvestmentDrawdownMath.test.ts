import { describe, expect, it } from 'vitest';
import { analyzeInvestmentDrawdownMath, type InvestmentDrawdownObservation } from '../src/InvestmentDrawdownMath.js';

const cutoff = '2026-11-13T23:59:59.999Z';
function observation(overrides: Partial<InvestmentDrawdownObservation> & Pick<InvestmentDrawdownObservation, 'id' | 'kind' | 'effectiveAt' | 'portfolioValue'>): InvestmentDrawdownObservation {
    return {
        id: overrides.id, scopeId: overrides.scopeId ?? 'portfolio-main', currency: overrides.currency ?? 'INR',
        kind: overrides.kind, effectiveAt: overrides.effectiveAt, recordedAt: overrides.recordedAt ?? '2026-11-13T12:00:00.000Z',
        portfolioValue: overrides.portfolioValue, complete: overrides.complete ?? true,
        ...(overrides.flowId === undefined ? {} : { flowId: overrides.flowId }),
        ...(overrides.unavailableReason === undefined ? {} : { unavailableReason: overrides.unavailableReason })
    };
}
function input(observations: InvestmentDrawdownObservation[], externalFlows: Array<{ id: string; effectiveAt: string; recordedAt?: string }> = [], expectedDailyCloseAt = observations.filter((item) => item.kind === 'DailyClose').map((item) => item.effectiveAt)) {
    return {
        scopeId: 'portfolio-main', currency: 'INR',
        startAt: '2026-11-01T00:00:00.000Z', endAt: '2026-11-13T23:59:59.999Z',
        recordedAtCutoff: cutoff, observations, expectedDailyCloseAt, externalFlows: externalFlows.map((flow) => ({ ...flow, recordedAt: flow.recordedAt ?? '2026-11-13T12:00:00.000Z' }))
    };
}

describe('analyzeInvestmentDrawdownMath', () => {
    it('chains daily returns and identifies peak, trough, maximum drawdown and recovery', () => {
        const result = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 1200 }),
            observation({ id: 'd3', kind: 'DailyClose', effectiveAt: '2026-11-03T16:00:00.000Z', portfolioValue: 900 }),
            observation({ id: 'd4', kind: 'DailyClose', effectiveAt: '2026-11-04T16:00:00.000Z', portfolioValue: 1200 })
        ]));
        expect(result.status).toBe('available');
        expect(result.maximumDrawdown).toBeCloseTo(-0.25, 12);
        expect(result.peakAt).toBe('2026-11-02T16:00:00.000Z');
        expect(result.troughAt).toBe('2026-11-03T16:00:00.000Z');
        expect(result.recovered).toBe(true);
        expect(result.recoveryAt).toBe('2026-11-04T16:00:00.000Z');
    });

    it('neutralizes an external contribution using paired pre-flow and post-flow valuations', () => {
        const result = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'flow-1-pre', kind: 'ExternalFlowPre', flowId: 'flow-1', effectiveAt: '2026-11-02T10:00:00.000Z', portfolioValue: 1100 }),
            observation({ id: 'flow-1-post', kind: 'ExternalFlowPost', flowId: 'flow-1', effectiveAt: '2026-11-02T10:00:00.000Z', portfolioValue: 2100 }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 2100 })
        ], [{ id: 'flow-1', effectiveAt: '2026-11-02T10:00:00.000Z' }]));
        expect(result.status).toBe('available');
        expect(result.points.find((point) => point.observationId === 'flow-1-pre')?.wealthIndex).toBeCloseTo(1.1, 12);
        expect(result.points.find((point) => point.observationId === 'flow-1-post')?.wealthIndex).toBeCloseTo(1.1, 12);
        expect(result.points.at(-1)?.wealthIndex).toBeCloseTo(1.1, 12);
        expect(result.maximumDrawdown).toBe(0);
        expect(result.recovered).toBeNull();
        expect(result.peakAt).toBeNull();
        expect(result.troughAt).toBeNull();
    });

    it('neutralizes a withdrawal but preserves the investment loss before the withdrawal', () => {
        const result = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 1200 }),
            observation({ id: 'flow-2-pre', kind: 'ExternalFlowPre', flowId: 'flow-2', effectiveAt: '2026-11-03T10:00:00.000Z', portfolioValue: 900 }),
            observation({ id: 'flow-2-post', kind: 'ExternalFlowPost', flowId: 'flow-2', effectiveAt: '2026-11-03T10:00:00.000Z', portfolioValue: 500 }),
            observation({ id: 'd3', kind: 'DailyClose', effectiveAt: '2026-11-03T16:00:00.000Z', portfolioValue: 550 })
        ], [{ id: 'flow-2', effectiveAt: '2026-11-03T10:00:00.000Z' }]));
        expect(result.status).toBe('available');
        expect(result.maximumDrawdown).toBeCloseTo(-0.25, 12);
        expect(result.troughAt).toBe('2026-11-03T10:00:00.000Z');
        expect(result.recovered).toBe(false);
        expect(result.recoveryAt).toBeNull();
    });

    it('returns unavailable when a flow boundary is unpaired or incomplete', () => {
        const unpaired = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'flow-pre', kind: 'ExternalFlowPre', flowId: 'flow-x', effectiveAt: '2026-11-02T10:00:00.000Z', portfolioValue: 1100 })
        ], [{ id: 'flow-x', effectiveAt: '2026-11-02T10:00:00.000Z' }]));
        expect(unpaired.status).toBe('unavailable');
        expect(unpaired.reason).toContain('paired');

        const incomplete = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 1100, complete: false, unavailableReason: 'Missing one open position valuation.' })
        ]));
        expect(incomplete.status).toBe('unavailable');
        expect(incomplete.reason).toBe('Missing one open position valuation.');
    });

    it('uses recorded-at cutoff and refuses a flow with only one boundary known at that cutoff', () => {
        const result = analyzeInvestmentDrawdownMath({
            ...input([
                observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
                observation({ id: 'pre', kind: 'ExternalFlowPre', flowId: 'flow-late', effectiveAt: '2026-11-02T10:00:00.000Z', portfolioValue: 1100, recordedAt: '2026-11-02T11:00:00.000Z' }),
                observation({ id: 'post', kind: 'ExternalFlowPost', flowId: 'flow-late', effectiveAt: '2026-11-02T10:00:00.000Z', portfolioValue: 2100, recordedAt: '2026-11-14T11:00:00.000Z' })
            ], [{ id: 'flow-late', effectiveAt: '2026-11-02T10:00:00.000Z', recordedAt: '2026-11-02T12:00:00.000Z' }]),
            recordedAtCutoff: '2026-11-13T00:00:00.000Z'
        });
        expect(result.status).toBe('unavailable');
        expect(result.reason).toContain('paired');
    });

    it('rejects invalid denominators, mixed scopes/currencies, duplicate IDs and ambiguous simultaneous flows', () => {
        expect(analyzeInvestmentDrawdownMath(input([
            observation({ id: 'zero', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 0 }),
            observation({ id: 'next', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 10 })
        ])).status).toBe('unavailable');

        expect(() => analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000, currency: 'USD' }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 1100 })
        ]))).toThrow('scope and currency');

        const duplicate = observation({ id: 'same', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 });
        expect(() => analyzeInvestmentDrawdownMath(input([duplicate, duplicate]))).toThrow('unique');

        expect(() => analyzeInvestmentDrawdownMath(input([
            observation({ id: 'a-pre', kind: 'ExternalFlowPre', flowId: 'a', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'a-post', kind: 'ExternalFlowPost', flowId: 'a', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1100 }),
            observation({ id: 'b-pre', kind: 'ExternalFlowPre', flowId: 'b', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1100 }),
            observation({ id: 'b-post', kind: 'ExternalFlowPost', flowId: 'b', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1200 })
        ], [{ id: 'a', effectiveAt: '2026-11-01T16:00:00.000Z' }, { id: 'b', effectiveAt: '2026-11-01T16:00:00.000Z' }]))).toThrow('sequence simultaneous flows explicitly');
    });

    it('rejects flow-boundary observations that disagree with the authoritative event timestamp', () => {
        expect(() => analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'pre', kind: 'ExternalFlowPre', flowId: 'flow-time', effectiveAt: '2026-11-02T10:01:00.000Z', portfolioValue: 1100 }),
            observation({ id: 'post', kind: 'ExternalFlowPost', flowId: 'flow-time', effectiveAt: '2026-11-02T10:01:00.000Z', portfolioValue: 2100 })
        ], [{ id: 'flow-time', effectiveAt: '2026-11-02T10:00:00.000Z' }]))).toThrow('effective timestamp');
    });

    it('reflects portfolio costs as performance loss rather than neutralizing them as external flows', () => {
        const result = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 990 })
        ]));
        expect(result.status).toBe('available');
        expect(result.points.at(-1)?.wealthIndex).toBeCloseTo(0.99, 12);
        expect(result.maximumDrawdown).toBeCloseTo(-0.01, 12);
        expect(result.startAt).toBe('2026-11-01T00:00:00.000Z');
        expect(result.coverageStartAt).toBe('2026-11-01T16:00:00.000Z');
    });

    it('does not bridge an expected daily close that is missing at the knowledge cutoff', () => {
        const result = analyzeInvestmentDrawdownMath(input([
            observation({ id: 'before', kind: 'DailyClose', effectiveAt: '2026-10-31T16:00:00.000Z', portfolioValue: 900 }),
            observation({ id: 'd1', kind: 'DailyClose', effectiveAt: '2026-11-01T16:00:00.000Z', portfolioValue: 1000 }),
            observation({ id: 'future-recorded', kind: 'DailyClose', effectiveAt: '2026-11-02T16:00:00.000Z', portfolioValue: 1200, recordedAt: '2026-11-14T00:00:00.000Z' }),
            observation({ id: 'd2', kind: 'DailyClose', effectiveAt: '2026-11-03T16:00:00.000Z', portfolioValue: 1100 })
        ], [], ['2026-11-01T16:00:00.000Z', '2026-11-02T16:00:00.000Z', '2026-11-03T16:00:00.000Z']));
        expect(result.status).toBe('unavailable');
        expect(result.reason).toContain('expected daily-close valuation');
        expect(result.observationCount).toBe(2);
    });
});
