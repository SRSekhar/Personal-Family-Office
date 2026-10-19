const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isCalendarDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidCashFlowEntry(entry) {
    return Boolean(entry && typeof entry === 'object'
        && typeof entry.id === 'string' && entry.id.trim() !== ''
        && ['income', 'expense'].includes(entry.type)
        && typeof entry.category === 'string' && entry.category.trim() !== ''
        && typeof entry.description === 'string' && entry.description.trim() !== ''
        && isCalendarDate(entry.date)
        && Number.isFinite(entry.amount) && entry.amount > 0
        && typeof entry.recurring === 'boolean');
}

export function validateCashFlowEntries(entries) {
    if (!Array.isArray(entries)) throw new Error('Cash flow ledger must be an array.');
    const seen = new Set();
    let income = 0;
    let expenses = 0;
    const validated = entries.map((entry) => {
        if (!isValidCashFlowEntry(entry) || seen.has(entry.id)) {
            throw new Error('The cash flow ledger contains an invalid or duplicate transaction.');
        }
        seen.add(entry.id);
        if (entry.type === 'income') income += entry.amount;
        else expenses += entry.amount;
        if (!Number.isFinite(income) || !Number.isFinite(expenses)) {
            throw new Error('Cash flow totals exceed the supported numeric range.');
        }
        return {
            id: entry.id, date: entry.date, type: entry.type,
            category: entry.category.trim(), description: entry.description.trim(),
            amount: entry.amount, recurring: entry.recurring
        };
    });
    return validated;
}

export function summarizeCashFlow(entries, period = 'all') {
    if (period !== 'all' && (typeof period !== 'string' || !PERIOD_PATTERN.test(period))) {
        throw new RangeError('Period must be "all" or a valid YYYY-MM month.');
    }
    const selected = validateCashFlowEntries(entries).filter((entry) =>
        period === 'all' || entry.date.startsWith(period));
    let income = 0;
    let expenses = 0;
    for (const entry of selected) {
        if (entry.type === 'income') income += entry.amount;
        else expenses += entry.amount;
        if (!Number.isFinite(income) || !Number.isFinite(expenses)) {
            throw new RangeError('Cash flow totals exceed the supported numeric range.');
        }
    }
    const net = income - expenses;
    if (!Number.isFinite(net)) throw new RangeError('Net cash flow exceeds the supported numeric range.');
    return { period, income, expenses, net, transactionCount: selected.length };
}

export function summarizeCashFlowByCategory(entries, period = 'all') {
    if (period !== 'all' && (typeof period !== 'string' || !PERIOD_PATTERN.test(period))) {
        throw new RangeError('Period must be "all" or a valid YYYY-MM month.');
    }
    const selected = validateCashFlowEntries(entries).filter((entry) =>
        period === 'all' || entry.date.startsWith(period));
    const categories = new Map();
    for (const entry of selected) {
        let summary = categories.get(entry.category);
        if (!summary) {
            summary = { category: entry.category, income: 0, expenses: 0, transactionCount: 0 };
            categories.set(entry.category, summary);
        }
        if (entry.type === 'income') summary.income += entry.amount;
        else summary.expenses += entry.amount;
        summary.transactionCount += 1;
        if (!Number.isFinite(summary.income) || !Number.isFinite(summary.expenses)) {
            throw new RangeError('Cash flow category totals exceed the supported numeric range.');
        }
    }
    const result = [...categories.values()].map((summary) => {
        const net = summary.income - summary.expenses;
        const activity = summary.income + summary.expenses;
        if (!Number.isFinite(net) || !Number.isFinite(activity)) {
            throw new RangeError('Cash flow category totals exceed the supported numeric range.');
        }
        return { ...summary, net, activity };
    });
    return result.sort((a, b) => b.activity - a.activity || a.category.localeCompare(b.category))
        .map(({ activity, ...summary }) => summary);
}

function csvCell(value) {
    let text = String(value);
    // trimStart neutralizes leading spaces and control whitespace before formula detection.
    if (/^[=+@-]/.test(text.trimStart())) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}

export function cashFlowToCsv(entries) {
    const rows = validateCashFlowEntries(entries).map((entry) => [
        entry.date, entry.type, entry.category, entry.description, entry.amount, entry.recurring ? 'true' : 'false'
    ]);
    return [
        ['date', 'type', 'category', 'description', 'amount', 'recurring'],
        ...rows
    ].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
