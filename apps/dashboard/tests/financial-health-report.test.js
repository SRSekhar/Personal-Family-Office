import { describe, expect, it } from 'vitest';
import { renderFinancialHealthReportHtml } from '../financial-health-report.js';

const report = {
    reportingPeriod: 'October 2026',
    generatedAt: '2026-10-26T03:00:00.000Z',
    metrics: [
        { label: 'Net worth', value: '₹750', detail: 'Assets ₹1,000 · Liabilities ₹250' },
        { label: 'Savings rate', value: '60%', detail: 'Recorded net cash flow ÷ recorded income' }
    ]
};

describe('financial health standalone HTML report', () => {
    it('renders validated metrics into a self-contained report', () => {
        const html = renderFinancialHealthReportHtml(report);
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('October 2026');
        expect(html).toContain('₹750');
        expect(html).toContain('Keep this file private');
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toMatch(/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i);
    });

    it('escapes metric and period text as HTML', () => {
        const html = renderFinancialHealthReportHtml({
            ...report,
            reportingPeriod: '<img src=x onerror=alert(1)>',
            metrics: [{ label: '<script>alert(1)</script>', value: '"bad"', detail: 'A & B' }]
        });
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('A &amp; B');
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('rejects missing or malformed report data', () => {
        expect(() => renderFinancialHealthReportHtml({ ...report, reportingPeriod: '' })).toThrow(/reporting period/);
        expect(() => renderFinancialHealthReportHtml({ ...report, generatedAt: 'not-a-date' })).toThrow(/timestamp/);
        expect(() => renderFinancialHealthReportHtml({ ...report, metrics: [] })).toThrow(/at least one/);
        expect(() => renderFinancialHealthReportHtml({ ...report, metrics: [{ label: 'Net worth' }] })).toThrow(/label, value, and detail/);
    });
});
