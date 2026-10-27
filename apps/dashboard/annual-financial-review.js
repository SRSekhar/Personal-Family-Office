import { buildMonthlyFinancialReview } from './monthly-financial-review.js';

const YEAR_PATTERN = /^\d{4}$/;

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function money(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

/**
 * Build an annual review from recorded transactions, explicit monthly budgets,
 * and saved goals. Missing months remain zero; no transactions are inferred.
 */
export function buildAnnualFinancialReview({ entries, budgets, goals, year, generatedAt = new Date() }) {
    if (typeof year !== 'string' || !YEAR_PATTERN.test(year)) {
        throw new RangeError('Year must use YYYY format.');
    }
    if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) {
        throw new TypeError('A valid report timestamp is required.');
    }

    const months = [];
    const categoryTotals = new Map();
    const budgetTotals = new Map();
    let income = 0;
    let expenses = 0;
    let transactionCount = 0;
    let goalsForYear = [];

    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
        const month = year + '-' + String(monthNumber).padStart(2, '0');
        const review = buildMonthlyFinancialReview({ entries, budgets, goals, month, generatedAt });
        const summary = review.current;
        income += summary.income;
        expenses += summary.expenses;
        transactionCount += summary.transactionCount;
        if (![income, expenses].every(Number.isFinite) || !Number.isSafeInteger(transactionCount)) {
            throw new RangeError('Annual cash-flow totals exceed the supported numeric range.');
        }
        months.push({
            month,
            label: review.monthLabel,
            income: summary.income,
            expenses: summary.expenses,
            net: summary.net,
            savingsRate: summary.savingsRate,
            transactionCount: summary.transactionCount
        });

        for (const item of review.categories) {
            const key = item.category.toLocaleLowerCase('en-US');
            const current = categoryTotals.get(key) || { category: item.category, income: 0, expenses: 0, transactionCount: 0 };
            current.income += item.income;
            current.expenses += item.expenses;
            current.transactionCount += item.transactionCount;
            if (![current.income, current.expenses].every(Number.isFinite) || !Number.isSafeInteger(current.transactionCount)) {
                throw new RangeError('Annual category totals exceed the supported numeric range.');
            }
            categoryTotals.set(key, current);
        }

        for (const item of review.budgets) {
            const key = item.category.toLocaleLowerCase('en-US');
            const current = budgetTotals.get(key) || {
                category: item.category, budgetedMonths: 0, overBudgetMonths: 0,
                totalBudget: 0, totalActual: 0, totalOverrun: 0
            };
            current.budgetedMonths += 1;
            current.totalBudget += item.budget;
            current.totalActual += item.actual;
            current.totalOverrun += item.overrun;
            if (item.overrun > 0) current.overBudgetMonths += 1;
            if (![current.totalBudget, current.totalActual, current.totalOverrun].every(Number.isFinite)) {
                throw new RangeError('Annual budget totals exceed the supported numeric range.');
            }
            budgetTotals.set(key, current);
        }
        if (monthNumber === 12) goalsForYear = review.goals;
    }

    const categories = [...categoryTotals.values()]
        .map((item) => ({ ...item, net: item.income - item.expenses }))
        .sort((a, b) => b.expenses - a.expenses || a.category.localeCompare(b.category));
    const budgetsByCategory = [...budgetTotals.values()]
        .map((item) => ({ ...item, remaining: item.totalBudget - item.totalActual }))
        .sort((a, b) => b.totalOverrun - a.totalOverrun || a.category.localeCompare(b.category));
    const net = income - expenses;
    const savingsRate = income > 0 ? net / income * 100 : null;
    if (!Number.isFinite(net) || (savingsRate !== null && !Number.isFinite(savingsRate))) {
        throw new RangeError('Annual cash-flow totals exceed the supported numeric range.');
    }

    const previousYear = String(Number(year) - 1).padStart(4, '0');
    let previousIncome = 0;
    let previousExpenses = 0;
    let previousTransactionCount = 0;
    for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
        const month = previousYear + '-' + String(monthNumber).padStart(2, '0');
        const review = buildMonthlyFinancialReview({ entries, budgets, goals, month, generatedAt });
        previousIncome += review.current.income;
        previousExpenses += review.current.expenses;
        previousTransactionCount += review.current.transactionCount;
        if (![previousIncome, previousExpenses].every(Number.isFinite) || !Number.isSafeInteger(previousTransactionCount)) {
            throw new RangeError('Previous-year cash-flow totals exceed the supported numeric range.');
        }
    }
    const previousNet = previousIncome - previousExpenses;
    const previousSavingsRate = previousIncome > 0 ? previousNet / previousIncome * 100 : null;
    if (!Number.isFinite(previousNet) || (previousSavingsRate !== null && !Number.isFinite(previousSavingsRate))) {
        throw new RangeError('Previous-year cash-flow totals exceed the supported numeric range.');
    }
    const comparison = {
        year: previousYear,
        summary: {
            income: previousIncome, expenses: previousExpenses, net: previousNet,
            savingsRate: previousSavingsRate, transactionCount: previousTransactionCount
        },
        change: {
            income: income - previousIncome,
            expenses: expenses - previousExpenses,
            net: net - previousNet,
            transactionCount: transactionCount - previousTransactionCount,
            incomePercent: previousIncome > 0 ? (income - previousIncome) / previousIncome * 100 : null,
            expensesPercent: previousExpenses > 0 ? (expenses - previousExpenses) / previousExpenses * 100 : null
        },
        hasTransactions: previousTransactionCount > 0
    };

    return {
        year, generatedAt: generatedAt.toISOString(),
        summary: { income, expenses, net, savingsRate, transactionCount },
        comparison, months, categories, budgets: budgetsByCategory, goals: goalsForYear,
        hasTransactions: transactionCount > 0
    };
}

function rows(items, columns, emptyText) {
    if (!items.length) return '<tr><td colspan="' + columns.length + '">' + escapeHtml(emptyText) + '</td></tr>';
    return items.map((item) => '<tr>' + columns.map(([key, render]) =>
        '<td>' + escapeHtml(render(item[key], item)) + '</td>').join('') + '</tr>').join('');
}

export function renderAnnualFinancialReviewHtml(review) {
    if (!review || typeof review.year !== 'string' || !YEAR_PATTERN.test(review.year)
        || !review.summary || !review.comparison || typeof review.comparison.year !== 'string'
        || !YEAR_PATTERN.test(review.comparison.year) || !review.comparison.summary || !review.comparison.change
        || !Array.isArray(review.months) || !Array.isArray(review.categories)
        || !Array.isArray(review.budgets) || !Array.isArray(review.goals)
        || typeof review.generatedAt !== 'string') {
        throw new TypeError('Annual financial review data is invalid.');
    }
    const amount = (value) => money(value);
    const rate = (value) => value === null ? 'Unavailable (zero recorded income)' : value.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + '%';
    const generatedAt = new Date(review.generatedAt);
    if (Number.isNaN(generatedAt.getTime())) throw new TypeError('Annual financial review timestamp is invalid.');
    const generatedLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(generatedAt);
    const monthlyRows = rows(review.months, [
        ['label', (v) => v], ['income', amount], ['expenses', amount], ['net', amount],
        ['savingsRate', rate], ['transactionCount', String]
    ], 'No recorded transactions for this year.');
    const comparisonRows = [
        ['Recorded income', review.summary.income, review.comparison.summary.income, review.comparison.change.income,
            review.comparison.change.incomePercent],
        ['Recorded expenses', review.summary.expenses, review.comparison.summary.expenses, review.comparison.change.expenses,
            review.comparison.change.expensesPercent],
        ['Net cash flow', review.summary.net, review.comparison.summary.net, review.comparison.change.net, null],
        ['Recorded transactions', review.summary.transactionCount, review.comparison.summary.transactionCount,
            review.comparison.change.transactionCount, null]
    ].map(([label, current, previous, change, percentChange]) => '<tr><th scope="row">' + escapeHtml(label)
        + '</th><td>' + escapeHtml(String(review.year)) + ': ' + escapeHtml(label === 'Recorded transactions' ? String(current) : amount(current))
        + '</td><td>' + escapeHtml(String(review.comparison.year)) + ': ' + escapeHtml(label === 'Recorded transactions' ? String(previous) : amount(previous))
        + '</td><td>' + escapeHtml(label === 'Recorded transactions' ? String(change) : amount(change))
        + '</td><td>' + escapeHtml(percentChange === null ? 'Unavailable (prior-year baseline is zero)' : percentChange.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + '%')
        + '</td></tr>').join('');
    const categoryRows = rows(review.categories, [
        ['category', (v) => v], ['income', amount], ['expenses', amount], ['net', amount], ['transactionCount', String]
    ], 'No recorded category activity for this year.');
    const budgetRows = rows(review.budgets, [
        ['category', (v) => v], ['budgetedMonths', String], ['overBudgetMonths', String],
        ['totalBudget', amount], ['totalActual', amount], ['totalOverrun', amount], ['remaining', amount]
    ], 'No explicit monthly budgets were saved for this year.');
    const goalRows = rows(review.goals, [
        ['name', (v) => v], ['currentAmount', amount], ['targetAmount', amount],
        ['progress', (v) => v.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + '%'],
        ['remaining', amount], ['targetDate', (v) => v], ['status', (v) => v]
    ], 'No saved goals.');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PFO OS — Annual Financial Review · ${escapeHtml(review.year)}</title><style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#24382c;background:#f5f7f4}body{max-width:1080px;margin:0 auto;padding:28px 18px 50px;line-height:1.55}header,section,footer{background:#fff;border:1px solid #e2e9e2;border-radius:12px;padding:20px;margin:0 0 16px}h1{margin:0;font-size:clamp(24px,4vw,36px)}h2{font-size:19px;margin:0 0 12px}p,.muted{color:#69796e;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.metric{background:#f8faf8;border:1px solid #e8eee8;border-radius:9px;padding:13px;min-width:0}.metric strong{display:block;font-size:clamp(17px,2.5vw,24px);overflow-wrap:anywhere}.metric span,.metric small{display:block;color:#6a796f;font-size:11px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e8eee8;vertical-align:top}th{background:#f7f9f7;color:#526257}td:not(:first-child),th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:12px;font-size:12px}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:12px}header,section,footer{padding:14px}.table-wrap{overflow-x:auto}table{min-width:560px}}@media print{body{background:#fff;padding:0;max-width:none}header,section{break-inside:avoid}}
</style></head><body><header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Annual financial review</h1><p><strong>${escapeHtml(review.year)}</strong> · Generated ${escapeHtml(generatedLabel)} UTC</p><p>Recorded transactions, explicitly saved monthly budgets, and saved goals only. No forecasts or inferred transactions.</p></header>
<section><h2>Year at a glance</h2><div class="grid">
<article class="metric"><span>Recorded income</span><strong>${escapeHtml(amount(review.summary.income))}</strong></article>
<article class="metric"><span>Recorded expenses</span><strong>${escapeHtml(amount(review.summary.expenses))}</strong></article>
<article class="metric"><span>Net cash flow</span><strong>${escapeHtml(amount(review.summary.net))}</strong></article>
<article class="metric"><span>Savings rate</span><strong>${escapeHtml(rate(review.summary.savingsRate))}</strong><small>${escapeHtml(String(review.summary.transactionCount))} recorded transactions</small></article>
</div><p>${review.hasTransactions ? 'Totals include only transactions dated within the selected calendar year.' : 'No transactions were recorded for this year; all monthly values are zero.'}</p></section>
<section><h2>Year-over-year comparison</h2><p>Compares recorded activity in ${escapeHtml(review.year)} with ${escapeHtml(review.comparison.year)}. No missing transactions are inferred. Percentage changes are unavailable when the prior-year baseline is zero.</p>
${review.comparison.hasTransactions ? '' : '<p class="muted">No transactions were recorded in the comparison year; absolute changes compare the selected year against zero recorded activity and are not a like-for-like comparison.</p>'}
<div class="table-wrap"><table><thead><tr><th>Measure</th><th>Selected year</th><th>Prior year</th><th>Absolute change</th><th>Change %</th></tr></thead><tbody>${comparisonRows}</tbody></table></div></section>
<section><h2>Month-by-month cash flow</h2><div class="table-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Savings rate</th><th>Transactions</th></tr></thead><tbody>${monthlyRows}</tbody></table></div></section>
<section><h2>Category activity</h2><div class="table-wrap"><table><thead><tr><th>Category</th><th>Income</th><th>Expenses</th><th>Net</th><th>Transactions</th></tr></thead><tbody>${categoryRows}</tbody></table></div></section>
<section><h2>Saved budget performance</h2><p>Budget totals include only months where a category had an explicit saved budget. Actual expenses are summed for those budgeted months only; overrun sums positive category-month overruns without offsetting under-budget months.</p><div class="table-wrap"><table><thead><tr><th>Category</th><th>Budgeted months</th><th>Months over budget</th><th>Budget total</th><th>Actual in budgeted months</th><th>Positive overrun</th><th>Remaining</th></tr></thead><tbody>${budgetRows}</tbody></table></div></section>
<section><h2>Saved goal progress</h2><div class="table-wrap"><table><thead><tr><th>Goal</th><th>Current</th><th>Target</th><th>Progress</th><th>Remaining</th><th>Target date</th><th>Status</th></tr></thead><tbody>${goalRows}</tbody></table></div><p class="muted">Goal values reflect saved progress at report generation time.</p></section>
<footer class="privacy"><strong>Privacy and limitations</strong><p>This self-contained HTML report may contain sensitive financial information. Keep it private. It is generated locally and does not upload data or depend on scripts, remote assets, or network requests.</p></footer></body></html>`;
}
