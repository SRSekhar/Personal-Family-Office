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
        financialRatios: {
            liabilitiesToAssets: 0.25,
            netWorthToAssets: 0.75,
            assetsToLiabilities: 4
        },
        diversification: {
            categoryCount: 2,
            concentrationIndex: 0.625,
            effectiveCategoryCount: 1.6,
            largestCategoryShare: 0.75
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

        expect(report.schemaVersion).toBe(2);
        expect(report.portfolioId).toBe('portfolio-1');
        expect(report.portfolioName).toBe('Household');
        expect(report.asOfDate).toBe('2026-10-01T00:00:00.000Z');
        expect(report.generatedAt).toBe('2026-10-10T06:00:00.000Z');
        expect(report.totalAssets).toBe(100_000);
        expect(report.totalLiabilities).toBe(25_000);
        expect(report.netWorth).toBe(75_000);
        expect(report.financialRatios).toEqual({
            liabilitiesToAssets: 0.25,
            netWorthToAssets: 0.75,
            assetsToLiabilities: 4
        });
        expect(report.diversification).toEqual({
            categoryCount: 2,
            concentrationIndex: 0.625,
            effectiveCategoryCount: 1.6,
            largestCategoryShare: 0.75
        });
        expect(report.allocations.map((item) => item.category)).toEqual(['Cash', 'Equity']);
    });


    it('rejects invalid or inconsistent portfolio analysis metrics', () => {
        const invalidRatio = makeAnalysis({
            financialRatios: {
                liabilitiesToAssets: -1,
                netWorthToAssets: 0.75,
                assetsToLiabilities: 4
            }
        });
        const invalidConcentration = makeAnalysis({
            diversification: {
                categoryCount: 2,
                concentrationIndex: 1.2,
                effectiveCategoryCount: 1,
                largestCategoryShare: 0.75
            }
        });
        const missingMetrics = {
            ...createReport(),
            financialRatios: null
        };

        expect(() => createReport(invalidRatio)).toThrow(/financial ratios must be non-negative/);
        expect(() => createReport(invalidConcentration)).toThrow(/diversification metrics contain invalid values/);
        expect(() => renderPortfolioReportHtml(missingMetrics as unknown as ReturnType<typeof createPortfolioReport>))
            .toThrow(/financial ratios must be an object/);
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

    it('rejects nested monetary values with inconsistent currencies', () => {
        const base = makeAnalysis();
        const mismatchedAssets = makeAnalysis({
            netWorth: {
                ...base.netWorth,
                totalAssets: new Money(100_000, Currency.USD)
            }
        });
        const mismatchedAllocationTotal = makeAnalysis({
            assetAllocation: {
                ...base.assetAllocation,
                totalValue: new Money(100_000, Currency.USD)
            }
        });
        const mismatchedAllocationEntry = makeAnalysis({
            assetAllocation: {
                ...base.assetAllocation,
                allocations: [
                    { category: 'Equity', value: new Money(100_000, Currency.USD), weight: 1 }
                ]
            }
        });

        expect(() => createReport(mismatchedAssets))
            .toThrow(/one consistent currency/);
        expect(() => createReport(mismatchedAllocationTotal))
            .toThrow(/one consistent currency/);
        expect(() => createReport(mismatchedAllocationEntry))
            .toThrow(/one consistent currency/);
    });

    it('rejects mismatched net-worth and allocation total assets', () => {
        const base = makeAnalysis();
        const inconsistent = makeAnalysis({
            assetAllocation: {
                ...base.assetAllocation,
                totalValue: new Money(99_999, Currency.INR)
            }
        });

        expect(() => createReport(inconsistent))
            .toThrow(/asset-allocation total must equal net-worth total assets/);
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
        expect(html).toContain('Balance-sheet ratios');
        expect(html).toContain('Liabilities / assets');
        expect(html).toContain('Category concentration');
        expect(html).toContain('Concentration index (HHI)');
        expect(html).toContain('correlation-aware risk or diversification score');
        expect(html).toContain('Effective category count');
        expect(html).toContain('datetime="2026-10-01T00:00:00.000Z"');
        expect(html).toContain('datetime="2026-10-10T06:00:00.000Z"');
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

    it('rejects malformed currency codes before formatting', () => {
        const invalidCurrency = {
            ...createReport(),
            currency: '<script>'
        };

        expect(() => renderPortfolioReportHtml(invalidCurrency))
            .toThrow(/currency must be a three-letter uppercase code/);
    });

    it('rejects malformed top-level report payloads without leaking TypeErrors', () => {
        const invalidReports: unknown[] = [
            null,
            { ...createReport(), portfolioName: 42 },
            { ...createReport(), asOfDate: 20261001 },
            { ...createReport(), totalAssets: '100000' }
        ];

        for (const invalidReport of invalidReports) {
            expect(() => renderPortfolioReportHtml(
                invalidReport as ReturnType<typeof createPortfolioReport>
            )).toThrow(RangeError);
        }
    });

    it('rejects malformed allocation arrays and entries', () => {
        const nullAllocations = {
            ...createReport(),
            allocations: null
        } as unknown as ReturnType<typeof createPortfolioReport>;
        const nullEntry = {
            ...createReport(),
            allocations: [null]
        } as unknown as ReturnType<typeof createPortfolioReport>;
        const invalidCategory = {
            ...createReport(),
            allocations: [{ category: 42, value: 1, weight: 1 }]
        } as unknown as ReturnType<typeof createPortfolioReport>;

        expect(() => renderPortfolioReportHtml(nullAllocations))
            .toThrow(/allocations must be an array/);
        expect(() => renderPortfolioReportHtml(nullEntry))
            .toThrow(/allocations contain invalid values/);
        expect(() => renderPortfolioReportHtml(invalidCategory))
            .toThrow(/allocations contain invalid values/);
    });

    it('rejects allocation values and weights that do not reconcile', () => {
        const report = createReport();
        const inconsistentValues = {
            ...report,
            allocations: report.allocations.map((allocation, index) => index === 0
                ? { ...allocation, value: allocation.value - 1 }
                : allocation)
        };
        const inconsistentWeights = {
            ...report,
            allocations: report.allocations.map((allocation, index) => index === 0
                ? { ...allocation, weight: 0.2 }
                : { ...allocation, weight: 0.7 })
        };

        expect(() => renderPortfolioReportHtml(inconsistentValues))
            .toThrow(/allocation values must equal total assets/);
        expect(() => renderPortfolioReportHtml(inconsistentWeights))
            .toThrow(/allocation weights must sum to 1/);
    });

    it('rejects allocations when total assets are zero', () => {
        const zeroAssets = {
            ...createReport(),
            totalAssets: 0,
            totalLiabilities: 0,
            netWorth: 0,
            allocations: [
                { category: 'Cash', value: 0, weight: 1 }
            ]
        };

        expect(() => renderPortfolioReportHtml(zeroAssets))
            .toThrow(/allocations require positive total assets/);
    });

    it('rejects non-zero assets when the allocation list is empty', () => {
        const inconsistentReport = {
            ...createReport(),
            allocations: []
        };

        expect(() => renderPortfolioReportHtml(inconsistentReport))
            .toThrow(/allocation values must equal total assets/);
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
        const zeroAssets = Money.zero(Currency.INR);
        const liabilities = new Money(25_000, Currency.INR);
        const analysis = makeAnalysis({
            positionCount: 1,
            netWorth: {
                currency: Currency.INR,
                totalAssets: zeroAssets,
                totalLiabilities: liabilities,
                netWorth: zeroAssets.subtract(liabilities)
            },
            assetAllocation: {
                currency: Currency.INR,
                totalValue: zeroAssets,
                allocations: []
            },
            financialRatios: {
                liabilitiesToAssets: null,
                netWorthToAssets: null,
                assetsToLiabilities: 0
            },
            diversification: {
                categoryCount: 0,
                concentrationIndex: null,
                effectiveCategoryCount: null,
                largestCategoryShare: null
            }
        });

        const html = renderPortfolioReportHtml(createReport(analysis));
        expect(html).toContain('No asset positions were selected for allocation.');
        expect(html).toContain('Unavailable (zero denominator)');
        expect(html).toContain('Concentration index (HHI)');
        expect(html).toContain('Unavailable</td>');
    });
});
