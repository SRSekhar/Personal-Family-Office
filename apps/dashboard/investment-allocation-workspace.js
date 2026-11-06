import { analyzeInvestmentAllocation, selectInvestmentAllocationPolicy, validateInvestmentAllocationPolicies } from './investment-allocation.js';
import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const POLICY_KEY = 'pfo-os.investment-allocation-policies.v1';
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
const money = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
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
    if (!Array.isArray(values)) throw new Error('Saved allocation policies are not a collection.');
    return validateInvestmentAllocationPolicies(values, {
        accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments
    });
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function message(text, isError = false) {
    const node = $('#investment-allocation-message');
    node.textContent = text;
    node.className = isError ? 'validation-message' : 'form-note';
    node.hidden = false;
}
function addTargetRow(ledger) {
    const container = $('#investment-allocation-targets');
    const row = document.createElement('div');
    row.className = 'investment-allocation-target-row';
    const keyLabel = document.createElement('label');
    keyLabel.className = 'field-label';
    keyLabel.textContent = 'Target group';
    const key = document.createElement('select');
    key.required = true;
    key.className = 'investment-allocation-target-key';
    const groupBy = $('#investment-allocation-group-by').value;
    const currency = $('#investment-allocation-currency').value;
    const options = groupBy === 'instrumentType'
        ? INSTRUMENT_TYPES.map((value) => ({ value, label: value }))
        : ledger.investmentInstruments.filter((item) => item.currency === currency).map((item) => ({ value: item.id, label: item.name + ' · ' + item.currency }));
    key.innerHTML = options.map((item) => '<option value="' + escape(item.value) + '">' + escape(item.label) + '</option>').join('');
    keyLabel.append(key);
    const weightLabel = document.createElement('label');
    weightLabel.className = 'field-label';
    weightLabel.textContent = 'Target weight (%)';
    const weight = document.createElement('input');
    weight.type = 'number'; weight.min = '0'; weight.max = '100'; weight.step = 'any'; weight.required = true; weight.value = '0';
    weight.className = 'investment-allocation-target-weight';
    weightLabel.append(weight);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-secondary button-small'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => row.remove());
    row.append(keyLabel, weightLabel, remove);
    container.append(row);
}
function refreshTargetRows(ledger) {
    const current = [...$('#investment-allocation-targets').querySelectorAll('.investment-allocation-target-row')].map((row) => ({
        key: row.querySelector('.investment-allocation-target-key').value,
        weight: row.querySelector('.investment-allocation-target-weight').value
    }));
    $('#investment-allocation-targets').replaceChildren();
    for (const item of current) {
        addTargetRow(ledger);
        const row = $('#investment-allocation-targets').lastElementChild;
        if ([...row.querySelector('.investment-allocation-target-key').options].some((option) => option.value === item.key)) row.querySelector('.investment-allocation-target-key').value = item.key;
        row.querySelector('.investment-allocation-target-weight').value = item.weight;
    }
}
function fillAccountOptions(ledger) {
    const currency = $('#investment-allocation-currency').value;
    const select = $('#investment-allocation-account');
    const previous = select.value;
    const accounts = ledger.investmentAccounts.filter((item) => item.currency === currency);
    select.innerHTML = '<option value="">Select account</option>' + accounts.map((item) => '<option value="' + escape(item.id) + '">' + escape(item.name) + ' · ' + escape(item.institution) + '</option>').join('');
    if (accounts.some((item) => item.id === previous)) select.value = previous;
}
function fillPolicySetOptions(policies) {
    const select = $('#investment-allocation-policy-set');
    const previous = select.value;
    const sets = new Map();
    for (const policy of policies) {
        const old = sets.get(policy.policySetId);
        if (!old || policy.version > old.version) sets.set(policy.policySetId, policy);
    }
    select.innerHTML = '<option value="">Create a new policy set</option>' + [...sets.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((policy) => '<option value="' + escape(policy.policySetId) + '">' + escape(policy.name) + ' · v' + policy.version + '</option>').join('');
    if (sets.has(previous)) select.value = previous;
    const analyze = $('#investment-allocation-analyze-set');
    const analyzePrevious = analyze.value;
    analyze.innerHTML = '<option value="">Choose a policy set</option>' + [...sets.values()]
        .sort((x, y) => x.name.localeCompare(y.name))
        .map((policy) => '<option value="' + escape(policy.policySetId) + '">' + escape(policy.name) + ' · v' + policy.version + '</option>').join('');
    if (sets.has(analyzePrevious)) analyze.value = analyzePrevious;
    else if (sets.size === 1) analyze.value = [...sets.keys()][0];
}
function renderPolicies(policies) {
    const body = $('#investment-allocation-policy-rows');
    body.replaceChildren();
    for (const policy of [...policies].sort((a, b) => a.policySetId.localeCompare(b.policySetId) || b.version - a.version)) {
        const row = document.createElement('tr');
        for (const value of [policy.name, policy.version, policy.currency, policy.scope === 'account' ? 'Account: ' + policy.accountId : 'Portfolio',
            policy.groupBy === 'instrumentType' ? 'Instrument type' : 'Instrument', policy.effectiveFrom,
            policy.recordedAt, policy.targets.map((target) => target.key + ' ' + percent(target.weightPercent)).join(', ')]) {
            const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
        }
        body.append(row);
    }
    if (!policies.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 8; cell.textContent = 'No allocation policies have been saved.';
        row.append(cell); body.append(row);
    }
}
function renderAnalysis(ledger, policies) {
    const output = $('#investment-allocation-analysis');
    output.replaceChildren();
    if (!privateWorkspace()) return;
    const policySetId = $('#investment-allocation-analyze-set').value;
    const asOf = $('#investment-allocation-as-of').value;
    if (!policySetId || !asOf) {
        const note = document.createElement('p'); note.className = 'form-note'; note.textContent = 'Choose a policy set and as-of date to calculate allocation drift.';
        output.append(note); return;
    }
    try {
        const [year, month, day] = asOf.split('-').map(Number);
        const asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) throw new Error('Select a valid calendar date.');
        const latest = policies.filter((item) => item.policySetId === policySetId).sort((a, b) => b.version - a.version)[0];
        if (!latest) throw new Error('The selected policy set is unavailable.');
        const recordedAtCutoff = new Date();
        const policy = selectInvestmentAllocationPolicy(policies.filter((item) => item.policySetId === policySetId), {
            asOfDate, recordedAtCutoff, scope: latest.scope, currency: latest.currency, accountId: latest.accountId
        }, { accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments });
        if (!policy || policy.policySetId !== policySetId) {
            const note = document.createElement('p'); note.className = 'form-note';
            note.textContent = 'No version of this policy was both effective and recorded by the selected cutoffs.';
            output.append(note); return;
        }
        const positions = analyzeInvestmentPortfolio({
            accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
            transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations,
            asOfDate, recordedAtCutoff
        });
        const result = analyzeInvestmentAllocation({
            positions, instruments: ledger.investmentInstruments, accounts: ledger.investmentAccounts,
            policy, asOfDate, recordedAtCutoff
        });
        const summary = document.createElement('p'); summary.className = 'form-note';
        if (result.status === 'unavailable') summary.textContent = result.reason;
        else if (result.status === 'empty') summary.textContent = result.message;
        else summary.textContent = 'Policy v' + result.policyVersion + ' · ' + result.currency + ' · Total valued holdings: ' + money(result.totalValue, result.currency)
            + ' · HHI: ' + result.hhi.toFixed(4) + ' · Effective categories: ' + result.effectiveCategoryCount.toFixed(2)
            + '. Drift is descriptive only; no trades or recommendations are generated.';
        output.append(summary);
        if (result.status !== 'available') return;
        const table = document.createElement('table');
        const head = document.createElement('thead'), header = document.createElement('tr');
        for (const label of ['Category', 'Actual value', 'Actual weight', 'Target weight', 'Drift (pp)', 'Value drift']) {
            const cell = document.createElement('th'); cell.textContent = label; header.append(cell);
        }
        head.append(header); table.append(head);
        const body = document.createElement('tbody');
        for (const item of result.rows) {
            const row = document.createElement('tr');
            const instrument = ledger.investmentInstruments.find((entry) => entry.id === item.key);
            const label = policy.groupBy === 'instrument' ? (instrument?.name ?? item.key) : item.key;
            for (const value of [label, money(item.actualValue, result.currency), percent(item.actualWeightPercent),
                percent(item.targetWeightPercent), (item.driftPercentagePoints > 0 ? '+' : '') + item.driftPercentagePoints.toFixed(2),
                money(item.driftValue, result.currency)]) {
                const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
            }
            body.append(row);
        }
        table.append(body);
        const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.append(table); output.append(wrapper);
    } catch (error) {
        const note = document.createElement('p'); note.className = 'validation-message';
        note.textContent = error instanceof Error ? error.message : 'Allocation analysis could not be completed.';
        output.append(note);
    }
}
function render() {
    const panel = $('#investment-allocation-workspace');
    if (!panel) return;
    const privateMode = privateWorkspace();
    $('#investment-allocation-demo-note').hidden = privateMode;
    panel.querySelectorAll('form input, form select, form button, #investment-allocation-analyze-set, #investment-allocation-as-of').forEach((control) => { control.disabled = !privateMode; });
    if (!privateMode) {
        $('#investment-allocation-policy-rows').replaceChildren();
        $('#investment-allocation-analysis').replaceChildren();
        $('#investment-allocation-policy-count').textContent = '0';
        return;
    }
    try {
        const ledger = readLedger();
        const policies = readPolicies(ledger);
        $('#investment-allocation-policy-count').textContent = String(policies.length);
        renderPolicies(policies);
        fillPolicySetOptions(policies);
        fillAccountOptions(ledger);
        renderAnalysis(ledger, policies);
        $('#investment-allocation-error').hidden = true;
        refreshTargetRows(ledger);
    } catch (error) {
        $('#investment-allocation-error').textContent = error instanceof Error ? error.message : 'Allocation policies could not be loaded.';
        $('#investment-allocation-error').hidden = false;
        $('#investment-allocation-policy-rows').replaceChildren();
        $('#investment-allocation-analysis').replaceChildren();
        panel.querySelectorAll('form button').forEach((button) => { button.disabled = true; });
    }
}
export function initializeInvestmentAllocationWorkspace() {
    const panel = $('#investment-allocation-workspace');
    if (!panel) return;
    $('#investment-allocation-currency').innerHTML = CURRENCIES.map((value) => '<option value="' + value + '">' + value + '</option>').join('');
    $('#investment-allocation-group-by').addEventListener('change', () => {
        try { refreshTargetRows(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-currency').addEventListener('change', () => {
        try { fillAccountOptions(readLedger()); refreshTargetRows(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-scope').addEventListener('change', () => {
        $('#investment-allocation-account-row').hidden = $('#investment-allocation-scope').value !== 'account';
    });
    $('#investment-allocation-add-target').addEventListener('click', () => {
        try { addTargetRow(readLedger()); } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-policy-set').addEventListener('change', () => {
        try {
            const ledger = readLedger(), policies = readPolicies(ledger);
            const selected = policies.filter((item) => item.policySetId === $('#investment-allocation-policy-set').value)
                .sort((a, b) => b.version - a.version)[0];
            if (selected) {
                $('#investment-allocation-analyze-set').value = selected.policySetId;
                $('#investment-allocation-name').value = selected.name;
                $('#investment-allocation-currency').value = selected.currency;
                $('#investment-allocation-scope').value = selected.scope;
                fillAccountOptions(ledger);
                $('#investment-allocation-account').value = selected.accountId ?? '';
                $('#investment-allocation-group-by').value = selected.groupBy;
                $('#investment-allocation-account-row').hidden = selected.scope !== 'account';
                refreshTargetRows(ledger);
                const container = $('#investment-allocation-targets'); container.replaceChildren();
                for (const target of selected.targets) {
                    addTargetRow(ledger);
                    const row = container.lastElementChild;
                    row.querySelector('.investment-allocation-target-key').value = target.key;
                    row.querySelector('.investment-allocation-target-weight').value = String(target.weightPercent);
                }
            } else {
                $('#investment-allocation-name').value = '';
                $('#investment-allocation-currency').value = 'INR';
                $('#investment-allocation-scope').value = 'portfolio';
                $('#investment-allocation-group-by').value = 'instrumentType';
                $('#investment-allocation-account-row').hidden = true;
                fillAccountOptions(ledger);
                $('#investment-allocation-targets').replaceChildren();
                addTargetRow(ledger); addTargetRow(ledger);
            }
            renderAnalysis(ledger, policies);
        } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-analyze-set').addEventListener('change', () => {
        try { renderAnalysis(readLedger(), readPolicies(readLedger())); } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-as-of').addEventListener('change', () => {
        try { const ledger = readLedger(); renderAnalysis(ledger, readPolicies(ledger)); } catch (error) { message(error.message, true); }
    });
    $('#investment-allocation-form').addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            if (!privateWorkspace()) throw new Error('Switch to the private workspace before saving an allocation policy.');
            const ledger = readLedger(), policies = readPolicies(ledger);
            const selectedSet = $('#investment-allocation-policy-set').value;
            const existing = selectedSet ? policies.filter((item) => item.policySetId === selectedSet) : [];
            const latest = existing.sort((a, b) => b.version - a.version)[0];
            const currency = $('#investment-allocation-currency').value;
            const scope = $('#investment-allocation-scope').value;
            const accountId = scope === 'account' ? $('#investment-allocation-account').value : undefined;
            const groupBy = $('#investment-allocation-group-by').value;
            if (latest && (latest.currency !== currency || latest.scope !== scope || latest.accountId !== accountId || latest.groupBy !== groupBy)) {
                throw new Error('A new version must retain its policy set currency, scope, account and grouping. Start a new policy set to change those dimensions.');
            }
            const targets = [...$('#investment-allocation-targets').querySelectorAll('.investment-allocation-target-row')].map((row) => ({
                key: row.querySelector('.investment-allocation-target-key').value,
                weightPercent: Number(row.querySelector('.investment-allocation-target-weight').value)
            }));
            const policy = {
                id: crypto.randomUUID(), policySetId: latest?.policySetId ?? crypto.randomUUID(),
                version: latest ? latest.version + 1 : 1,
                name: $('#investment-allocation-name').value.trim(), currency, scope,
                ...(accountId ? { accountId } : {}), groupBy,
                effectiveFrom: $('#investment-allocation-effective-from').value,
                recordedAt: new Date().toISOString(), targets
            };
            const validated = validateInvestmentAllocationPolicies([...policies, policy], {
                accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments
            });
            const confirmed = window.confirm('Save immutable allocation policy ' + policy.name + ' v' + policy.version
                + '? Existing policy versions will remain unchanged. Target weights must total 100%.');
            if (!confirmed) return;
            localStorage.setItem(POLICY_KEY, JSON.stringify(validated));
            $('#investment-allocation-policy-set').value = policy.policySetId;
            $('#investment-allocation-analyze-set').value = policy.policySetId;
            $('#investment-allocation-targets').replaceChildren();
            addTargetRow(ledger); addTargetRow(ledger);
            render();
            window.dispatchEvent(new Event('pfo:investment-allocation-updated'));
            window.dispatchEvent(new Event('pfo:workspace-updated'));
            message('Saved policy version ' + policy.version + '. Prior versions were preserved.');
        } catch (error) { message(error instanceof Error ? error.message : 'Allocation policy could not be saved.', true); }
    });
    window.addEventListener('pfo:workspace-updated', render);
    window.addEventListener('pfo:investment-updated', render);
    const today = new Date().toISOString().slice(0, 10);
    $('#investment-allocation-effective-from').value = today;
    $('#investment-allocation-as-of').value = today;
    render();
}
