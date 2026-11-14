import { describe, expect, it } from 'vitest';
import { renderInvestmentPeriodComparisonHtml, investmentPeriodComparisonToCsv } from './investment-period-comparison-report.js';

const comparison = {
    status: 'partially-unavailable', scope: 'portfolio', currency: 'INR',
    recordedAtCutoff: '2026-04-01T00:00:00.000Z',
    methodology: 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1',
    periods: [
        { label: 'January <script>', status: 'available', startAt: '2026-01-01T00:00:00.000Z',
            endAt: '2026-02-01T00:00:00.000Z', coverageStartAt: '2026-01-01T00:00:00.000Z',
            coverageEndAt: '2026-02-01T00:00:00.000Z', periodReturn: 0.25, maximumDrawdown: -0.1,
            peakAt: null, troughAt: null, recoveryAt: null, recovered: false, observationCount: 2,
            flowBoundaryCount: 0, calendarId: 'calendar-1', calendarVersion: 1, overlapsPrevious: false },
        { label: 'February', status: 'unavailable', reason: 'Missing <close> evidence.',
            startAt: '2026-02-01T00:00:00.000Z', endAt: '2026-03-01T00:00:00.000Z',
            coverageStartAt: null, coverageEndAt: null, periodReturn: null, maximumDrawdown: null,
            peakAt: null, troughAt: null, recoveryAt: null, recovered: null, observationCount: 0,
            flowBoundaryCount: 0, calendarId: 'calendar-2', calendarVersion: 1, overlapsPrevious: false }
    ]
};

describe('historical period comparison report', () => {
    it('renders a standalone script-free report and escapes period labels and reasons', () => {
        const html = renderInvestmentPeriodComparisonHtml({ comparison, generatedAt: '2026-04-02T00:00:00.000Z' });
        expect(html).toContain('25.00%');
        expect(html).toContain('Unavailable');
        expect(html).toContain('Missing &lt;close&gt; evidence.');
        expect(html).toContain('January &lt;script&gt;');
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toMatch(/https?:\/\//i);
    });

    it('exports consistent spreadsheet-safe CSV rows including unavailable reasons', () => {
        const csv = investmentPeriodComparisonToCsv({ comparison, generatedAt: '2026-04-02T00:00:00.000Z' });
        const rows = csv.trim().split(/\r?\n/u).map((row) => row.split(','));
        expect(rows).toHaveLength(3);
        expect(rows[0]).toHaveLength(rows[1].length);
        expect(rows[1][2]).toContain("January <script>");
        expect(csv).toContain('Missing <close> evidence.');
        expect(csv).toContain('0.25');
        expect(csv).toContain('-0.1');
        expect(csv).toContain('PeriodReturn');
        const formulaInput = structuredClone(comparison);
        formulaInput.periods[0].label = '=DANGER';
        expect(investmentPeriodComparisonToCsv({ comparison: formulaInput, generatedAt: '2026-04-02T00:00:00.000Z' }))
            .toContain("'=DANGER");
    });

    it('rejects a partial numeric result for an unavailable period', () => {
        const invalid = structuredClone(comparison);
        invalid.periods[1].periodReturn = 0.01;
        expect(() => renderInvestmentPeriodComparisonHtml({ comparison: invalid, generatedAt: '2026-04-02T00:00:00.000Z' }))
            .toThrow(/no partial metrics/u);
    });

    it('rejects a mismatched comparison status', () => {
        const invalid = structuredClone(comparison);
        invalid.status = 'available';
        expect(() => investmentPeriodComparisonToCsv({ comparison: invalid, generatedAt: '2026-04-02T00:00:00.000Z' }))
            .toThrow(/does not match/u);
    });
});
