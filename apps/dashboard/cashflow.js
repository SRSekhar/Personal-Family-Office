import {
    calculateCashFlowSavingsRate, cashFlowCategorySummaryToCsv, cashFlowMonthlySummaryToCsv, cashFlowToCsv, filterCashFlowEntries,
    sortCashFlowEntries, summarizeCashFlow, summarizeCashFlowByCategory,
    summarizeCashFlowByMonth, validateCashFlowEntries
} from './cashflow-ledger.js';

const STORAGE_KEY = 'pfo-os.cash-flow.v1';
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
            else if (ch === '\\r' || ch === '\\n') {
                row.push(field); rows.push(row); row = []; field = ''; quoteClosed = false;
                if (ch === '\\r' && input[i + 1] === '\\n') i += 1;
            } else throw new Error('The CSV contains characters after a closing quote.');
            continue;
        }
        if (ch === '"') {
            if (field.length !== 0) throw new Error('The CSV contains a quote inside an unquoted field.');
            quoted = true;
        } else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\\r' || ch === '\\n') {
            row.push(field); rows.push(row); row = []; field = '';
            if (ch === '\\r' && input[i + 1] === '\\n') i += 1;
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
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)
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
        const shown = visibleEntries();
        const filtersActive = $('#cash-flow-type-filter').value !== 'all'
            || $('#cash-flow-frequency-filter').value !== 'all'
            || $('#cash-flow-category-filter').value !== ''
            || $('#cash-flow-date-from').value !== ''
            || $('#cash-flow-date-to').value !== ''
            || $('#cash-flow-search').value.trim() !== '';
        $('#cash-flow-count').textContent = filtersActive
            ? shown.length + ' shown of ' + summary.transactionCount + ' transaction' + (summary.transactionCount === 1 ? '' : 's')
            : summary.transactionCount + ' transaction' + (summary.transactionCount === 1 ? '' : 's');
        $('#cash-flow-empty').textContent = filtersActive
            ? 'No transactions match the current filters.'
            : 'No transactions for this period. Add income or an expense to begin.';
        const categoryBody = $('#cash-flow-category-rows');
        categoryBody.replaceChildren();
        const categories = summarizeCashFlowByCategory(entries, period);
        $('#cash-flow-category-empty').hidden = categories.length !== 0;
        for (const category of categories) {
            const row = documentRef.createElement('tr');
            for (const value of [category.category, money(category.income), money(category.expenses), money(category.net), String(category.transactionCount)]) {
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
            for (const value of [monthLabel, money(summary.income), money(summary.expenses), money(summary.net), String(summary.transactionCount)]) {
                const cell = documentRef.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            monthlyBody.append(row);
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
    }

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

    function download(filename, text, type) {
        const url = URL.createObjectURL(new Blob([text], { type }));
        const link = documentRef.createElement('a');
        link.href = url; link.download = filename;
        documentRef.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    $('#cash-flow-form').addEventListener('submit', (event) => {
        event.preventDefault();
    
    $('#cash-flow-import-csv').addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            try {
                const imported = parseCashFlowCsv(String(reader.result), windowRef.crypto);
                const preview = summarizeCashFlow(imported);
                const confirmMessage = [
                    'CSV import preview: ' + imported.length + ' transaction' + (imported.length === 1 ? '' : 's'),
                    'Income: ' + money(preview.income),
                    'Expenses: ' + money(preview.expenses),
                    'Net cash flow: ' + money(preview.net),
                    '',
                    'Importing this CSV replaces all cash flow transactions stored in this browser. Continue?'
                ].join('\\n');
                if (!windowRef.confirm(confirmMessage)) {
                    message('CSV import cancelled. Existing transactions were not changed.');
                    return;
                }
                const wasHealthy = storageHealthy;
                storageHealthy = true;
                if (!save(imported)) storageHealthy = wasHealthy;
                else message('Imported ' + imported.length + ' cash flow transactions from CSV.');
            } catch (error) {
                message(error instanceof Error ? error.message : 'Could not import cash flow CSV.', true);
            } finally {
                $('#cash-flow-import-csv').value = '';
            }
        });
        reader.addEventListener('error', () => {
            message('Could not read the selected cash flow CSV.', true);
            $('#cash-flow-import-csv').value = '';
        });
        reader.readAsText(file);
    });

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

    $('#cash-flow-cancel').addEventListener('click', resetForm);
    $('#cash-flow-period').addEventListener('change', render);
    $('#cash-flow-type-filter').addEventListener('change', render);
    $('#cash-flow-frequency-filter').addEventListener('change', render);
    $('#cash-flow-category-filter').addEventListener('change', render);
    $('#cash-flow-date-from').addEventListener('change', render);
    $('#cash-flow-date-to').addEventListener('change', render);
    $('#cash-flow-sort-order').addEventListener('change', render);
    $('#cash-flow-search').addEventListener('input', render);
    $('#cash-flow-reset-filters').addEventListener('click', () => {
        $('#cash-flow-search').value = '';
        $('#cash-flow-type-filter').value = 'all';
        $('#cash-flow-frequency-filter').value = 'all';
        $('#cash-flow-category-filter').value = '';
        $('#cash-flow-date-from').value = '';
        $('#cash-flow-date-to').value = '';
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
        exportCsv(visibleEntries(), 'pfo-cash-flow-filtered.csv', 'Filtered cash flow CSV exported to this device.');
    });
    $('#cash-flow-export-all-csv').addEventListener('click', () => {
        exportCsv(entries, 'pfo-cash-flow.csv', 'All cash flow transactions exported to this device.');
    });
    $('#cash-flow-export-monthly-csv').addEventListener('click', () => {
        try {
            download('pfo-cash-flow-monthly-summary.csv', cashFlowMonthlySummaryToCsv(entries), 'text/csv;charset=utf-8');
            message('Monthly cash-flow summary exported to this device.');
        } catch (error) {
            message(error instanceof Error ? error.message : 'Could not export monthly cash-flow summary.', true);
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
    resetForm();
    render();
    if (!storageHealthy) root.querySelectorAll('#cash-flow-form input, #cash-flow-form select, #cash-flow-form button').forEach((control) => { control.disabled = true; });
}

export { STORAGE_KEY as CASH_FLOW_STORAGE_KEY };
