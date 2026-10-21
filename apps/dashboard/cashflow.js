import {
    calculateCashFlowSavingsRate, findPotentialDuplicateCashFlowEntry, cashFlowAnnualSummaryToCsv, cashFlowCategorySummaryToCsv, cashFlowFilteredSummaryToCsv, cashFlowMonthlySummaryToCsv, cashFlowToCsv, filterCashFlowEntries,
    sortCashFlowEntries, summarizeCashFlow, summarizeCashFlowByCategory,
    summarizeCashFlowByMonth, summarizeCashFlowByYear, validateCashFlowEntries
} from './cashflow-ledger.js';

const STORAGE_KEY = 'pfo-os.cash-flow.v1';
const BUDGET_STORAGE_KEY = 'pfo-os.cash-flow-budgets.v1';
const CURRENCY = 'INR';

function localDateString() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function localMonthString() {
    return localDateString().slice(0, 7);
}

function isLoopback(hostname) {
    const host = typeof hostname === 'string' ? hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '') : '';
    return host === 'localhost' || host === '::1' || host === '127.0.0.1';
}


function parseCashFlowCsv(source, cryptoRef) {
    if (typeof source !== 'string' || source.trim() === '') throw new Error('The CSV file is empty.');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let quoteClosed = false;
    const input = source.replace(/^\uFEFF/u, '');
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (quoted) {
            if (ch === '"') {
                if (input[i + 1] === '"') { field += '"'; i += 1; }
                else { quoted = false; quoteClosed = true; }
            } else field += ch;
            continue;
        }
        if (quoteClosed) {
            if (ch === ',') { row.push(field); field = ''; quoteClosed = false; }
            else if (ch === '\r' || ch === '\n') {
                row.push(field); rows.push(row); row = []; field = ''; quoteClosed = false;
                if (ch === '\r' && input[i + 1] === '\n') i += 1;
            } else throw new Error('The CSV contains characters after a closing quote.');
            continue;
        }
        if (ch === '"') {
            if (field.length !== 0) throw new Error('The CSV contains a quote inside an unquoted field.');
            quoted = true;
        } else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\r' || ch === '\n') {
            row.push(field); rows.push(row); row = []; field = '';
            if (ch === '\r' && input[i + 1] === '\n') i += 1;
        } else field += ch;
    }
    if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
    if (field.length > 0 || row.length > 0 || quoteClosed) { row.push(field); rows.push(row); }
    const header = ['date', 'type', 'category', 'description', 'amount', 'recurring'];
    if (!rows.length || rows[0].length !== header.length || !header.every((value, index) => rows[0][index] === value)) {
        throw new Error('Unsupported CSV format. Expected columns: date, type, category, description, amount, recurring.');
    }
    if (rows.length === 1) throw new Error('The CSV contains no transactions.');
    return rows.slice(1).map((columns) => {
        if (columns.length !== header.length || columns.some((value) => value.trim() === '')) {
            throw new Error('The CSV contains an incomplete transaction.');
        }
        const [date, type, category, description, rawAmount, recurring] = columns;
        const amount = Number(rawAmount);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
            || !['income', 'expense'].includes(type)
            || !Number.isFinite(amount) || amount <= 0
            || !['true', 'false'].includes(recurring)) {
            throw new Error('The CSV contains an invalid transaction.');
        }
        const [year, month, day] = date.split('-').map(Number);
        const calendarDate = new Date(Date.UTC(year, month - 1, day));
        if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
            throw new Error('The CSV contains an invalid calendar date.');
        }
        return { id: cryptoRef.randomUUID(), date, type, category: category.trim(), description: description.trim(), amount, recurring: recurring === 'true' };
    });
}

export function initializeCashFlowTracker(documentRef = document, windowRef = window) {
    const root = documentRef.querySelector('#cash-flow');
    if (!root) return;
    const $ = (selector) => root.querySelector(selector);
    const money = (value) => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: CURRENCY, maximumFractionDigits: 0
    }).format(value);
    let entries = [];
    let storageHealthy = true;
    let budgets = [];
    let budgetStorageHealthy = true;
    let editingBudgetKey = null;
    let editingId = null;
    let duplicatingEntry = false;

    function message(text, isError = false) {
        $('#cash-flow-message').textContent = text;
        $('#cash-flow-message').hidden = !text;
        $('#cash-flow-message').classList.toggle('fire-validation', isError);
    }

    function load() {
        try {
            const raw = windowRef.localStorage.getItem(STORAGE_KEY);
            entries = raw === null ? [] : validateCashFlowEntries(JSON.parse(raw));
            storageHealthy = true;
        } catch {
            entries = [];
            storageHealthy = false;
            message('Saved cash flow data could not be validated. It has been left untouched. Import a valid cash flow backup to recover.', true);
        }
    }

    function save(nextEntries) {
        if (!storageHealthy) {
            message('Editing is paused because saved data could not be validated. Import a valid cash flow backup before editing.', true);
            return false;
        }
        let validated;
        try {
            validated = validateCashFlowEntries(nextEntries);
            windowRef.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not safely save cash flow data.', true);
            return false;
        }
        entries = validated;
        render();
        return true;
    }

    function visibleEntries() {
        const filtered = filterCashFlowEntries(entries, {
            period: $('#cash-flow-period').value || 'all',
            type: $('#cash-flow-type-filter').value || 'all',
            recurring: $('#cash-flow-frequency-filter').value || 'all',
            category: $('#cash-flow-category-filter').value || null,
            fromDate: $('#cash-flow-date-from').value,
            toDate: $('#cash-flow-date-to').value,
            minAmount: $('#cash-flow-amount-min').value === '' ? null : Number($('#cash-flow-amount-min').value),
            maxAmount: $('#cash-flow-amount-max').value === '' ? null : Number($('#cash-flow-amount-max').value),
            search: $('#cash-flow-search').value
        });
        return sortCashFlowEntries(filtered, $('#cash-flow-sort-order').value || 'date-newest');
    }

    function refreshCategoryOptions() {
        const select = $('#cash-flow-category-filter');
        const previous = select.value || '';
        const categories = [...new Set(entries.map((entry) => entry.category))]
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        select.replaceChildren();
        const all = documentRef.createElement('option');
        all.value = '';
        all.textContent = 'All categories';
        select.append(all);
        for (const category of categories) {
            const option = documentRef.createElement('option');
            option.value = category;
            option.textContent = category;
            select.append(option);
        }
        select.value = previous === '' || categories.includes(previous) ? previous : '';
    }

    function refreshPeriodOptions() {
        const select = $('#cash-flow-period');
        const previous = select.value;
        const periods = new Set([localMonthString(), ...entries.map((entry) => entry.date.slice(0, 7))]);
        select.replaceChildren();
        const all = documentRef.createElement('option');
        all.value = 'all'; all.textContent = 'All transactions'; select.append(all);
        [...periods].sort().reverse().forEach((period) => {
            const option = documentRef.createElement('option');
            option.value = period;
            option.textContent = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(period + '-01T00:00:00Z'));
            select.append(option);
        });
        select.value = select.dataset.initialized === 'true' && [...select.options].some((option) => option.value === previous)
            ? previous : localMonthString();
        select.dataset.initialized = 'true';
    }

    function render() {
        refreshPeriodOptions();
        refreshCategoryOptions();
        const period = $('#cash-flow-period').value || 'all';
        const summary = summarizeCashFlow(entries, period);
        $('#cash-flow-income-total').textContent = money(summary.income);
        $('#cash-flow-expense-total').textContent = money(summary.expenses);
        $('#cash-flow-net-total').textContent = money(summary.net);
        const savingsRate = calculateCashFlowSavingsRate(summary.income, summary.expenses);
        $('#cash-flow-savings-rate').textContent = savingsRate === null
            ? '—'
            : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(savingsRate) + '%';
        $('#cash-flow-savings-rate-caption').textContent = savingsRate === null
            ? 'Unavailable when income is zero'
            : 'Net cash flow ÷ income';
        const recurringEntries = entries.filter((entry) => entry.recurring
            && (period === 'all' || entry.date.startsWith(period)));
        const recurringIncome = recurringEntries.filter((entry) => entry.type === 'income')
            .reduce((total, entry) => total + entry.amount, 0);
        const recurringExpenses = recurringEntries.filter((entry) => entry.type === 'expense')
            .reduce((total, entry) => total + entry.amount, 0);
        const recurringNet = recurringIncome - recurringExpenses;
        const recurringTotalsAreFinite = Number.isFinite(recurringIncome)
            && Number.isFinite(recurringExpenses) && Number.isFinite(recurringNet);
        $('#cash-flow-recurring-income').textContent = recurringTotalsAreFinite ? money(recurringIncome) : '—';
        $('#cash-flow-recurring-expenses').textContent = recurringTotalsAreFinite ? money(recurringExpenses) : '—';
        $('#cash-flow-recurring-net').textContent = recurringTotalsAreFinite ? money(recurringNet) : '—';
        $('#cash-flow-recurring-count').textContent = String(recurringEntries.length);
        const recurringCategories = summarizeCashFlowByCategory(recurringEntries, 'all');
        const recurringCategoryExpenses = recurringCategories.reduce((total, item) => total + item.expenses, 0);
        const recurringCategoryBody = $('#cash-flow-recurring-category-rows');
        recurringCategoryBody.replaceChildren();
        $('#cash-flow-recurring-category-empty').hidden = recurringCategories.length !== 0;
        for (const category of recurringCategories) {
            const row = documentRef.createElement('tr');
            const expenseShare = !Number.isFinite(recurringCategoryExpenses) || recurringCategoryExpenses === 0 ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format((category.expenses / recurringCategoryExpenses) * 100) + '%';
            for (const value of [category.category, money(category.income), money(category.expenses), expenseShare, money(category.net), String(category.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            recurringCategoryBody.append(row);
        }
        const fromDate = $('#cash-flow-date-from').value;
        const toDate = $('#cash-flow-date-to').value;
        const minAmount = $('#cash-flow-amount-min').value === '' ? null : Number($('#cash-flow-amount-min').value);
        const maxAmount = $('#cash-flow-amount-max').value === '' ? null : Number($('#cash-flow-amount-max').value);
        const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
        const invalidAmountRange = (minAmount !== null && (!Number.isFinite(minAmount) || minAmount < 0))
            || (maxAmount !== null && (!Number.isFinite(maxAmount) || maxAmount < 0))
            || (minAmount !== null && maxAmount !== null && minAmount > maxAmount);
        const invalidFilterRange = invalidDateRange || invalidAmountRange;
        const dateRangeError = $('#cash-flow-date-range-error');
        dateRangeError.textContent = invalidDateRange
            ? 'Start date must be on or before end date. Correct the date range to view or export transactions.'
            : invalidAmountRange ? 'Amount range must use non-negative finite amounts, with minimum no greater than maximum. Correct the range to view or export transactions.' : '';
        dateRangeError.hidden = !invalidFilterRange;
        const shown = invalidFilterRange ? [] : visibleEntries();
        $('#cash-flow-export-filtered-csv').disabled = invalidFilterRange;
        $('#cash-flow-export-filtered-summary-csv').disabled = invalidFilterRange;
        $('#cash-flow-export-filtered-category-csv').disabled = invalidFilterRange;
        const filteredSummary = summarizeCashFlow(shown);
        $('#cash-flow-filtered-income').textContent = money(filteredSummary.income);
        $('#cash-flow-filtered-expenses').textContent = money(filteredSummary.expenses);
        $('#cash-flow-filtered-net').textContent = money(filteredSummary.net);
        const filteredSavingsRate = calculateCashFlowSavingsRate(filteredSummary.income, filteredSummary.expenses);
        $('#cash-flow-filtered-savings-rate').textContent = filteredSavingsRate === null
            ? '—'
            : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(filteredSavingsRate) + '%';
        $('#cash-flow-filtered-savings-rate-caption').textContent = filteredSavingsRate === null
            ? 'Unavailable when filtered income is zero'
            : 'Filtered net cash flow ÷ filtered income';
        const filtersActive = $('#cash-flow-type-filter').value !== 'all'
            || $('#cash-flow-frequency-filter').value !== 'all'
            || $('#cash-flow-category-filter').value !== ''
            || $('#cash-flow-date-from').value !== ''
            || $('#cash-flow-date-to').value !== ''
            || $('#cash-flow-search').value.trim() !== '';
        $('#cash-flow-count').textContent = invalidDateRange
            ? 'Invalid date range'
            : filtersActive
                ? shown.length + ' shown of ' + summary.transactionCount + ' transaction' + (summary.transactionCount === 1 ? '' : 's')
                : summary.transactionCount + ' transaction' + (summary.transactionCount === 1 ? '' : 's');
        $('#cash-flow-empty').textContent = invalidDateRange
            ? 'Correct the date range to see matching transactions.'
            : filtersActive
                ? 'No transactions match the current filters.'
                : 'No transactions for this period. Add income or an expense to begin.';
        const categoryBody = $('#cash-flow-category-rows');
        categoryBody.replaceChildren();
        const categories = summarizeCashFlowByCategory(entries, period);
        $('#cash-flow-category-empty').hidden = categories.length !== 0;
        for (const category of categories) {
            const row = documentRef.createElement('tr');
            const expenseShare = summary.expenses === 0
                ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })
                    .format((category.expenses / summary.expenses) * 100) + '%';
            for (const value of [category.category, money(category.income), money(category.expenses), expenseShare, money(category.net), String(category.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            categoryBody.append(row);
        }
        const monthlyBody = $('#cash-flow-monthly-rows');
        monthlyBody.replaceChildren();
        const monthlySummaries = summarizeCashFlowByMonth(entries);
        $('#cash-flow-monthly-empty').hidden = monthlySummaries.length !== 0;
        for (const summary of monthlySummaries) {
            const row = documentRef.createElement('tr');
            const monthLabel = new Intl.DateTimeFormat('en-IN', {
                month: 'short', year: 'numeric', timeZone: 'UTC'
            }).format(new Date(summary.month + '-01T00:00:00.000Z'));
            const savingsRate = calculateCashFlowSavingsRate(summary.income, summary.expenses);
            const savingsRateLabel = savingsRate === null
                ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(savingsRate) + '%';
            for (const value of [monthLabel, money(summary.income), money(summary.expenses), money(summary.net), savingsRateLabel, String(summary.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            monthlyBody.append(row);
        }
        const comparisonCurrentFilter = $('#cash-flow-comparison-current-month');
        const comparisonBaseFilter = $('#cash-flow-comparison-base-month');
        const priorCurrentMonth = comparisonCurrentFilter.value;
        const priorBaseMonth = comparisonBaseFilter.value;
        const comparisonMonths = monthlySummaries.map((item) => item.month);
        for (const [select, previous, fallbackIndex] of [
            [comparisonCurrentFilter, priorCurrentMonth, 0],
            [comparisonBaseFilter, priorBaseMonth, Math.min(1, comparisonMonths.length - 1)]
        ]) {
            select.replaceChildren();
            for (const month of comparisonMonths) {
                const option = documentRef.createElement('option');
                option.value = month;
                option.textContent = new Intl.DateTimeFormat('en-IN', {
                    month: 'long', year: 'numeric', timeZone: 'UTC'
                }).format(new Date(month + '-01T00:00:00.000Z'));
                select.append(option);
            }
            select.value = comparisonMonths.includes(previous) ? previous : (comparisonMonths[fallbackIndex] || '');
            select.disabled = comparisonMonths.length === 0;
        }
        $('#cash-flow-monthly-comparison-empty').hidden = comparisonMonths.length !== 0;
        const currentComparison = monthlySummaries.find((item) => item.month === comparisonCurrentFilter.value);
        const baseComparison = monthlySummaries.find((item) => item.month === comparisonBaseFilter.value);
        const comparisonBody = $('#cash-flow-monthly-comparison-rows');
        comparisonBody.replaceChildren();
        const comparisonMetrics = currentComparison && baseComparison ? [
            ['Income', currentComparison.income, baseComparison.income, money],
            ['Expenses', currentComparison.expenses, baseComparison.expenses, money],
            ['Net cash flow', currentComparison.net, baseComparison.net, money],
            ['Savings rate', calculateCashFlowSavingsRate(currentComparison.income, currentComparison.expenses),
                calculateCashFlowSavingsRate(baseComparison.income, baseComparison.expenses), (value) => value === null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value) + '%'],
            ['Transaction count', currentComparison.transactionCount, baseComparison.transactionCount, (value) => String(value)]
        ] : [];
        for (const [label, currentValue, baseValue, format] of comparisonMetrics) {
            const row = documentRef.createElement('tr');
            let differenceLabel = '—';
            if (Number.isFinite(currentValue) && Number.isFinite(baseValue)) {
                const difference = currentValue - baseValue;
                if (Number.isFinite(difference)) {
                    differenceLabel = label === 'Savings rate'
                        ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(difference) + ' pp'
                        : format(difference);
                }
            }
            for (const value of [label, format(currentValue), format(baseValue), differenceLabel]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            comparisonBody.append(row);
        }
        const annualBody = $('#cash-flow-annual-rows');
        annualBody.replaceChildren();
        const annualSummaries = summarizeCashFlowByYear(entries);
        $('#cash-flow-annual-empty').hidden = annualSummaries.length !== 0;
        for (const summary of annualSummaries) {
            const row = documentRef.createElement('tr');
            const savingsRate = calculateCashFlowSavingsRate(summary.income, summary.expenses);
            const savingsRateLabel = savingsRate === null
                ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(savingsRate) + '%';
            for (const value of [summary.year, money(summary.income), money(summary.expenses), money(summary.net), savingsRateLabel, String(summary.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            annualBody.append(row);
        }
        const comparisonCurrentYearFilter = $('#cash-flow-comparison-current-year');
        const comparisonBaseYearFilter = $('#cash-flow-comparison-base-year');
        const priorCurrentYear = comparisonCurrentYearFilter.value;
        const priorBaseYear = comparisonBaseYearFilter.value;
        const comparisonYears = annualSummaries.map((item) => item.year);
        for (const [select, previous, fallbackIndex] of [
            [comparisonCurrentYearFilter, priorCurrentYear, 0],
            [comparisonBaseYearFilter, priorBaseYear, Math.min(1, comparisonYears.length - 1)]
        ]) {
            select.replaceChildren();
            for (const year of comparisonYears) {
                const option = documentRef.createElement('option');
                option.value = year;
                option.textContent = year;
                select.append(option);
            }
            select.value = comparisonYears.includes(previous) ? previous : (comparisonYears[fallbackIndex] || '');
            select.disabled = comparisonYears.length === 0;
        }
        $('#cash-flow-annual-comparison-empty').hidden = comparisonYears.length !== 0;
        const currentYearComparison = annualSummaries.find((item) => item.year === comparisonCurrentYearFilter.value);
        const baseYearComparison = annualSummaries.find((item) => item.year === comparisonBaseYearFilter.value);
        const annualComparisonBody = $('#cash-flow-annual-comparison-rows');
        annualComparisonBody.replaceChildren();
        const annualComparisonMetrics = currentYearComparison && baseYearComparison ? [
            ['Income', currentYearComparison.income, baseYearComparison.income, money],
            ['Expenses', currentYearComparison.expenses, baseYearComparison.expenses, money],
            ['Net cash flow', currentYearComparison.net, baseYearComparison.net, money],
            ['Savings rate', calculateCashFlowSavingsRate(currentYearComparison.income, currentYearComparison.expenses),
                calculateCashFlowSavingsRate(baseYearComparison.income, baseYearComparison.expenses),
                (value) => value === null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value) + '%'],
            ['Transaction count', currentYearComparison.transactionCount, baseYearComparison.transactionCount, (value) => String(value)]
        ] : [];
        for (const [label, currentValue, baseValue, format] of annualComparisonMetrics) {
            const row = documentRef.createElement('tr');
            let differenceLabel = '—';
            if (Number.isFinite(currentValue) && Number.isFinite(baseValue)) {
                const difference = currentValue - baseValue;
                if (Number.isFinite(difference)) {
                    differenceLabel = label === 'Savings rate'
                        ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(difference) + ' pp'
                        : format(difference);
                }
            }
            for (const value of [label, format(currentValue), format(baseValue), differenceLabel]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            annualComparisonBody.append(row);
        }
        const annualCategoryComparisonBody = $('#cash-flow-annual-category-comparison-rows');
        annualCategoryComparisonBody.replaceChildren();
        const currentYearCategories = currentYearComparison
            ? summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(currentYearComparison.year)), 'all')
            : [];
        const baseYearCategories = baseYearComparison
            ? summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(baseYearComparison.year)), 'all')
            : [];
        const categoriesByKey = new Map();
        for (const item of currentYearCategories) {
            categoriesByKey.set(item.category.toLocaleLowerCase('en-US'), {
                category: item.category, currentIncome: item.income, currentExpenses: item.expenses,
                baseIncome: 0, baseExpenses: 0
            });
        }
        for (const item of baseYearCategories) {
            const key = item.category.toLocaleLowerCase('en-US');
            const existing = categoriesByKey.get(key);
            if (existing) {
                existing.baseIncome = item.income;
                existing.baseExpenses = item.expenses;
            } else {
                categoriesByKey.set(key, {
                    category: item.category, currentIncome: 0, currentExpenses: 0,
                    baseIncome: item.income, baseExpenses: item.expenses
                });
            }
        }
        const annualCategoryComparison = [...categoriesByKey.values()].sort((a, b) =>
            b.currentExpenses - a.currentExpenses || b.baseExpenses - a.baseExpenses
            || a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }));
        $('#cash-flow-annual-category-comparison-empty').hidden = annualCategoryComparison.length !== 0;
        for (const item of annualCategoryComparison) {
            const expenseDifference = item.currentExpenses - item.baseExpenses;
            const row = documentRef.createElement('tr');
            for (const value of [
                item.category, money(item.currentIncome), money(item.currentExpenses),
                money(item.baseIncome), money(item.baseExpenses),
                Number.isFinite(expenseDifference) ? money(expenseDifference) : '—'
            ]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            annualCategoryComparisonBody.append(row);
        }
        const annualCategoryYearFilter = $('#cash-flow-annual-category-year');
        const priorCategoryYear = annualCategoryYearFilter.value;
        const categoryYears = [...new Set(entries.map((entry) => entry.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
        if (categoryYears.length === 0) categoryYears.push(localDateString().slice(0, 4));
        annualCategoryYearFilter.replaceChildren();
        for (const year of categoryYears) {
            const option = documentRef.createElement('option');
            option.value = year;
            option.textContent = year;
            annualCategoryYearFilter.append(option);
        }
        annualCategoryYearFilter.value = categoryYears.includes(priorCategoryYear) ? priorCategoryYear : categoryYears[0];
        const annualCategoryEntries = entries.filter((entry) => entry.date.startsWith(annualCategoryYearFilter.value));
        const annualCategories = summarizeCashFlowByCategory(annualCategoryEntries, 'all');
        const annualCategoryExpenses = annualCategories.reduce((total, item) => total + item.expenses, 0);
        const annualCategoryBody = $('#cash-flow-annual-category-rows');
        annualCategoryBody.replaceChildren();
        $('#cash-flow-annual-category-empty').hidden = annualCategories.length !== 0;
        for (const category of annualCategories) {
            const row = documentRef.createElement('tr');
            const expenseShare = !Number.isFinite(annualCategoryExpenses) || annualCategoryExpenses === 0 ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format((category.expenses / annualCategoryExpenses) * 100) + '%';
            for (const value of [category.category, money(category.income), money(category.expenses), expenseShare, money(category.net), String(category.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            annualCategoryBody.append(row);
        }
        const monthlyCategoryMonthFilter = $('#cash-flow-monthly-category-month');
        const priorCategoryMonth = monthlyCategoryMonthFilter.value;
        const categoryMonths = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
        if (categoryMonths.length === 0) categoryMonths.push(localMonthString());
        monthlyCategoryMonthFilter.replaceChildren();
        for (const month of categoryMonths) {
            const option = documentRef.createElement('option');
            option.value = month;
            option.textContent = new Intl.DateTimeFormat('en-IN', {
                month: 'long', year: 'numeric', timeZone: 'UTC'
            }).format(new Date(month + '-01T00:00:00.000Z'));
            monthlyCategoryMonthFilter.append(option);
        }
        monthlyCategoryMonthFilter.value = categoryMonths.includes(priorCategoryMonth) ? priorCategoryMonth : categoryMonths[0];
        const monthlyCategoryEntries = entries.filter((entry) => entry.date.startsWith(monthlyCategoryMonthFilter.value));
        const monthlyCategories = summarizeCashFlowByCategory(monthlyCategoryEntries, 'all');
        const monthlyCategoryExpenses = monthlyCategories.reduce((total, item) => total + item.expenses, 0);
        const monthlyCategoryBody = $('#cash-flow-monthly-category-rows');
        monthlyCategoryBody.replaceChildren();
        $('#cash-flow-monthly-category-empty').hidden = monthlyCategories.length !== 0;
        for (const category of monthlyCategories) {
            const row = documentRef.createElement('tr');
            const expenseShare = !Number.isFinite(monthlyCategoryExpenses) || monthlyCategoryExpenses === 0 ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format((category.expenses / monthlyCategoryExpenses) * 100) + '%';
            for (const value of [category.category, money(category.income), money(category.expenses), expenseShare, money(category.net), String(category.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            monthlyCategoryBody.append(row);
        }
        const body = $('#cash-flow-rows');
        body.replaceChildren();
        $('#cash-flow-empty').hidden = shown.length !== 0;
        for (const entry of shown) {
            const row = documentRef.createElement('tr');
            for (const value of [entry.date, entry.type === 'income' ? 'Income' : 'Expense', entry.category, entry.description, money(entry.amount), entry.recurring ? 'Recurring' : 'One-time']) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            const actions = documentRef.createElement('td');
            actions.className = 'cash-flow-row-actions';
            const edit = documentRef.createElement('button');
            edit.type = 'button'; edit.className = 'row-action'; edit.textContent = 'Edit';
            edit.setAttribute('aria-label', 'Edit ' + entry.description);
            edit.addEventListener('click', () => beginEdit(entry));
            const duplicate = documentRef.createElement('button');
            duplicate.type = 'button'; duplicate.className = 'row-action'; duplicate.textContent = 'Duplicate';
            duplicate.setAttribute('aria-label', 'Duplicate ' + entry.description);
            duplicate.addEventListener('click', () => beginDuplicate(entry));
            const remove = documentRef.createElement('button');
            remove.type = 'button'; remove.className = 'row-action'; remove.textContent = 'Delete';
            remove.setAttribute('aria-label', 'Delete ' + entry.description);
            remove.addEventListener('click', () => {
                const confirmation = [
                    'Delete this cash-flow transaction?',
                    'Description: ' + entry.description,
                    'Date: ' + entry.date,
                    'Type: ' + (entry.type === 'income' ? 'Income' : 'Expense'),
                    'Category: ' + entry.category,
                    'Amount: ' + money(entry.amount)
                ].join('\n');
                if (windowRef.confirm(confirmation)) {
                    if (save(entries.filter((item) => item.id !== entry.id))) message('Transaction deleted.');
                }
            });
            actions.append(edit, duplicate, remove);
            row.append(actions);
            body.append(row);
        }
        renderBudgets();
    }

    function budgetMessage(text, isError = false) {
        $('#cash-flow-budget-message').textContent = text;
        $('#cash-flow-budget-message').hidden = !text;
        $('#cash-flow-budget-message').classList.toggle('fire-validation', isError);
    }

    function validateBudgets(value) {
        if (!Array.isArray(value)) throw new Error('Saved budgets must be a list.');
        const seen = new Set();
        return value.map((budget) => {
            if (!budget || typeof budget !== 'object'
                || typeof budget.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.month)
                || typeof budget.category !== 'string' || budget.category.trim().length < 1 || budget.category.trim().length > 60
                || typeof budget.amount !== 'number' || !Number.isFinite(budget.amount) || budget.amount <= 0) {
                throw new Error('Saved budgets contain an invalid month, category, or positive amount.');
            }
            const category = budget.category.trim();
            const key = budget.month + '|' + category.toLocaleLowerCase('en-US');
            if (seen.has(key)) throw new Error('Saved budgets contain duplicate month/category entries.');
            seen.add(key);
            return { month: budget.month, category, amount: budget.amount };
        });
    }

    function loadBudgets() {
        try {
            const raw = windowRef.localStorage.getItem(BUDGET_STORAGE_KEY);
            budgets = raw === null ? [] : validateBudgets(JSON.parse(raw));
            budgetStorageHealthy = true;
        } catch {
            budgets = [];
            budgetStorageHealthy = false;
            budgetMessage('Saved budget data could not be validated and has been left untouched. Budget editing is paused.', true);
        }
    }

    function saveBudgets(nextBudgets) {
        if (!budgetStorageHealthy) {
            budgetMessage('Budget editing is paused because saved data could not be validated. Existing data was left untouched.', true);
            return false;
        }
        try {
            const validated = validateBudgets(nextBudgets);
            windowRef.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(validated));
            budgets = validated;
            renderBudgets();
            return true;
        } catch (error) {
            budgetMessage(error instanceof Error ? error.message : 'Could not safely save budgets.', true);
            return false;
        }
    }

    function resetBudgetForm() {
        $('#cash-flow-budget-category').value = '';
        $('#cash-flow-budget-amount').value = '';
        editingBudgetKey = null;
        $('#cash-flow-budget-save').textContent = 'Save budget';
        $('#cash-flow-budget-cancel').hidden = true;
    }

    function budgetUtilizationPercent(budget, actual) {
        if (budget === null) return null;
        const percentage = actual / budget * 100;
        return Number.isFinite(percentage) ? Number(percentage.toFixed(1)) : null;
    }

    function renderBudgets() {
        const month = $('#cash-flow-budget-month').value || localMonthString();
        const actuals = new Map();
        for (const entry of entries) {
            if (entry.date.slice(0, 7) !== month || entry.type !== 'expense') continue;
            const key = entry.category.trim().toLocaleLowerCase('en-US');
            const current = actuals.get(key) ?? { category: entry.category.trim(), amount: 0 };
            current.amount += entry.amount;
            if (!Number.isFinite(current.amount)) {
                budgetMessage('Expense totals exceed the supported numeric range; comparison is unavailable.', true);
                $('#cash-flow-budget-rows').replaceChildren();
                $('#cash-flow-budget-empty').hidden = false;
                return;
            }
            actuals.set(key, current);
        }
        const combined = new Map();
        for (const budget of budgets.filter((item) => item.month === month)) {
            const key = budget.category.toLocaleLowerCase('en-US');
            combined.set(key, { category: budget.category, budget: budget.amount, actual: actuals.get(key)?.amount ?? 0 });
        }
        for (const [key, actual] of actuals) {
            if (!combined.has(key)) combined.set(key, { category: actual.category, budget: null, actual: actual.amount });
        }
        const budgetedRows = [...combined.values()].filter((item) => item.budget !== null);
        const totalBudget = budgetedRows.reduce((total, item) => total + item.budget, 0);
        const actualAgainstBudget = budgetedRows.reduce((total, item) => total + item.actual, 0);
        const overBudgetRows = budgetedRows.filter((item) => item.actual > item.budget);
        const totalOverrun = overBudgetRows.reduce((total, item) => total + (item.actual - item.budget), 0);
        const overrunIsFinite = Number.isFinite(totalOverrun);
        $('#cash-flow-budget-overrun-count').textContent = String(overBudgetRows.length);
        $('#cash-flow-budget-overrun-total').textContent = overrunIsFinite ? money(totalOverrun) : '—';
        const remainingAgainstBudget = totalBudget - actualAgainstBudget;
        const overviewIsFinite = Number.isFinite(totalBudget) && Number.isFinite(actualAgainstBudget)
            && Number.isFinite(remainingAgainstBudget);
        $('#cash-flow-budget-total').textContent = overviewIsFinite ? money(totalBudget) : '—';
        $('#cash-flow-budget-actual').textContent = overviewIsFinite ? money(actualAgainstBudget) : '—';
        $('#cash-flow-budget-remaining').textContent = overviewIsFinite ? money(remainingAgainstBudget) : '—';
        const overallUtilization = totalBudget > 0 ? budgetUtilizationPercent(totalBudget, actualAgainstBudget) : null;
        $('#cash-flow-budget-utilization').textContent = overviewIsFinite && overallUtilization !== null
            ? overallUtilization.toFixed(1) + '%' : '—';
        const body = $('#cash-flow-budget-rows');
        body.replaceChildren();
        const rows = [...combined.values()].sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }));
        $('#cash-flow-budget-empty').hidden = rows.length !== 0;
        for (const item of rows) {
            const remaining = item.budget === null ? null : item.budget - item.actual;
            const utilization = budgetUtilizationPercent(item.budget, item.actual);
            const status = item.budget === null ? 'No budget set' : remaining < 0 ? 'Over budget' : item.actual === 0 ? 'Not spent' : 'Within budget';
            const row = documentRef.createElement('tr');
            for (const value of [item.category, item.budget === null ? '—' : money(item.budget), money(item.actual),
                utilization === null ? '—' : utilization.toFixed(1) + '%',
                remaining === null ? '—' : money(remaining), status]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            const actions = documentRef.createElement('td');
            if (item.budget !== null) {
                const edit = documentRef.createElement('button');
                edit.type = 'button'; edit.className = 'row-action'; edit.textContent = 'Edit';
                edit.setAttribute('aria-label', 'Edit ' + item.category + ' budget');
                edit.disabled = !budgetStorageHealthy;
                edit.addEventListener('click', () => {
                    $('#cash-flow-budget-category').value = item.category;
                    $('#cash-flow-budget-amount').value = String(item.budget);
                    editingBudgetKey = month + '|' + item.category.toLocaleLowerCase('en-US');
                    $('#cash-flow-budget-save').textContent = 'Save changes';
                    $('#cash-flow-budget-cancel').hidden = false;
                    $('#cash-flow-budget-category').focus();
                });
                const remove = documentRef.createElement('button');
                remove.type = 'button'; remove.className = 'row-action'; remove.textContent = 'Delete';
                remove.setAttribute('aria-label', 'Delete ' + item.category + ' budget');
                remove.disabled = !budgetStorageHealthy;
                remove.addEventListener('click', () => {
                    if (!windowRef.confirm('Delete the ' + item.category + ' budget for ' + month + '?')) return;
                    const nextBudgets = budgets.filter((budget) => budget.month !== month
                        || budget.category.toLocaleLowerCase('en-US') !== item.category.toLocaleLowerCase('en-US'));
                    if (saveBudgets(nextBudgets)) budgetMessage('Budget deleted. Recorded transactions were not changed.');
                });
                actions.append(edit, remove);
            } else {
                const empty = documentRef.createElement('span');
                empty.textContent = '—';
                actions.append(empty);
            }
            row.append(actions);
            body.append(row);
        }
        $('#cash-flow-budget-form').querySelectorAll('input, button').forEach((control) => { control.disabled = !budgetStorageHealthy; });
        if (!$('#cash-flow-budget-history-panel').hidden) {
            try {
                renderBudgetHistory();
            } catch (error) {
                budgetMessage(error instanceof Error ? error.message : 'Could not refresh budget history.', true);
            }
        }
    }

    $('#cash-flow-budget-month').value = localMonthString();
    $('#cash-flow-budget-month').addEventListener('change', () => { resetBudgetForm(); renderBudgets(); });
    $('#cash-flow-budget-copy-previous').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            budgetMessage('Use the local-only dashboard to manage personal budgets.', true);
            return;
        }
        if (!budgetStorageHealthy) {
            budgetMessage('Budget copying is paused because saved data could not be validated. Existing data was left untouched.', true);
            return;
        }
        const month = $('#cash-flow-budget-month').value;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            budgetMessage('Select a valid target month before copying budgets.', true);
            return;
        }
        const [year, monthNumber] = month.split('-').map(Number);
        const previousDate = new Date(Date.UTC(year, monthNumber - 2, 1));
        const previousMonth = previousDate.getUTCFullYear() + '-' + String(previousDate.getUTCMonth() + 1).padStart(2, '0');
        const sourceBudgets = budgets.filter((budget) => budget.month === previousMonth);
        if (sourceBudgets.length === 0) {
            budgetMessage('No budgets were found for ' + previousMonth + '. Nothing was changed.');
            return;
        }
        const existingCategories = new Set(budgets.filter((budget) => budget.month === month)
            .map((budget) => budget.category.toLocaleLowerCase('en-US')));
        const toCopy = sourceBudgets.filter((budget) => !existingCategories.has(budget.category.toLocaleLowerCase('en-US')));
        if (toCopy.length === 0) {
            budgetMessage('All categories from ' + previousMonth + ' already have budgets for ' + month + '. Existing limits were preserved.');
            return;
        }
        const preview = [
            'Copy ' + toCopy.length + ' budget limit' + (toCopy.length === 1 ? '' : 's') + ' from ' + previousMonth + ' to ' + month + '?',
            '',
            ...toCopy.map((budget) => budget.category + ': ' + money(budget.amount)),
            '',
            'Existing budgets for ' + month + ' will not be overwritten. Transactions will not be changed.'
        ].join('\n');
        if (!windowRef.confirm(preview)) {
            budgetMessage('Budget copy cancelled. Existing budgets and transactions were not changed.');
            return;
        }
        const copied = toCopy.map((budget) => ({ ...budget, month }));
        if (saveBudgets([...budgets, ...copied])) {
            resetBudgetForm();
            budgetMessage('Copied ' + copied.length + ' budget limit' + (copied.length === 1 ? '' : 's') + ' from ' + previousMonth + '. Existing limits were preserved.');
        }
    });
    $('#cash-flow-budget-form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (!isLoopback(windowRef.location.hostname)) {
            budgetMessage('Use the local-only dashboard to manage personal budgets.', true);
            return;
        }
        const month = $('#cash-flow-budget-month').value;
        const category = $('#cash-flow-budget-category').value.trim();
        const amount = Number($('#cash-flow-budget-amount').value);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !category || category.length > 60 || !Number.isFinite(amount) || amount <= 0) {
            budgetMessage('Enter a valid month, category, and monthly limit greater than zero.', true);
            return;
        }
        const normalized = category.toLocaleLowerCase('en-US');
        const next = budgets.filter((budget) => !(budget.month === month
            && (budget.category.toLocaleLowerCase('en-US') === normalized
                || editingBudgetKey === budget.month + '|' + budget.category.toLocaleLowerCase('en-US'))));
        next.push({ month, category, amount });
        if (saveBudgets(next)) {
            resetBudgetForm();
            budgetMessage('Monthly category budget saved. Actuals use recorded expenses only.');
            renderBudgets();
        }
    });
    $('#cash-flow-budget-cancel').addEventListener('click', resetBudgetForm);

    function resetForm() {
        $('#cash-flow-form').reset();
        $('#cash-flow-date').value = localDateString();
        $('#cash-flow-type').value = 'expense';
        $('#cash-flow-recurring').checked = false;
        editingId = null;
        duplicatingEntry = false;
        $('#cash-flow-save').textContent = 'Add transaction';
        $('#cash-flow-cancel').hidden = true;
    }

    function beginEdit(entry) {
        editingId = entry.id;
        duplicatingEntry = false;
        $('#cash-flow-date').value = entry.date;
        $('#cash-flow-type').value = entry.type;
        $('#cash-flow-category').value = entry.category;
        $('#cash-flow-description').value = entry.description;
        $('#cash-flow-amount').value = String(entry.amount);
        $('#cash-flow-recurring').checked = entry.recurring;
        $('#cash-flow-save').textContent = 'Save changes';
        $('#cash-flow-cancel').hidden = false;
        $('#cash-flow-date').focus();
    }

    function beginDuplicate(entry) {
        editingId = null;
        duplicatingEntry = true;
        $('#cash-flow-date').value = entry.date;
        $('#cash-flow-type').value = entry.type;
        $('#cash-flow-category').value = entry.category;
        $('#cash-flow-description').value = entry.description;
        $('#cash-flow-amount').value = String(entry.amount);
        $('#cash-flow-recurring').checked = entry.recurring;
        $('#cash-flow-save').textContent = 'Save as new transaction';
        $('#cash-flow-cancel').hidden = false;
        $('#cash-flow-date').focus();
    }

    function budgetSummaryToCsv(month) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new Error('Select a valid budget month before exporting.');
        }
        const actuals = new Map();
        for (const entry of entries) {
            if (entry.date.slice(0, 7) !== month || entry.type !== 'expense') continue;
            const key = entry.category.trim().toLocaleLowerCase('en-US');
            const current = actuals.get(key) ?? { category: entry.category.trim(), amount: 0 };
            current.amount += entry.amount;
            if (!Number.isFinite(current.amount)) {
                throw new Error('Expense totals exceed the supported numeric range; budget export is unavailable.');
            }
            actuals.set(key, current);
        }
        const combined = new Map();
        for (const budget of budgets.filter((item) => item.month === month)) {
            const key = budget.category.toLocaleLowerCase('en-US');
            combined.set(key, { category: budget.category, budget: budget.amount, actual: actuals.get(key)?.amount ?? 0 });
        }
        for (const [key, actual] of actuals) {
            if (!combined.has(key)) combined.set(key, { category: actual.category, budget: null, actual: actual.amount });
        }
        const csvField = (value, textField = false) => {
            let field = String(value ?? '');
            if (textField && /^[=+\-@\t\r]/u.test(field)) field = "'" + field;
            return '"' + field.replaceAll('"', '""') + '"';
        };
        const rows = [...combined.values()].sort((a, b) =>
            a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
        );
        const lines = [['month', 'category', 'budget', 'actual_expenses', 'budget_used_percent', 'remaining', 'status']];
        for (const item of rows) {
            const remaining = item.budget === null ? null : item.budget - item.actual;
            const status = item.budget === null ? 'No budget set'
                : remaining < 0 ? 'Over budget'
                    : item.actual === 0 ? 'Not spent' : 'Within budget';
            lines.push([
                month,
                item.category,
                item.budget === null ? '' : item.budget,
                item.actual,
                budgetUtilizationPercent(item.budget, item.actual) ?? '',
                remaining === null ? '' : remaining,
                status
            ]);
        }
        return lines.map((row) => row.map((value, index) => csvField(value, index === 1)).join(',')).join('\r\n') + '\r\n';
    }

    function budgetHistoryRows() {
        const combined = new Map();
        const keyFor = (month, category) => month + '|' + category.trim().toLocaleLowerCase('en-US');
        for (const budget of budgets) {
            const key = keyFor(budget.month, budget.category);
            const current = combined.get(key) ?? { month: budget.month, category: budget.category, budget: null, actual: 0 };
            current.budget = budget.amount;
            combined.set(key, current);
        }
        for (const entry of entries) {
            if (entry.type !== 'expense') continue;
            const month = entry.date.slice(0, 7);
            const key = keyFor(month, entry.category);
            const current = combined.get(key) ?? { month, category: entry.category.trim(), budget: null, actual: 0 };
            current.actual += entry.amount;
            if (!Number.isFinite(current.actual)) throw new Error('Expense totals exceed the supported numeric range; budget history is unavailable.');
            combined.set(key, current);
        }
        return [...combined.values()]
            .sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }))
            .map((item) => {
                const remaining = item.budget === null ? null : item.budget - item.actual;
                if (remaining !== null && !Number.isFinite(remaining)) {
                    throw new Error('Budget history remaining amounts exceed the supported numeric range.');
                }
                return {
                    ...item,
                    utilization: budgetUtilizationPercent(item.budget, item.actual),
                    remaining,
                    status: item.budget === null ? 'No budget set' : remaining < 0 ? 'Over budget' : item.actual === 0 ? 'Not spent' : 'Within budget'
                };
            });
    }

    function budgetPerformanceTrendRows() {
        const months = [...new Set(budgets.map((budget) => budget.month))].sort((a, b) => b.localeCompare(a));
        return months.map((month) => {
            const monthBudgets = budgets.filter((budget) => budget.month === month);
            let totalBudget = 0;
            let actualAgainstBudget = 0;
            let overBudgetCategories = 0;
            let totalOverrun = 0;
            for (const budget of monthBudgets) {
                const key = budget.category.trim().toLocaleLowerCase('en-US');
                let actual = 0;
                for (const entry of entries) {
                    if (entry.type !== 'expense' || entry.date.slice(0, 7) !== month
                        || entry.category.trim().toLocaleLowerCase('en-US') !== key) continue;
                    actual += entry.amount;
                    if (!Number.isFinite(actual)) {
                        throw new Error('Expense totals exceed the supported numeric range; budget performance is unavailable.');
                    }
                }
                totalBudget += budget.amount;
                actualAgainstBudget += actual;
                if (actual > budget.amount) {
                    overBudgetCategories += 1;
                    totalOverrun += actual - budget.amount;
                }
            }
            const remaining = totalBudget - actualAgainstBudget;
            const utilization = totalBudget > 0 ? budgetUtilizationPercent(totalBudget, actualAgainstBudget) : null;
            if (![totalBudget, actualAgainstBudget, remaining, totalOverrun].every(Number.isFinite)) {
                throw new Error('Budget totals exceed the supported numeric range; budget performance is unavailable.');
            }
            return { month, totalBudget, actualAgainstBudget, remaining, utilization, overBudgetCategories, totalOverrun };
        });
    }

    function budgetPerformanceTrendToCsv() {
        const rows = budgetPerformanceTrendRows();
        const csvField = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
        const lines = [[
            'month', 'budgeted_total', 'actual_expenses_in_budgeted_categories', 'remaining',
            'budget_used_percent', 'over_budget_category_count', 'positive_category_overruns'
        ]];
        for (const item of rows) {
            lines.push([
                item.month, item.totalBudget, item.actualAgainstBudget, item.remaining,
                item.utilization ?? '', item.overBudgetCategories, item.totalOverrun
            ]);
        }
        return lines.map((row) => row.map(csvField).join(',')).join('\\r\\n') + '\\r\\n';
    }

    function renderBudgetPerformanceTrend() {
        const rows = budgetPerformanceTrendRows();
        const body = $('#cash-flow-budget-performance-rows');
        body.replaceChildren();
        $('#cash-flow-budget-performance-empty').hidden = rows.length !== 0;
        for (const item of rows) {
            const row = documentRef.createElement('tr');
            const values = [
                item.month, money(item.totalBudget), money(item.actualAgainstBudget), money(item.remaining),
                item.utilization === null ? '—' : item.utilization.toFixed(1) + '%',
                String(item.overBudgetCategories), money(item.totalOverrun)
            ];
            for (const value of values) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
    }

    function renderBudgetHistory() {
        const rows = budgetHistoryRows();
        const yearFilter = $('#cash-flow-budget-history-year-filter');
        const categoryFilter = $('#cash-flow-budget-history-category-filter');
        const statusFilter = $('#cash-flow-budget-history-status-filter');
        const selectedYear = yearFilter.value;
        const selectedCategory = categoryFilter.value;
        const selectedStatus = statusFilter.value;
        const years = [...new Set(rows.map((item) => item.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
        const categories = [...new Map(rows.map((item) => [item.category.toLocaleLowerCase('en-US'), item.category])).values()]
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const fillOptions = (select, allLabel, values, selectedValue) => {
            select.replaceChildren();
            const allOption = documentRef.createElement('option');
            allOption.value = '';
            allOption.textContent = allLabel;
            select.append(allOption);
            for (const value of values) {
                const option = documentRef.createElement('option');
                option.value = value;
                option.textContent = value;
                select.append(option);
            }
            select.value = values.includes(selectedValue) ? selectedValue : '';
        };
        fillOptions(yearFilter, 'All years', years, selectedYear);
        fillOptions(categoryFilter, 'All categories', categories, selectedCategory);
        statusFilter.value = ['Over budget', 'Within budget', 'Not spent', 'No budget set'].includes(selectedStatus) ? selectedStatus : '';
        const visibleRows = rows.filter((item) =>
            (!yearFilter.value || item.month.startsWith(yearFilter.value))
            && (!categoryFilter.value || item.category.toLocaleLowerCase('en-US') === categoryFilter.value.toLocaleLowerCase('en-US'))
            && (!statusFilter.value || item.status === statusFilter.value));
        const body = $('#cash-flow-budget-history-rows');
        body.replaceChildren();
        $('#cash-flow-budget-history-count').textContent = 'Showing ' + visibleRows.length + ' of ' + rows.length + ' rows';
        const empty = $('#cash-flow-budget-history-empty');
        empty.textContent = rows.length === 0
            ? 'No saved budgets or recorded expenses yet.'
            : 'No budget history matches the selected filters.';
        empty.hidden = visibleRows.length !== 0;
        for (const item of visibleRows) {
            const utilization = item.utilization === null ? '—'
                : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(item.utilization) + '%';
            const values = [
                item.month, item.category, item.budget === null ? '—' : money(item.budget),
                money(item.actual), utilization, item.remaining === null ? '—' : money(item.remaining), item.status
            ];
            const row = documentRef.createElement('tr');
            for (const value of values) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
        renderBudgetPerformanceTrend();
    }


    $('#cash-flow-budget-performance-export-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) { budgetMessage('Use the local-only dashboard to export personal budget data.', true); return; }
        if (!budgetStorageHealthy || !storageHealthy) { budgetMessage('Budget performance export is unavailable because saved budget or cash-flow data could not be validated.', true); return; }
        try {
            if (budgets.length === 0) { budgetMessage('No saved monthly budgets are available for a performance trend export.'); return; }
            download('pfo-monthly-budget-performance.csv', budgetPerformanceTrendToCsv(), 'text/csv;charset=utf-8');
            budgetMessage('Monthly budget performance trend exported to this device.');
        } catch (error) { budgetMessage(error instanceof Error ? error.message : 'Could not export budget performance.', true); }
    });

    function budgetHistoryToCsv() {
        const rows = budgetHistoryRows();
        const csvField = (value, textField = false) => {
            let field = String(value ?? '');
            if (textField && /^[=+\-@\t\r]/u.test(field)) field = "'" + field;
            return '"' + field.replaceAll('"', '""') + '"';
        };
        const lines = [['month', 'category', 'budget', 'actual_expenses', 'budget_used_percent', 'remaining', 'status']];
        for (const item of rows) {
            lines.push([
                item.month, item.category, item.budget === null ? '' : item.budget, item.actual,
                item.utilization ?? '', item.remaining === null ? '' : item.remaining, item.status
            ]);
        }
        return lines.map((row) => row.map((value, index) => csvField(value, index === 1)).join(',')).join('\r\n') + '\r\n';
    }

    for (const id of ['cash-flow-budget-history-year-filter', 'cash-flow-budget-history-category-filter', 'cash-flow-budget-history-status-filter']) {
        $('#' + id).addEventListener('change', () => {
            try {
                renderBudgetHistory();
            } catch (error) {
                budgetMessage(error instanceof Error ? error.message : 'Could not filter budget history.', true);
            }
        });
    }
    $('#cash-flow-budget-history-reset-filters').addEventListener('click', () => {
        $('#cash-flow-budget-history-year-filter').value = '';
        $('#cash-flow-budget-history-category-filter').value = '';
        $('#cash-flow-budget-history-status-filter').value = '';
        try {
            renderBudgetHistory();
        } catch (error) {
            budgetMessage(error instanceof Error ? error.message : 'Could not reset budget history filters.', true);
        }
    });

    $('#cash-flow-budget-history-toggle').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            budgetMessage('Use the local-only dashboard to view personal budget history.', true);
            return;
        }
        if (!budgetStorageHealthy || !storageHealthy) {
            budgetMessage('Budget history is unavailable because saved budget or cash-flow data could not be validated.', true);
            return;
        }
        const panel = $('#cash-flow-budget-history-panel');
        const shouldShow = panel.hidden;
        if (shouldShow) {
            try {
                renderBudgetHistory();
            } catch (error) {
                budgetMessage(error instanceof Error ? error.message : 'Could not display budget history.', true);
                return;
            }
        }
        panel.hidden = !shouldShow;
        $('#cash-flow-budget-history-toggle').textContent = shouldShow ? 'Hide budget history' : 'Show budget history';
        $('#cash-flow-budget-history-toggle').setAttribute('aria-expanded', String(shouldShow));
    });

    $('#cash-flow-budget-export-history-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) { budgetMessage('Use the local-only dashboard to export personal budget data.', true); return; }
        if (!budgetStorageHealthy || !storageHealthy) { budgetMessage('Budget history export is unavailable because saved budget or cash-flow data could not be validated.', true); return; }
        try {
            if (budgets.length === 0 && !entries.some((entry) => entry.type === 'expense')) { budgetMessage('No budget limits or recorded expenses are available to export.'); return; }
            download('pfo-category-budget-history.csv', budgetHistoryToCsv(), 'text/csv;charset=utf-8');
            budgetMessage('All-period category budget history exported to this device.');
        } catch (error) { budgetMessage(error instanceof Error ? error.message : 'Could not export budget history.', true); }
    });

    function download(filename, text, type) {
        const url = URL.createObjectURL(new Blob([text], { type }));
        const link = documentRef.createElement('a');
        link.href = url; link.download = filename;
        documentRef.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    $('#cash-flow-form').addEventListener('submit', (event) => {
        event.preventDefault();
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to manage personal cash flow.', true);
            return;
        }
        const entry = {
            id: editingId ?? windowRef.crypto.randomUUID(),
            date: $('#cash-flow-date').value,
            type: $('#cash-flow-type').value,
            category: $('#cash-flow-category').value.trim(),
            description: $('#cash-flow-description').value.trim(),
            amount: Number($('#cash-flow-amount').value),
            recurring: $('#cash-flow-recurring').checked
        };
        if (!entry.date || !entry.category || !entry.description || !Number.isFinite(entry.amount) || entry.amount <= 0) {
            message('Enter a valid date, category, description, and amount greater than zero.', true);
            return;
        }
        const duplicate = findPotentialDuplicateCashFlowEntry(entries, entry, editingId);
        if (duplicate && !windowRef.confirm([
            'A transaction with the same date, type, category, description, amount, and frequency already exists.',
            'Existing transaction: ' + duplicate.date + ' · ' + duplicate.description + ' · ' + money(duplicate.amount),
            '',
            'Save this as a separate transaction anyway?'
        ].join('\\n'))) {
            message('Save cancelled. The existing transaction was left unchanged.');
            return;
        }
        const wasEditing = Boolean(editingId);
        const wasDuplicating = duplicatingEntry;
        const next = editingId
            ? entries.map((item) => item.id === editingId ? entry : item)
            : [...entries, entry];
        if (save(next)) {
            resetForm();
            message(wasEditing ? 'Transaction updated.' : wasDuplicating ? 'Transaction duplicated locally.' : 'Transaction saved locally.');
        }
    });

    function registerCashFlowCsvImport(inputId, appendMode) {
        $('#' + inputId).addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                try {
                    if (appendMode && !storageHealthy) {
                        throw new Error('Appending is unavailable because saved data could not be validated. Use Import CSV to replace the ledger with a valid file and recover safely.');
                    }
                    const imported = parseCashFlowCsv(String(reader.result), windowRef.crypto);
                    const seenImported = [];
                    let duplicateInFileCount = 0;
                    for (const candidate of imported) {
                        if (findPotentialDuplicateCashFlowEntry(seenImported, candidate) !== null) duplicateInFileCount += 1;
                        else seenImported.push(candidate);
                    }
                    const duplicateCount = appendMode
                        ? imported.filter((candidate) => findPotentialDuplicateCashFlowEntry(entries, candidate) !== null).length
                        : 0;
                    const next = appendMode ? [...entries, ...imported] : imported;
                    const preview = summarizeCashFlow(next);
                    const importedIncomeCount = imported.filter((item) => item.type === 'income').length;
                    const importedExpenseCount = imported.length - importedIncomeCount;
                    const importedDates = imported.map((item) => item.date).sort();
                    const importedDateRange = importedDates.length === 0 ? '—'
                        : importedDates[0] === importedDates[importedDates.length - 1]
                            ? importedDates[0] : importedDates[0] + ' to ' + importedDates[importedDates.length - 1];
                    const confirmLines = [
                        (appendMode ? 'CSV append preview: ' : 'CSV replacement preview: ')
                            + imported.length + ' transaction' + (imported.length === 1 ? '' : 's'),
                        'Imported income transactions: ' + importedIncomeCount,
                        'Imported expense transactions: ' + importedExpenseCount,
                        'Imported transaction date range: ' + importedDateRange,
                        'Total transactions after import: ' + next.length,
                        'Income after import: ' + money(preview.income),
                        'Expenses after import: ' + money(preview.expenses),
                        'Net cash flow after import: ' + money(preview.net)
                    ];
                    if (duplicateInFileCount > 0) {
                        confirmLines.push('', 'Potential exact duplicates within the selected CSV: ' + duplicateInFileCount
                            + '. They will be retained if you continue.');
                    }
                    if (appendMode && duplicateCount > 0) {
                        confirmLines.push('', 'Potential exact duplicates against the existing ledger: ' + duplicateCount
                            + '. They will be retained if you continue.');
                    }
                    confirmLines.push('', appendMode
                        ? 'Existing transactions will be kept and the imported transactions appended. Continue?'
                        : 'Importing this CSV replaces all cash flow transactions stored in this browser. Continue?');
                    if (!windowRef.confirm(confirmLines.join('\n'))) {
                        message(appendMode
                            ? 'CSV append cancelled. Existing transactions were not changed.'
                            : 'CSV import cancelled. Existing transactions were not changed.');
                        return;
                    }
                    const wasHealthy = storageHealthy;
                    storageHealthy = true;
                    if (!save(next)) storageHealthy = wasHealthy;
                    else message(appendMode
                        ? 'Appended ' + imported.length + ' cash flow transactions from CSV.'
                        : 'Imported ' + imported.length + ' cash flow transactions from CSV.');
                } catch (error) {
                    message(error instanceof Error ? error.message : 'Could not import cash flow CSV.', true);
                } finally {
                    $('#' + inputId).value = '';
                }
            });
            reader.addEventListener('error', () => {
                message('Could not read the selected cash flow CSV.', true);
                $('#' + inputId).value = '';
            });
            reader.readAsText(file);
        });
    }
    registerCashFlowCsvImport('cash-flow-import-csv', false);
    registerCashFlowCsvImport('cash-flow-append-csv', true);

    $('#cash-flow-cancel').addEventListener('click', resetForm);
    $('#cash-flow-period').addEventListener('change', render);
    $('#cash-flow-type-filter').addEventListener('change', render);
    $('#cash-flow-frequency-filter').addEventListener('change', render);
    $('#cash-flow-category-filter').addEventListener('change', render);
    $('#cash-flow-date-from').addEventListener('change', render);
    $('#cash-flow-date-to').addEventListener('change', render);
    $('#cash-flow-amount-min').addEventListener('input', render);
    $('#cash-flow-amount-max').addEventListener('input', render);
    $('#cash-flow-sort-order').addEventListener('change', render);
    $('#cash-flow-search').addEventListener('input', render);
    $('#cash-flow-reset-filters').addEventListener('click', () => {
        $('#cash-flow-search').value = '';
        $('#cash-flow-type-filter').value = 'all';
        $('#cash-flow-frequency-filter').value = 'all';
        $('#cash-flow-category-filter').value = '';
        $('#cash-flow-date-from').value = '';
        $('#cash-flow-date-to').value = '';
        $('#cash-flow-amount-min').value = '';
        $('#cash-flow-amount-max').value = '';
        $('#cash-flow-sort-order').value = 'date-newest';
        render();
        $('#cash-flow-search').focus();
    });
    function exportCsv(exportEntries, filename, successMessage) {
        try {
            download(filename, cashFlowToCsv(exportEntries), 'text/csv;charset=utf-8');
            message(successMessage);
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export cash flow CSV.', true);
        }
    }
    $('#cash-flow-export-filtered-csv').addEventListener('click', () => {
        if ($('#cash-flow-export-filtered-csv').disabled) {
            message('Correct the date range before exporting filtered transactions.', true);
            return;
        }
        exportCsv(visibleEntries(), 'pfo-cash-flow-filtered.csv', 'Filtered cash flow CSV exported to this device.');
    });
    $('#cash-flow-export-filtered-summary-csv').addEventListener('click', () => {
        if ($('#cash-flow-export-filtered-summary-csv').disabled) {
            message('Correct the date range before exporting the filtered summary.', true);
            return;
        }
        try {
            download('pfo-cash-flow-filtered-summary.csv', cashFlowFilteredSummaryToCsv(visibleEntries()), 'text/csv;charset=utf-8');
            message('Filtered cash-flow summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export filtered cash-flow summary.', true);
        }
    });
    $('#cash-flow-export-filtered-category-csv').addEventListener('click', () => {
        if ($('#cash-flow-export-filtered-category-csv').disabled) {
            message('Correct the date range before exporting filtered categories.', true);
            return;
        }
        try {
            download('pfo-cash-flow-filtered-categories.csv', cashFlowCategorySummaryToCsv(visibleEntries(), 'all'), 'text/csv;charset=utf-8');
            message('Filtered cash-flow category summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export filtered category summary.', true);
        }
    });
    $('#cash-flow-export-all-csv').addEventListener('click', () => {
        exportCsv(entries, 'pfo-cash-flow.csv', 'All cash flow transactions exported to this device.');
    });
    $('#cash-flow-comparison-current-month').addEventListener('change', render);
    $('#cash-flow-comparison-base-month').addEventListener('change', render);
    $('#cash-flow-comparison-current-year').addEventListener('change', render);
    $('#cash-flow-comparison-base-year').addEventListener('change', render);
    $('#cash-flow-export-annual-comparison-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        if (!storageHealthy) {
            message('Annual comparison export is unavailable because saved cash-flow data could not be validated.', true);
            return;
        }
        const currentYear = $('#cash-flow-comparison-current-year').value;
        const baseYear = $('#cash-flow-comparison-base-year').value;
        const summaries = summarizeCashFlowByYear(entries);
        const current = summaries.find((item) => item.year === currentYear);
        const comparison = summaries.find((item) => item.year === baseYear);
        if (!current || !comparison || !current.transactionCount || !comparison.transactionCount) {
            message('Record transactions in both selected years before exporting a comparison.', true);
            return;
        }
        const currentRate = calculateCashFlowSavingsRate(current.income, current.expenses);
        const baseRate = calculateCashFlowSavingsRate(comparison.income, comparison.expenses);
        const csvRows = [
            ['record_type', 'metric', 'category', 'selected_year', 'selected_value', 'comparison_year', 'comparison_value', 'difference'],
            ['summary', 'income', '', currentYear, current.income, baseYear, comparison.income, current.income - comparison.income],
            ['summary', 'expenses', '', currentYear, current.expenses, baseYear, comparison.expenses, current.expenses - comparison.expenses],
            ['summary', 'net_cash_flow', '', currentYear, current.net, baseYear, comparison.net, current.net - comparison.net],
            ['summary', 'savings_rate_percent', '', currentYear, currentRate ?? '', baseYear, baseRate ?? '', currentRate === null || baseRate === null ? '' : currentRate - baseRate],
            ['summary', 'transaction_count', '', currentYear, current.transactionCount, baseYear, comparison.transactionCount, current.transactionCount - comparison.transactionCount]
        ];
        const currentCategories = summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(currentYear)), 'all');
        const comparisonCategories = summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(baseYear)), 'all');
        const categoryRows = new Map();
        for (const item of currentCategories) {
            categoryRows.set(item.category.toLocaleLowerCase('en-US'), {
                category: item.category, currentIncome: item.income, currentExpenses: item.expenses,
                baseIncome: 0, baseExpenses: 0
            });
        }
        for (const item of comparisonCategories) {
            const key = item.category.toLocaleLowerCase('en-US');
            const existing = categoryRows.get(key);
            if (existing) {
                existing.baseIncome = item.income;
                existing.baseExpenses = item.expenses;
            } else {
                categoryRows.set(key, {
                    category: item.category, currentIncome: 0, currentExpenses: 0,
                    baseIncome: item.income, baseExpenses: item.expenses
                });
            }
        }
        for (const item of categoryRows.values()) {
            csvRows.push(['category', 'income', item.category, currentYear, item.currentIncome, baseYear, item.baseIncome, item.currentIncome - item.baseIncome]);
            csvRows.push(['category', 'expenses', item.category, currentYear, item.currentExpenses, baseYear, item.baseExpenses, item.currentExpenses - item.baseExpenses]);
        }
        if (csvRows.slice(1).some((row) => row.some((value) => typeof value === 'number' && !Number.isFinite(value)))) {
            message('Annual comparison contains a numeric difference outside the supported range; export is unavailable.', true);
            return;
        }
        const csv = csvRows.map((row) => row.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
        download('pfo-cash-flow-annual-comparison.csv', csv, 'text/csv;charset=utf-8');
        message('Annual cash-flow comparison exported to this device.');
    });
    $('#cash-flow-export-monthly-comparison-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        if (!storageHealthy) {
            message('Monthly comparison export is unavailable because saved cash-flow data could not be validated.', true);
            return;
        }
        const currentMonth = $('#cash-flow-comparison-current-month').value;
        const baseMonth = $('#cash-flow-comparison-base-month').value;
        const current = summarizeCashFlow(entries, currentMonth);
        const comparison = summarizeCashFlow(entries, baseMonth);
        if (!current.transactionCount || !comparison.transactionCount) {
            message('Record transactions in both selected months before exporting a comparison.', true);
            return;
        }
        const currentRate = calculateCashFlowSavingsRate(current.income, current.expenses);
        const baseRate = calculateCashFlowSavingsRate(comparison.income, comparison.expenses);
        const csvRows = [
            ['metric', 'selected_month', 'selected_value', 'comparison_month', 'comparison_value', 'difference'],
            ['income', currentMonth, current.income, baseMonth, comparison.income, current.income - comparison.income],
            ['expenses', currentMonth, current.expenses, baseMonth, comparison.expenses, current.expenses - comparison.expenses],
            ['net_cash_flow', currentMonth, current.net, baseMonth, comparison.net, current.net - comparison.net],
            ['savings_rate_percent', currentMonth, currentRate ?? '', baseMonth, baseRate ?? '', currentRate === null || baseRate === null ? '' : currentRate - baseRate],
            ['transaction_count', currentMonth, current.transactionCount, baseMonth, comparison.transactionCount, current.transactionCount - comparison.transactionCount]
        ];
        if (csvRows.slice(1).some((row) => row.some((value) => typeof value === 'number' && !Number.isFinite(value)))) {
            message('Monthly comparison contains a numeric difference outside the supported range; export is unavailable.', true);
            return;
        }
        const csv = csvRows.map((row) => row.map((value) => {
            const cell = String(value);
            return '"' + (typeof value !== 'number' && /^[=+@-]/.test(cell.trimStart()) ? "'" + cell : cell).replaceAll('"', '""') + '"';
        }).join(',')).join('\\r\\n') + '\\r\\n';
        download('pfo-cash-flow-monthly-comparison-' + currentMonth + '-vs-' + baseMonth + '.csv', csv, 'text/csv;charset=utf-8');
        message('Monthly cash-flow comparison exported to this device.');
    });
    $('#cash-flow-monthly-category-month').addEventListener('change', render);
    $('#cash-flow-export-monthly-categories-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        if (!storageHealthy) {
            message('Monthly category export is unavailable because saved cash-flow data could not be validated.', true);
            return;
        }
        try {
            const month = $('#cash-flow-monthly-category-month').value;
            const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
            if (monthEntries.length === 0) {
                message('No recorded transactions for ' + month + '. Nothing was exported.', true);
                return;
            }
            const monthExpenses = monthEntries.filter((entry) => entry.type === 'expense')
                .reduce((total, entry) => total + entry.amount, 0);
            if (!Number.isFinite(monthExpenses)) {
                message('Monthly expense totals exceed the supported numeric range; export is unavailable.', true);
                return;
            }
            download('pfo-cash-flow-category-summary-' + month + '.csv', cashFlowCategorySummaryToCsv(monthEntries, 'all'), 'text/csv;charset=utf-8');
            message('Monthly category summary for ' + month + ' exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export monthly category summary.', true);
        }
    });
    $('#cash-flow-annual-category-year').addEventListener('change', render);
    $('#cash-flow-export-annual-categories-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        if (!storageHealthy) {
            message('Annual category export is unavailable because saved cash-flow data could not be validated.', true);
            return;
        }
        try {
            const year = $('#cash-flow-annual-category-year').value;
            const yearEntries = entries.filter((entry) => entry.date.startsWith(year));
            if (yearEntries.length === 0) {
                message('No recorded transactions for ' + year + '. Nothing was exported.', true);
                return;
            }
            const annualExpenses = yearEntries.filter((entry) => entry.type === 'expense')
                .reduce((total, entry) => total + entry.amount, 0);
            if (!Number.isFinite(annualExpenses)) {
                message('Annual expense totals exceed the supported numeric range; export is unavailable.', true);
                return;
            }
            download('pfo-cash-flow-category-summary-' + year + '.csv', cashFlowCategorySummaryToCsv(yearEntries, 'all'), 'text/csv;charset=utf-8');
            message('Annual category summary for ' + year + ' exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export annual category summary.', true);
        }
    });

    $('#cash-flow-export-monthly-csv').addEventListener('click', () => {
        try {
            download('pfo-cash-flow-monthly-summary.csv', cashFlowMonthlySummaryToCsv(entries), 'text/csv;charset=utf-8');
            message('Monthly cash-flow summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export monthly cash-flow summary.', true);
        }
    });
    $('#cash-flow-export-annual-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        try {
            download('pfo-cash-flow-annual-summary.csv', cashFlowAnnualSummaryToCsv(entries), 'text/csv;charset=utf-8');
            message('Annual cash-flow summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export annual cash-flow summary.', true);
        }
    });
    $('#cash-flow-budget-export-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            budgetMessage('Use the local-only dashboard to export personal budget data.', true);
            return;
        }
        try {
            const month = $('#cash-flow-budget-month').value;
            download('pfo-monthly-category-budgets-' + month + '.csv', budgetSummaryToCsv(month), 'text/csv;charset=utf-8');
            budgetMessage('Selected-month budget comparison exported to this device.');
        } catch (error) {
            budgetMessage(error instanceof Error ? error.message : 'Could not export the budget comparison.', true);
        }
    });
    $('#cash-flow-budget-export-json').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            budgetMessage('Use the local-only dashboard to export personal budget data.', true);
            return;
        }
        if (!budgetStorageHealthy) {
            budgetMessage('Budget backup is unavailable because saved budget data could not be validated.', true);
            return;
        }
        download('pfo-category-budget-backup.json', JSON.stringify({
            schemaVersion: 1, currency: CURRENCY, exportedAt: new Date().toISOString(), budgets
        }, null, 2), 'application/json');
        budgetMessage('Budget backup exported to this device. Cash-flow transactions were not included.');
    });
    $('#cash-flow-budget-import-json').addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            try {
                if (!isLoopback(windowRef.location.hostname)) {
                    throw new Error('Use the local-only dashboard to import personal budget data.');
                }
                const payload = JSON.parse(String(reader.result));
                if (!payload || typeof payload !== 'object' || payload.schemaVersion !== 1
                    || payload.currency !== CURRENCY || !Array.isArray(payload.budgets)) {
                    throw new Error('Unsupported budget backup. Expected schemaVersion 1, INR currency, and a budgets list.');
                }
                const imported = validateBudgets(payload.budgets);
                const totalLimits = imported.reduce((total, item) => total + item.amount, 0);
                if (!Number.isFinite(totalLimits)) throw new Error('Budget backup totals exceed the supported numeric range.');
                const months = [...new Set(imported.map((item) => item.month))].sort();
                const preview = [
                    'Budget backup restore preview',
                    'Budget entries to restore: ' + imported.length,
                    'Months covered: ' + (months.length ? months[0] + (months.length > 1 ? ' through ' + months[months.length - 1] : '') : 'none'),
                    'Sum of monthly category limits across all entries: ' + money(totalLimits),
                    '',
                    'This replaces all saved category budgets in this browser. Cash-flow transactions will not be changed.',
                    'Continue?'
                ].join('\n');
                if (!windowRef.confirm(preview)) {
                    budgetMessage('Budget restore cancelled. Existing budgets and transactions were not changed.');
                    return;
                }
                const wasHealthy = budgetStorageHealthy;
                budgetStorageHealthy = true;
                if (!saveBudgets(imported)) budgetStorageHealthy = wasHealthy;
                else {
                    resetBudgetForm();
                    budgetMessage('Restored ' + imported.length + ' category budget' + (imported.length === 1 ? '' : 's') + '. Cash-flow transactions were not changed.');
                }
            } catch (error) {
                budgetMessage(error instanceof Error ? error.message : 'Could not import budget backup.', true);
            } finally {
                $('#cash-flow-budget-import-json').value = '';
            }
        });
        reader.addEventListener('error', () => {
            budgetMessage('Could not read the selected budget backup.', true);
            $('#cash-flow-budget-import-json').value = '';
        });
        reader.readAsText(file);
    });
    $('#cash-flow-export-recurring-category-csv').addEventListener('click', () => {
        if (!isLoopback(windowRef.location.hostname)) {
            message('Use the local-only dashboard to export personal cash-flow data.', true);
            return;
        }
        if (!storageHealthy) {
            message('Recurring category export is unavailable because saved cash-flow data could not be validated.', true);
            return;
        }
        try {
            const period = $('#cash-flow-period').value || 'all';
            const recurringEntries = entries.filter((entry) => entry.recurring
                && (period === 'all' || entry.date.startsWith(period)));
            if (recurringEntries.length === 0) {
                message('No recurring-tagged transactions for the selected period. Nothing was exported.', true);
                return;
            }
            const recurringExpenses = recurringEntries.filter((entry) => entry.type === 'expense')
                .reduce((total, entry) => total + entry.amount, 0);
            if (!Number.isFinite(recurringExpenses)) {
                message('Recurring expense totals exceed the supported numeric range; export is unavailable.', true);
                return;
            }
            download('pfo-cash-flow-recurring-categories.csv', cashFlowCategorySummaryToCsv(recurringEntries, 'all'), 'text/csv;charset=utf-8');
            message('Recurring-tagged category summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export recurring category summary.', true);
        }
    });
    $('#cash-flow-export-recurring-csv').addEventListener('click', () => {
        try {
            const period = $('#cash-flow-period').value || 'all';
            const recurringEntries = entries.filter((entry) => entry.recurring
                && (period === 'all' || entry.date.startsWith(period)));
            if (recurringEntries.length === 0) {
                message('No recurring-tagged transactions exist in the selected reporting period. Nothing was exported.');
                return;
            }
            const periodLabel = period === 'all' ? 'all-periods' : period;
            download('pfo-recurring-cash-flow-' + periodLabel + '.csv',
                cashFlowToCsv(recurringEntries), 'text/csv;charset=utf-8');
            message('Exported ' + recurringEntries.length + ' recurring-tagged transaction' +
                (recurringEntries.length === 1 ? '' : 's') + ' for ' + periodLabel + '.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export recurring transactions.', true);
        }
    });
    $('#cash-flow-export-category-csv').addEventListener('click', () => {
        try {
            const period = $('#cash-flow-period').value || 'all';
            download('pfo-cash-flow-category-summary.csv', cashFlowCategorySummaryToCsv(entries, period), 'text/csv;charset=utf-8');
            message('Selected-period category summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export category summary.', true);
        }
    });
    $('#cash-flow-export-json').addEventListener('click', () => {
        download('pfo-cash-flow-backup.json', JSON.stringify({
            schemaVersion: 1, currency: CURRENCY, exportedAt: new Date().toISOString(), entries
        }, null, 2), 'application/json');
        message('Cash flow backup exported to this device.');
    });
    $('#cash-flow-import-json').addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            try {
                const payload = JSON.parse(String(reader.result));
                if (!payload || payload.schemaVersion !== 1 || payload.currency !== CURRENCY || !Array.isArray(payload.entries)) {
                    throw new Error('Unsupported cash flow backup. Expected schema version 1 and INR currency.');
                }
                const imported = validateCashFlowEntries(payload.entries);
                const preview = summarizeCashFlow(imported);
                const confirmMessage = [
                    'Import preview: ' + imported.length + ' transaction' + (imported.length === 1 ? '' : 's'),
                    'Income: ' + money(preview.income),
                    'Expenses: ' + money(preview.expenses),
                    'Net cash flow: ' + money(preview.net),
                    '',
                    'Importing this backup replaces all cash flow transactions stored in this browser. Continue?'
                ].join('\n');
                if (!windowRef.confirm(confirmMessage)) {
                    message('Import cancelled. Existing transactions were not changed.');
                    return;
                }
                const wasHealthy = storageHealthy;
                storageHealthy = true;
                if (!save(imported)) storageHealthy = wasHealthy;
                else message('Imported ' + imported.length + ' cash flow transactions.');
            } catch (error) {
                message(error instanceof Error ? error.message : 'Could not import cash flow backup.', true);
            } finally {
                $('#cash-flow-import-json').value = '';
            }
        });
        reader.addEventListener('error', () => {
            message('Could not read the selected cash flow backup.', true);
            $('#cash-flow-import-json').value = '';
        });
        reader.readAsText(file);
    });

    if (!isLoopback(windowRef.location.hostname)) {
        root.querySelectorAll('input, select, button').forEach((control) => { control.disabled = true; });
        message('Cash flow entry is available only in the local dashboard. Do not enter personal financial data on a hosted demo.', true);
        $('#cash-flow-empty').hidden = false;
        return;
    }

    load();
    loadBudgets();
    resetForm();
    render();
    if (!storageHealthy) root.querySelectorAll('#cash-flow-form input, #cash-flow-form select, #cash-flow-form button').forEach((control) => { control.disabled = true; });
}

export { STORAGE_KEY as CASH_FLOW_STORAGE_KEY };
