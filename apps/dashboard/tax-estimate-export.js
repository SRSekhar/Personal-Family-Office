function assertFiniteNonNegative(name, value) {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite, non-negative amount.`);
    }
}

function assertRate(name, value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError(`${name} must be between 0 and 100 percent.`);
    }
}

/**
 * Serialize a validated caller-defined tax estimate and its supplied brackets.
 * The output deliberately contains numeric values and fixed headings only.
 */
export function taxEstimateToCsv({ taxableIncome, brackets, result }) {
    assertFiniteNonNegative('Taxable income', taxableIncome);
    if (!Array.isArray(brackets) || brackets.length === 0) {
        throw new RangeError('At least one tax bracket is required for export.');
    }

    let previousUpperBound = 0;
    brackets.forEach((bracket, index) => {
        if (!bracket || typeof bracket !== 'object') {
            throw new TypeError('Every exported tax bracket must be an object.');
        }
        assertRate('Marginal tax rate', bracket.marginalRatePercent);
        const final = index === brackets.length - 1;
        if (final ? bracket.upperBound !== null : !Number.isFinite(bracket.upperBound)) {
            throw new RangeError('Only the final tax bracket may have no upper limit.');
        }
        if (!final) {
            if (bracket.upperBound <= previousUpperBound) {
                throw new RangeError('Tax bracket upper bounds must be strictly increasing.');
            }
            previousUpperBound = bracket.upperBound;
        }
    });

    if (!result || typeof result !== 'object') throw new TypeError('A tax estimate result is required for export.');
    assertFiniteNonNegative('Estimated tax', result.estimatedTax);
    assertFiniteNonNegative('After-tax income', result.afterTaxIncome);
    if (result.effectiveTaxRate !== null) assertRate('Effective tax rate', result.effectiveTaxRate);
    assertRate('Marginal tax rate', result.marginalRatePercent);

    const lines = [
        'Metric,Value',
        'Currency,INR',
        `Taxable income,${taxableIncome}`,
        `Estimated tax,${result.estimatedTax}`,
        `Income after estimated tax,${result.afterTaxIncome}`,
        `Effective tax rate (%),${result.effectiveTaxRate === null ? '' : result.effectiveTaxRate}`,
        `Marginal rate at income (%),${result.marginalRatePercent}`,
        '',
        'Bracket,Upper income bound,Marginal rate (%)',
        ...brackets.map((bracket, index) =>
            `${index + 1},${bracket.upperBound === null ? 'No upper limit' : bracket.upperBound},${bracket.marginalRatePercent}`)
    ];
    return lines.join('\r\n') + '\r\n';
}

/**
 * Render a self-contained offline HTML report for a validated caller-defined
 * tax estimate. Validation is shared with the CSV export contract.
 */
export function taxEstimateToHtml(input) {
    taxEstimateToCsv(input);
    const { taxableIncome, brackets, result } = input;
    const money = (value) => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(value);
    const percent = (value) => new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2
    }).format(value) + '%';
    const bracketRows = brackets.map((bracket, index) => `<tr><td>${index + 1}</td><td>${bracket.upperBound === null ? 'No upper limit' : money(bracket.upperBound)}</td><td>${percent(bracket.marginalRatePercent)}</td></tr>`).join('\n');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PFO OS — Tax Estimate Report</title><style>
:root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}
*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}
main{max-width:960px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}
h1{font-size:2rem;margin:.25rem 0}h2{font-size:1.15rem;margin:0 0 .8rem}p{margin:.5rem 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
.metric,section{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.metric span{display:block;color:var(--muted);font-size:.9rem}.metric strong{display:block;font-size:1.5rem;overflow-wrap:anywhere;margin-top:.25rem}
section{margin-top:1rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.7rem;border-bottom:1px solid var(--line)}td:last-child,th:last-child{text-align:right;font-variant-numeric:tabular-nums}
footer{margin-top:1.5rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:.9rem}
@media(max-width:600px){body{padding:1rem}h1{font-size:1.55rem}.metric,section{padding:.9rem}}@media print{body{padding:0}header,section,.metric{break-inside:avoid;background:#fff}}
</style></head><body><main>
<header><p class="eyebrow">PFO OS · Private local report</p><h1>Progressive tax estimate</h1><p>Currency: INR. Taxable income supplied: <strong>${money(taxableIncome)}</strong>.</p><p>Generated from the caller-defined marginal brackets used for the displayed estimate. No tax rules or brackets are fetched or assumed.</p></header>
<div class="grid">
<article class="metric"><span>Taxable income</span><strong>${money(taxableIncome)}</strong></article>
<article class="metric"><span>Estimated tax</span><strong>${money(result.estimatedTax)}</strong></article>
<article class="metric"><span>Income after estimated tax</span><strong>${money(result.afterTaxIncome)}</strong></article>
<article class="metric"><span>Effective tax rate</span><strong>${result.effectiveTaxRate === null ? 'Unavailable' : percent(result.effectiveTaxRate)}</strong></article>
<article class="metric"><span>Marginal rate at income</span><strong>${percent(result.marginalRatePercent)}</strong></article>
</div>
<section><h2>Supplied marginal brackets</h2><div class="table-wrap"><table><thead><tr><th>Bracket</th><th>Upper income bound</th><th>Marginal rate</th></tr></thead><tbody>${bracketRows}</tbody></table></div><p>The rates and thresholds above are exactly the assumptions supplied to the calculator. Each rate applies only within its bracket.</p></section>
<footer class="privacy"><strong>Limitations and privacy</strong><p>This is an arithmetic estimate based only on the supplied taxable income and bracket schedule. It does not infer a tax regime, filing status, deductions, surcharge, cess, credits, exemptions, or any other unmodeled item. It is not tax advice. Confirm all assumptions with an authoritative source or qualified professional before relying on the result.</p><p>This self-contained report is generated locally and uses no scripts, remote assets, or network requests. It may contain sensitive financial assumptions; keep it private.</p></footer>
</main></body></html>`;
}
