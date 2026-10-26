const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderFinancialHealthReportHtml({ reportingPeriod, generatedAt, metrics }) {
    if (typeof reportingPeriod !== 'string' || !reportingPeriod.trim()) {
        throw new Error('A reporting period is required.');
    }
    if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new Error('A valid report generation timestamp is required.');
    }
    if (!Array.isArray(metrics) || metrics.length === 0) {
        throw new Error('At least one validated financial health metric is required.');
    }
    for (const metric of metrics) {
        if (!metric || typeof metric.label !== 'string' || !metric.label.trim()
            || typeof metric.value !== 'string' || typeof metric.detail !== 'string') {
            throw new Error('Financial health metrics must include a label, value, and detail.');
        }
    }
    const cards = metrics.map((metric) => `<section class="metric"><h2>${escapeHtml(metric.label)}</h2><p class="value">${escapeHtml(metric.value)}</p><p>${escapeHtml(metric.detail)}</p></section>`).join('\n');
    const timestamp = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date(generatedAt));
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal Financial Health — ${escapeHtml(reportingPeriod)}</title>
<style>
:root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}
*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}
main{max-width:1000px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}
.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}h1{font-size:2rem;margin:.25rem 0}p{margin:.4rem 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}
.metric{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.metric h2{font-size:1rem;margin:0;color:var(--muted)}.value{font-size:1.55rem;font-weight:750;color:var(--ink);margin:.5rem 0}
footer{margin-top:2rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}@media print{body{padding:0}.metric{background:#fff}}@media(max-width:600px){body{padding:1rem}h1{font-size:1.5rem}}
</style>
</head>
<body><main>
<header><p class="eyebrow">Personal Family Office · Financial health</p><h1>Financial health overview</h1><p>Reporting period: <strong>${escapeHtml(reportingPeriod)}</strong></p><p>Generated locally: ${escapeHtml(timestamp)}</p></header>
<div class="grid">${cards}</div>
<footer><p><strong>Scope and limitations</strong></p><p>This report reflects the validated summary shown in the private local workspace at export time. It is descriptive and historical, not financial advice. It uses recorded balances, transactions, explicit budgets, and saved goals only. It contains no forecasts, external data feeds, financial score, or recommendations. Values are not refreshed after export.</p><p>Keep this file private: it may contain sensitive household financial information.</p></footer>
</main></body></html>
`;
}
