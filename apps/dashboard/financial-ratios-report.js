import { calculateFinancialRatios } from './analytics-runtime/FinancialRatios.js';

const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);
const percentage = (value) => value === null ? 'Unavailable (zero assets)' :
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value * 100) + '%';
const multiple = (value) => value === null ? 'Unavailable (zero liabilities)' :
    new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '×';

/** Render a self-contained ratio report after reconciling the supplied totals and ratios. */
export function renderFinancialRatiosReportHtml({ assets, liabilities, netWorth, ratios, generatedAt }) {
    if (!Number.isFinite(assets) || assets < 0 || !Number.isFinite(liabilities) || liabilities < 0
        || !Number.isFinite(netWorth) || netWorth !== assets - liabilities) {
        throw new RangeError('Balance-sheet totals are invalid or do not reconcile.');
    }
    if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new TypeError('A valid report generation timestamp is required.');
    }
    const calculated = calculateFinancialRatios({
        currency: 'INR',
        totalAssets: { amount: assets, currency: 'INR' },
        totalLiabilities: { amount: liabilities, currency: 'INR' },
        netWorth: { amount: netWorth, currency: 'INR' }
    });
    if (!ratios || ratios.liabilitiesToAssets !== calculated.liabilitiesToAssets
        || ratios.netWorthToAssets !== calculated.netWorthToAssets
        || ratios.assetsToLiabilities !== calculated.assetsToLiabilities) {
        throw new RangeError('Balance-sheet ratios do not match the supplied totals.');
    }

    const timestamp = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date(generatedAt));
    const rows = [
        ['Liabilities / assets', percentage(calculated.liabilitiesToAssets), money(liabilities), money(assets),
            'Recorded liabilities as a share of recorded assets.'],
        ['Net worth / assets', percentage(calculated.netWorthToAssets), money(netWorth), money(assets),
            'Recorded net worth as a share of recorded assets.'],
        ['Assets / liabilities', multiple(calculated.assetsToLiabilities), money(assets), money(liabilities),
            'Recorded assets per unit of recorded liabilities.']
    ].map(([label, value, numerator, denominator, detail]) =>
        `<tr><th scope="row">${label}</th><td>${value}</td><td>${numerator}</td><td>${denominator}</td><td>${detail}</td></tr>`
    ).join('\n');

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Balance-sheet ratios</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}body{margin:0;padding:clamp(1rem,4vw,2.5rem)}main{max-width:1080px;margin:0 auto}header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}h1{font-size:clamp(1.5rem,4vw,2.25rem);margin:.2rem 0}h2{font-size:1.15rem}.muted{color:#52645d;line-height:1.55}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}.metric{background:#f5f8f6;border-radius:8px;padding:1rem;overflow-wrap:anywhere}.metric span{display:block;color:#52645d;font-size:.9rem}.metric strong{display:block;margin-top:.4rem;font-size:1.3rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:left;padding:.75rem;border-bottom:1px solid #d6e0da;vertical-align:top}th{background:#f5f8f6}footer{font-size:.9rem;color:#52645d}@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Balance-sheet ratios</h1><p class="muted">Generated locally: ${timestamp} IST. Ratios describe the recorded balance sheet at export time.</p></header>
<section><h2>Reconciled balance sheet</h2><div class="summary">
<div class="metric"><span>Total assets</span><strong>${money(assets)}</strong></div>
<div class="metric"><span>Total liabilities</span><strong>${money(liabilities)}</strong></div>
<div class="metric"><span>Net worth</span><strong>${money(netWorth)}</strong></div></div></section>
<section><h2>Ratio detail</h2><div class="table-wrap"><table><thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Numerator</th><th scope="col">Denominator</th><th scope="col">Definition</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer><strong>Scope and limitations</strong><p>This report uses recorded asset and liability totals only. A dash/unavailable ratio reflects a zero denominator. These descriptive ratios do not measure liquidity, asset quality, holding-level diversification, future income, or overall financial resilience. No benchmarks, forecasts, scores, or recommendations are implied.</p><p>This standalone report contains no executable scripts, remote assets, or network dependencies. Keep it private because it may contain sensitive financial information.</p></footer>
</main></body></html>`;
}
