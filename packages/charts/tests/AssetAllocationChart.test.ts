import { describe, expect, it } from 'vitest';

import { renderAssetAllocationChart } from '../src/AssetAllocationChart.js';

const validInput = {
    currency: 'INR',
    totalValue: 100_000,
    allocations: [
        { category: 'Cash', value: 25_000, weight: 0.25 },
        { category: 'Equity', value: 75_000, weight: 0.75 }
    ]
} as const;

describe('renderAssetAllocationChart', () => {
    it('renders a visual bar and an accessible tabular breakdown', () => {
        const html = renderAssetAllocationChart(validInput);

        expect(html).toContain('<svg');
        expect(html).toContain('role="img"');
        expect(html).toContain('<table>');
        expect(html).toContain('<caption>Asset allocation breakdown</caption>');
        expect(html).toContain('INR 100000.00');
        expect(html).toContain('25.00%');
        expect(html).toContain('Cash');
        expect(html).toContain('Equity');
    });

    it('escapes untrusted category and title text', () => {
        const html = renderAssetAllocationChart({
            ...validInput,
            title: '<script>alert("x")</script>',
            allocations: [
                { category: '<img src=x onerror=alert(1)>', value: 100_000, weight: 1 }
            ]
        });

        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('handles an empty allocation without dividing by zero', () => {
        const html = renderAssetAllocationChart({
            currency: 'INR',
            totalValue: 0,
            allocations: []
        });

        expect(html).toContain('No asset allocation data is available.');
        expect(html).toContain('INR 0.00');
        expect(html).not.toContain('<svg');
    });

    it('rejects invalid currency codes, totals, duplicate categories, and inconsistent weights', () => {
        expect(() => renderAssetAllocationChart({ ...validInput, currency: 'rupees' })).toThrow(/currency/);
        expect(() => renderAssetAllocationChart({ ...validInput, totalValue: Number.NaN })).toThrow(/totalValue/);
        expect(() => renderAssetAllocationChart({
            ...validInput,
            allocations: [
                { category: 'Cash', value: 50_000, weight: 0.5 },
                { category: 'Cash', value: 50_000, weight: 0.5 }
            ]
        })).toThrow(/Duplicate allocation category/);
        expect(() => renderAssetAllocationChart({
            ...validInput,
            allocations: [
                { category: 'Cash', value: 25_000, weight: 0.25 },
                { category: 'Equity', value: 75_000, weight: 0.65 }
            ]
        })).toThrow(/weights must sum/);
    });
});
