import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import {
    analyzeInvestmentConcentrationPositions,
    evaluateInvestmentConcentrationPolicy,
    selectInvestmentConcentrationPolicy,
    validateInvestmentConcentrationPolicies
} from './investment-concentration.js';

const POLICY_KEY = 'pfo-os.investment-concentration-policies.v1';
const LEDGER_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const INSTRUMENT_TYPES = ['Equity', 'MutualFund', 'ETF', 'Bond', 'FixedDeposit', 'PublicProvidentFund', 'NationalPensionSystem', 'EmployeesProvidentFund', 'Gold', 'Silver', 'RealEstateInvestment', 'Cryptocurrency', 'AlternativeInvestment', 'Other'];
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
function readPolicies(ledger) {
    const raw = localStorage.getItem(POLICY_KEY);
    const values = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error('Saved concentration policies are not a collection.');
    return validateInvestmentConcentrationPolicies(values, {
        accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments
    });
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function message(text, isError = false) {
    const node = $('#investment-concentration-message');
    node.textContent = text;
    node.className = isError ? 'validation-message' : 'form-note';
    node.hidden = false;
}
function fillAccountOptions(ledger) {
    const currency = $('#investment-concentration-currency').value;
    const select = $('#investment-concentration-account');
    const previous = select.value;
    const accounts = ledger.investmentAccounts.filter((item) => item.currency === currency);
    select.innerHTML = '<option value="">Select account</option>' + accounts.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.institution) + '</option>').join('');
    if (accounts.some((item) => item.id === previous)) select.value = previous;
}
function addRuleRow(ledger, value = {}) {
    const container = $('#investment-concentration-rules');
    const row = document.createElement('div');
    row.className = 'investment-concentration-rule-row';
    const key = document.createElement('select');
    key.className = 'investment-concentration-rule-key';
    key.required = true;
    const grouping = $('#investment-concentration-group-by').value;
    const currency = $('#investment-concentration-currency').value;
    const options = grouping === 'instrumentType'
        ? INSTRUMENT_TYPES.map((item) => ({ value: item, label: item }))
        : ledger.investmentInstruments.filter((item) => item.currency === currency).map((item) => ({ value: item.id, label: item.name + ' · ' + item.currency }));
    key.innerHTML = options.map((item) => '<option value="' + escape(item.value) + '">' + escape(item.label) + '</option>').join('');
    if (value.key && options.some((item) => item.value === value.key)) key.value = value.key;
    const limit = document.createElement('input');
    limit.type = 'number'; limit.min = '0'; limit.max = '100'; limit.step = 'any'; limit.required = true;
    limit.className = 'investment-concentration-rule-limit'; limit.value = value.maxWeightPercent ?? '';
    limit.setAttribute('aria-label', 'Maximum concentration percentage');
    const operator = document.createElement('select');
    operator.className = 'investment-concentration-rule-operator';
    operator.innerHTML = '<option value=">">Greater than (&gt;)</option><option value=">=">Greater than or equal to (&gt;=)</option>';
    operator.value = value.operator ?? '>';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-secondary button-small'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => row.remove());
    const keyLabel = document.createElement('label'); keyLabel.className = 'field-label'; keyLabel.textContent = 'Group'; keyLabel.append(key);
    const limitLabel = document.createElement('label'); limitLabel.className = 'field-label'; limitLabel.textContent = 'Your maximum (%)'; limitLabel.append(limit);
    const operatorLabel = document.createElement('label'); operatorLabel.className = 'field-label'; operatorLabel.textContent = 'Breach when'; operatorLabel.append(operator);
    row.append(keyLabel, limitLabel, operatorLabel, remove);
    container.append(row);
}
function fillPolicySets(policies) {
    const sets = new Map();
    for (const policy of policies) {
        const current = sets.get(policy.policySetId);
        if (!current || policy.version > current.version) sets.set(policy.policySetId, policy);
    }
    const ordered = [...sets.values()].sort((a, b) => a.name.localeCompare(b.name));
    const options = '<option value="">Choose a policy set</option>' + ordered.map((item) =>
        '<option value="' + escape(item.policySetId) + '">' + escape(item.name) + ' · v' + item.version + '</option>').join('');
    const edit = $('#investment-concentration-policy-set'), analyze = $('#investment-concentration-analyze-set');
    const oldEdit = edit.value, oldAnalyze = analyze.value;
    edit.innerHTML = '<option value="">Create a new policy set</option>' + ordered.map((item) =>
        '<option value="' + escape(item.policySetId) + '">' + escape(item.name) + ' · v' + item.version + '</option>').join('');
    analyze.innerHTML = options;
    if (sets.has(oldEdit)) edit.value = oldEdit;
    if (sets.has(oldAnalyze)) analyze.value = oldAnalyze;
    else if (ordered.length === 1) analyze.value = ordered[0].policySetId;
}
function renderHistory(policies) {
    const body = $('#investment-concentration-history');
    body.replaceChildren();
    for (const policy of [...policies].sort((a, b) => a.policySetId.localeCompare(b.policySetId) || b.version - a.version)) {
        const row = document.createElement('tr');
        const values = [policy.name, policy.version, policy.currency, policy.scope === 'account' ? 'Account: ' + policy.accountId : 'Portfolio',
            policy.groupBy === 'instrumentType' ? 'Instrument type' : 'Instrument', policy.effectiveFrom,
            policy.recordedAt, policy.rules.map((rule) => rule.key + ' ' + rule.operator + ' ' + percent(rule.maxWeightPercent)).join('; ')];
        for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell); }
        body.append(row);
    }
    if (!policies.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 7; cell.textContent = 'No user-defined concentration limits have been saved.';
        row.append(cell); body.append(row);
    }
}
function renderAnalysis(ledger, policies) {
    const output = $('#investment-concentration-analysis');
    output.replaceChildren();
    const policySetId = $('#investment-concentration-analyze-set').value;
    const asOf = $('#investment-concentration-as-of').value;
    if (!policySetId || !asOf) {
        const note = document.createElement('p'); note.className = 'form-note';
        note.textContent = 'Choose a saved policy set and as-of date to evaluate your concentration limits.';
        output.append(note); return;
    }
    try {
        const [year, month, day] = asOf.split('-').map(Number);
        const asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) throw new Error('Select a valid calendar date.');
        const versions = policies.filter((item) => item.policySetId === policySetId);
        const latest = [...versions].sort((a, b) => b.version - a.version)[0];
        if (!latest) throw new Error('The selected concentration policy set is unavailable.');
        const recordedAtCutoff = new Date();
        const policy = selectInvestmentConcentrationPolicy(versions, {
            asOfDate, recordedAtCutoff, scope: latest.scope, currency: latest.currency, accountId: latest.accountId
        }, { accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments });
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
        const allocation = analyzeInvestmentConcentrationPositions({
            positions, instruments: ledger.investmentInstruments, accounts: ledger.investmentAccounts,
            policy, asOfDate, recordedAtCutoff
        });
        const result = evaluateInvestmentConcentrationPolicy({
            allocation, policy, asOfDate, recordedAtCutoff,
            accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments
        });
        const summary = document.createElement('p'); summary.className = result.status === 'breach' ? 'validation-message' : 'form-note';
        if (result.status === 'unavailable') summary.textContent = result.reason;
        else if (result.status === 'empty') summary.textContent = result.message;
        else summary.textContent = result.status === 'breach'
            ? result.breachCount + ' of ' + result.evaluatedRuleCount + ' user-defined concentration limits are breached.'
            : 'All ' + result.evaluatedRuleCount + ' user-defined concentration limits are within their configured boundaries.';
        output.append(summary);
        if (!['breach', 'withinLimits'].includes(result.status)) return;
        const table = document.createElement('table');
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const label of ['Group', 'Actual weight', 'Your limit', 'Result']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
        head.append(header); table.append(head);
        const body = document.createElement('tbody');
        for (const item of result.results) {
            const row = document.createElement('tr');
            const instrument = ledger.investmentInstruments.find((entry) => entry.id === item.key);
            const label = policy.groupBy === 'instrument' ? (instrument?.name ?? item.key) : item.key;
            for (const value of [label, percent(item.actualWeightPercent), item.operator + ' ' + percent(item.maxWeightPercent),
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
        note.textContent = error instanceof Error ? error.message : 'Concentration analysis could not be completed.';
        output.append(note);
    }
}
function render() {
    const panel = $('#investment-concentration-workspace');
    if (!panel) return;
    const enabled = privateWorkspace();
    $('#investment-concentration-demo-note').hidden = enabled;
    panel.querySelectorAll('form input, form select, form button, #investment-concentration-analyze-set, #investment-concentration-as-of')
        .forEach((control) => { control.disabled = !enabled; });
    if (!enabled) {
        $('#investment-concentration-history').replaceChildren();
        $('#investment-concentration-analysis').replaceChildren();
        $('#investment-concentration-policy-count').textContent = '0';
        return;
    }
    try {
        const ledger = readLedger(), policies = readPolicies(ledger);
        $('#investment-concentration-policy-count').textContent = String(policies.length);
        renderHistory(policies); fillPolicySets(policies); fillAccountOptions(ledger);
        renderAnalysis(ledger, policies);
        $('#investment-concentration-error').hidden = true;
    } catch (error) {
        $('#investment-concentration-error').textContent = error instanceof Error ? error.message : 'Concentration policies could not be loaded.';
        $('#investment-concentration-error').hidden = false;
        $('#investment-concentration-history').replaceChildren();
        $('#investment-concentration-analysis').replaceChildren();
        panel.querySelectorAll('form button').forEach((button) => { button.disabled = true; });
    }
}
export function initializeInvestmentConcentrationWorkspace() {
    const panel = $('#investment-concentration-workspace');
    if (!panel) return;
    $('#investment-concentration-currency').innerHTML = CURRENCIES.map((value) => '<option value="' + value + '">' + value + '</option>').join('');
    $('#investment-concentration-add-rule').addEventListener('click', () => {
        try { addRuleRow(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-group-by').addEventListener('change', () => {
        try { $('#investment-concentration-rules').replaceChildren(); addRuleRow(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-currency').addEventListener('change', () => {
        try { fillAccountOptions(readLedger()); $('#investment-concentration-rules').replaceChildren(); addRuleRow(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-scope').addEventListener('change', () => {
        $('#investment-concentration-account-row').hidden = $('#investment-concentration-scope').value !== 'account';
    });
    $('#investment-concentration-policy-set').addEventListener('change', () => {
        try {
            const ledger = readLedger(), policies = readPolicies(ledger);
            const selected = policies.filter((item) => item.policySetId === $('#investment-concentration-policy-set').value)
                .sort((a, b) => b.version - a.version)[0];
            $('#investment-concentration-name').value = selected?.name ?? '';
            $('#investment-concentration-currency').value = selected?.currency ?? 'INR';
            $('#investment-concentration-scope').value = selected?.scope ?? 'portfolio';
            $('#investment-concentration-group-by').value = selected?.groupBy ?? 'instrumentType';
            $('#investment-concentration-account-row').hidden = !selected || selected.scope !== 'account';
            fillAccountOptions(ledger);
            $('#investment-concentration-account').value = selected?.accountId ?? '';
            $('#investment-concentration-rules').replaceChildren();
            if (selected) selected.rules.forEach((rule) => addRuleRow(ledger, rule));
            else addRuleRow(ledger);
        } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-analyze-set').addEventListener('change', () => {
        try { const ledger = readLedger(); renderAnalysis(ledger, readPolicies(ledger)); } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-as-of').addEventListener('change', () => {
        try { const ledger = readLedger(); renderAnalysis(ledger, readPolicies(ledger)); } catch (error) { message(error.message, true); }
    });
    $('#investment-concentration-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            if (!privateWorkspace()) throw new Error('Switch to the private workspace before saving concentration limits.');
            const baseline = localStorage.getItem(POLICY_KEY);
            const ledger = readLedger(), policies = readPolicies(ledger);
            const selectedSet = $('#investment-concentration-policy-set').value;
            const existing = selectedSet ? policies.filter((item) => item.policySetId === selectedSet) : [];
            const latest = [...existing].sort((a, b) => b.version - a.version)[0];
            const currency = $('#investment-concentration-currency').value;
            const scope = $('#investment-concentration-scope').value;
            const accountId = scope === 'account' ? $('#investment-concentration-account').value : undefined;
            const groupBy = $('#investment-concentration-group-by').value;
            if (latest && (latest.currency !== currency || latest.scope !== scope || latest.accountId !== accountId || latest.groupBy !== groupBy)) {
                throw new Error('A new version must retain its policy set currency, scope, account and grouping. Start a new policy set to change those dimensions.');
            }
            const rules = [...$('#investment-concentration-rules').querySelectorAll('.investment-concentration-rule-row')].map((row) => ({
                key: row.querySelector('.investment-concentration-rule-key').value,
                maxWeightPercent: Number(row.querySelector('.investment-concentration-rule-limit').value),
                operator: row.querySelector('.investment-concentration-rule-operator').value
            }));
            const policy = {
                id: crypto.randomUUID(), policySetId: latest?.policySetId ?? crypto.randomUUID(),
                version: latest ? latest.version + 1 : 1, name: $('#investment-concentration-name').value.trim(),
                currency, scope, ...(accountId ? { accountId } : {}), groupBy,
                effectiveFrom: $('#investment-concentration-effective-from').value,
                recordedAt: new Date().toISOString(), rules
            };
            const validated = validateInvestmentConcentrationPolicies([...policies, policy], {
                accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments
            });
            if (!window.confirm('Save immutable concentration policy ' + policy.name + ' v' + policy.version
                + '? Each maximum and comparison boundary is user-defined. Existing versions will remain unchanged.')) return;
            const commit = () => {
                if (localStorage.getItem(POLICY_KEY) !== baseline) throw new Error('Concentration policies changed in another tab. Reload policy history and retry; no changes were written.');
                localStorage.setItem(POLICY_KEY, JSON.stringify(validated));
            };
            if (navigator.locks?.request) await navigator.locks.request('pfo-os-investment-concentration-policy-write', commit);
            else commit();
            render();
            $('#investment-concentration-policy-set').value = policy.policySetId;
            $('#investment-concentration-analyze-set').value = policy.policySetId;
            $('#investment-concentration-policy-set').dispatchEvent(new Event('change', { bubbles: true }));
            window.dispatchEvent(new Event('pfo:investment-concentration-updated'));
            window.dispatchEvent(new Event('pfo:workspace-updated'));
            message('Saved user-defined concentration policy version ' + policy.version + '.');
        } catch (error) { message(error instanceof Error ? error.message : 'Concentration policy could not be saved.', true); }
    });
    window.addEventListener('pfo:workspace-updated', render);
    window.addEventListener('pfo:investment-updated', render);
    window.addEventListener('pfo:investment-concentration-updated', render);
    window.addEventListener('storage', (event) => { if (event.key === POLICY_KEY) render(); });
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    $('#investment-concentration-effective-from').value = today;
    $('#investment-concentration-as-of').value = today;
    render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeInvestmentConcentrationWorkspace, { once: true });
else initializeInvestmentConcentrationWorkspace();
