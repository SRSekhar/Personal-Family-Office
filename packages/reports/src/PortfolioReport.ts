import type { PortfolioAnalysis } from '@pfo/analytics';

export interface PortfolioReportInput {
    readonly analysis: PortfolioAnalysis;
    /** Valuation date/time represented by the selected domain records. */
    readonly asOfDate: Date;
    /** Explicit generation timestamp so report creation remains reproducible. */
    readonly generatedAt: Date;
}

export interface PortfolioReportAllocation {
    readonly category: string;
    readonly value: number;
    /** Fraction of total assets, from 0 through 1. */
    readonly weight: number;
}

export interface PortfolioReportData {
    readonly schemaVersion: number;
    readonly portfolioId: string;
    readonly portfolioName: string;
    readonly currency: string;
    readonly asOfDate: string;
    readonly generatedAt: string;
    readonly positionCount: number;
    readonly totalAssets: number;
    readonly totalLiabilities: number;
    readonly netWorth: number;
    readonly allocations: readonly PortfolioReportAllocation[];
}

/**
 * Creates a versioned, serializable report model from validated portfolio
 * analysis. Dates are serialized as ISO-8601 UTC timestamps.
 */
export function createPortfolioReport({
    analysis,
    asOfDate,
    generatedAt
}: PortfolioReportInput): PortfolioReportData {
    assertValidDate('asOfDate', asOfDate);
    assertValidDate('generatedAt', generatedAt);

    if (analysis.currency !== analysis.netWorth.currency ||
        analysis.currency !== analysis.assetAllocation.currency) {
        throw new RangeError('Portfolio analysis results must use one consistent currency.');
    }

    if (!Number.isInteger(analysis.positionCount) || analysis.positionCount < 0) {
        throw new RangeError('positionCount must be a non-negative integer.');
    }

    const report: PortfolioReportData = {
        schemaVersion: 1,
        portfolioId: analysis.portfolioId,
        portfolioName: analysis.portfolioName,
        currency: analysis.currency,
        asOfDate: asOfDate.toISOString(),
        generatedAt: generatedAt.toISOString(),
        positionCount: analysis.positionCount,
        totalAssets: analysis.netWorth.totalAssets.amount,
        totalLiabilities: analysis.netWorth.totalLiabilities.amount,
        netWorth: analysis.netWorth.netWorth.amount,
        allocations: analysis.assetAllocation.allocations.map((allocation) => ({
            category: allocation.category,
            value: allocation.value.amount,
            weight: allocation.weight
        }))
    };

    validatePortfolioReport(report);
    return {
        ...report,
        allocations: [...report.allocations].sort(compareAllocationCategory)
    };
}

/**
 * Renders a self-contained, script-free HTML report.
 *
 * All dynamic text is HTML-escaped. The report contains no remote assets,
 * scripts, tracking, or external stylesheets and can be opened offline.
 */
export function renderPortfolioReportHtml(report: PortfolioReportData): string {
    validatePortfolioReport(report);

    const allocations = [...report.allocations].sort(compareAllocationCategory);
    const allocationRows = allocations.length === 0
        ? '<p class="empty-state">No asset positions were selected for allocation.</p>'
        : `<table>
                <caption>Asset allocation by category</caption>
                <thead>
                    <tr>
                        <th scope="col">Category</th>
                        <th scope="col" class="numeric">Value</th>
                        <th scope="col" class="numeric">Allocation</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map((allocation) => `<tr>
                        <th scope="row">${escapeHtml(allocation.category)}</th>
                        <td class="numeric">${escapeHtml(formatMoney(allocation.value, report.currency))}</td>
                        <td class="numeric">${escapeHtml(formatPercentage(allocation.weight))}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Financial Summary — ${escapeHtml(report.portfolioName)}</title>
    <style>
        :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { margin: 0; background: #f4f6f8; color: #17202a; line-height: 1.5; }
        main { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
        header, section, footer { background: #fff; border: 1px solid #dfe5eb; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .eyebrow { color: #526579; font-size: .8rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        h1 { margin: .25rem 0 1rem; font-size: clamp(1.7rem, 4vw, 2.4rem); overflow-wrap: anywhere; }
        h2 { margin-top: 0; font-size: 1.25rem; }
        .metadata { display: flex; flex-wrap: wrap; gap: .5rem 2rem; color: #526579; font-size: .9rem; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; }
        .metric { border: 1px solid #e4e9ef; border-radius: 8px; padding: 1rem; min-width: 0; }
        .metric-label { display: block; color: #526579; font-size: .85rem; }
        .metric-value { display: block; margin-top: .35rem; font-size: clamp(1.15rem, 2.8vw, 1.55rem); font-weight: 700; overflow-wrap: anywhere; }
        table { width: 100%; border-collapse: collapse; }
        caption { text-align: left; padding-bottom: .75rem; color: #526579; }
        th, td { border-bottom: 1px solid #e4e9ef; padding: .8rem .5rem; text-align: left; overflow-wrap: anywhere; }
        thead th { color: #526579; font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
        .numeric { text-align: right; font-variant-numeric: tabular-nums; }
        .empty-state, footer { color: #526579; font-size: .9rem; }
        footer p { margin: .25rem 0; }
        @media print { body { background: #fff; } main { max-width: none; padding: 0; } header, section, footer { break-inside: avoid; border-color: #cfd6de; } }
    </style>
</head>
<body>
    <main>
        <header>
            <p class="eyebrow">PFO OS · Financial Summary</p>
            <h1 id="report-title">${escapeHtml(report.portfolioName)}</h1>
            <div class="metadata">
                <span>As of ${escapeHtml(formatDate(report.asOfDate))}</span>
                <span>Currency: ${escapeHtml(report.currency)}</span>
                <span>Positions: ${String(report.positionCount)}</span>
            </div>
        </header>
        <section aria-labelledby="net-worth-heading">
            <h2 id="net-worth-heading">Net worth summary</h2>
            <div class="metrics">
                <div class="metric"><span class="metric-label">Total assets</span><span class="metric-value">${escapeHtml(formatMoney(report.totalAssets, report.currency))}</span></div>
                <div class="metric"><span class="metric-label">Total liabilities</span><span class="metric-value">${escapeHtml(formatMoney(report.totalLiabilities, report.currency))}</span></div>
                <div class="metric"><span class="metric-label">Net worth</span><span class="metric-value">${escapeHtml(formatMoney(report.netWorth, report.currency))}</span></div>
            </div>
        </section>
        <section aria-labelledby="allocation-heading">
            <h2 id="allocation-heading">Asset allocation</h2>
            ${allocationRows}
        </section>
        <footer>
            <p>Generated ${escapeHtml(formatTimestamp(report.generatedAt))} (UTC).</p>
            <p>Informational summary based on the selected records and their supplied valuations. Not investment, tax, or legal advice.</p>
        </footer>
    </main>
</body>
</html>`;
}

function validatePortfolioReport(report: PortfolioReportData): void {
    if (report.schemaVersion !== 1) {
        throw new RangeError('Unsupported portfolio report schema version.');
    }

    if (report.portfolioId.trim().length === 0 ||
        report.portfolioName.trim().length === 0 ||
        report.currency.trim().length === 0) {
        throw new RangeError('Portfolio report requires a portfolio ID, name, and currency.');
    }

    assertValidDateString('asOfDate', report.asOfDate);
    assertValidDateString('generatedAt', report.generatedAt);

    if (!Number.isInteger(report.positionCount) || report.positionCount < 0) {
        throw new RangeError('positionCount must be a non-negative integer.');
    }

    if (![report.totalAssets, report.totalLiabilities, report.netWorth].every(Number.isFinite) ||
        report.totalAssets < 0 ||
        report.totalLiabilities < 0) {
        throw new RangeError('Portfolio report totals must be finite; assets and liabilities cannot be negative.');
    }

    if (report.netWorth !== report.totalAssets - report.totalLiabilities) {
        throw new RangeError('Portfolio report net worth must equal total assets minus total liabilities.');
    }

    if (!Array.isArray(report.allocations)) {
        throw new RangeError('Portfolio report allocations must be an array.');
    }

    for (const allocation of report.allocations) {
        if (allocation === null ||
            typeof allocation !== 'object' ||
            typeof allocation.category !== 'string' ||
            allocation.category.trim().length === 0 ||
            !Number.isFinite(allocation.value) ||
            allocation.value < 0 ||
            !Number.isFinite(allocation.weight) ||
            allocation.weight < 0 ||
            allocation.weight > 1) {
            throw new RangeError('Portfolio report allocations contain invalid values.');
        }
    }
}

function assertValidDate(name: string, value: Date): void {
    if (Number.isNaN(value.getTime())) {
        throw new RangeError(`${name} must be a valid Date.`);
    }
}

function assertValidDateString(name: string, value: string): void {
    if (value.trim().length === 0) {
        throw new RangeError(`${name} must be a valid ISO-8601 UTC timestamp.`);
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== value) {
        throw new RangeError(`${name} must be a valid ISO-8601 UTC timestamp.`);
    }
}

function compareAllocationCategory(
    left: PortfolioReportAllocation,
    right: PortfolioReportAllocation
): number {
    return left.category < right.category ? -1 : left.category > right.category ? 1 : 0;
}

function formatMoney(amount: number, currency: string): string {
    const formattedAmount = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);

    return `${currency} ${formattedAmount}`;
}

function formatPercentage(weight: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'percent',
        maximumFractionDigits: 2
    }).format(weight);
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeZone: 'UTC'
    }).format(new Date(value));
}

function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
    }).format(new Date(value));
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
