import { describe, expect, it } from 'vitest';
import { compareInvestmentPerformancePeriods } from './investment-period-comparison.js';

const cutoff = '2026-04-01T00:00:00.000Z';
const methodology = 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1';

function analysis(startAt, endAt, overrides = {}) {
    const points = [
        { effectiveAt: startAt, wealthIndex: 1, portfolioValue: 1000, drawdown: 0, observationId: 'start' },
        { effectiveAt: endAt, wealthIndex: 1.12, portfolioValue: 1120, drawdown: 0, observationId: 'end' }
    ];
    return {
        status: 'available', reason: null, scope: 'portfolio', currency: 'INR',
        startAt, endAt, recordedAtCutoff: cutoff, methodology,
        calendarId: 'calendar-' + startAt.slice(0, 10), calendarVersion: 1,
        observationCount: 2, flowBoundaryCount: 0,
        coverageStartAt: startAt, coverageEndAt: endAt,
        maximumDrawdown: 0, peakAt: null, troughAt: null, recoveryAt: null, recovered: true,
        points, ...overrides
    };
}

const janStart = '2026-01-01T00:00:00.000Z';
const janEnd = '2026-02-01T00:00:00.000Z';
const febStart = '2026-02-01T00:00:00.000Z';
const febEnd = '2026-03-01T00:00:00.000Z';

describe('historical investment performance period comparison', () => {
    it('derives each period return only from existing wealth-index endpoints', () => {
        const jan = analysis(janStart, janEnd, {
            points: [
                { effectiveAt: janStart, wealthIndex: 2, portfolioValue: 1000, drawdown: 0, observationId: 'jan-start' },
                { effectiveAt: janEnd, wealthIndex: 2.5, portfolioValue: 1250, drawdown: 0, observationId: 'jan-end' }
            ],
            coverageStartAt: janStart, coverageEndAt: janEnd, maximumDrawdown: 0
        });
        const feb = analysis(febStart, febEnd, {
            points: [
                { effectiveAt: febStart, wealthIndex: 2.5, portfolioValue: 1250, drawdown: 0, observationId: 'feb-start' },
                { effectiveAt: febEnd, wealthIndex: 2.25, portfolioValue: 1125, drawdown: -0.1, observationId: 'feb-end' }
            ],
            coverageStartAt: febStart, coverageEndAt: febEnd, maximumDrawdown: -0.1
        });
        const result = compareInvestmentPerformancePeriods({
            periods: [{ label: 'January', analysis: jan }, { label: 'February', analysis: feb }]
        });
        expect(result.status).toBe('available');
        expect(result.periods[0].periodReturn).toBeCloseTo(0.25, 12);
        expect(result.periods[1].periodReturn).toBeCloseTo(-0.1, 12);
        expect(result.periods[1]).toMatchObject({ maximumDrawdown: -0.1, overlapsPrevious: false });
    });

    it('sorts periods chronologically and explicitly flags overlapping windows', () => {
        const later = analysis(febStart, febEnd);
        const earlier = analysis(janStart, janEnd);
        const overlapping = analysis('2026-01-20T00:00:00.000Z', '2026-02-10T00:00:00.000Z');
        const result = compareInvestmentPerformancePeriods({
            periods: [
                { label: 'Later', analysis: later },
                { label: 'Earlier', analysis: earlier },
                { label: 'Overlap', analysis: overlapping }
            ]
        });
        expect(result.periods.map((row) => row.label)).toEqual(['Earlier', 'Overlap', 'Later']);
        expect(result.periods.map((row) => row.overlapsPrevious)).toEqual([false, true, true]);
    });

    it('retains an unavailable period and emits no partial numeric statistics for it', () => {
        const unavailable = analysis(febStart, febEnd, {
            status: 'unavailable', reason: 'Expected daily close is missing.',
            points: [], maximumDrawdown: null, coverageStartAt: null, coverageEndAt: null,
            peakAt: null, troughAt: null, recoveryAt: null, recovered: null
        });
        const result = compareInvestmentPerformancePeriods({
            periods: [{ label: 'January', analysis: analysis(janStart, janEnd) },
                { label: 'February', analysis: unavailable }]
        });
        expect(result.status).toBe('partially-unavailable');
        expect(result.periods[1]).toMatchObject({
            status: 'unavailable', reason: 'Expected daily close is missing.',
            periodReturn: null, maximumDrawdown: null, coverageStartAt: null, coverageEndAt: null
        });
    });

    it('rejects mismatched scope, currency, account or recorded-at cutoff', () => {
        for (const overrides of [
            { scope: 'account', accountId: 'account-1' },
            { currency: 'USD' },
            { recordedAtCutoff: '2026-04-02T00:00:00.000Z' }
        ]) {
            expect(() => compareInvestmentPerformancePeriods({
                periods: [{ label: 'A', analysis: analysis(janStart, janEnd) },
                    { label: 'B', analysis: analysis(febStart, febEnd, overrides) }]
            })).toThrow(/same scope, account, currency, methodology and recorded-at cutoff/u);
        }
        expect(() => compareInvestmentPerformancePeriods({
            periods: [{ label: 'A', analysis: analysis(janStart, janEnd, { scope: 'account', accountId: 'account-1' }) },
                { label: 'B', analysis: analysis(febStart, febEnd) }]
        })).toThrow(/same scope, account, currency, methodology and recorded-at cutoff/u);
    });

    it('rejects invalid wealth-index endpoints, unsorted points and malformed provenance', () => {
        expect(() => compareInvestmentPerformancePeriods({
            periods: [{ label: 'Bad', analysis: analysis(janStart, janEnd, {
                points: [{ effectiveAt: janStart, wealthIndex: 0 }, { effectiveAt: janEnd, wealthIndex: 1 }]
            }) }]
        })).toThrow(/wealth index must be positive/u);
        expect(() => compareInvestmentPerformancePeriods({
            periods: [{ label: 'Bad', analysis: analysis(janStart, janEnd, {
                points: [{ effectiveAt: janEnd, wealthIndex: 1 }, { effectiveAt: janStart, wealthIndex: 1 }]
            }) }]
        })).toThrow(/strictly increasing/u);
        expect(() => compareInvestmentPerformancePeriods({
            periods: [{ label: 'Bad', analysis: analysis(janStart, janEnd, { calendarVersion: 0 }) }]
        })).toThrow(/calendar provenance/u);
    });

    it('rejects duplicate labels and an empty period set', () => {
        expect(() => compareInvestmentPerformancePeriods({ periods: [] })).toThrow(/at least one/iu);
        expect(() => compareInvestmentPerformancePeriods({
            periods: [{ label: 'Same', analysis: analysis(janStart, janEnd) },
                { label: 'Same', analysis: analysis(febStart, febEnd) }]
        })).toThrow(/labels must be unique/u);
    });
});
