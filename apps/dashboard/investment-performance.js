import { analyzeInvestmentPerformanceMath } from './calculators-runtime/InvestmentPerformanceMath.js';
import { investmentCashFlowsToCsv, investmentPerformanceToCsv, investmentPerformanceToHtml } from './investment-performance-export.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function createCashFlowRow({ amount = '', date = '', onRemove = () => {} } = {}) {
    const row = document.createElement('div'); row.className = 'investment-flow-row';
    const dateLabel = document.createElement('label'); dateLabel.className = 'field-label'; dateLabel.textContent = 'Cash-flow date';
    const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.className = 'investment-flow-date'; dateInput.required = true; dateInput.value = date; dateInput.setAttribute('aria-label', 'Investment cash-flow date'); dateLabel.append(dateInput);
    const amountLabel = document.createElement('label'); amountLabel.className = 'field-label'; amountLabel.textContent = 'Amount (₹)';
    const amountInput = document.createElement('input'); amountInput.type = 'number'; amountInput.step = 'any'; amountInput.required = true; amountInput.className = 'investment-flow-amount'; amountInput.value = String(amount); amountInput.setAttribute('aria-label', 'Investment cash-flow amount in rupees'); amountLabel.append(amountInput);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-secondary button-small'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove investment cash flow'); remove.addEventListener('click', () => { row.remove(); onRemove(); });
    row.append(dateLabel, amountLabel, remove);
    return row;
}

function parseInvestmentCashFlowsCsv(source) {
    if (typeof source !== 'string' || source.trim() === '') throw new Error('The CSV file is empty.');
    const lines = source.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u);
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length < 2) throw new Error('The CSV must contain a header and at least one cash flow.');

    const parseRow = (line) => {
        const fields = [];
        let field = '';
        let quoted = false;
        let quoteClosed = false;
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (quoted) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { field += '"'; i += 1; }
                    else { quoted = false; quoteClosed = true; }
                } else field += ch;
                continue;
            }
            if (quoteClosed) {
                if (ch === ',') { fields.push(field); field = ''; quoteClosed = false; }
                else if (ch.trim() === '') continue;
                else throw new Error('The CSV contains characters after a closing quote.');
                continue;
            }
            if (ch === '"') {
                if (field.trim() !== '') throw new Error('The CSV contains a quote inside an unquoted field.');
                quoted = true;
            } else if (ch === ',') { fields.push(field); field = ''; }
            else field += ch;
        }
        if (quoted) throw new Error('The CSV contains an unterminated quoted field.');
        fields.push(field);
        return fields;
    };

    const header = parseRow(lines[0]).map((value) => value.trim());
    if (header.length !== 2 || header[0] !== 'date' || header[1] !== 'amount') {
        throw new Error('Unsupported CSV format. Expected columns: date, amount.');
    }
    return lines.slice(1).map((line) => {
        if (line.trim() === '') throw new Error('The CSV contains an empty row.');
        const columns = parseRow(line);
        if (columns.length !== 2 || columns.some((value) => value.trim() === '')) {
            throw new Error('The CSV contains an incomplete cash flow.');
        }
        const date = columns[0].trim();
        const amount = Number(columns[1].trim());
        if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(amount) || amount === 0) {
            throw new Error('Each cash flow needs an ISO date and a non-zero finite signed amount.');
        }
        const [year, month, day] = date.split('-').map(Number);
        const calendarDate = new Date(Date.UTC(year, month - 1, day));
        if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
            throw new Error('The CSV contains an invalid calendar date.');
        }
        return { date, amount };
    });
}

function renderPerformance(result) {
    $('#investment-performance-results').hidden = false;
    $('#investment-gross-contributions').textContent = money(result.grossContributions);
    $('#investment-gross-proceeds').textContent = money(result.grossProceeds);
    $('#investment-net-gain').textContent = money(result.netGain);
    $('#investment-simple-return').textContent = percent(result.netReturnOnContributionsPercentage);
    $('#investment-xirr').textContent = percent(result.annualizedMoneyWeightedReturn * 100);
    $('#investment-cash-flow-count').textContent = String(result.cashFlowCount);
    $('#investment-date-range').textContent = new Date(result.startDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) + ' – ' + new Date(result.endDate).toLocaleDateString('en-IN', { timeZone: 'UTC' });
}

export function initializeInvestmentPerformanceCalculator() {
    const form = $('#investment-performance-form'); if (!form) return;
    const rows = $('#investment-cash-flows');
    let latestPerformance = null;
    const invalidatePerformance = () => {
        latestPerformance = null;
        $('#investment-performance-export-csv').disabled = true;
        $('#investment-cash-flows-export-csv').disabled = true;
        $('#investment-performance-export-html').disabled = true;
        $('#investment-performance-results').hidden = true;
    };
    rows.append(createCashFlowRow({ onRemove: invalidatePerformance }));
    $('#investment-import-csv').addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (Number.isFinite(file.size) && file.size > MAX_IMPORT_FILE_BYTES) {
            $('#investment-performance-import-status').textContent = 'The selected file exceeds the 10 MiB import limit. Existing cash flows were not changed.';
            $('#investment-import-csv').value = '';
            return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            try {
                const imported = parseInvestmentCashFlowsCsv(String(reader.result));
                const contributions = imported.reduce((sum, flow) => sum + (flow.amount < 0 ? Math.abs(flow.amount) : 0), 0);
                const proceeds = imported.reduce((sum, flow) => sum + (flow.amount > 0 ? flow.amount : 0), 0);
                const preview = [
                    'CSV import preview: ' + imported.length + ' dated cash flows',
                    'Gross contributions: ' + money(contributions),
                    'Gross proceeds: ' + money(proceeds),
                    '',
                    'Importing this CSV replaces all cash flows currently entered in the calculator. Continue?'
                ].join('\n');
                if (!window.confirm(preview)) {
                    $('#investment-performance-import-status').textContent = 'CSV import cancelled. Existing cash flows were not changed.';
                    return;
                }
                rows.replaceChildren(...imported.map((flow) => createCashFlowRow({ ...flow, onRemove: invalidatePerformance })));
                invalidatePerformance();
                $('#investment-performance-validation').hidden = true;
                $('#investment-performance-validation').textContent = '';
                $('#investment-performance-import-status').textContent = 'Imported ' + imported.length + ' investment cash flows from CSV.';
            } catch (error) {
                $('#investment-performance-import-status').textContent = error instanceof Error ? error.message : 'Could not import investment cash-flow CSV.';
            } finally {
                $('#investment-import-csv').value = '';
            }
        });
        reader.addEventListener('error', () => {
            $('#investment-performance-import-status').textContent = 'Could not read the selected investment cash-flow CSV.';
            $('#investment-import-csv').value = '';
        });
        reader.readAsText(file);
    });

    $('#investment-add-flow').addEventListener('click', () => {
        const row = createCashFlowRow({ onRemove: invalidatePerformance });
        rows.append(row);
        invalidatePerformance();
        row.querySelector('.investment-flow-date').focus();
    });
    form.addEventListener('input', invalidatePerformance);
    form.addEventListener('change', invalidatePerformance);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        latestPerformance = null;
        $('#investment-performance-export-csv').disabled = true;
        $('#investment-performance-export-html').disabled = true;
        $('#investment-performance-validation').hidden = true;
        try {
            const cashFlows = [...rows.querySelectorAll('.investment-flow-row')].map((row) => {
                const date = row.querySelector('.investment-flow-date').value;
                const amount = row.querySelector('.investment-flow-amount').value;
                if (!date) throw new RangeError('Enter a date for every cash flow.');
                if (amount.trim() === '') throw new RangeError('Enter an amount for every cash flow.');
                return { date: new Date(date + 'T00:00:00.000Z'), amount: Number(amount) };
            });
            const result = analyzeInvestmentPerformanceMath({ cashFlows });
            renderPerformance(result);
            latestPerformance = { cashFlows, result };
            $('#investment-performance-export-csv').disabled = false;
            $('#investment-performance-export-html').disabled = false;
            $('#investment-cash-flows-export-csv').disabled = false;
        } catch (error) {
            latestPerformance = null;
            $('#investment-performance-export-csv').disabled = true;
            $('#investment-performance-export-html').disabled = true;
            $('#investment-cash-flows-export-csv').disabled = true;
            $('#investment-performance-results').hidden = true;
            $('#investment-performance-validation').textContent = error instanceof Error ? error.message : 'Could not calculate investment performance.';
            $('#investment-performance-validation').hidden = false;
        }
    });
    $('#investment-performance-export-csv').addEventListener('click', () => {
        if (!latestPerformance) return;
        const blob = new Blob([investmentPerformanceToCsv(latestPerformance)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-investment-performance.csv';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    $('#investment-performance-export-html').addEventListener('click', () => {
        if (!latestPerformance) return;
        const blob = new Blob([investmentPerformanceToHtml(latestPerformance)], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-investment-performance.html';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    $('#investment-cash-flows-export-csv').addEventListener('click', () => {
        if (!latestPerformance) return;
        const blob = new Blob([investmentCashFlowsToCsv(latestPerformance.cashFlows)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-investment-cash-flows.csv';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    $('#investment-performance-reset').addEventListener('click', () => {
        form.reset();
        rows.replaceChildren(createCashFlowRow({ onRemove: invalidatePerformance }));
        invalidatePerformance();
        $('#investment-performance-validation').hidden = true;
        $('#investment-performance-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#investment-performance-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
        $('#investment-add-flow').disabled = true;
    }
}