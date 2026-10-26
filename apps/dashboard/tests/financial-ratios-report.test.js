import { describe, expect, it } from 'vitest';
import { calculateFinancialRatios } from '../analytics-runtime/FinancialRatios.js';
import { renderFinancialRatiosReportHtml } from '../financial-ratios-report.js';

function reportInput(assets = 100, liabilities = 25) {
    const netWorth = assets - liabilities;
    const ratios = calculateFinancialRatios({
        currency: 'INR',
        totalAssets: { amount: assets, currency: 'INR' },
        totalLiabilities: { amount: liabilities, currency: 'INR' },
        netWorth: { amount: netWorth, currency: 'INR' }
    });
    return { assets, liabilities, netWorth, ratios, generatedAt: '2026-10-26T10:00:00.000Z' };
}

describe('renderFinancialRatiosReportHtml', () => {
    it('renders reconciled totals, ratio values, and limitations in a standalone report', () => {
        const html = renderFinancialRatiosReportHtml(reportInput());
        expect(html).toMatch(/<!doctype html/i);
        expect(html).toContain('Balance-sheet ratios');
        expect(html).toContain('₹100.00');
        expect(html).toContain('₹25.00');
        expect(html).toContain('₹75.00');
        expect(html).toContain('25%');
        expect(html).toContain('75%');
        expect(html).toContain('4×');
        expect(html).toContain('holding-level diversification');
        expect(html).not.toMatch(/<script\b|<iframe\b|<img\b/i);
        expect(html).not.toMatch(/https?:\/\//i);
    });

    it('reports ratios with zero denominators as unavailable', () => {
        const html = renderFinancialRatiosReportHtml(reportInput(0, 0));
        expect(html).toContain('Unavailable (zero assets)');
        expect(html).toContain('Unavailable (zero liabilities)');
    });

    it('rejects unreconciled totals, stale ratios, and invalid timestamps', () => {
        const input = reportInput();
        expect(() => renderFinancialRatiosReportHtml({ ...input, netWorth: 70 })).toThrow(/reconcile/i);
        expect(() => renderFinancialRatiosReportHtml({
            ...input, ratios: { ...input.ratios, liabilitiesToAssets: 0.5 }
        })).toThrow(/do not match/i);
        expect(() => renderFinancialRatiosReportHtml({ ...input, generatedAt: 'invalid' })).toThrow(/timestamp/i);
    });
});
