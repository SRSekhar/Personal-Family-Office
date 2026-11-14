import { describe, expect, it } from 'vitest';
import {
    investmentDrawdownReportToCsv,
    renderInvestmentDrawdownReportHtml
} from './investment-drawdown-report.js';

const startAt = '2026-01-01T00:00:00.000Z';
const endAt = '2026-01-03T00:00:00.000Z';
const recordedAtCutoff = '2026-01-04T00:00:00.000Z';
const generatedAt = '2026-01-05T00:00:00.000Z';

function reportInput(overrides = {}) {
    const analysis = {
        status: 'available',
        reason: null,
        scope: 'account',
        accountId: '=HYPERLINK("x")',
        currency: 'INR',
        startAt,
        endAt,
        recordedAtCutoff,
        methodology: 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1',
        calendarId: 'calendar-1',
        calendarVersion: 2,
        observationCount: 2,
        flowBoundaryCount: 0,
        coverageStartAt: startAt,
        coverageEndAt: endAt,
        maximumDrawdown: -0.2,
        peakAt: startAt,
        troughAt: endAt,
        recoveryAt: null,
        recovered: false,
        points: [
            { effectiveAt: startAt, observationId: 'snapshot-1', kind: 'DailyClose', portfolioValue: 1000, wealthIndex: 1, drawdown: 0 },
            { effectiveAt: endAt, observationId: 'snapshot-2', kind: 'DailyClose', portfolioValue: 800, wealthIndex: 0.8, drawdown: -0.2 }
        ],
        completeness: [{
            status: 'complete', snapshotId: '<snapshot-1>', expectedComponentCount: 2, actualComponentCount: 2,
            missingComponents: [], unexpectedComponents: [], mismatchedComponents: [], reasons: []
        }],
        limitations: []
    };
    return {
        analysis: { ...analysis, ...overrides.analysis },
        scope: 'account',
        accountId: analysis.accountId,
        currency: 'INR',
        startAt,
        endAt,
        recordedAtCutoff,
        generatedAt
    };
}

describe('investment drawdown reports', () => {
    it('renders a self-contained report with escaped identifiers and explicit methodology', () => {
        const html = renderInvestmentDrawdownReportHtml(reportInput());
        expect(html).toContain('TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1');
        expect(html).toContain('Maximum drawdown');
        expect(html).toContain('Observed coverage');
        expect(html).toContain('20.00%');
        expect(html).toContain('&lt;snapshot-1&gt;');
        expect(html).not.toContain('<script>');
        expect(html).toContain('not a forecast');
    });

    it('exports spreadsheet-safe CSV for summaries, points and completeness evidence', () => {
        const csv = investmentDrawdownReportToCsv(reportInput());
        expect(csv).toContain('RecordType,Status,Scope');
        expect(csv).toContain('CoverageStartAt,CoverageEndAt');
        expect(csv).toContain('"\'=HYPERLINK(""x"")"');
        expect(csv).toContain('"Point"');
        expect(csv).toContain('"Completeness"');
        expect(csv).toContain('-0.2');
    });

    it('renders unavailable results without partial drawdown statistics', () => {
        const input = reportInput({
            analysis: {
                status: 'unavailable',
                reason: 'A required daily close is missing.',
                maximumDrawdown: null,
                peakAt: null,
                troughAt: null,
                recoveryAt: null,
                recovered: null,
                points: [],
                completeness: [{
                    status: 'incomplete', snapshotId: 'snapshot-missing', expectedComponentCount: 2,
                    actualComponentCount: 1, missingComponents: [{}], unexpectedComponents: [],
                    mismatchedComponents: [], reasons: ['Position valuation is missing.']
                }]
            }
        });
        const html = renderInvestmentDrawdownReportHtml(input);
        const csv = investmentDrawdownReportToCsv(input);
        expect(html).toContain('Calculation unavailable');
        expect(html).toContain('A required daily close is missing.');
        expect(html).toContain('Unavailable');
        expect(html).toContain('Position valuation is missing.');
        expect(html).not.toContain('800.00');
        expect(csv).toContain('A required daily close is missing.');
        expect(csv).not.toContain('"Point"');
    });

    it('rejects report metadata that does not match the analysis provenance', () => {
        expect(() => renderInvestmentDrawdownReportHtml({
            ...reportInput(),
            startAt: '2026-01-02T00:00:00.000Z'
        })).toThrow(/provenance does not match/u);
    });
});
