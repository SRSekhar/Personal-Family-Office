import { analyzeReturnSeries } from './analytics-runtime/RiskAnalysis.js';

function assertMatchesAnalysis(input, result) {
    const calculated = analyzeReturnSeries(input);
    if (!result || typeof result !== 'object') throw new TypeError('A validated return-risk result is required.');
    for (const key of [
        'observationCount', 'cumulativeReturn', 'annualizedVolatility', 'maximumDrawdown',
        'worstPeriodReturn', 'annualizedSharpeRatio', 'annualizedSortinoRatio', 'negativePeriodCount'
    ]) {
        if (result[key] !== calculated[key]) {
            throw new RangeError('Return-risk result does not match the supplied observations and assumptions.');
        }
    }
    return calculated;
}

const percent = (value) => value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value * 100) + '%';
const ratio = (value) => value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value);

/** Render a validated, self-contained HTML report from the exact supplied return series. */
export function renderReturnRiskReportHtml({ input, result }) {
    const calculated = assertMatchesAnalysis(input, result);
    const observationRows = input.observations.map((observation) =>
        `<tr><td>${observation.date}</td><td>${percent(observation.returnRate)}</td></tr>`).join('\n');
    const generatedLabel = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date());
    const assumptions = [
        `Periods per year: ${input.periodsPerYear}`,
        `Risk-free return per period: ${input.riskFreeRatePerPeriod === undefined ? 'Not supplied' : percent(input.riskFreeRatePerPeriod)}`,
        `Minimum acceptable return per period: ${input.minimumAcceptableReturnPerPeriod === undefined ? 'Not supplied' : percent(input.minimumAcceptableReturnPerPeriod)}`
    ].map((item) => `<li>${item}</li>`).join('\n');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PFO OS — Return Risk Analysis Report</title><style>
:root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}
*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}
main{max-width:1000px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}
h1{font-size:2rem;margin:.25rem 0}h2{font-size:1.15rem;margin:0 0 .8rem}p{margin:.5rem 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
.metric,section{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.metric span{display:block;color:var(--muted);font-size:.9rem}.metric strong{display:block;font-size:1.4rem;overflow-wrap:anywhere;margin-top:.25rem}
section{margin-top:1rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.7rem;border-bottom:1px solid var(--line)}td:last-child,th:last-child{text-align:right;font-variant-numeric:tabular-nums}
ul{margin:.2rem 0;padding-left:1.3rem}footer{margin-top:1.5rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:.9rem}
@media(max-width:600px){body{padding:1rem}h1{font-size:1.55rem}.metric,section{padding:.9rem}}@media print{body{padding:0}header,section,.metric{break-inside:avoid;background:#fff}}
</style></head><body><main>
<header><p class="eyebrow">PFO OS · Private local report</p><h1>Return risk analysis</h1><p>Generated locally: ${generatedLabel}. ${calculated.observationCount} dated return observations.</p><p>Descriptive analysis of the exact user-supplied series. No market data is fetched or inferred.</p></header>
<div class="grid">
<article class="metric"><span>Observations</span><strong>${calculated.observationCount}</strong></article>
<article class="metric"><span>Cumulative return</span><strong>${percent(calculated.cumulativeReturn)}</strong></article>
<article class="metric"><span>Annualized volatility</span><strong>${percent(calculated.annualizedVolatility)}</strong></article>
<article class="metric"><span>Maximum drawdown</span><strong>${percent(calculated.maximumDrawdown)}</strong></article>
<article class="metric"><span>Worst period return</span><strong>${percent(calculated.worstPeriodReturn)}</strong></article>
<article class="metric"><span>Negative periods</span><strong>${calculated.negativePeriodCount}</strong></article>
<article class="metric"><span>Annualized Sharpe ratio</span><strong>${ratio(calculated.annualizedSharpeRatio)}</strong></article>
<article class="metric"><span>Annualized Sortino ratio</span><strong>${ratio(calculated.annualizedSortinoRatio)}</strong></article>
</div>
<section><h2>Calculation assumptions</h2><ul>${assumptions}</ul><p>Volatility uses sample standard deviation annualized by the square root of periods per year. Drawdown uses the compounded wealth index. Sharpe and Sortino are omitted when required assumptions or data are unavailable.</p></section>
<section><h2>Return observations used</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Period return</th></tr></thead><tbody>${observationRows}</tbody></table></div></section>
<footer class="privacy"><strong>Limitations and privacy</strong><p>These metrics describe the supplied historical observations; they are not a forecast, risk rating, guarantee, or investment recommendation. Results depend on the completeness and regular interval spacing of the supplied series. This report is generated locally, uses no scripts or remote assets, and may contain sensitive financial information. Keep it private.</p></footer>
</main></body></html>`;
}
