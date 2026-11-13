import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { analyzeInvestmentExposurePositions, validateInvestmentExposureClassifications } from './investment-exposure.js';
import {
    evaluateInvestmentExposurePolicy,
    selectInvestmentExposurePolicy,
    validateInvestmentExposurePolicyCollections
} from './investment-exposure-policy.js';

const POLICY_KEY = 'pfo-os.' + 'investment-exposure-policies.v1';
const CLASSIFICATION_KEY = 'pfo-os.investment-exposure-classifications.v1';
const LEDGER_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';
const localDateTimeValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

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
function readPolicies(ledger, classifications) {
    const raw = localStorage.getItem(POLICY_KEY);
    const values = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error('Saved exposure policies are not a collection.');
    return validateInvestmentExposurePolicyCollections({
        ...ledger, investmentExposureClassifications: classifications, investmentExposurePolicies: values
    }).investmentExposurePolicies;
}
function isPrivateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function showMessage(value, isError = false) {
    const node = $('#investment-exposure-policy-message');
    node.textContent = value;
    node.className = isError ? 'validation-message' : 'form-note';
    node.hidden = false;
}
function currentContext() {
    const ledger = readLedger();
    const classifications = readClassifications(ledger);
    const policies = readPolicies(ledger, classifications);
    return { ledger, classifications, policies };
}
function dimensionName(classifications, dimensionId) {
    return classifications.find((item) => item.dimensionId === dimensionId)?.dimensionName ?? '';
}
function groupsFor(classifications, instruments, dimensionId, currency) {
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    const groups = new Map();
    for (const classification of classifications) {
        const instrument = instrumentMap.get(classification.instrumentId);
        if (classification.dimensionId !== dimensionId || instrument?.currency !== currency) continue;
        for (const allocation of classification.allocations) groups.set(allocation.groupId, allocation.groupName);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([id, name]) => ({ id, name }));
}
function refreshDimensions(classifications) {
    const select = $('#investment-exposure-policy-dimension');
    const previous = select.value;
    const dimensions = new Map();
    for (const item of classifications) dimensions.set(item.dimensionId, item.dimensionName);
    select.innerHTML = '<option value="">Select a dimension</option>' + [...dimensions].sort(([a], [b]) => a.localeCompare(b))
        .map(([id, name]) => '<option value="' + escape(id) + '">' + escape(name) + ' (' + escape(id) + ')</option>').join('');
    if (dimensions.has(previous)) select.value = previous;
}
function refreshAccounts(ledger) {
    const select = $('#investment-exposure-policy-account');
    const currency = $('#investment-exposure-policy-currency').value;
    const previous = select.value;
    const accounts = ledger.investmentAccounts.filter((item) => item.currency === currency);
    select.innerHTML = '<option value="">Select an account</option>' + accounts.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.institution) + '</option>').join('');
    if (accounts.some((item) => item.id === previous)) select.value = previous;
    $('#investment-exposure-policy-account-row').hidden = $('#investment-exposure-policy-scope').value !== 'account';
}
function addRuleRow(groups, value = {}) {
    const container = $('#investment-exposure-policy-rules');
    const row = document.createElement('div');
    row.className = 'investment-allocation-target-row investment-exposure-policy-rule-row';
    const group = document.createElement('select');
    group.required = true;
    group.setAttribute('aria-label', 'Exposure group');
    group.innerHTML = '<option value="">Select a group</option>' + groups.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.id) + '</option>').join('');
    if (value.groupId && groups.some((item) => item.id === value.groupId)) group.value = value.groupId;
    const maximum = document.createElement('input');
    maximum.type = 'number'; maximum.min = '0'; maximum.max = '100'; maximum.step = 'any'; maximum.required = true;
    maximum.value = value.maxWeightPercent ?? '';
    maximum.setAttribute('aria-label', 'Maximum exposure percentage');
    const operator = document.createElement('select');
    operator.required = true; operator.setAttribute('aria-label', 'Comparison operator');
    operator.innerHTML = '<option value="">Choose boundary</option><option value=">">Greater than (&gt;)</option><option value=">=">Greater than or equal to (&gt;=)</option>';
    operator.value = value.operator ?? '';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-secondary button-small';
    remove.textContent = 'Remove'; remove.addEventListener('click', () => row.remove());
    const field = (label, control) => {
        const wrapper = document.createElement('label'); wrapper.className = 'field-label';
        wrapper.textContent = label; wrapper.append(control); return wrapper;
    };
    row.append(field('Exposure group', group), field('Your maximum (%)', maximum), field('Breach when', operator), remove);
    container.append(row);
}
function refreshRuleRows(ledger, classifications) {
    const container = $('#investment-exposure-policy-rules');
    const existing = [...container.querySelectorAll('.investment-exposure-policy-rule-row')].map((row) => ({
        groupId: row.querySelector('[aria-label="Exposure group"]').value,
        maxWeightPercent: row.querySelector('[aria-label="Maximum exposure percentage"]').value,
        operator: row.querySelector('[aria-label="Comparison operator"]').value
    }));
    container.replaceChildren();
    const groups = groupsFor(classifications, ledger.investmentInstruments,
        $('#investment-exposure-policy-dimension').value, $('#investment-exposure-policy-currency').value);
    if (existing.length) existing.forEach((item) => addRuleRow(groups, item));
    else addRuleRow(groups);
}
function fillPolicySets(policies) {
    const latest = new Map();
    for (const item of policies) {
        const current = latest.get(item.policySetId);
        if (!current || item.version > current.version) latest.set(item.policySetId, item);
    }
    const select = $('#investment-exposure-policy-analyze-set');
    const previous = select.value;
    select.innerHTML = '<option value="">Choose a policy set</option>' + [...latest.values()].sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => '<option value="' + escape(item.policySetId) + '">' + escape(item.name) + ' · ' + escape(item.policySetId) + '</option>').join('');
    if (latest.has(previous)) select.value = previous;
}
function renderHistory(policies, classifications) {
    const body = $('#investment-exposure-policy-history');
    body.replaceChildren();
    const ordered = [...policies].sort((a, b) => a.policySetId.localeCompare(b.policySetId) || b.version - a.version);
    for (const item of ordered) {
        const row = document.createElement('tr');
        const values = [item.name + ' · ' + item.policySetId, String(item.version), item.currency,
            item.scope === 'account' ? 'Account: ' + item.accountId : 'Portfolio',
            item.dimensionName + ' (' + item.dimensionId + ')', item.effectiveFrom, item.recordedAt,
            item.rules.map((rule) => {
                const group = groupsFor(classifications, currentLedger.investmentInstruments, item.dimensionId, item.currency)
                    .find((entry) => entry.id === rule.groupId);
                return (group?.name ?? rule.groupId) + ' ' + rule.operator + ' ' + percent(rule.maxWeightPercent);
            }).join('; ')];
        for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
        body.append(row);
    }
    if (!ordered.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 8; cell.textContent = 'No user-defined exposure limits have been saved.';
        row.append(cell); body.append(row);
    }
}
let currentLedger = null;
function renderEvaluation(ledger, classifications, policies) {
    const output = $('#investment-exposure-policy-analysis');
    output.replaceChildren();
    const policySetId = $('#investment-exposure-policy-analyze-set').value;
    const asOf = $('#investment-exposure-policy-as-of').value;
    const recordedAtInput = $('#investment-exposure-policy-recorded-at').value;
    if (!policySetId || !asOf) {
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Choose a saved exposure policy set and as-of date to evaluate your limits.';
        output.append(note); return;
    }
    try {
        const [year, month, day] = asOf.split('-').map(Number);
        const asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) {
            throw new Error('Select a valid calendar date.');
        }
        const recordedAtCutoff = recordedAtInput ? new Date(recordedAtInput) : new Date();
        if (!Number.isFinite(recordedAtCutoff.getTime())) throw new Error('Select a valid recorded-at cutoff.');
        const versions = policies.filter((item) => item.policySetId === policySetId);
        const latest = [...versions].sort((a, b) => b.version - a.version)[0];
        if (!latest) throw new Error('The selected exposure policy set is unavailable.');
        const policy = selectInvestmentExposurePolicy(versions, {
            asOfDate, recordedAtCutoff, policySetId, currency: latest.currency, scope: latest.scope,
            accountId: latest.accountId, dimensionId: latest.dimensionId
        }, { accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments, classifications });
        if (!policy) {
            const note = document.createElement('p'); note.className = 'form-note';
            note.textContent = 'No policy version was both effective and recorded by the selected cutoffs.';
            output.append(note); return;
        }
        const positions = analyzeInvestmentPortfolio({
            accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
            transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations,
            asOfDate, recordedAtCutoff
        });
        const exposure = analyzeInvestmentExposurePositions({
            positions, instruments: ledger.investmentInstruments, accounts: ledger.investmentAccounts,
            classifications, dimensionId: policy.dimensionId, dimensionName: policy.dimensionName,
            currency: policy.currency, scope: policy.scope,
            ...(policy.accountId ? { accountId: policy.accountId } : {}), asOfDate, recordedAtCutoff
        });
        const result = evaluateInvestmentExposurePolicy({
            exposure, policy, asOfDate, recordedAtCutoff, accounts: ledger.investmentAccounts,
            instruments: ledger.investmentInstruments, classifications
        });
        const summary = document.createElement('p');
        summary.className = result.status === 'breach' || result.status === 'unavailable' ? 'validation-message' : 'form-note';
        if (result.status === 'unavailable') summary.textContent = result.reason;
        else if (result.status === 'empty') summary.textContent = result.message;
        else summary.textContent = result.status === 'breach'
            ? result.breachCount + ' of ' + result.evaluatedRuleCount + ' user-defined exposure limits are breached.'
            : 'All ' + result.evaluatedRuleCount + ' user-defined exposure limits are within their configured boundaries.';
        output.append(summary);
        if (!['breach', 'withinLimits'].includes(result.status)) return;
        const groupNames = new Map(groupsFor(classifications, ledger.investmentInstruments, policy.dimensionId, policy.currency)
            .map((item) => [item.id, item.name]));
        const table = document.createElement('table');
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const label of ['Group', 'Actual exposure', 'Your limit', 'Result']) {
            const cell = document.createElement('th'); cell.textContent = label; header.append(cell);
        }
        head.append(header); table.append(head);
        const body = document.createElement('tbody');
        for (const item of result.results) {
            const row = document.createElement('tr');
            for (const value of [groupNames.get(item.groupId) ?? item.groupId, percent(item.actualWeightPercent),
                item.operator + ' ' + percent(item.maxWeightPercent),
                item.status === 'breach' ? 'Limit breached' : 'Within limit']) {
                const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
            }
            body.append(row);
        }
        table.append(body);
        const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.append(table); output.append(wrapper);
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Results compare complete user-entered look-through exposure with your saved limits. They are descriptive measurements, not investment advice or instructions to trade.';
        output.append(note);
    } catch (error) {
        const note = document.createElement('p'); note.className = 'validation-message';
        note.textContent = error instanceof Error ? error.message : 'Exposure policy evaluation could not be completed.';
        output.append(note);
    }
}
function render() {
    const panel = $('#investment-exposure-policy-workspace');
    if (!panel) return;
    const enabled = isPrivateWorkspace();
    $('#investment-exposure-policy-demo-note').hidden = enabled;
    panel.querySelectorAll('form input, form select, form button, #investment-exposure-policy-analyze-set, #investment-exposure-policy-as-of, #investment-exposure-policy-recorded-at')
        .forEach((control) => { control.disabled = !enabled; });
    if (!enabled) {
        $('#investment-exposure-policy-history').replaceChildren();
        $('#investment-exposure-policy-analysis').replaceChildren();
        $('#investment-exposure-policy-error').hidden = true;
        return;
    }
    try {
        const { ledger, classifications, policies } = currentContext();
        currentLedger = ledger;
        $('#investment-exposure-policy-error').hidden = true;
        refreshDimensions(classifications);
        refreshAccounts(ledger);
        refreshRuleRows(ledger, classifications);
        fillPolicySets(policies);
        renderHistory(policies, classifications);
        renderEvaluation(ledger, classifications, policies);
        $('#investment-exposure-policy-count').textContent = String(policies.length);
    } catch (error) {
        $('#investment-exposure-policy-error').textContent = error instanceof Error ? error.message : 'Exposure policies could not be loaded.';
        $('#investment-exposure-policy-error').hidden = false;
        $('#investment-exposure-policy-history').replaceChildren();
        $('#investment-exposure-policy-analysis').replaceChildren();
    }
}
function savePolicy(form) {
    const { ledger, classifications, policies } = currentContext();
    const policySetId = String(form.get('policySetId')).trim();
    if (!policySetId) throw new Error('Enter a stable policy-set ID.');
    const versions = policies.filter((item) => item.policySetId === policySetId);
    const version = versions.reduce((maximum, item) => Math.max(maximum, item.version), 0) + 1;
    const dimensionId = $('#investment-exposure-policy-dimension').value;
    const name = String(form.get('name')).trim();
    const currency = $('#investment-exposure-policy-currency').value;
    const scope = $('#investment-exposure-policy-scope').value;
    const accountId = $('#investment-exposure-policy-account').value;
    if (!dimensionId || !currency) throw new Error('Select a classification dimension and currency.');
    if (scope === 'account' && !accountId) throw new Error('Select an investment account for account-scoped limits.');
    const rules = [...$('#investment-exposure-policy-rules').querySelectorAll('.investment-exposure-policy-rule-row')].map((row) => ({
        groupId: row.querySelector('[aria-label="Exposure group"]').value,
        maxWeightPercent: Number(row.querySelector('[aria-label="Maximum exposure percentage"]').value),
        operator: row.querySelector('[aria-label="Comparison operator"]').value
    }));
    const policy = {
        id: crypto.randomUUID(), policySetId, version, name, currency, scope,
        ...(scope === 'account' ? { accountId } : {}),
        dimensionId, dimensionName: dimensionName(classifications, dimensionId),
        effectiveFrom: String(form.get('effectiveFrom')), recordedAt: new Date().toISOString(), rules
    };
    const validated = validateInvestmentExposurePolicyCollections({
        ...ledger, investmentExposureClassifications: classifications,
        investmentExposurePolicies: [...policies, policy]
    });
    localStorage.setItem(POLICY_KEY, JSON.stringify(validated.investmentExposurePolicies));
    window.dispatchEvent(new Event('pfo:workspace-updated'));
}
if ($('#investment-exposure-policy-workspace')) {
    $('#investment-exposure-policy-currency').innerHTML = '<option value="">Select currency</option>' + CURRENCIES
        .map((item) => '<option value="' + item + '">' + item + '</option>').join('');
    $('#investment-exposure-policy-dimension').addEventListener('change', () => {
        try { const { ledger, classifications } = currentContext(); refreshRuleRows(ledger, classifications); }
        catch (error) { showMessage(error instanceof Error ? error.message : 'Could not refresh exposure groups.', true); }
    });
    $('#investment-exposure-policy-currency').addEventListener('change', () => {
        try { const { ledger, classifications } = currentContext(); refreshAccounts(ledger); refreshRuleRows(ledger, classifications); }
        catch (error) { showMessage(error instanceof Error ? error.message : 'Could not refresh exposure groups.', true); }
    });
    $('#investment-exposure-policy-scope').addEventListener('change', () => {
        try { const { ledger } = currentContext(); refreshAccounts(ledger); }
        catch (error) { showMessage(error instanceof Error ? error.message : 'Could not refresh account options.', true); }
    });
    $('#investment-exposure-policy-add-rule').addEventListener('click', () => {
        try { const { ledger, classifications } = currentContext(); addRuleRow(groupsFor(classifications,
            ledger.investmentInstruments, $('#investment-exposure-policy-dimension').value,
            $('#investment-exposure-policy-currency').value)); }
        catch (error) { showMessage(error instanceof Error ? error.message : 'Could not add an exposure limit.', true); }
    });
    $('#investment-exposure-policy-form').addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            savePolicy(new FormData(event.currentTarget));
            event.currentTarget.reset();
            $('#investment-exposure-policy-rules').replaceChildren();
            $('#investment-exposure-policy-recorded-at').value = localDateTimeValue(new Date());
            showMessage('A new immutable exposure policy version was saved.');
            render();
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Exposure policy could not be saved.', true);
        }
    });
    for (const id of ['investment-exposure-policy-analyze-set', 'investment-exposure-policy-as-of', 'investment-exposure-policy-recorded-at']) {
        $('#' + id).addEventListener('change', render);
    }
    $('#investment-exposure-policy-as-of').value = new Date().toISOString().slice(0, 10);
    $('#investment-exposure-policy-recorded-at').value = localDateTimeValue(new Date());
    window.addEventListener('pfo:workspace-updated', render);
    window.addEventListener('pfo:investment-updated', render);
    render();
}
