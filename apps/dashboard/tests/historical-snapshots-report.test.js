import { describe, expect, it } from 'vitest';
import { renderHistoricalSnapshotsReportHtml } from '../historical-snapshots-report.js';

const snapshots = [
    { date: '2022-12-31', currency: 'INR', records: [
        { id: 'cash-2022', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 240000 },
        { id: 'investment-2022', name: 'Investment portfolio', category: 'Investments', type: 'asset', value: 780000 },
        { id: 'home-2022', name: 'Residential property', category: 'Property', type: 'asset', value: 3500000 },
        { id: 'loan-2022', name: 'Home loan', category: 'Home loan', type: 'liability', value: 2100000 }
    ] },
    { date: '2024-12-31', currency: 'INR', records: [
        { id: 'cash-2024', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 320000 },
        { id: 'investment-2024', name: 'Investment portfolio', category: 'Investments', type: 'asset', value: 1250000 },
        { id: 'home-2024', name: 'Residential property', category: 'Property', type: 'asset', value: 3900000 },
        { id: 'loan-2024', name: 'Home loan', category: 'Home loan', type: 'liability', value: 1750000 }
    ] }
];

describe('renderHistoricalSnapshotsReportHtml', () => {
    it('renders only captured snapshots and reconciled balance-sheet history', () => {
        const html = renderHistoricalSnapshotsReportHtml({
            snapshots, currency: 'INR', generatedAt: '2026-10-27T02:00:00.000Z'
        });
        expect(html).toMatch(/<!doctype html/i);
        expect(html).toContain('Historical net worth');
        expect(html).toContain('2,420,000');
        expect(html).toContain('3,720,000');
        expect(html).toContain('1,300,000');
        expect(html).toContain('missing dates are not interpolated');
        expect(html).not.toContain('2023');
        expect(html).toContain('point-in-time balance sheets');
        expect(html).not.toMatch(/<script\b|<iframe\b|<img\b/i);
        expect(html).not.toMatch(/https?:\/\//i);
    });

    it('rejects empty history, invalid snapshots, and invalid timestamps', () => {
        expect(() => renderHistoricalSnapshotsReportHtml({
            snapshots: [], currency: 'INR', generatedAt: '2026-10-27T02:00:00.000Z'
        })).toThrow(/at least one/i);
        expect(() => renderHistoricalSnapshotsReportHtml({
            snapshots: [{ date: '2023-02-30', currency: 'INR', records: [] }],
            currency: 'INR', generatedAt: '2026-10-27T02:00:00.000Z'
        })).toThrow();
        expect(() => renderHistoricalSnapshotsReportHtml({
            snapshots, currency: 'INR', generatedAt: 'invalid'
        })).toThrow(/timestamp/i);
    });
});
