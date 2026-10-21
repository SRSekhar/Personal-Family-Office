import { calculateCashFlowSavingsRate, summarizeCashFlow, validateCashFlowEntries } from './cashflow-ledger.js';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function previousMonth(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 2, 1));
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
}

function validateBudgets(budgets) {
    if (!Array.isArray(budgets)) throw new TypeError('Budgets must be a list.');
    const seen = new Set();
    return budgets.map((budget) => {
        if (!budget || typeof budget.month !== 'string' || !MONTH_PATTERN.test(budget.month)
            || typeof budget.category !== 'string' || !budget.category.trim() || budget.category.trim().length > 60
            || typeof budget.amount !== 'number' || !Number.isFinite(budget.amount) || budget.amount <= 0) {
            throw new TypeError('Saved budget data failed validation.');
        }
        const category = budget.category.trim();
        const key = budget.month + '|' + category.toLocaleLowerCase('en-US');
        if (seen.has(key)) throw new TypeError('Saved budgets contain duplicate month/category entries.');
        seen.add(key);
        return { month: budget.month, category, amount: budget.amount };
    });
}

function validateGoals(goals) {
    if (!Array.isArray(goals)) throw new TypeError('Goals must be a list.');
    const ids = new Set();
    return goals.map((goal) => {
        if (!goal || typeof goal.id !== 'string' || !goal.id.trim() || ids.has(goal.id)
            || typeof goal.name !== 'string' || !goal.name.trim()
            || typeof goal.targetAmount !== 'number' || !Number.isFinite(goal.targetAmount) || goal.targetAmount <= 0
            || typeof goal.currentAmount !== 'number' || !Number.isFinite(goal.currentAmount) || goal.currentAmount < 0
            || typeof goal.targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)
            || Number.isNaN(Date.parse(goal.targetDate + 'T00:00:00Z'))) {
            throw new TypeError('Saved goal data failed validation.');
        }
        ids.add(goal.id);
        return { id: goal.id, name: goal.name.trim(), targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount, targetDate: goal.targetDate };
    });
}

function money(value, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function monthLabel(month) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function summaryFor(entries, month) {
    const summary = summarizeCashFlow(entries, month);
    return { ...summary, savingsRate: calculateCashFlowSavingsRate(summary.income, summary.expenses) };
}

/** Build a review strictly from validated transactions, explicit budgets, and saved goals. */
export function buildMonthlyFinancialReview({ entries, budgets, goals, month, generatedAt = new Date() }) {
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) throw new RangeError('Month must use YYYY-MM format.');
    if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) throw new TypeError('A valid report timestamp is required.');
    const validatedEntries = validateCashFlowEntries(entries);
    const validatedBudgets = validateBudgets(budgets);
    const validatedGoals = validateGoals(goals);
    const priorMonth = previousMonth(month);
    const current = summaryFor(validatedEntries, month);
    const prior = summaryFor(validatedEntries, priorMonth);
    const selectedEntries = validatedEntries.filter((entry) => entry.date.startsWith(month));
    const priorEntries = validatedEntries.filter((entry) => entry.date.startsWith(priorMonth));
    const summarizeCategories = (periodEntries) => {
        const categoryMap = new Map();
        for (const entry of periodEntries) {
            const key = entry.category.toLocaleLowerCase('en-US');
            const row = categoryMap.get(key) || { category: entry.category, income: 0, expenses: 0, transactionCount: 0 };
            if (entry.type === 'income') row.income += entry.amount;
            else row.expenses += entry.amount;
            row.transactionCount += 1;
            if (!Number.isFinite(row.income) || !Number.isFinite(row.expenses)) {
                throw new RangeError('Category totals exceed the supported numeric range.');
            }
            categoryMap.set(key, row);
        }
        return categoryMap;
    };
    const currentCategoryMap = summarizeCategories(selectedEntries);
    const priorCategoryMap = summarizeCategories(priorEntries);
    const categories = [...currentCategoryMap.values()].map((row) => ({ ...row, net: row.income - row.expenses }))
        .sort((a, b) => b.expenses - a.expenses || a.category.localeCompare(b.category));
    const categoryKeys = new Set([...currentCategoryMap.keys(), ...priorCategoryMap.keys()]);
    const categoryComparison = [...categoryKeys].map((key) => {
        const currentCategory = currentCategoryMap.get(key);
        const priorCategory = priorCategoryMap.get(key);
        const category = currentCategory?.category ?? priorCategory.category;
        const currentIncome = currentCategory?.income ?? 0;
        const currentExpenses = currentCategory?.expenses ?? 0;
        const priorIncome = priorCategory?.income ?? 0;
        const priorExpenses = priorCategory?.expenses ?? 0;
        const incomeChange = currentIncome - priorIncome;
        const expenseChange = currentExpenses - priorExpenses;
        if (![incomeChange, expenseChange].every(Number.isFinite)) {
            throw new RangeError('Category comparison exceeds the supported numeric range.');
        }
        return { category, currentIncome, currentExpenses, priorIncome, priorExpenses, incomeChange, expenseChange };
    }).sort((a, b) => b.currentExpenses - a.currentExpenses || b.priorExpenses - a.priorExpenses
        || a.category.localeCompare(b.category));
    const budgetRows = validatedBudgets.filter((budget) => budget.month === month).map((budget) => {
        const actual = categories.find((row) => row.category.toLocaleLowerCase('en-US') === budget.category.toLocaleLowerCase('en-US'))?.expenses || 0;
        return { category: budget.category, budget: budget.amount, actual, remaining: budget.amount - actual,
            overrun: Math.max(0, actual - budget.amount), status: actual > budget.amount ? 'Over budget' : actual === 0 ? 'Not spent' : 'Within budget' };
    }).sort((a, b) => b.overrun - a.overrun || a.category.localeCompare(b.category));
    const reportGoals = validatedGoals.map((goal) => {
        const progress = Math.min(100, goal.currentAmount / goal.targetAmount * 100);
        return { ...goal, progress, remaining: Math.max(0, goal.targetAmount - goal.currentAmount),
            status: goal.currentAmount >= goal.targetAmount ? 'Reached' : goal.targetDate < generatedAt.toISOString().slice(0, 10) ? 'Past due' : 'In progress' };
    }).sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.name.localeCompare(b.name));
    return {
        month, monthLabel: monthLabel(month), priorMonth, priorMonthLabel: monthLabel(priorMonth),
        generatedAt: generatedAt.toISOString(), current, prior, categories, categoryComparison, budgets: budgetRows, goals: reportGoals,
        hasCurrentTransactions: current.transactionCount > 0, hasPriorTransactions: prior.transactionCount > 0
    };
}

function tableRows(rows, columns, emptyText) {
    if (!rows.length) return '<tr><td colspan="' + columns.length + '">' + escapeHtml(emptyText) + '</td></tr>';
    return rows.map((row) => '<tr>' + columns.map(([key, render]) => '<td>' + escapeHtml(render(row[key], row)) + '</td>').join('') + '</tr>').join('');
}

export function renderMonthlyFinancialReviewHtml(review) {
    if (!review || typeof review.month !== 'string' || !MONTH_PATTERN.test(review.month)
        || !Array.isArray(review.categories) || !Array.isArray(review.categoryComparison) || !Array.isArray(review.budgets) || !Array.isArray(review.goals)
        || !review.current || !review.prior || typeof review.generatedAt !== 'string') {
        throw new TypeError('Monthly financial review data is invalid.');
    }
    const amount = (value) => money(value);
    const rate = (value) => value === null ? 'Unavailable (zero recorded income)' : value.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + '%';
    const delta = (now, before) => ({ value: now - before, direction: now === before ? 'No change' : now > before ? 'Increased' : 'Decreased' });
    const metrics = [
        ['Recorded income', amount(review.current.income), delta(review.current.income, review.prior.income)],
        ['Recorded expenses', amount(review.current.expenses), delta(review.current.expenses, review.prior.expenses)],
        ['Net cash flow', amount(review.current.net), delta(review.current.net, review.prior.net)],
        ['Savings rate', rate(review.current.savingsRate), { value: review.current.savingsRate === null || review.prior.savingsRate === null ? 'Unavailable' : (review.current.savingsRate - review.prior.savingsRate).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' percentage points', direction: 'Compared with prior month' }]
    ];
    const budgetOverruns = review.budgets.filter((row) => row.overrun > 0);
    const generatedLabel = escapeHtml(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(review.generatedAt)));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PFO OS — Monthly Financial Review · ${escapeHtml(review.monthLabel)}</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#24382c;background:#f5f7f4}body{max-width:1080px;margin:0 auto;padding:28px 18px 50px;line-height:1.55}header,.card,section{background:#fff;border:1px solid #e2e9e2;border-radius:12px;padding:20px;margin:0 0 16px}h1{margin:0;font-size:clamp(24px,4vw,36px)}h2{font-size:19px;margin:0 0 12px}p,.muted{color:#69796e;font-size:13px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:700;color:#52735e}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.metric{background:#f8faf8;border:1px solid #e8eee8;border-radius:9px;padding:13px;min-width:0}.metric strong{display:block;font-size:clamp(17px,2.5vw,24px);overflow-wrap:anywhere}.metric span,.metric small{display:block;color:#6a796f;font-size:11px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e8eee8;vertical-align:top}th{background:#f7f9f7;color:#526257}td:not(:first-child),th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}.empty{color:#69796e}.privacy{border-left:4px solid #c4a15d;background:#fffbf1;padding:12px;font-size:12px}@media(max-width:700px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:12px}.card,section,header{padding:14px}.table-wrap{overflow-x:auto}table{min-width:540px}}@media print{body{background:#fff;padding:0;max-width:none}header,.card,section{break-inside:avoid;box-shadow:none}button{display:none}}
</style></head><body><header><p class="eyebrow">PFO OS · PRIVATE LOCAL REPORT</p><h1>Monthly financial review</h1><p><strong>${escapeHtml(review.monthLabel)}</strong> · Generated ${generatedLabel}</p><p>Recorded cash flow, saved category budgets, and saved goals only. No forecasts, inferred transactions, or recommendations.</p></header>
<section><h2>Month at a glance</h2><div class="grid">${metrics.map(([label,value,change])=>'<article class="metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong><small>'+escapeHtml(change.direction)+': '+escapeHtml(typeof change.value === 'number' ? amount(change.value) : change.value)+'</small></article>').join('')}</div><p class="muted">Comparison: ${escapeHtml(review.priorMonthLabel)}. ${review.hasCurrentTransactions ? '' : 'No transactions were recorded for the selected month.'} ${review.hasPriorTransactions ? '' : 'No transactions were recorded for the comparison month.'}</p></section>
<section><h2>Category activity</h2><div class="table-wrap"><table><thead><tr><th>Category</th><th>Income</th><th>Expenses</th><th>Net</th><th>Transactions</th></tr></thead><tbody>${tableRows(review.categories,[['category',(v)=>v],['income',amount],['expenses',amount],['net',amount],['transactionCount',String]],'No recorded transactions for this month.')}</tbody></table></div></section>
<section><h2>Category changes vs prior month</h2><p>Changes compare recorded transactions in ${escapeHtml(review.monthLabel)} with ${escapeHtml(review.priorMonthLabel)}. A category missing from either month is treated as zero for that month; this is a historical comparison, not a forecast.</p><div class="table-wrap"><table><thead><tr><th>Category</th><th>Current income</th><th>Current expenses</th><th>Prior income</th><th>Prior expenses</th><th>Expense change</th></tr></thead><tbody>${tableRows(review.categoryComparison,[["category",(v)=>v],["currentIncome",amount],["currentExpenses",amount],["priorIncome",amount],["priorExpenses",amount],["expenseChange",amount]],"No categories to compare.")}</tbody></table></div></section>
<section><h2>Budget attention</h2><p>Only explicitly saved budgets for ${escapeHtml(review.monthLabel)} are included. Categories without budgets are not assigned a limit.</p><div class="table-wrap"><table><thead><tr><th>Category</th><th>Budget</th><th>Actual expenses</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${tableRows(review.budgets,[['category',(v)=>v],['budget',amount],['actual',amount],['remaining',amount],['status',(v)=>v]],'No budgets saved for this month.')}</tbody></table></div><p>${budgetOverruns.length ? escapeHtml(budgetOverruns.length+' budgeted categories are over budget; total positive overrun: '+amount(budgetOverruns.reduce((sum,row)=>sum+row.overrun,0))+'.') : 'No positive overruns against saved budgets for this month.'}</p></section>
<section><h2>Saved goal progress</h2><div class="table-wrap"><table><thead><tr><th>Goal</th><th>Current</th><th>Target</th><th>Progress</th><th>Remaining</th><th>Target date</th><th>Status</th></tr></thead><tbody>${tableRows(review.goals,[['name',(v)=>v],['currentAmount',amount],['targetAmount',amount],['progress',(v)=>v.toLocaleString('en-IN',{maximumFractionDigits:1})+'%'],['remaining',amount],['targetDate',(v)=>v],['status',(v)=>v]],'No saved goals.')}</tbody></table></div><p class="muted">Goal amounts and status reflect saved progress at report generation time.</p></section>
<p class="privacy">Privacy: this is a self-contained HTML file and may contain sensitive financial information. Store it securely. It is generated in the browser and is not uploaded by PFO OS.</p></body></html>`;
}
