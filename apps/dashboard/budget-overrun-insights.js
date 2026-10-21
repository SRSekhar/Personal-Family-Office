const CASH_FLOW_KEY = 'pfo-os.cash-flow.v1';
const BUDGET_KEY = 'pfo-os.cash-flow-budgets.v1';

function isLoopback(hostname) {
    const host = typeof hostname === 'string' ? hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '') : '';
    return host === 'localhost' || host === '::1' || host === '127.0.0.1';
}

function readValidatedData(storage) {
    const rawBudgets = storage.getItem(BUDGET_KEY);
    const rawEntries = storage.getItem(CASH_FLOW_KEY);
    const budgets = rawBudgets === null ? [] : JSON.parse(rawBudgets);
    const entries = rawEntries === null ? [] : JSON.parse(rawEntries);
    if (!Array.isArray(budgets) || !Array.isArray(entries)) throw new Error('Saved budget or cash-flow data is not a valid list.');
    const budgetKeys = new Set();
    for (const budget of budgets) {
        if (!budget || typeof budget.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.month)
            || typeof budget.category !== 'string' || !budget.category.trim()
            || typeof budget.amount !== 'number' || !Number.isFinite(budget.amount) || budget.amount <= 0) {
            throw new Error('Saved budget data failed validation. Existing data was left untouched.');
        }
        const key = budget.month + '|' + budget.category.trim().toLocaleLowerCase('en-US');
        if (budgetKeys.has(key)) throw new Error('Saved budget data contains duplicate month/category entries.');
        budgetKeys.add(key);
    }
    const entryIds = new Set();
    for (const entry of entries) {
        if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || entryIds.has(entry.id)
            || !['income', 'expense'].includes(entry.type)
            || typeof entry.category !== 'string' || !entry.category.trim()
            || typeof entry.description !== 'string' || !entry.description.trim()
            || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
            || !Number.isFinite(entry.amount) || entry.amount <= 0 || typeof entry.recurring !== 'boolean') {
            throw new Error('Saved cash-flow data failed validation. Existing data was left untouched.');
        }
        const [year, month, day] = entry.date.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
            throw new Error('Saved cash-flow data contains an invalid calendar date.');
        }
        entryIds.add(entry.id);
    }
    return { budgets, entries };
}

export function summarizeRepeatedOverruns(budgets, entries) {
    const actuals = new Map();
    for (const entry of entries) {
        if (entry.type !== 'expense') continue;
        const key = entry.date.slice(0, 7) + '|' + entry.category.trim().toLocaleLowerCase('en-US');
        const next = (actuals.get(key) || 0) + entry.amount;
        if (!Number.isFinite(next)) throw new Error('Expense totals exceed the supported numeric range.');
        actuals.set(key, next);
    }
    const categories = new Map();
    for (const budget of budgets) {
        const categoryKey = budget.category.trim().toLocaleLowerCase('en-US');
        const actual = actuals.get(budget.month + '|' + categoryKey) || 0;
        const overrun = actual > budget.amount ? actual - budget.amount : 0;
        const current = categories.get(categoryKey) || {
            category: budget.category.trim(), monthsBudgeted: 0, monthsOverBudget: 0, totalOverrun: 0
        };
        current.monthsBudgeted += 1;
        if (overrun > 0) {
            current.monthsOverBudget += 1;
            current.totalOverrun += overrun;
            if (!Number.isFinite(current.totalOverrun)) throw new Error('Overrun totals exceed the supported numeric range.');
        }
        categories.set(categoryKey, current);
    }
    return [...categories.values()]
        .filter((item) => item.monthsOverBudget >= 2)
        .map((item) => {
            const averageOverrun = item.totalOverrun / item.monthsOverBudget;
            if (!Number.isFinite(averageOverrun)) throw new Error('Average overruns exceed the supported numeric range.');
            return { ...item, averageOverrun };
        })
        .sort((a, b) => b.monthsOverBudget - a.monthsOverBudget
            || b.totalOverrun - a.totalOverrun
            || a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }));
}

function money(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function render() {
    const panel = document.querySelector('#cash-flow-repeated-budget-overrun-panel');
    if (!panel) return;
    const body = panel.querySelector('#cash-flow-repeated-budget-overrun-rows');
    const empty = panel.querySelector('#cash-flow-repeated-budget-overrun-empty');
    const message = panel.querySelector('#cash-flow-repeated-budget-overrun-message');
    body.replaceChildren();
    empty.hidden = true;
    message.hidden = true;
    if (!isLoopback(window.location.hostname)) {
        message.textContent = 'Repeated budget insights are available only in the local dashboard.';
        message.hidden = false;
        return;
    }
    try {
        const { budgets, entries } = readValidatedData(window.localStorage);
        const rows = summarizeRepeatedOverruns(budgets, entries);
        empty.hidden = rows.length !== 0;
        for (const item of rows) {
            const row = document.createElement('tr');
            for (const value of [item.category, String(item.monthsOverBudget), String(item.monthsBudgeted), money(item.totalOverrun), money(item.averageOverrun)]) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
        if (!budgets.length) empty.textContent = 'Save monthly budgets to identify repeated overruns.';
        else empty.textContent = 'No category has exceeded its saved budget in two or more recorded months.';
    } catch (error) {
        message.textContent = error instanceof Error ? error.message : 'Repeated budget insights are unavailable because saved data could not be validated.';
        message.hidden = false;
    }
}

function initialize() {
    render();
    const historyToggle = document.querySelector('#cash-flow-budget-history-toggle');
    const budgetSave = document.querySelector('#cash-flow-budget-save');
    const cashFlowSave = document.querySelector('#cash-flow-save');
    for (const control of [historyToggle, budgetSave, cashFlowSave]) {
        if (control) control.addEventListener('click', () => window.setTimeout(render, 0));
    }
    const root = document.querySelector('#cash-flow');
    if (root) root.addEventListener('submit', () => window.setTimeout(render, 0));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}
