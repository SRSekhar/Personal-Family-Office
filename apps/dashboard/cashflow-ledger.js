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

export function calculateCashFlowSavingsRate(income, expenses) {
    if (!Number.isFinite(income) || income < 0 || !Number.isFinite(expenses) || expenses < 0) {
        throw new RangeError('Income and expenses must be finite, non-negative amounts.');
    }
    if (income === 0) return null;
    const rate = ((income - expenses) / income) * 100;
    if (!Number.isFinite(rate)) throw new RangeError('Cash flow savings rate exceeds the supported numeric range.');
    return rate;
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
        .map((summary) => ({
            category: summary.category, income: summary.income, expenses: summary.expenses,
            transactionCount: summary.transactionCount, net: summary.net
        }));
}

export function summarizeCashFlowByMonth(entries) {
    const months = new Map();
    for (const entry of validateCashFlowEntries(entries)) {
        const month = entry.date.slice(0, 7);
        let summary = months.get(month);
        if (!summary) {
            summary = { month, income: 0, expenses: 0, transactionCount: 0 };
            months.set(month, summary);
        }
        if (entry.type === 'income') summary.income += entry.amount;
        else summary.expenses += entry.amount;
        summary.transactionCount += 1;
        if (!Number.isFinite(summary.income) || !Number.isFinite(summary.expenses)) {
            throw new RangeError('Monthly cash flow totals exceed the supported numeric range.');
        }
    }
    return [...months.values()]
        .map((summary) => {
            const net = summary.income - summary.expenses;
            if (!Number.isFinite(net)) {
                throw new RangeError('Monthly net cash flow exceeds the supported numeric range.');
            }
            return { ...summary, net };
        })
        .sort((a, b) => b.month.localeCompare(a.month));
}

function csvCell(value) {
    let text = String(value);
    // trimStart neutralizes leading spaces and control whitespace before formula detection.
    if (/^[=+@-]/.test(text.trimStart())) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}

export function sortCashFlowEntries(entries, order = 'date-newest') {
    const comparators = {
        'date-newest': (a, b) => b.date.localeCompare(a.date),
        'date-oldest': (a, b) => a.date.localeCompare(b.date),
        'amount-high': (a, b) => b.amount - a.amount,
        'amount-low': (a, b) => a.amount - b.amount,
        'category-az': (a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
    };
    if (!Object.hasOwn(comparators, order)) {
        throw new RangeError('Order must be date-newest, date-oldest, amount-high, amount-low, or category-az.');
    }
    return validateCashFlowEntries(entries).sort((a, b) => comparators[order](a, b)
        || b.date.localeCompare(a.date)
        || a.description.localeCompare(b.description)
        || a.id.localeCompare(b.id));
}

export function filterCashFlowEntries(entries, {
    period = 'all', type = 'all', recurring = 'all', category = null,
    fromDate = '', toDate = '', search = ''
} = {}) {
    if (period !== 'all' && (typeof period !== 'string' || !PERIOD_PATTERN.test(period))) {
        throw new RangeError('Period must be "all" or a valid YYYY-MM month.');
    }
    if (!['all', 'income', 'expense'].includes(type)) {
        throw new RangeError('Type must be "all", "income", or "expense".');
    }
    if (!['all', 'recurring', 'one-time'].includes(recurring)) {
        throw new RangeError('Frequency must be "all", "recurring", or "one-time".');
    }
    if (category !== null && (typeof category !== 'string' || category.trim() === '')) {
        throw new TypeError('Category must be null or a non-empty category name.');
    }
    if (typeof fromDate !== 'string' || (fromDate !== '' && !isCalendarDate(fromDate))) {
        throw new RangeError('Start date must be empty or a valid YYYY-MM-DD date.');
    }
    if (typeof toDate !== 'string' || (toDate !== '' && !isCalendarDate(toDate))) {
        throw new RangeError('End date must be empty or a valid YYYY-MM-DD date.');
    }
    if (fromDate && toDate && fromDate > toDate) {
        throw new RangeError('Start date must be on or before end date.');
    }
    if (typeof search !== 'string') throw new TypeError('Search must be a string.');
    const query = search.trim().toLowerCase();
    return validateCashFlowEntries(entries)
        .filter((entry) => (period === 'all' || entry.date.startsWith(period))
            && (type === 'all' || entry.type === type)
            && (recurring === 'all' || entry.recurring === (recurring === 'recurring'))
            && (category === null || entry.category === category)
            && (!fromDate || entry.date >= fromDate)
            && (!toDate || entry.date <= toDate)
            && (!query || [entry.date, entry.category, entry.description]
                .some((value) => value.toLowerCase().includes(query))))
        .sort((a, b) => b.date.localeCompare(a.date)
            || a.description.localeCompare(b.description)
            || a.id.localeCompare(b.id));
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
