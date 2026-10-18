export type FireReportContributionTiming = 'beginning' | 'end';

export interface FireScenarioReportAssumptions {
    readonly currentPortfolio: number;
    readonly annualContribution: number;
    readonly yearsToRetirement: number;
    readonly expectedAnnualReturn: number;
    readonly annualInflationRate: number;
    readonly annualRetirementSpendingToday: number;
    readonly withdrawalRate: number;
    readonly contributionTiming: FireReportContributionTiming;
}

export interface FireScenarioReportResult {
    readonly yearsToRetirement: number;
    readonly projectedPortfolioAtRetirement: number;
    readonly projectedAnnualRetirementSpending: number;
    readonly targetCorpusAtRetirement: number;
    readonly surplusOrShortfall: number;
    readonly isOnTrack: boolean;
    readonly contributionTiming: FireReportContributionTiming;
}

export interface FireScenarioReportScenarioInput {
    readonly id: string;
    readonly name: string;
    readonly assumptions: FireScenarioReportAssumptions;
    readonly result: FireScenarioReportResult;
}

export interface FireScenarioReportInput {
    readonly currency: string;
    readonly generatedAt: Date;
    readonly scenarios: readonly FireScenarioReportScenarioInput[];
}

export interface FireScenarioReportData {
    readonly schemaVersion: 1;
    readonly currency: string;
    readonly generatedAt: string;
    readonly scenarios: readonly FireScenarioReportScenarioInput[];
}

export function createFireScenarioReport({
    currency,
    generatedAt,
    scenarios
}: FireScenarioReportInput): FireScenarioReportData {
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) {
        throw new RangeError('generatedAt must be a valid Date.');
    }
    const report: FireScenarioReportData = {
        schemaVersion: 1,
        currency,
        generatedAt: generatedAt.toISOString(),
        scenarios: scenarios.map((scenario) => ({
            ...scenario,
            assumptions: { ...scenario.assumptions },
            result: { ...scenario.result }
        }))
    };
    validateFireScenarioReport(report);
    return report;
}

/** Renders a self-contained, script-free HTML report that can be opened offline. */
export function renderFireScenarioReportHtml(report: FireScenarioReportData): string {
    validateFireScenarioReport(report);
    const rows = report.scenarios.map((scenario) => {
        const input = scenario.assumptions;
        const result = scenario.result;
        const assumptions = [
            `Current portfolio: ${formatMoney(input.currentPortfolio, report.currency)}`,
            `Annual contribution: ${formatMoney(input.annualContribution, report.currency)}`,
            `Years to retirement: ${input.yearsToRetirement}`,
            `Expected return: ${formatPercentage(input.expectedAnnualReturn)}`,
            `Inflation: ${formatPercentage(input.annualInflationRate)}`,
            `Annual spending today: ${formatMoney(input.annualRetirementSpendingToday, report.currency)}`,
            `Withdrawal rate: ${formatPercentage(input.withdrawalRate)}`,
            `Contribution timing: ${input.contributionTiming === 'beginning' ? 'Beginning of year' : 'End of year'}`
        ].join(' · ');
        return `<tr>
            <th scope="row">${escapeHtml(scenario.name)}<p class="assumptions">${escapeHtml(assumptions)}</p></th>
            <td>${escapeHtml(formatMoney(result.projectedPortfolioAtRetirement, report.currency))}</td>
            <td>${escapeHtml(formatMoney(result.projectedAnnualRetirementSpending, report.currency))}</td>
            <td>${escapeHtml(formatMoney(result.targetCorpusAtRetirement, report.currency))}</td>
            <td>${escapeHtml((result.surplusOrShortfall < 0 ? '−' : '+') + formatMoney(Math.abs(result.surplusOrShortfall), report.currency))}</td>
            <td><span class="status ${result.isOnTrack ? 'on-track' : 'shortfall'}">${result.isOnTrack ? 'On track under assumptions' : 'Shortfall under assumptions'}</span></td>
        </tr>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FIRE Scenario Report</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d3025;background:#f4f7f4}
body{margin:0;line-height:1.55}main{max-width:1200px;margin:0 auto;padding:2rem 1.25rem 3rem}
header,section,footer{background:#fff;border:1px solid #dce6dc;border-radius:12px;padding:1.4rem;margin-bottom:1rem}
.eyebrow{font-size:.78rem;font-weight:750;letter-spacing:.08em;color:#627568;text-transform:uppercase}
h1{font-size:clamp(1.7rem,4vw,2.4rem);margin:.3rem 0 .6rem;overflow-wrap:anywhere}h2{font-size:1.25rem;margin-top:0}
.metadata{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;color:#637268;font-size:.9rem}
.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:950px}caption{text-align:left;padding:.5rem 0 1rem;color:#637268}
th,td{border-bottom:1px solid #e5ece5;text-align:left;vertical-align:top;padding:.8rem .6rem;overflow-wrap:anywhere}
thead th{font-size:.78rem;color:#637268;text-transform:uppercase;letter-spacing:.04em}
.assumptions{font-weight:400;font-size:.78rem;color:#637268;max-width:360px;margin:.35rem 0 0}
.status{display:inline-block;padding:.3rem .5rem;border-radius:5px;font-size:.78rem;font-weight:700}.on-track{background:#e7f4ea;color:#236d49}.shortfall{background:#fff0e7;color:#995426}
footer{font-size:.9rem;color:#637268}footer p{margin:.25rem 0}
@media print{body{background:#fff}main{max-width:none;padding:0}header,section,footer{break-inside:avoid;border-color:#cfd8cf}.table-wrap{overflow:visible}table{min-width:0;font-size:9pt}.assumptions{font-size:8pt}}
@media(forced-colors:active){.status{border:1px solid currentColor}}
</style>
</head>
<body><main>
<header><p class="eyebrow">PFO OS · Retirement planning</p><h1>FIRE scenario report</h1><div class="metadata"><span>Generated <time datetime="${escapeHtml(report.generatedAt)}">${escapeHtml(formatTimestamp(report.generatedAt))} UTC</time></span><span>Currency: ${escapeHtml(report.currency)}</span><span>Scenarios: ${report.scenarios.length}</span></div></header>
<section aria-labelledby="results-heading"><h2 id="results-heading">Scenario comparison</h2><div class="table-wrap"><table><caption>Results are shown in the order entered, with each scenario's assumptions.</caption><thead><tr><th scope="col">Scenario and assumptions</th><th scope="col">Projected portfolio</th><th scope="col">Annual spending at retirement</th><th scope="col">Target corpus</th><th scope="col">Surplus / shortfall</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer><p>Deterministic illustrations based only on the assumptions shown. Not a forecast, investment recommendation, or guarantee.</p><p>Excludes taxes, fees, investment volatility, sequence-of-returns risk, changing contributions, pension or benefit income, and longevity adjustments.</p><p>This report is a downloaded local file. PFO OS does not upload or automatically save these assumptions.</p></footer>
</main></body></html>`;
}

function validateFireScenarioReport(value: unknown): asserts value is FireScenarioReportData {
    if (!isRecord(value) || value['schemaVersion'] !== 1) {
        throw new RangeError('FIRE scenario report must use schema version 1.');
    }
    if (typeof value['currency'] !== 'string' || !/^[A-Z]{3}$/.test(value['currency'])) {
        throw new RangeError('FIRE scenario report currency must be a three-letter uppercase code.');
    }
    if (typeof value['generatedAt'] !== 'string') {
        throw new RangeError('generatedAt must be a valid ISO-8601 UTC timestamp.');
    }
    assertValidDateString(value['generatedAt']);
    if (!Array.isArray(value['scenarios']) || value['scenarios'].length === 0) {
        throw new RangeError('FIRE scenario report must contain at least one scenario.');
    }
    const ids = new Set<string>();
    for (const candidate of value['scenarios']) {
        if (!isRecord(candidate) || typeof candidate['id'] !== 'string' || candidate['id'].trim() === ''
            || typeof candidate['name'] !== 'string' || candidate['name'].trim() === '') {
            throw new RangeError('Each FIRE report scenario requires a non-empty ID and name.');
        }
        if (ids.has(candidate['id'])) throw new RangeError('FIRE report scenario IDs must be unique.');
        ids.add(candidate['id']);
        if (!isRecord(candidate['assumptions']) || !isRecord(candidate['result'])) {
            throw new RangeError('Each FIRE report scenario requires assumptions and a result.');
        }
        const input = candidate['assumptions'];
        const result = candidate['result'];
        for (const field of ['currentPortfolio', 'annualContribution', 'annualRetirementSpendingToday']) {
            if (!isFiniteNumber(input[field]) || input[field] < 0) {
                throw new RangeError(`FIRE scenario ${field} must be a finite non-negative number.`);
            }
        }
        if (!Number.isInteger(input['yearsToRetirement']) || (input['yearsToRetirement'] as number) < 0) {
            throw new RangeError('FIRE scenario yearsToRetirement must be a non-negative integer.');
        }
        if (!isFiniteNumber(input['expectedAnnualReturn']) || input['expectedAnnualReturn'] <= -1
            || !isFiniteNumber(input['annualInflationRate']) || input['annualInflationRate'] < 0
            || !isFiniteNumber(input['withdrawalRate']) || input['withdrawalRate'] <= 0 || input['withdrawalRate'] > 1) {
            throw new RangeError('FIRE scenario rates are outside supported ranges.');
        }
        if (input['contributionTiming'] !== 'beginning' && input['contributionTiming'] !== 'end') {
            throw new RangeError('FIRE scenario contribution timing is invalid.');
        }
        for (const field of ['projectedPortfolioAtRetirement', 'projectedAnnualRetirementSpending', 'targetCorpusAtRetirement']) {
            if (!isFiniteNumber(result[field]) || result[field] < 0) {
                throw new RangeError(`FIRE scenario result ${field} must be finite and non-negative.`);
            }
        }
        if (!isFiniteNumber(result['surplusOrShortfall']) || typeof result['isOnTrack'] !== 'boolean'
            || !Number.isInteger(result['yearsToRetirement']) || result['yearsToRetirement'] !== input['yearsToRetirement']
            || result['contributionTiming'] !== input['contributionTiming']
            || result['surplusOrShortfall'] !== (result['projectedPortfolioAtRetirement'] as number) - (result['targetCorpusAtRetirement'] as number)
            || result['isOnTrack'] !== (result['surplusOrShortfall'] >= 0)) {
            throw new RangeError('FIRE scenario result is inconsistent with its result fields and assumptions.');
        }
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function assertValidDateString(value: string): void {
    const parsed = new Date(value);
    if (value.trim() === '' || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
        throw new RangeError('generatedAt must be a valid ISO-8601 UTC timestamp.');
    }
}
function formatMoney(amount: number, currency: string): string {
    return `${currency} ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}
function formatPercentage(rate: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 2 }).format(rate);
}
function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
}
function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
