import { summarizeHistoricalSnapshots } from './historical-snapshots.js';

const money = (value, currency) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2
}).format(value);
const percent = (value) => value === null || value === undefined
    ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';
const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeZone: 'UTC'
}).format(new Date(value + 'T00:00:00.000Z'));

/** Render a standalone, offline report from explicitly captured historical snapshots. */
export function renderHistoricalSnapshotsReportHtml({ snapshots, currency, generatedAt }) {
    if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new TypeError('A valid report generation timestamp is required.');
    }
    const points = summarizeHistoricalSnapshots(snapshots, currency);
    if (points.length === 0) throw new RangeError('Capture at least one historical snapshot before exporting a history report.');

    const first = points[0];
    const latest = points.at(-1);
    const totalChange = latest.netWorth - first.netWorth;
    const totalChangePercent = first.netWorth !== 0 ? totalChange / Math.abs(first.netWorth) * 100 : null;
    const rows = points.map((point) => {
        const changeClass = point.netWorthChange === null ? '' : point.netWorthChange >= 0 ? 'positive' : 'negative';
        return `<tr><th scope="row">${dateLabel(point.date)}</th><td>${point.recordCount}</td><td>${money(point.assets, currency)}</td><td>${money(point.liabilities, currency)}</td><td><strong>${money(point.netWorth, currency)}</strong></td><td class="${changeClass}">${point.netWorthChange === null ? '—' : money(point.netWorthChange, currency)}</td><td>${percent(point.netWorthChangePercent)}</td></tr>`;
    }).join('\n');
    const timestamp = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date(generatedAt));

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Historical net worth report</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}body{margin:0;padding:clamp(1rem,4vw,2.5rem)}main{max-width:1200px;margin:0 auto}header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}h1{font-size:clamp(1.5rem,4vw,2.25rem);margin:.2rem 0}h2{font-size:1.15rem}.muted{color:#52645d;line-height:1.55}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}.metric{background:#f5f8f6;border-radius:8px;padding:1rem;overflow-wrap:anywhere}.metric span{display:block;color:#52645d;font-size:.9rem}.metric strong{display:block;margin-top:.4rem;font-size:1.3rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:780px}th,td{text-align:left;padding:.75rem;border-bottom:1px solid #d6e0da;vertical-align:top;font-variant-numeric:tabular-nums}thead th{background:#f5f8f6}.positive{color:#17633b}.negative{color:#a12b2b}footer{font-size:.9rem;color:#52645d}@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Historical net worth</h1><p class="muted">Generated locally: ${timestamp} IST. Includes only snapshots explicitly captured by the user; missing dates are not interpolated.</p></header>
<section><h2>History overview</h2><div class="summary">
<div class="metric"><span>Recorded snapshots</span><strong>${points.length}</strong></div>
<div class="metric"><span>First recorded net worth · ${dateLabel(first.date)}</span><strong>${money(first.netWorth, currency)}</strong></div>
<div class="metric"><span>Latest recorded net worth · ${dateLabel(latest.date)}</span><strong>${money(latest.netWorth, currency)}</strong></div>
<div class="metric"><span>Change since first snapshot</span><strong>${money(totalChange, currency)}</strong><span>${percent(totalChangePercent)} relative to the first snapshot</span></div>
</div></section>
<section><h2>Snapshot-by-snapshot detail</h2><p class="muted">Change columns compare each snapshot with the immediately preceding captured snapshot, not necessarily the preceding calendar year.</p><div class="table-wrap"><table><thead><tr><th scope="col">Valuation date</th><th scope="col">Records</th><th scope="col">Assets</th><th scope="col">Liabilities</th><th scope="col">Net worth</th><th scope="col">Change</th><th scope="col">Change %</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer><strong>Scope and limitations</strong><p>Historical snapshots are point-in-time balance sheets. Changes may reflect savings, withdrawals, purchases, sales, debt repayments, revaluations, or changes in the records—not investment performance alone. Percentage change is unavailable when the comparison denominator is zero. The report does not estimate missing history or make forecasts or recommendations.</p><p>This standalone report contains no executable scripts, remote assets, or network dependencies. Keep it private because it may contain sensitive financial information.</p></footer>
</main></body></html>`;
}
