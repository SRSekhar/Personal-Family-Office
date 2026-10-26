import { analyzeDiversification } from './analytics-runtime/DiversificationAnalysis.js';

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value * 100) + '%';

/** Render an offline asset allocation report from grouped, validated category totals. */
export function renderAssetAllocationReportHtml({ entries, generatedAt }) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new TypeError('At least one asset category is required.');
    }
    if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new TypeError('A valid report generation timestamp is required.');
    }

    const seen = new Set();
    let totalAssets = 0;
    const normalized = entries.map((entry) => {
        if (!entry || typeof entry.category !== 'string' || !entry.category.trim()
            || !Number.isFinite(entry.value) || entry.value < 0) {
            throw new RangeError('Asset allocation categories and values must be valid.');
        }
        if (seen.has(entry.category)) throw new RangeError('Asset allocation categories must be unique.');
        seen.add(entry.category);
        totalAssets += entry.value;
        if (!Number.isFinite(totalAssets)) throw new RangeError('Asset allocation total exceeds the supported numeric range.');
        return { category: entry.category, value: entry.value };
    }).sort((a, b) => b.value - a.value || a.category.localeCompare(b.category, 'en'));

    if (totalAssets <= 0) throw new RangeError('Add a positive-value asset before exporting allocation.');
    const concentration = analyzeDiversification({
        currency: 'INR',
        totalValue: { amount: totalAssets, currency: 'INR' },
        allocations: normalized.map(({ category, value }) => ({
            category, value: { amount: value, currency: 'INR' }, weight: value / totalAssets
        }))
    });
    const rows = normalized.map(({ category, value }) =>
        `<tr><th scope="row">${escapeHtml(category)}</th><td>${money(value)}</td><td>${percent(value / totalAssets)}</td></tr>`
    ).join('\n');
    const timestamp = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date(generatedAt));

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Asset allocation report</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}body{margin:0;padding:clamp(1rem,4vw,2.5rem)}main{max-width:960px;margin:0 auto}header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}h1{font-size:clamp(1.5rem,4vw,2.25rem);margin:.2rem 0}h2{font-size:1.15rem}.muted{color:#52645d;line-height:1.55}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}.metric{background:#f5f8f6;border-radius:8px;padding:1rem;overflow-wrap:anywhere}.metric span{display:block;color:#52645d;font-size:.9rem}.metric strong{display:block;margin-top:.4rem;font-size:1.3rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.75rem;border-bottom:1px solid #d6e0da}thead th{background:#f5f8f6}td:last-child,th:last-child{text-align:right;font-variant-numeric:tabular-nums}footer{font-size:.9rem;color:#52645d}@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Asset allocation by category</h1><p class="muted">Generated locally: ${timestamp} IST. Allocation is based on recorded asset values at export time.</p></header>
<section><h2>Asset allocation summary</h2><div class="summary">
<div class="metric"><span>Total assets</span><strong>${money(totalAssets)}</strong></div>
<div class="metric"><span>Categories</span><strong>${normalized.length}</strong></div>
<div class="metric"><span>Concentration index (HHI)</span><strong>${concentration.concentrationIndex.toFixed(3)}</strong></div>
<div class="metric"><span>Effective category count</span><strong>${concentration.effectiveCategoryCount.toFixed(2)}</strong></div>
<div class="metric"><span>Largest category share</span><strong>${percent(concentration.largestCategoryShare)}</strong></div>
</div></section>
<section><h2>Category breakdown</h2><div class="table-wrap"><table><thead><tr><th scope="col">Category</th><th scope="col">Recorded value</th><th scope="col">Share of assets</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer><strong>Scope and limitations</strong><p>Category concentration summarizes only the categories recorded in this balance sheet. It does not measure holding-level diversification, correlations, liquidity, asset quality, or overall portfolio risk. Values reflect the records at export time; no external data, forecasts, financial scores, or recommendations are included.</p><p>This standalone report contains no executable scripts, remote assets, or network dependencies. Keep it private because it may contain sensitive financial information.</p></footer>
</main></body></html>`;
}
