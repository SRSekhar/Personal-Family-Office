import { calculateCagr } from './calculators-runtime/Cagr.js';

const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
}).format(value);

const percent = (value) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(value * 100)}%`;

function assertPositiveFinite(name, value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
    }
}

/**
 * Render a self-contained report for a completed CAGR calculation.
 * The supplied rate is reconciled against the canonical calculator before rendering.
 */
export function renderCagrHtmlReport({ beginningValue, endingValue, periods, annualizedRate }) {
    assertPositiveFinite('Beginning value', beginningValue);
    assertPositiveFinite('Ending value', endingValue);
    assertPositiveFinite('Elapsed years', periods);
    if (!Number.isFinite(annualizedRate)) {
        throw new RangeError('Annualized rate must be a finite number.');
    }

    const calculatedRate = calculateCagr({ beginningValue, endingValue, periods });
    if (annualizedRate !== calculatedRate) {
        throw new RangeError('CAGR result does not match the supplied assumptions.');
    }

    const beginning = money(beginningValue);
    const ending = money(endingValue);
    const rate = percent(calculatedRate);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — CAGR Report</title>
<style>
:root{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182230;background:#f3f6fa}
body{margin:0;padding:clamp(1rem,4vw,3rem)}main{max-width:860px;margin:0 auto;background:#fff;padding:clamp(1rem,4vw,2.5rem);border:1px solid #dce3ec;border-radius:1rem}
h1{margin-top:0;font-size:clamp(1.6rem,4vw,2.25rem)}p{line-height:1.6}.eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#52647a}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1.5rem 0}.metric{padding:1rem;background:#f3f6fa;border-radius:.65rem;overflow-wrap:anywhere}.metric span{display:block;color:#52647a;font-size:.9rem}.metric strong{display:block;font-size:1.3rem;margin-top:.4rem}
table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{text-align:left;padding:.75rem;border-bottom:1px solid #dce3ec}th{width:45%}.note{border-left:4px solid #8293a8;padding:.75rem 1rem;background:#f7f9fc}.footer{font-size:.85rem;color:#52647a;margin-top:2rem}
@media(max-width:420px){th,td{padding:.5rem;overflow-wrap:anywhere}th{width:40%}}
</style>
</head>
<body><main>
<p class="eyebrow">Personal Family Office · Local report</p>
<h1>Compound annual growth rate (CAGR)</h1>
<p>This report records the exact beginning value, ending value, and elapsed period used for the calculation.</p>
<section class="summary" aria-label="CAGR result">
<div class="metric"><span>Annualized growth rate</span><strong>${rate}</strong></div>
<div class="metric"><span>Beginning value</span><strong>${beginning}</strong></div>
<div class="metric"><span>Ending value</span><strong>${ending}</strong></div>
</section>
<h2>Assumptions</h2>
<table><tbody>
<tr><th scope="row">Beginning value (INR)</th><td>${beginningValue}</td></tr>
<tr><th scope="row">Ending value (INR)</th><td>${endingValue}</td></tr>
<tr><th scope="row">Elapsed years</th><td>${periods}</td></tr>
<tr><th scope="row">Compound annual growth rate</th><td>${rate}</td></tr>
</tbody></table>
<div class="note"><strong>Interpretation and limitations</strong><p>CAGR is a smoothed annualized rate between two values. It does not account for deposits, withdrawals, taxes, fees, inflation, or interim cash flows. When there are contributions or withdrawals during the period, use a dated cash-flow measure such as XIRR instead.</p></div>
<p class="footer">Generated locally by PFO OS. This standalone report contains no executable scripts, external assets, or network dependencies. It is an illustration of the supplied assumptions, not financial advice or a forecast.</p>
</main></body></html>`;
}
