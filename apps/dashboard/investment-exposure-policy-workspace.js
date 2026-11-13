import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentExposureClassifications } from './investment-exposure.js';
import {
    evaluateInvestmentExposurePolicy,
    selectInvestmentExposurePolicy,
    validateInvestmentExposurePolicies
} from './investment-exposure-policy.js';
import { analyzeInvestmentExposurePositions } from './investment-exposure.js';

const POLICY_KEY = 'pfo-os.investment-exposure-policies.v1';
const LEDGER_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const CLASSIFICATION_KEY = 'pfo-os.investment-exposure-classifications.v1';
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';

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
    return validateInvestmentExposurePolicies(values, {
        accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments, classifications
    });
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function message(text, isError = false) {
    const node = $('#investment-exposure-policy-message');
    node.textContent = text;
    node.className = isError ? 'validation-message' : 'form-note';
    node.hidden = false;
}
function fillAccountOptions(ledger) {
    const currency = $('#investment-exposure-policy-currency').value;
    const select = $('#investment-exposure-policy-account');
    const previous = select.value;
    const accounts = ledger.investmentAccounts.filter((item) => item.currency === currency);
    select.innerHTML = '<option value="">Select account</option>' + accounts.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.institution) + '</option>').join('');
    if (accounts.some((item) => item.id === previous)) select.value = previous;
}
function fillDimensionOptions(classifications, ledger, currency) {
    const dimensions = new Map();
    const instrumentMap = new Map(ledger.investmentInstruments.map((item) => [item.id, item]));
    for (const item of classifications) {
        if (instrumentMap.get(item.instrumentId)?.currency === currency) dimensions.set(item.dimensionId, item.dimensionName);
    }
    const select = $('#investment-exposure-policy-dimension');
    const previous = select.value;
    select.innerHTML = '<option value="">Select a classification dimension</option>' + [...dimensions.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, name]) => '<option value="' + escape(id) + '">' + escape(name) + '</option>').join('');
    if (dimensions.has(previous)) select.value = previous;
}
function groupsForDimension(classifications, dimensionId, currency, instruments) {
    const groups = new Map();
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    for (const item of classifications) {
        if (item.dimensionId !== dimensionId || instrumentMap.get(item.instrumentId)?.currency !== currency) continue;
        for (const group of item.allocations) groups.set(group.groupId, group.groupName);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupId, groupName]) => ({ groupId, groupName }));
}
function addRuleRow(classifications, value = {}, ledger) {
    const row = document.createElement('div');
    row.className = 'investment-exposure-policy-rule-row investment-concentration-rule-row';
    const dimensionId = $('#investment-exposure-policy-dimension').value;
    const groups = groupsForDimension(classifications, dimensionId, $('#investment-exposure-policy-currency').value, ledger.investmentInstruments);
    const group = document.createElement('select');
    group.className = 'investment-exposure-policy-rule-group';
    group.required = true;
    group.innerHTML = '<option value="">Select group</option>' + groups.map((item) =>
        '<option value="' + escape(item.groupId) + '">' + escape(item.groupName) + '</option>').join('');
    if (value.groupId && groups.some((item) => item.groupId === value.groupId)) group.value = value.groupId;
    const limit = document.createElement('input');
    limit.type = 'number'; limit.min = '0'; limit.max = '100'; limit.step = 'any'; limit.required = true;
    limit.className = 'investment-exposure-policy-rule-limit'; limit.value = value.maxWeightPercent ?? '';
    limit.setAttribute('aria-label', 'Maximum exposure percentage');
    const operator = document.createElement('select');
    operator.className = 'investment-exposure-policy-rule-operator';
    operator.innerHTML = '<option value=">">Greater than (&gt;)</option><option value=">=">Greater than or equal to (&gt;=)</option>';
    operator.value = value.operator ?? '>';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-secondary button-small'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => row.remove());
    const groupLabel = document.createElement('label'); groupLabel.className = 'field-label'; groupLabel.textContent = 'Group'; groupLabel.append(group);
    const limitLabel = document.createElement('label'); limitLabel.className = 'field-label'; limitLabel.textContent = 'Your maximum (%)'; limitLabel.append(limit);
    const operatorLabel = document.createElement('label'); operatorLabel.className = 'field-label'; operatorLabel.textContent = 'Breach when'; operatorLabel.append(operator);
    row.append(groupLabel, limitLabel, operatorLabel, remove);
    $('#investment-exposure-policy-rules').append(row);
}
function refreshRuleRows(classifications, ledger) {
    const container = $('#investment-exposure-policy-rules');
    const current = [...container.querySelectorAll('.investment-exposure-policy-rule-row')].map((row) => ({
        groupId: row.querySelector('.investment-exposure-policy-rule-group').value,
        maxWeightPercent: row.querySelector('.investment-exposure-policy-rule-limit').value,
        operator: row.querySelector('.investment-exposure-policy-rule-operator').value
    }));
    container.replaceChildren();
    current.forEach((rule) => addRuleRow(classifications, rule, ledger));
}
function fillPolicySets(policies) {
    const sets = new Map();
    for (const item of policies) {
        const current = sets.get(item.policySetId);
        if (!current || item.version > current.version) sets.set(item.policySetId, item);
    }
    const select = $('#investment-exposure-policy-version-set');
    const previous = select.value;
    select.innerHTML = '<option value="">Create a new policy set</option>' + [...sets.values()].sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => '<option value="' + escape(item.policySetId) + '">' + escape(item.name) + ' · v' + item.version + '</option>').join('');
    if (sets.has(previous)) select.value = previous;
}
function renderHistory(ledger, policies) {
    const body = $('#investment-exposure-policy-history');
    body.replaceChildren();
    for (const item of policies) {
        const row = document.createElement('tr');
        const values = [item.name, item.policySetId, 'v' + item.version, item.currency,
            item.scope === 'account' ? ledger.investmentAccounts.find((a) => a.id === item.accountId)?.name ?? item.accountId : 'Portfolio',
            item.dimensionName, item.effectiveFrom, item.recordedAt,
            item.rules.map((rule) => rule.groupName + ' ' + rule.operator + ' ' + percent(rule.maxWeightPercent)).join('; ')];
        for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
        body.append(row);
    }
    if (!policies.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 9; cell.textContent = 'No user-defined exposure limits have been saved.';
        row.append(cell); body.append(row);
    }
}
function renderEvaluation(ledger, classifications, policies) {
    const output = $('#investment-exposure-policy-analysis');
    output.replaceChildren();
    const policySetId = $('#investment-exposure-policy-analyze-set').value;
    const asOf = $('#investment-exposure-policy-as-of').value;
    const cutoffInput = $('#investment-exposure-policy-recorded-at-cutoff').value;
    if (!policySetId || !asOf) {
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Choose a saved exposure policy set and as-of date to evaluate your explicit limits.';
        output.append(note); return;
    }
    try {
        const [year, month, day] = asOf.split('-').map(Number);
        const asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) {
            throw new Error('Select a valid calendar date.');
        }
        const recordedAtCutoff = cutoffInput ? new Date(cutoffInput) : new Date();
        if (!Number.isFinite(recordedAtCutoff.getTime())) throw new Error('Select a valid recorded-at cutoff.');
        const versions = policies.filter((item) => item.policySetId === policySetId);
        const latest = [...versions].sort((a, b) => b.version - a.version)[0];
        if (!latest) throw new Error('The selected exposure policy set is unavailable.');
        const policy = selectInvestmentExposurePolicy(versions, {
            asOfDate, recordedAtCutoff, policySetId, scope: latest.scope, currency: latest.currency,
            accountId: latest.accountId, dimensionId: latest.dimensionId
        }, { accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments, classifications });
        if (!policy) {
            const note = document.createElement('p'); note.className = 'form-note';
            note.textContent = 'No exposure policy version was both effective and recorded by the selected cutoffs.';
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
            currency: policy.currency, scope: policy.scope, accountId: policy.accountId,
            asOfDate, recordedAtCutoff
        });
        const result = evaluateInvestmentExposurePolicy({
            exposure, policy, asOfDate, recordedAtCutoff, accounts: ledger.investmentAccounts,
            instruments: ledger.investmentInstruments, classifications
        });
        const summary = document.createElement('p'); summary.className = result.status === 'breach' ? 'validation-message' : 'form-note';
        if (result.status === 'unavailable') summary.textContent = result.reason;
        else if (result.status === 'empty') summary.textContent = result.message;
        else summary.textContent = result.status === 'breach'
            ? result.breachCount + ' of ' + result.evaluatedRuleCount + ' user-defined exposure limits are breached.'
            : 'All ' + result.evaluatedRuleCount + ' user-defined exposure limits are within their configured boundaries.';
        output.append(summary);
        if (!['breach', 'withinLimits'].includes(result.status)) return;
        const table = document.createElement('table');
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const label of ['Group', 'Actual weight', 'Your limit', 'Result']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
        head.append(header); table.append(head);
        const body = document.createElement('tbody');
        for (const item of result.results) {
            const row = document.createElement('tr');
            for (const value of [item.groupName, percent(item.actualWeightPercent),
                item.operator + ' ' + percent(item.maxWeightPercent),
                item.status === 'breach' ? 'Limit breached' : 'Within limit']) {
                const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
            }
            body.append(row);
        }
        table.append(body);
        const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.append(table); output.append(wrapper);
        const footnote = document.createElement('p'); footnote.className = 'form-note';
        footnote.textContent = 'Results are descriptive calculations against limits you configured. They are not investment advice or instructions to trade.';
        output.append(footnote);
    } catch (error) {
        const note = document.createElement('p'); note.className = 'validation-message';
        note.textContent = error instanceof Error ? error.message : 'Exposure policy evaluation could not be completed.';
        output.append(note);
    }
}
function render() {
    const panel = $('#investment-exposure-policy-workspace');
    if (!panel) return;
    const enabled = privateWorkspace();
    $('#investment-exposure-policy-demo-note').hidden = enabled;
    panel.querySelectorAll('form input, form select, form button, #investment-exposure-policy-analyze-set, #investment-exposure-policy-as-of, #investment-exposure-policy-recorded-at-cutoff')
        .forEach((control) => { control.disabled = !enabled; });
    if (!enabled) {
        $('#investment-exposure-policy-count').textContent = '0';
        $('#investment-exposure-policy-history').replaceChildren();
        $('#investment-exposure-policy-analysis').replaceChildren();
        return;
    }
    try {
        const ledger = readLedger();
        const classifications = readClassifications(ledger);
        const policies = readPolicies(ledger, classifications);
        $('#investment-exposure-policy-error').hidden = true;
        $('#investment-exposure-policy-count').textContent = String(policies.length);
        fillAccountOptions(ledger);
        fillDimensionOptions(classifications, ledger, $('#investment-exposure-policy-currency').value);
        fillPolicySets(policies);
        const evaluationSet = $('#investment-exposure-policy-analyze-set');
        const previous = evaluationSet.value;
        const sets = [...new Map(policies.map((item) => [item.policySetId, item])).values()];
        evaluationSet.innerHTML = '<option value="">Choose a policy set</option>' + sets.map((item) =>
            '<option value="' + escape(item.policySetId) + '">' + escape(item.name) + '</option>').join('');
        if (sets.some((item) => item.policySetId === previous)) evaluationSet.value = previous;
        renderHistory(ledger, policies);
        renderEvaluation(ledger, classifications, policies);
    } catch (error) {
        $('#investment-exposure-policy-error').textContent = error instanceof Error ? error.message : 'Exposure policy data could not be read.';
        $('#investment-exposure-policy-error').hidden = false;
    }
}
function bindForm(selector, callback) {
    $(selector).addEventListener('submit', (event) => {
        event.preventDefault();
        try { callback(new FormData(event.currentTarget)); event.currentTarget.reset(); message('A new immutable exposure policy version was saved.'); render(); }
        catch (error) { message(error instanceof Error ? error.message : 'Exposure policy could not be saved.', true); }
    });
}
if ($('#investment-exposure-policy-workspace')) {
    $('#investment-exposure-policy-currency').innerHTML = CURRENCIES.map((item) => '<option value="' + item + '">' + item + '</option>').join('');
    $('#investment-exposure-policy-add-rule').addEventListener('click', () => {
        try { const ledger = readLedger(); addRuleRow(readClassifications(ledger), {}, ledger); }
        catch (error) { message(error instanceof Error ? error.message : 'Classification groups could not be read.', true); }
    });
    $('#investment-exposure-policy-version-set').addEventListener('change', () => {
        const selected = $('#investment-exposure-policy-version-set').value;
        if (!selected) return;
        const ledger = readLedger(), classifications = readClassifications(ledger), policies = readPolicies(ledger, classifications);
        const latest = policies.filter((item) => item.policySetId === selected).sort((a, b) => b.version - a.version)[0];
        if (!latest) return;
        $('#investment-exposure-policy-name').value = latest.name;
        $('#investment-exposure-policy-currency').value = latest.currency;
        $('#investment-exposure-policy-scope').value = latest.scope;
        fillAccountOptions(ledger);
        $('#investment-exposure-policy-account').value = latest.accountId ?? '';
        $('#investment-exposure-policy-dimension').value = latest.dimensionId;
        $('#investment-exposure-policy-rules').replaceChildren();
        latest.rules.forEach((rule) => addRuleRow(classifications, rule, ledger));
    });
    $('#investment-exposure-policy-dimension').addEventListener('change', () => {
        const ledger = readLedger(); refreshRuleRows(readClassifications(ledger), ledger);
    });
    $('#investment-exposure-policy-currency').addEventListener('change', () => {
        const ledger = readLedger(), classifications = readClassifications(ledger);
        fillAccountOptions(ledger);
        fillDimensionOptions(classifications, ledger, $('#investment-exposure-policy-currency').value);
        refreshRuleRows(classifications, ledger);
    });
    $('#investment-exposure-policy-scope').addEventListener('change', () => {
        $('#investment-exposure-policy-account-row').hidden = $('#investment-exposure-policy-scope').value !== 'account';
    });
    bindForm('#investment-exposure-policy-form', (form) => {
        const ledger = readLedger(), classifications = readClassifications(ledger);
        const current = readPolicies(ledger, classifications);
        const selectedSetId = String($('#investment-exposure-policy-version-set').value || '').trim();
        const setVersions = selectedSetId ? current.filter((item) => item.policySetId === selectedSetId) : [];
        const latest = setVersions.sort((a, b) => b.version - a.version)[0];
        const dimensionId = String($('#investment-exposure-policy-dimension').value);
        const dimension = classifications.find((item) => item.dimensionId === dimensionId);
        if (!dimension) throw new Error('Choose a dimension with validated exposure classifications.');
        const rules = [...$('#investment-exposure-policy-rules').querySelectorAll('.investment-exposure-policy-rule-row')].map((row) => {
            const groupId = row.querySelector('.investment-exposure-policy-rule-group').value;
            const group = groupsForDimension(classifications, dimensionId, String(form.get('currency')), ledger.investmentInstruments).find((item) => item.groupId === groupId);
            if (!group) throw new Error('Select a valid group for every exposure limit.');
            return { groupId, groupName: group.groupName,
                maxWeightPercent: Number(row.querySelector('.investment-exposure-policy-rule-limit').value),
                operator: row.querySelector('.investment-exposure-policy-rule-operator').value };
        });
        const scope = String(form.get('scope'));
        const accountId = String(form.get('accountId') ?? '').trim();
        const policy = {
            id: crypto.randomUUID(), policySetId: selectedSetId || crypto.randomUUID(),
            version: latest ? latest.version + 1 : 1, name: String(form.get('name')).trim(),
            currency: String(form.get('currency')), scope, ...(scope === 'account' ? { accountId } : {}),
            dimensionId, dimensionName: dimension.dimensionName, effectiveFrom: String(form.get('effectiveFrom')),
            recordedAt: new Date().toISOString(), rules
        };
        const validated = validateInvestmentExposurePolicies([...current, policy], {
            accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments, classifications
        });
        localStorage.setItem(POLICY_KEY, JSON.stringify(validated));
        const cutoff = new Date(Math.ceil(Date.now() / 1000) * 1000);
        $('#investment-exposure-policy-recorded-at-cutoff').value =
            new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
        window.dispatchEvent(new Event('pfo:workspace-updated'));
    });
    for (const id of ['investment-exposure-policy-dimension', 'investment-exposure-policy-as-of', 'investment-exposure-policy-recorded-at-cutoff', 'investment-exposure-policy-analyze-set']) {
        $('#' + id).addEventListener('change', render);
    }
    const cutoff = new Date(Math.ceil(Date.now() / 1000) * 1000);
    $('#investment-exposure-policy-as-of').value = new Date().toISOString().slice(0, 10);
    $('#investment-exposure-policy-recorded-at-cutoff').value =
        new Date(cutoff.getTime() - cutoff.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    window.addEventListener('pfo:workspace-updated', render);
    window.addEventListener('pfo:investment-updated', render);
    render();
}
