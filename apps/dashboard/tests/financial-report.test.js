import { describe, expect, it } from 'vitest';
import { renderFinancialReportHtml } from '../financial-report.js';

const generatedAt = new Date('2026-10-19T12:00:00.000Z');
const records = [
    { id: 'cash-1', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 125000 },
    { id: 'fund-1', name: 'Mutual fund portfolio', category: 'Investments', type: 'asset', value: 375000 },
    { id: 'loan-1', name: 'Home loan', category: 'Home loan', type: 'liability', value: 80000 }
];

describe('renderFinancialReportHtml', () => {
    it('renders a complete offline report with totals, allocation, and records', () => {
        const html = renderFinancialReportHtml({ records, currency: 'INR', generatedAt });

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Total assets');
        expect(html).toContain('₹5,00,000');
        expect(html).toContain('₹80,000');
        expect(html).toContain('₹4,20,000');
        expect(html).toContain('Savings account');
        expect(html).toContain('Mutual fund portfolio');
        expect(html).toContain('Home loan');
        expect(html).toContain('Cash &amp; deposits');
        expect(html).toContain('75.0%');
        expect(html).toContain('does not track valuation dates');
        expect(html).toContain('2026-10-19T12:00:00.000Z');
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toMatch(/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i);
    });

    it('escapes untrusted names and categories before rendering HTML', () => {
        const html = renderFinancialReportHtml({
            records: [{ id: 'x', name: '<script>alert(1)</script>', category: 'A&B', type: 'asset', value: 1 }],
            generatedAt
        });

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('A&amp;B');
        expect(html).not.toMatch(/<script\b/i);
    });

    it('renders empty records without invalid allocation percentages', () => {
        const html = renderFinancialReportHtml({ records: [], generatedAt });
        expect(html).toContain('No assets recorded.');
        expect(html).toContain('No financial records.');
        expect(html).not.toContain('NaN%');
    });

    it('rejects malformed records and duplicate IDs rather than generating partial reports', () => {
        expect(() => renderFinancialReportHtml({ records: [{ id: '', name: 'Invalid', category: 'Other', type: 'asset', value: 1 }], generatedAt }))
            .toThrow('invalid or duplicate entries');
        expect(() => renderFinancialReportHtml({ records: [
            { id: 'same', name: 'One', category: 'Other', type: 'asset', value: 1 },
            { id: 'same', name: 'Two', category: 'Other', type: 'asset', value: 2 }
        ], generatedAt })).toThrow('invalid or duplicate entries');
    });

    it('rejects invalid timestamps, currency codes, and numeric overflow', () => {
        expect(() => renderFinancialReportHtml({ records, generatedAt: new Date(Number.NaN) })).toThrow('generation date');
        expect(() => renderFinancialReportHtml({ records, currency: 'rupees', generatedAt })).toThrow('currency code');
        expect(() => renderFinancialReportHtml({ records: [
            { id: 'a', name: 'A', category: 'Other', type: 'asset', value: Number.MAX_VALUE },
            { id: 'b', name: 'B', category: 'Other', type: 'asset', value: Number.MAX_VALUE }
        ], generatedAt })).toThrow('numeric range');
    });
});
