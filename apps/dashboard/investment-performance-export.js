function assertFinite(name, value) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

/**
 * Serialize an investment-performance summary and the exact dated cash flows
 * used for its calculation. The export contains no user-entered free text.
 */
export function investmentPerformanceToCsv({ cashFlows, result }) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
        throw new RangeError('At least two cash flows are required for export.');
    }
    let contributions = 0;
    let proceeds = 0;
    const normalizedFlows = cashFlows.map((flow) => {
        if (!flow || !(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every exported cash flow must have a valid date.');
        }
        if (!Number.isFinite(flow.amount) || flow.amount === 0) {
            throw new RangeError('Every exported cash-flow amount must be non-zero and finite.');
        }
        if (flow.amount < 0) contributions += Math.abs(flow.amount);
        else proceeds += flow.amount;
        return { date: flow.date.toISOString().slice(0, 10), amount: flow.amount };
    });
    if (!Number.isFinite(contributions) || !Number.isFinite(proceeds)) {
        throw new RangeError('Investment cash-flow totals exceed the supported numeric range.');
    }
    if (!result || typeof result !== 'object') throw new TypeError('An investment-performance result is required for export.');
    for (const [name, value] of [
        ['Gross contributions', result.grossContributions],
        ['Gross proceeds', result.grossProceeds],
        ['Net gain', result.netGain],
        ['Simple net return', result.netReturnOnContributionsPercentage],
        ['Annualized money-weighted return', result.annualizedMoneyWeightedReturn]
    ]) assertFinite(name, value);
    if (result.cashFlowCount !== cashFlows.length
        || result.grossContributions !== contributions
        || result.grossProceeds !== proceeds) {
        throw new RangeError('Investment-performance summary does not match the supplied cash flows.');
    }

    const annualizedPercentage = result.annualizedMoneyWeightedReturn * 100;
    assertFinite('Annualized money-weighted return percentage', annualizedPercentage);
    const dates = normalizedFlows.map((flow) => flow.date).sort();
    const lines = [
        'Metric,Value',
        'Currency,INR',
        `Gross contributions,${result.grossContributions}`,
        `Gross proceeds,${result.grossProceeds}`,
        `Net gain/loss,${result.netGain}`,
        `Simple net return (%),${result.netReturnOnContributionsPercentage}`,
        `Annualized money-weighted return (XIRR %),${annualizedPercentage}`,
        `Cash-flow count,${result.cashFlowCount}`,
        `Start date,${dates[0]}`,
        `End date,${dates[dates.length - 1]}`,
        '',
        'Cash-flow date,Amount (INR)',
        ...normalizedFlows.map((flow) => `${flow.date},${flow.amount}`)
    ];
    return lines.join('\r\n') + '\r\n';
}


/**
 * Render a self-contained offline HTML report from the exact performance result
 * and dated cash flows. Validation is shared with the CSV export contract.
 */
export function investmentPerformanceToHtml({ cashFlows, result }) {
    investmentPerformanceToCsv({ cashFlows, result });
    const money = (value) => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(value);
    const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';
    const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeZone: 'UTC'
    }).format(value);
    const sortedFlows = cashFlows.map((flow) => ({
        date: flow.date.toISOString().slice(0, 10),
        amount: flow.amount
    })).sort((a, b) => a.date.localeCompare(b.date));
    const rows = sortedFlows.map((flow) => '<tr><td>' + flow.date + '</td><td>' + money(flow.amount) + '</td><td>'
        + (flow.amount < 0 ? 'Contribution' : 'Receipt / terminal value') + '</td></tr>').join('');
    const start = dateLabel(new Date(result.startDate));
    const end = dateLabel(new Date(result.endDate));
    return \`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PFO OS — Investment Performance Report</title><style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#24382c;background:#f5f7f4}body{max-width:960px;margin:0 auto;padding:28px 18px 50px;line-height:1.55}header,section,footer{background:#fff;border:1px solid #e2e9e2;border-radius:12px;padding:20px;margin:0 0 16px}h1{margin:0;font-size:clamp(24px,4vw,36px)}h2{font-size:19px;margin:0 0 12px}p,.muted{color:#69796e;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.metric{background:#f8faf8;border:1px solid #e8eee8;border-radius:9px;padding:13px;min-width:0}.metric strong{display:block;font-size:clamp(17px,2.5vw,24px);overflow-wrap:anywhere}.metric span{display:block;color:#6a796f;font-size:11px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e8eee8}th{background:#f7f9f7;color:#526257}td:nth-child(2),th:nth-child(2){text-align:right;font-variant-numeric:tabular-nums}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:12px;font-size:12px}@media(max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:12px}header,section,footer{padding:14px}.table-wrap{overflow-x:auto}table{min-width:400px}}@media print{body{background:#fff;padding:0;max-width:none}header,section{break-inside:avoid}}
</style></head><body><header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Investment performance</h1><p>Measurement period: \${start} – \${end}. Currency: INR. \${result.cashFlowCount} dated cash flows.</p><p>Calculated from the exact signed cash flows entered by the user. No market value is fetched or inferred.</p></header>
<section><h2>Performance summary</h2><div class="grid">
<article class="metric"><span>Gross contributions</span><strong>\${money(result.grossContributions)}</strong></article>
<article class="metric"><span>Gross proceeds</span><strong>\${money(result.grossProceeds)}</strong></article>
<article class="metric"><span>Net gain / loss</span><strong>\${money(result.netGain)}</strong></article>
<article class="metric"><span>Simple net return on contributions</span><strong>\${percent(result.netReturnOnContributionsPercentage)}</strong></article>
<article class="metric"><span>Annualized money-weighted return (XIRR)</span><strong>\${percent(result.annualizedMoneyWeightedReturn * 100)}</strong></article>
<article class="metric"><span>Cash flows</span><strong>\${result.cashFlowCount}</strong></article>
</div></section>
<section><h2>Cash flows used</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Signed amount (INR)</th><th>Interpretation</th></tr></thead><tbody>\${rows}</tbody></table></div><p>Negative amounts represent contributions; positive amounts represent receipts. Include an explicit positive terminal valuation on the measurement date if the investment is still held.</p></section>
<footer class="privacy"><strong>Limitations and privacy</strong><p>XIRR is an annualized money-weighted return based on the supplied dated cash flows. Simple net return is net gain divided by gross contributions. Neither metric is a guarantee, forecast, or investment recommendation. This self-contained report may contain sensitive financial information. Keep it private; it is generated locally and uses no scripts, remote assets, or network requests.</p></footer></body></html>\`;
}

/**
 * Serialize only dated signed cash flows in the importer's strict date,amount
 * schema so exported inputs can be re-imported without the summary section.
 */
export function investmentCashFlowsToCsv(cashFlows) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
        throw new RangeError('At least two cash flows are required for export.');
    }
    const rows = cashFlows.map((flow) => {
        if (!flow || !(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every exported cash flow must have a valid date.');
        }
        if (!Number.isFinite(flow.amount) || flow.amount === 0) {
            throw new RangeError('Every exported cash-flow amount must be non-zero and finite.');
        }
        return [flow.date.toISOString().slice(0, 10), flow.amount];
    });
    return [
        ['date', 'amount'],
        ...rows
    ].map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
}
