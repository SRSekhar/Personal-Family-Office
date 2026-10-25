const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const moneyFormatter = (currency) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
});

function validateInput(records, currency, generatedAt) {
    if (!Array.isArray(records)) throw new TypeError('Financial records must be an array.');
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
        throw new RangeError('A valid three-letter currency code is required.');
    }
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) {
        throw new RangeError('A valid report generation date is required.');
    }
    const ids = new Set();
    for (const record of records) {
        if (!record || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)
            || typeof record.name !== 'string' || !record.name.trim()
            || typeof record.category !== 'string' || !record.category.trim()
            || !['asset', 'liability'].includes(record.type)
            || !Number.isFinite(record.value) || record.value < 0) {
            throw new RangeError('Financial records contain invalid or duplicate entries; report was not created.');
        }
        ids.add(record.id);
    }
}

/**
 * Render a self-contained, offline financial summary from explicitly supplied
 * dashboard records. The dashboard does not track valuation dates, so this
 * report records its generation time and states that limitation clearly.
 */
export function renderFinancialReportHtml({ records, currency = 'INR', generatedAt = new Date() }) {
    validateInput(records, currency, generatedAt);
    const formatMoney = moneyFormatter(currency);
    const assets = records.filter((record) => record.type === 'asset');
    const liabilities = records.filter((record) => record.type === 'liability');
    const totalAssets = assets.reduce((sum, record) => sum + record.value, 0);
    const totalLiabilities = liabilities.reduce((sum, record) => sum + record.value, 0);
    const netWorth = totalAssets - totalLiabilities;
    if (![totalAssets, totalLiabilities, netWorth].every(Number.isFinite)) {
        throw new RangeError('Financial totals exceed the supported numeric range; report was not created.');
    }

    const categoryTotals = new Map();
    for (const record of assets) {
        categoryTotals.set(record.category, (categoryTotals.get(record.category) || 0) + record.value);
    }
    const categories = [...categoryTotals.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'));
    const allocationRows = categories.length
        ? categories.map(([category, value]) => `<tr><th scope="row">${escapeHtml(category)}</th><td class="numeric">${escapeHtml(formatMoney.format(value))}</td><td class="numeric">${totalAssets > 0 ? (value / totalAssets * 100).toFixed(1) : '0.0'}%</td></tr>`).join('')
        : '<tr><td colspan="3">No assets recorded.</td></tr>';
    const liabilityCategoryTotals = new Map();
    for (const record of liabilities) {
        liabilityCategoryTotals.set(record.category, (liabilityCategoryTotals.get(record.category) || 0) + record.value);
    }
    const liabilityCategories = [...liabilityCategoryTotals.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'));
    const liabilityRows = liabilityCategories.length
        ? liabilityCategories.map(([category, value]) => `<tr><th scope="row">${escapeHtml(category)}</th><td class="numeric">${escapeHtml(formatMoney.format(value))}</td><td class="numeric">${totalLiabilities > 0 ? (value / totalLiabilities * 100).toFixed(1) : '0.0'}%</td></tr>`).join('')
        : '<tr><td colspan="3">No liabilities recorded.</td></tr>';
    const recordRows = [...records]
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'en'))
        .map((record) => `<tr><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.category)}</td><td>${record.type === 'asset' ? 'Asset' : 'Liability'}</td><td class="numeric">${escapeHtml(formatMoney.format(record.value))}</td></tr>`)
        .join('');
    const generatedIso = generatedAt.toISOString();
    const generatedLabel = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
    }).format(generatedAt);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Financial Summary</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#18251f;background:#f4f7f4}
body{margin:0;line-height:1.5}main{max-width:1000px;margin:auto;padding:2rem 1rem}
header,section,footer{background:#fff;border:1px solid #dbe4dc;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
h1{margin:.25rem 0 .5rem;font-size:clamp(1.6rem,4vw,2.4rem)}h2{margin-top:0;font-size:1.2rem}
.muted{color:#53665a;font-size:.9rem}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem}
.metric{border:1px solid #e0e8e1;border-radius:8px;padding:1rem;min-width:0}.metric span{display:block;color:#53665a;font-size:.85rem}
.metric strong{display:block;overflow-wrap:anywhere;font-size:clamp(1.15rem,3vw,1.6rem);margin-top:.4rem}
.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.7rem .5rem;border-bottom:1px solid #e0e8e1;overflow-wrap:anywhere}
thead th{font-size:.8rem;color:#53665a;text-transform:uppercase;letter-spacing:.03em}.numeric{text-align:right;font-variant-numeric:tabular-nums}
footer{font-size:.85rem;color:#53665a}
@page{margin:14mm}
@media print{
body{background:#fff;color:#000;font-size:10pt}
main{max-width:none;padding:0}
header,section,footer{background:#fff;border-color:#aaa;border-radius:0;padding:0 0 5mm;margin-bottom:7mm}
h1,h2{break-after:avoid-page}
.table-scroll{overflow:visible}
table{font-size:9pt}
thead{display:table-header-group}
tr{break-inside:avoid}
.metric{break-inside:avoid;border-color:#aaa}
footer{font-size:8pt}
}
</style>
</head>
<body><main>
<header><p class="muted">PFO OS · Financial Summary</p><h1>Financial overview</h1>
<p class="muted">Generated <time datetime="${escapeHtml(generatedIso)}">${escapeHtml(generatedLabel)} UTC</time> · Currency: ${escapeHtml(currency)} · Records: ${records.length}</p></header>
<section aria-labelledby="summary-heading"><h2 id="summary-heading">Summary</h2><div class="metrics">
<div class="metric"><span>Total assets</span><strong>${escapeHtml(formatMoney.format(totalAssets))}</strong></div>
<div class="metric"><span>Total liabilities</span><strong>${escapeHtml(formatMoney.format(totalLiabilities))}</strong></div>
<div class="metric"><span>Net worth</span><strong>${escapeHtml(formatMoney.format(netWorth))}</strong></div>
</div></section>
<section aria-labelledby="allocation-heading"><h2 id="allocation-heading">Asset allocation</h2><div class="table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col" class="numeric">Value</th><th scope="col" class="numeric">Share of assets</th></tr></thead><tbody>${allocationRows}</tbody></table></div></section>
<section aria-labelledby="liability-allocation-heading"><h2 id="liability-allocation-heading">Liability breakdown</h2><p class="muted">Liabilities are grouped by the categories entered in the dashboard. Shares use total liabilities as the denominator.</p><div class="table-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col" class="numeric">Value</th><th scope="col" class="numeric">Share of liabilities</th></tr></thead><tbody>${liabilityRows}</tbody></table></div><p class="muted">Reconciliation: ${escapeHtml(formatMoney.format(totalAssets))} assets − ${escapeHtml(formatMoney.format(totalLiabilities))} liabilities = ${escapeHtml(formatMoney.format(netWorth))} net worth.</p></section>
<section aria-labelledby="records-heading"><h2 id="records-heading">Financial records</h2><div class="table-scroll"><table><thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Type</th><th scope="col" class="numeric">Value</th></tr></thead><tbody>${recordRows || '<tr><td colspan="4">No financial records.</td></tr>'}</tbody></table></div></section>
<footer><p><strong>Important limitations</strong></p><p>This report reflects the values currently entered in the dashboard. PFO OS does not track valuation dates for these records, so the generation timestamp is not a valuation date. Review source values and keep this file private; it may contain sensitive financial information.</p><p>Generated locally in your browser. This report is self-contained and does not use scripts, remote assets, or network requests.</p></footer>
</main></body></html>`;
}
