import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import {
    analyzeInvestmentExposurePositions,
    validateInvestmentExposureClassifications
} from './investment-exposure.js';

const CLASSIFICATION_KEY = 'pfo-os.investment-exposure-classifications.v1';
const LEDGER_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';
const money = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

function readLedger() {
    const collections = {};
    for (const [name, key] of Object.entries(LEDGER_KEYS)) {
        const raw = localStorage.getItem(key);
        const value = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(value)) throw new Error('Saved ' + name + ' data is not a collection.');
        collections[name] = value;
    }
    return validateInvestmentLedgerCollections(collections);
}
function readClassifications(ledger) {
    const raw = localStorage.getItem(CLASSIFICATION_KEY);
    const values = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error('Saved exposure classifications are not a collection.');
    return validateInvestmentExposureClassifications(values, { instruments: ledger.investmentInstruments });
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function showMessage(text, isError = false) {
    const node = $('#investment-exposure-message');
    node.textContent = text;
    node.className = isError ? 'validation-message' : 'form-note';
    node.hidden = false;
}
function addAllocationRow(value = {}) {
    const container = $('#investment-exposure-allocations');
    const row = document.createElement('div');
    row.className = 'investment-allocation-target-row investment-exposure-allocation-row';
    const groupId = document.createElement('input');
    groupId.required = true; groupId.maxLength = 100; groupId.value = value.groupId ?? '';
    groupId.setAttribute('aria-label', 'Stable group ID');
    const groupName = document.createElement('input');
    groupName.required = true; groupName.maxLength = 100; groupName.value = value.groupName ?? '';
    groupName.setAttribute('aria-label', 'Group display name');
    const weight = document.createElement('input');
    weight.type = 'number'; weight.min = '0.000001'; weight.max = '100'; weight.step = 'any';
    weight.required = true; weight.value = value.weightPercent ?? '';
    weight.setAttribute('aria-label', 'Allocation weight percentage');
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-secondary button-small';
    remove.textContent = 'Remove'; remove.addEventListener('click', () => row.remove());
    const field = (label, control) => { const wrapper = document.createElement('label'); wrapper.className = 'field-label'; wrapper.textContent = label; wrapper.append(control); return wrapper; };
    row.append(field('Stable group ID', groupId), field('Group name', groupName), field('Weight (%)', weight), remove);
    container.append(row);
}
function fillInstrumentOptions(ledger) {
    const select = $('#investment-exposure-instrument');
    const previous = select.value;
    const instruments = ledger.investmentInstruments;
    select.innerHTML = '<option value="">Select an instrument</option>' + instruments.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.type) + ' · ' + escape(item.currency) + '</option>').join('');
    if (instruments.some((item) => item.id === previous)) select.value = previous;
}
function fillAnalysisOptions(ledger, classifications) {
    const dimensions = new Map();
    for (const item of classifications) if (!dimensions.has(item.dimensionId)) dimensions.set(item.dimensionId, item.dimensionName);
    const select = $('#investment-exposure-dimension');
    const previous = select.value;
    select.innerHTML = '<option value="">Select a dimension</option>' + [...dimensions].sort(([a], [b]) => a.localeCompare(b))
        .map(([id, name]) => '<option value="' + escape(id) + '">' + escape(name) + ' (' + escape(id) + ')</option>').join('');
    if (dimensions.has(previous)) select.value = previous;
    const currency = $('#investment-exposure-currency').value;
    const accountSelect = $('#investment-exposure-account');
    const oldAccount = accountSelect.value;
    const accounts = ledger.investmentAccounts.filter((item) => item.currency === currency);
    accountSelect.innerHTML = '<option value="">Select an account</option>' + accounts.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.institution) + '</option>').join('');
    if (accounts.some((item) => item.id === oldAccount)) accountSelect.value = oldAccount;
    $('#investment-exposure-account-row').hidden = $('#investment-exposure-scope').value !== 'account';
}
function renderHistory(classifications, instruments) {
    const body = $('#investment-exposure-history');
    body.replaceChildren();
    const ordered = [...classifications].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    for (const item of ordered) {
        const instrument = instruments.find((entry) => entry.id === item.instrumentId);
        const row = document.createElement('tr');
        const values = [instrument?.name ?? item.instrumentId, item.dimensionName + ' (' + item.dimensionId + ')',
            item.effectiveFrom, item.recordedAt, item.sourceType + ': ' + item.sourceName,
            item.allocations.map((part) => part.groupName + ' ' + percent(part.weightPercent)).join('; '),
            item.evidenceReference ?? '—'];
        for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
        body.append(row);
    }
    if (!ordered.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 7; cell.textContent = 'No look-through classifications have been recorded.';
        row.append(cell); body.append(row);
    }
}
function renderAnalysis(ledger, classifications) {
    const output = $('#investment-exposure-analysis');
    output.replaceChildren();
    const dimensionId = $('#investment-exposure-dimension').value;
    const currency = $('#investment-exposure-currency').value;
    const scope = $('#investment-exposure-scope').value;
    const accountId = $('#investment-exposure-account').value;
    const date = $('#investment-exposure-as-of').value;
    if (!dimensionId || !date || (scope === 'account' && !accountId)) {
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Choose a classification dimension, currency, scope and as-of date to calculate look-through exposure.';
        output.append(note); return;
    }
    try {
        const [year, month, day] = date.split('-').map(Number);
        const asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) {
            throw new Error('Select a valid calendar date.');
        }
        const recordedAtCutoff = new Date();
        const dimensionName = classifications.find((item) => item.dimensionId === dimensionId)?.dimensionName ?? dimensionId;
        const positions = analyzeInvestmentPortfolio({
            accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
            transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations,
            asOfDate, recordedAtCutoff
        });
        const result = analyzeInvestmentExposurePositions({
            positions, instruments: ledger.investmentInstruments, accounts: ledger.investmentAccounts,
            classifications, dimensionId, dimensionName, currency, scope,
            ...(scope === 'account' ? { accountId } : {}), asOfDate, recordedAtCutoff
        });
        const summary = document.createElement('p');
        summary.className = result.status === 'unavailable' ? 'validation-message' : 'form-note';
        if (result.status === 'unavailable') summary.textContent = result.reason;
        else if (result.status === 'empty') summary.textContent = result.message;
        else summary.textContent = 'Look-through exposure totals ' + money(result.totalValue, currency)
            + ' across ' + result.rows.length + ' groups. Group percentages reconcile to 100%.';
        output.append(summary);
        if (result.unclassifiedPositions?.length) {
            const list = document.createElement('ul');
            for (const item of result.unclassifiedPositions) {
                const entry = document.createElement('li');
                entry.textContent = item.instrumentName + ' — ' + money(item.marketValue, currency) + ': ' + item.reason;
                list.append(entry);
            }
            output.append(list);
        }
        if (result.status !== 'available') return;
        const table = document.createElement('table');
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const label of ['Group', 'Exposure value', 'Exposure weight']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
        head.append(header); table.append(head);
        const body = document.createElement('tbody');
        for (const item of result.rows) {
            const row = document.createElement('tr');
            for (const value of [item.groupName, money(item.actualValue, currency), percent(item.actualWeightPercent)]) {
                const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
            }
            body.append(row);
        }
        table.append(body);
        const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.append(table); output.append(wrapper);
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Weighted look-through is based only on the user-entered classifications effective and recorded by the selected cutoffs. No FX conversion, nested fund recursion or inferred classifications are applied.';
        output.append(note);
    } catch (error) {
        const note = document.createElement('p'); note.className = 'validation-message';
        note.textContent = error instanceof Error ? error.message : 'Exposure analysis could not be completed.';
        output.append(note);
    }
}
function render() {
    const panel = $('#investment-exposure-workspace');
    if (!panel) return;
    const enabled = privateWorkspace();
    $('#investment-exposure-demo-note').hidden = enabled;
    panel.querySelectorAll('form input, form select, form button, #investment-exposure-dimension, #investment-exposure-currency, #investment-exposure-scope, #investment-exposure-account, #investment-exposure-as-of')
        .forEach((control) => { control.disabled = !enabled; });
    if (!enabled) {
        $('#investment-exposure-history').replaceChildren();
        $('#investment-exposure-analysis').replaceChildren();
        $('#investment-exposure-error').hidden = true;
        return;
    }
    try {
        const ledger = readLedger();
        const classifications = readClassifications(ledger);
        $('#investment-exposure-error').hidden = true;
        fillInstrumentOptions(ledger);
        fillAnalysisOptions(ledger, classifications);
        renderHistory(classifications, ledger.investmentInstruments);
        renderAnalysis(ledger, classifications);
        $('#investment-exposure-count').textContent = String(classifications.length);
    } catch (error) {
        $('#investment-exposure-error').textContent = error instanceof Error ? error.message : 'Exposure workspace could not be loaded.';
        $('#investment-exposure-error').hidden = false;
        $('#investment-exposure-history').replaceChildren();
        $('#investment-exposure-analysis').replaceChildren();
    }
}
function bindForm(selector, callback) {
    $(selector).addEventListener('submit', (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
            callback(form);
            event.currentTarget.reset();
            $('#investment-exposure-allocations').replaceChildren();
            addAllocationRow();
            render();
            showMessage('A new immutable exposure classification snapshot was saved.');
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Exposure classification could not be saved.', true);
        }
    });
}
if ($('#investment-exposure-workspace')) {
    $('#investment-exposure-add-allocation').addEventListener('click', () => addAllocationRow());
    $('#investment-exposure-currency').innerHTML = CURRENCIES.map((currency) => '<option value="' + currency + '">' + currency + '</option>').join('');
    $('#investment-exposure-analysis-currency').innerHTML = CURRENCIES.map((currency) => '<option value="' + currency + '">' + currency + '</option>').join('');
    $('#investment-exposure-scope').addEventListener('change', render);
    $('#investment-exposure-currency').addEventListener('change', render);
    for (const id of ['investment-exposure-dimension', 'investment-exposure-analysis-currency', 'investment-exposure-as-of', 'investment-exposure-account']) {
        $('#' + id).addEventListener('change', render);
    }
    $('#investment-exposure-analysis-currency').addEventListener('change', () => {
        $('#investment-exposure-currency').value = $('#investment-exposure-analysis-currency').value;
        render();
    });
    $('#investment-exposure-scope').addEventListener('change', render);
    bindForm('#investment-exposure-form', (form) => {
        const ledger = readLedger();
        const instrument = ledger.investmentInstruments.find((item) => item.id === form.get('instrumentId'));
        if (!instrument) throw new Error('Select an existing investment instrument.');
        const allocations = [...$('#investment-exposure-allocations').querySelectorAll('.investment-exposure-allocation-row')].map((row) => ({
            groupId: row.querySelector('input[aria-label="Stable group ID"]').value,
            groupName: row.querySelector('input[aria-label="Group display name"]').value,
            weightPercent: Number(row.querySelector('input[aria-label="Allocation weight percentage"]').value)
        }));
        const classification = {
            id: crypto.randomUUID(), instrumentId: instrument.id,
            dimensionId: String(form.get('dimensionId')).trim(), dimensionName: String(form.get('dimensionName')).trim(),
            effectiveFrom: String(form.get('effectiveFrom')), recordedAt: new Date().toISOString(),
            sourceType: String(form.get('sourceType')), sourceName: String(form.get('sourceName')).trim(),
            ...(String(form.get('evidenceReference') ?? '').trim() ? { evidenceReference: String(form.get('evidenceReference')).trim() } : {}),
            allocations
        };
        const existing = readClassifications(ledger);
        const validated = validateInvestmentExposureClassifications([...existing, classification], { instruments: ledger.investmentInstruments });
        localStorage.setItem(CLASSIFICATION_KEY, JSON.stringify(validated));
        window.dispatchEvent(new Event('pfo:workspace-updated'));
    });
    $('#investment-exposure-analysis-currency').value = 'INR';
    $('#investment-exposure-as-of').value = new Date().toISOString().slice(0, 10);
    addAllocationRow();
    window.addEventListener('pfo:investment-updated', render);
    window.addEventListener('pfo:workspace-updated', render);
    render();
}
