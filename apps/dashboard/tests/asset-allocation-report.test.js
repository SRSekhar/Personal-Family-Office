import { describe, expect, it } from 'vitest';
import { renderAssetAllocationReportHtml } from '../asset-allocation-report.js';

describe('renderAssetAllocationReportHtml', () => {
    it('renders category totals and concentration metrics in standalone HTML', () => {
        const html = renderAssetAllocationReportHtml({
            entries: [{ category: 'Investments', value: 75 }, { category: 'Cash & deposits', value: 25 }],
            generatedAt: '2026-10-26T10:00:00.000Z'
        });
        expect(html).toMatch(/<!doctype html/i);
        expect(html).toContain('Asset allocation by category');
        expect(html).toContain('₹100.00');
        expect(html).toContain('Investments');
        expect(html).toContain('75%');
        expect(html).toContain('25%');
        expect(html).toContain('0.625');
        expect(html).toContain('1.60');
        expect(html).toContain('does not measure holding-level diversification');
        expect(html).not.toMatch(/<script\b|<iframe\b|<img\b/i);
        expect(html).not.toMatch(/https?:\/\//i);
    });

    it('escapes category names and rejects invalid totals or timestamps', () => {
        const html = renderAssetAllocationReportHtml({
            entries: [{ category: '<img src=x onerror=alert(1)>', value: 100 }],
            generatedAt: '2026-10-26T10:00:00.000Z'
        });
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toMatch(/<img\b/i);
        expect(() => renderAssetAllocationReportHtml({ entries: [], generatedAt: '2026-10-26T10:00:00.000Z' })).toThrow();
        expect(() => renderAssetAllocationReportHtml({ entries: [{ category: 'Cash', value: 0 }], generatedAt: '2026-10-26T10:00:00.000Z' })).toThrow(/positive-value/);
        expect(() => renderAssetAllocationReportHtml({ entries: [{ category: 'Cash', value: -1 }], generatedAt: '2026-10-26T10:00:00.000Z' })).toThrow(/valid/);
        expect(() => renderAssetAllocationReportHtml({ entries: [{ category: 'Cash', value: 1 }], generatedAt: 'invalid' })).toThrow(/timestamp/);
    });
});
