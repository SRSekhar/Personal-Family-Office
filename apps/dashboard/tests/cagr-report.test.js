import { describe, expect, it } from 'vitest';
import { calculateCagr } from '../calculators-runtime/Cagr.js';
import { renderCagrHtmlReport } from '../cagr-report.js';

const assumptions = {
    beginningValue: 1000,
    endingValue: 1331,
    periods: 3,
    annualizedRate: calculateCagr({ beginningValue: 1000, endingValue: 1331, periods: 3 })
};

describe('renderCagrHtmlReport', () => {
    it('renders reconciled assumptions and result in a standalone HTML document', () => {
        const html = renderCagrHtmlReport(assumptions);
        expect(html).toMatch(/<!doctype html/i);
        expect(html).toContain('CAGR Report');
        expect(html).toContain('10%');
        expect(html).toContain('Beginning value (INR)');
        expect(html).toContain('1331');
        expect(html).toContain('Elapsed years');
        expect(html).toContain('does not account for deposits, withdrawals, taxes, fees, inflation, or interim cash flows');
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toMatch(/https?:\/\//i);
        expect(html).toContain('Generated locally by PFO OS');
    });

    it('rejects a result that does not match the canonical calculation', () => {
        expect(() => renderCagrHtmlReport({ ...assumptions, annualizedRate: 0.25 }))
            .toThrow(/does not match/i);
    });

    it.each([
        ['zero beginning value', { ...assumptions, beginningValue: 0 }],
        ['negative ending value', { ...assumptions, endingValue: -1 }],
        ['zero elapsed years', { ...assumptions, periods: 0 }],
        ['non-finite rate', { ...assumptions, annualizedRate: Number.NaN }]
    ])('rejects invalid report data: %s', (_description, input) => {
        expect(() => renderCagrHtmlReport(input)).toThrow();
    });
});
