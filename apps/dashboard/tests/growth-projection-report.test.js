import { describe, expect, it } from 'vitest';
import { projectCompoundGrowthSchedule } from '../calculators-runtime/CompoundGrowth.js';
import { renderGrowthProjectionReportHtml } from '../growth-projection-report.js';

const input = { initialValue: 100000, annualRate: 0.07, periods: 10, contributionPerPeriod: 12000, contributionTiming: 'end' };
const rows = projectCompoundGrowthSchedule(input);

describe('compound growth standalone HTML report', () => {
    it('renders summary, exact assumptions, and the full annual schedule', () => {
        const report = renderGrowthProjectionReportHtml({ input, rows });
        expect(report).toContain('<!doctype html>');
        expect(report).toContain('Compound growth projection');
        expect(report).toContain('Projected future value');
        expect(report).toContain('Starting amount');
        expect(report).toContain('₹1,00,000.00');
        expect(report).toContain('7%');
        expect(report).toContain('10 years');
        expect(report).toContain('End of year');
        expect(report).toContain('<td>10</td>');
        expect(report).toContain('not a forecast or guarantee');
        expect(report).not.toContain('<script');
        expect(report).not.toContain('<img');
        expect(report).not.toContain('https://');
        expect(report).not.toContain('http://');
    });
    it('discloses beginning-of-year timing and zero-period schedules', () => {
        const zeroInput = { initialValue: 250, annualRate: 0, periods: 0, contributionPerPeriod: 40, contributionTiming: 'beginning' };
        const report = renderGrowthProjectionReportHtml({ input: zeroInput, rows: projectCompoundGrowthSchedule(zeroInput) });
        expect(report).toContain('Beginning of year');
        expect(report).toContain('₹250.00');
        expect(report).toContain('<td>0</td>');
    });
    it('rejects a schedule that does not match the supplied assumptions', () => {
        expect(() => renderGrowthProjectionReportHtml({ input, rows: rows.map((row, index) => index === rows.length - 1 ? { ...row, projectedValue: 1 } : row) })).toThrow(/does not match/i);
    });
    it('rejects malformed inputs and schedules', () => {
        expect(() => renderGrowthProjectionReportHtml({ input: null, rows })).toThrow(/required/i);
        expect(() => renderGrowthProjectionReportHtml({ input, rows: [] })).toThrow(/does not match/i);
        expect(() => renderGrowthProjectionReportHtml({ input: { ...input, periods: 101 }, rows })).toThrow(/100/i);
    });
});