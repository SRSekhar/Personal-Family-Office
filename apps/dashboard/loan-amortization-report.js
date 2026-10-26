import { calculateLoanAmortizationMath } from './calculators-runtime/LoanAmortizationMath.js';

const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);

function calculateCanonical(input) {
    if (!input || typeof input !== 'object' || typeof input.firstPaymentDate !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(input.firstPaymentDate)) {
        throw new TypeError('Valid loan assumptions and a first payment date are required.');
    }
    const date = new Date(input.firstPaymentDate + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.firstPaymentDate) {
        throw new RangeError('First payment date must be a real calendar date.');
    }
    return calculateLoanAmortizationMath({
        outstandingPrincipal: input.outstandingPrincipal,
        annualInterestRatePercent: input.annualInterestRatePercent,
        monthlyPayment: input.monthlyPayment,
        firstPaymentDate: date,
        maximumPayments: input.maximumPayments ?? 1200
    });
}

function assertMatchesCanonical(input, result) {
    const canonical = calculateCanonical(input);
    if (!result || typeof result !== 'object'
        || ['totalInterest', 'totalPayments', 'totalPrincipalPaid', 'remainingBalance', 'paidOff'].some((key) => result[key] !== canonical[key])
        || !Array.isArray(result.schedule)
        || result.schedule.length !== canonical.schedule.length
        || result.schedule.some((row, index) => !row || [
            'period', 'dueDate', 'openingBalance', 'interest', 'payment', 'principalPaid', 'closingBalance'
        ].some((key) => row[key] !== canonical.schedule[index][key]))) {
        throw new RangeError('Loan result does not match the supplied assumptions.');
    }
    return canonical;
}

/** Render a self-contained, script-free report from canonical loan amortization output. */
export function renderLoanAmortizationReportHtml({ input, result }) {
    const calculated = assertMatchesCanonical(input, result);
    const generatedLabel = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date());
    const rows = calculated.schedule.map((item) => '<tr><td>' + item.period + '</td><td>'
        + item.dueDate.slice(0, 10) + '</td><td>' + money(item.openingBalance) + '</td><td>'
        + money(item.interest) + '</td><td>' + money(item.payment) + '</td><td>'
        + money(item.principalPaid) + '</td><td>' + money(item.closingBalance) + '</td></tr>').join('\n');
    const status = calculated.paidOff ? 'Paid off under these assumptions' : 'Balance remains at the schedule limit';
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>PFO OS — Loan Amortization Report</title><style>'
        + ':root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}'
        + '*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}'
        + 'main{max-width:1100px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}'
        + 'h1{font-size:2rem;margin:.25rem 0}h2{font-size:1.15rem;margin:0 0 .8rem}p{margin:.5rem 0;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}'
        + '.metric,section{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.metric span{display:block;color:var(--muted);font-size:.9rem}.metric strong{display:block;font-size:1.4rem;overflow-wrap:anywhere;margin-top:.25rem}'
        + 'section{margin-top:1rem}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:.65rem;border-bottom:1px solid var(--line)}td:not(:first-child),th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}'
        + 'footer{margin-top:1.5rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}.notice{border-left:4px solid #c4a15d;background:#fffbf1;padding:.9rem}@media(max-width:600px){body{padding:1rem}h1{font-size:1.55rem}.metric,section{padding:.9rem}}@media print{body{padding:0}header,section,.metric{break-inside:avoid;background:#fff}}'
        + '</style></head><body><main><header><p class="eyebrow">PFO OS · Private local report</p><h1>Loan amortization report</h1><p>Generated locally: '
        + generatedLabel + '. Currency: INR.</p><p>A deterministic repayment scenario based only on the supplied assumptions; not a lender quote or financial advice.</p></header>'
        + '<div class="grid"><article class="metric"><span>Total interest</span><strong>' + money(calculated.totalInterest)
        + '</strong></article><article class="metric"><span>Total payments</span><strong>' + money(calculated.totalPayments)
        + '</strong></article><article class="metric"><span>Principal repaid</span><strong>' + money(calculated.totalPrincipalPaid)
        + '</strong></article><article class="metric"><span>Remaining balance</span><strong>' + money(calculated.remainingBalance)
        + '</strong></article></div><section><h2>Assumptions and outcome</h2><div class="table-wrap"><table><tbody>'
        + '<tr><th scope="row">Starting principal</th><td>' + money(input.outstandingPrincipal) + '</td></tr>'
        + '<tr><th scope="row">Nominal annual interest rate</th><td>' + input.annualInterestRatePercent + '%</td></tr>'
        + '<tr><th scope="row">Fixed monthly payment</th><td>' + money(input.monthlyPayment) + '</td></tr>'
        + '<tr><th scope="row">First payment date</th><td>' + input.firstPaymentDate + '</td></tr>'
        + '<tr><th scope="row">Scheduled payments</th><td>' + calculated.schedule.length + '</td></tr>'
        + '<tr><th scope="row">Outcome</th><td>' + status + '</td></tr></tbody></table></div></section>'
        + '<section><h2>Full monthly amortization schedule</h2><div class="table-wrap"><table><thead><tr><th scope="col">Period</th><th scope="col">Due date</th><th scope="col">Opening balance</th><th scope="col">Interest</th><th scope="col">Payment</th><th scope="col">Principal paid</th><th scope="col">Closing balance</th></tr></thead><tbody>'
        + rows + '</tbody></table></div></section><footer class="notice"><strong>Assumptions and limitations</strong><p>Annual nominal interest is divided by 12; interest is calculated on each period’s opening balance and payment occurs at period end. Fees, taxes, payment holidays, rate changes, lender-specific rounding, and other charges are excluded. Due dates preserve the first payment’s UTC day-of-month where possible.</p><p>This self-contained report contains no scripts, remote assets, external data, or network requests. It may contain sensitive financial assumptions; keep it private.</p></footer></main></body></html>';
}
