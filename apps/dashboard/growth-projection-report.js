import { projectCompoundGrowthSchedule } from './calculators-runtime/CompoundGrowth.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value * 100) + '%';

/** Render a standalone report after verifying the supplied schedule against canonical calculator output. */
export function renderGrowthProjectionReportHtml({ input, rows }) {
    if (!input || typeof input !== 'object' || !Array.isArray(rows)) throw new TypeError('A projection input and calculated schedule are required.');
    const calculated = projectCompoundGrowthSchedule(input);
    if (rows.length !== calculated.length || rows.some((row, index) => !row || ['year', 'projectedValue', 'totalContributions', 'estimatedGrowth'].some((key) => row[key] !== calculated[index][key]))) {
        throw new RangeError('Projection schedule does not match the supplied assumptions.');
    }
    const finalRow = calculated[calculated.length - 1];
    const timingLabel = input.contributionTiming === 'beginning' ? 'Beginning of year' : 'End of year';
    const generatedLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date());
    const scheduleRows = calculated.map((row) => '<tr><td>' + row.year + '</td><td>' + money(row.projectedValue) + '</td><td>' + money(row.totalContributions) + '</td><td>' + money(row.estimatedGrowth) + '</td></tr>').join('\n');
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>PFO OS — Compound Growth Projection</title><style>' +
        ':root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}' +
        '*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}' +
        'main{max-width:1000px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}' +
        'h1{font-size:2rem;margin:.25rem 0}h2{font-size:1.15rem;margin:0 0 .8rem}p{margin:.5rem 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}' +
        '.metric,section{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.metric span{display:block;color:var(--muted);font-size:.9rem}.metric strong{display:block;font-size:1.45rem;overflow-wrap:anywhere;margin-top:.25rem}' +
        'section{margin-top:1rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.7rem;border-bottom:1px solid var(--line)}td:not(:first-child),th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}' +
        'footer{margin-top:1.5rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:.9rem}@media(max-width:600px){body{padding:1rem}h1{font-size:1.55rem}.metric,section{padding:.9rem}}@media print{body{padding:0}header,section,.metric{break-inside:avoid;background:#fff}}' +
        '</style></head><body><main><header><p class="eyebrow">PFO OS · Private local report</p><h1>Compound growth projection</h1><p>Generated locally: ' + generatedLabel + '. Currency: INR.</p><p>A deterministic scenario based only on the explicit assumptions below. It is not a forecast or guarantee.</p></header>' +
        '<div class="grid"><article class="metric"><span>Projected future value</span><strong>' + money(finalRow.projectedValue) + '</strong></article><article class="metric"><span>Total contributed capital</span><strong>' + money(finalRow.totalContributions) + '</strong></article><article class="metric"><span>Estimated growth</span><strong>' + money(finalRow.estimatedGrowth) + '</strong></article></div>' +
        '<section><h2>Assumptions</h2><div class="table-wrap"><table><tbody>' +
        '<tr><th scope="row">Starting amount</th><td>' + money(input.initialValue) + '</td></tr>' +
        '<tr><th scope="row">Annual contribution</th><td>' + money(input.contributionPerPeriod ?? 0) + '</td></tr>' +
        '<tr><th scope="row">Assumed annual return</th><td>' + percent(input.annualRate) + '</td></tr>' +
        '<tr><th scope="row">Projection duration</th><td>' + input.periods + ' years</td></tr>' +
        '<tr><th scope="row">Contribution timing</th><td>' + timingLabel + '</td></tr></tbody></table></div></section>' +
        '<section><h2>Annual projection schedule</h2><div class="table-wrap"><table><thead><tr><th scope="col">Year</th><th scope="col">Projected value</th><th scope="col">Contributed capital</th><th scope="col">Estimated growth</th></tr></thead><tbody>' + scheduleRows + '</tbody></table></div></section>' +
        '<footer class="privacy"><strong>Limitations and privacy</strong><p>Contributions remain fixed in nominal terms. Inflation, taxes, fees, volatility, changing contributions, and currency conversion are excluded. Actual returns may differ materially; this scenario is not investment advice or a guarantee.</p><p>This self-contained report uses no scripts, remote assets, external data, or network requests. It may contain sensitive financial assumptions; keep it private.</p></footer></main></body></html>';
}