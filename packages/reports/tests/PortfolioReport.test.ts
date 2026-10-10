import type { PortfolioAnalysis } from '@pfo/analytics';
import { Currency, Money } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import {
    createPortfolioReport,
    renderPortfolioReportHtml
} from '../src/PortfolioReport.js';

function makeAnalysis(overrides: Partial<PortfolioAnalysis> = {}): PortfolioAnalysis {
    const totalAssets = new Money(100_000, Currency.INR);
    const totalLiabilities = new Money(25_000, Currency.INR);

    return {
        portfolioId: 'portfolio-1',
        portfolioName: 'Household',
        currency: Currency.INR,
        positionCount: 3,
        netWorth: {
            currency: Currency.INR,
            totalAssets,
            totalLiabilities,
            netWorth: totalAssets.subtract(totalLiabilities)
        },
        assetAllocation: {
            currency: Currency.INR,
            totalValue: totalAssets,
            allocations: [
                { category: 'Cash', value: new Money(25_000, Currency.INR), weight: 0.25 },
                { category: 'Equity', value: new Money(75_000, Currency.INR), weight: 0.75 }
            ]
        },
        ...overrides
    };
}

function createReport(analysis: PortfolioAnalysis = makeAnalysis()): ReturnType<typeof createPortfolioReport> {
    return createPortfolioReport({
        analysis,
        asOfDate: new Date('2026-10-01T00:00:00.000Z'),
        generatedAt: new Date('2026-10-10T06:00:00.000Z')
    });
}

describe('createPortfolioReport', () => {
    it('creates a serializable report with deterministic dates and totals', () => {
        const report = createReport();

        expect(report.schemaVersion).toBe(1);
        expect(report.portfolioId).toBe('portfolio-1');
        expect(report.portfolioName).toBe('Household');
        expect(report.asOfDate).toBe('2026-10-01T00:00:00.000Z');
        expect(report.generatedAt).toBe('2026-10-10T06:00:00.000Z');
        expect(report.totalAssets).toBe(100_000);
        expect(report.totalLiabilities).toBe(25_000);
        expect(report.netWorth).toBe(75_000);
        expect(report.allocations.map((item) => item.category)).toEqual(['Cash', 'Equity']);
    });

    it('rejects invalid dates and inconsistent currencies', () => {
        expect(() => createPortfolioReport({
            analysis: makeAnalysis(),
            asOfDate: new Date(Number.NaN),
            generatedAt: new Date('2026-10-10T06:00:00.000Z')
        })).toThrow(/asOfDate must be a valid Date/);

        const inconsistent = makeAnalysis({
            assetAllocation: {
                currency: Currency.USD,
                totalValue: new Money(100_000, Currency.USD),
                allocations: []
            }
        });

        expect(() => createReport(inconsistent)).toThrow(/one consistent currency/);
    });

    it('rejects invalid allocation weights', () => {
        const invalid = makeAnalysis({
            assetAllocation: {
                currency: Currency.INR,
                totalValue: new Money(100_000, Currency.INR),
                allocations: [
                    { category: 'Equity', value: new Money(100_000, Currency.INR), weight: 1.5 }
                ]
            }
        });

        expect(() => createReport(invalid)).toThrow(/allocations contain invalid values/);
    });
});

describe('renderPortfolioReportHtml', () => {
    it('renders a standalone semantic report with financial summary and allocation', () => {
        const html = renderPortfolioReportHtml(createReport());

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('<main>');
        expect(html).toContain('Net worth summary');
        expect(html).toContain('Asset allocation by category');
        expect(html).toContain('INR 1,00,000.00');
        expect(html).toContain('INR 75,000.00');
        expect(html).toContain('25%');
        expect(html).toContain('75%');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('https://');
    });

    it('rejects non-canonical or impossible report timestamps', () => {
        const impossibleDate = {
            ...createReport(),
            asOfDate: '2026-02-30T00:00:00.000Z'
        };
        const nonCanonicalUtc = {
            ...createReport(),
            generatedAt: '2026-10-10T06:00:00.000+00:00'
        };

        expect(() => renderPortfolioReportHtml(impossibleDate))
            .toThrow(/asOfDate must be a valid ISO-8601 UTC timestamp/);
        expect(() => renderPortfolioReportHtml(nonCanonicalUtc))
            .toThrow(/generatedAt must be a valid ISO-8601 UTC timestamp/);
    });

    it('escapes untrusted portfolio and category text', () => {
        const analysis = makeAnalysis({
            portfolioName: '<script>alert("x")</script> & Family',
            assetAllocation: {
                currency: Currency.INR,
                totalValue: new Money(100_000, Currency.INR),
                allocations: [
                    {
                        category: '<img src=x onerror=alert(1)> & Cash',
                        value: new Money(100_000, Currency.INR),
                        weight: 1
                    }
                ]
            }
        });

        const html = renderPortfolioReportHtml(createReport(analysis));

        expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Family');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; Cash');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img src=x');
    });

    it('rejects a serialized report with inconsistent net-worth totals', () => {
        const inconsistentReport = {
            ...createReport(),
            netWorth: 76_000
        };

        expect(() => renderPortfolioReportHtml(inconsistentReport))
            .toThrow(/net worth must equal total assets minus total liabilities/);
    });

    it('renders a useful empty state when there are no allocations', () => {
        const analysis = makeAnalysis({
            assetAllocation: {
                currency: Currency.INR,
                totalValue: Money.zero(Currency.INR),
                allocations: []
            }
        });

        expect(renderPortfolioReportHtml(createReport(analysis)))
            .toContain('No asset positions were selected for allocation.');
    });
});
