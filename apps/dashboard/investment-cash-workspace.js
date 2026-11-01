import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { reconcileInvestmentCashAccount, validateInvestmentCashCollections } from './investment-cash-ledger.js';

const ledgerKeys = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const cashKeys = {
    investmentCashAccounts: 'pfo-os.investment-cash-accounts.v1',
    investmentCashMovements: 'pfo-os.investment-cash-movements.v1',
    investmentCashTransfers: 'pfo-os.investment-cash-transfers.v1',
    investmentCashStatements: 'pfo-os.investment-cash-statements.v1'
};
const movementTypes = ['OpeningBalance', 'ExternalContribution', 'ExternalWithdrawal', 'Correction'];
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const money = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const timestamp = (date) => new Date(date + 'T00:00:00.000Z').toISOString();

function readCollections(keys) {
    const result = {};
    for (const [name, key] of Object.entries(keys)) {
        const raw = localStorage.getItem(key);
        const value = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(value)) throw new Error('Saved ' + name + ' data is not a collection.');
        result[name] = value;
    }
    return result;
}
function readData() {
    const ledger = validateInvestmentLedgerCollections(readCollections(ledgerKeys));
    const cash = validateInvestmentCashCollections({ ...ledger, ...readCollections(cashKeys) });
    return { ledger, cash };
}
function persistCash(cashCollections) {
    const ledger = validateInvestmentLedgerCollections(readCollections(ledgerKeys));
    const validated = validateInvestmentCashCollections({ ...ledger, ...cashCollections });
    const previous = Object.values(cashKeys).map((key) => [key, localStorage.getItem(key)]);
    try {
        for (const [name, key] of Object.entries(cashKeys)) localStorage.setItem(key, JSON.stringify(validated[name]));
    } catch (error) {
        const restored = previous.map(([key, value]) => {
            try {
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, value);
                return true;
            } catch { return false; }
        }).every(Boolean);
        if (!restored) throw new Error('Cash-ledger save failed and browser-storage rollback was incomplete. Stop editing and export/recover the workspace.', { cause: error });
        throw new Error(error instanceof Error ? error.message : 'Cash-ledger data could not be saved. Previous values were restored.', { cause: error });
    }
    window.dispatchEvent(new Event('pfo:investment-updated'));
    window.dispatchEvent(new Event('pfo:workspace-updated'));
}
function options(items, label) {
    return '<option value="">Select…</option>' + items.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(label(item)) + '</option>').join('');
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function render() {
    const panel = $('#investment-cash-ledger');
    if (!panel) return;
    let data;
    try { data = readData(); }
    catch (error) {
        $('#investment-cash-error').textContent = error instanceof Error ? error.message : 'Cash-ledger data could not be read.';
        $('#investment-cash-error').hidden = false;
        panel.querySelectorAll('form button').forEach((button) => { button.disabled = true; });
        return;
    }
    const { ledger, cash } = data;
    const isPrivate = privateWorkspace();
    $('#investment-cash-demo-note').hidden = isPrivate;
    $('#investment-cash-error').hidden = true;
    panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = !isPrivate; });
    $('#investment-cash-account-count').textContent = String(cash.investmentCashAccounts.length);
    $('#investment-cash-movement-count').textContent = String(cash.investmentCashMovements.length);
    $('#investment-cash-transfer-count').textContent = String(cash.investmentCashTransfers.length);
    $('#investment-cash-statement-count').textContent = String(cash.investmentCashStatements.length);

    const accountById = new Map(ledger.investmentAccounts.map((item) => [item.id, item]));
    const cashAccountLabel = (item) => item.name + ' · ' + item.currency;
    $('#investment-cash-owner').innerHTML = options(ledger.investmentAccounts, (item) => item.name + ' · ' + item.institution + ' · ' + item.currency);
    $('#investment-cash-movement-account').innerHTML = options(cash.investmentCashAccounts, cashAccountLabel);
    $('#investment-cash-statement-account').innerHTML = options(cash.investmentCashAccounts, cashAccountLabel);
    $('#investment-cash-transfer-source').innerHTML = options(cash.investmentCashAccounts, cashAccountLabel);
    $('#investment-cash-transfer-destination').innerHTML = options(cash.investmentCashAccounts, cashAccountLabel);
    $('#investment-cash-correction-target').innerHTML = options(cash.investmentCashMovements, (item) => item.type + ' · ' + item.effectiveAt.slice(0, 10) + ' · ' + money(item.amount.amount, item.amount.currency));

    const hasOwners = ledger.investmentAccounts.length > 0;
    const hasCashAccounts = cash.investmentCashAccounts.length > 0;
    $('#investment-cash-account-form').querySelector('button[type="submit"]').disabled = !isPrivate || !hasOwners;
    for (const selector of ['#investment-cash-movement-form', '#investment-cash-statement-form']) {
        $(selector).querySelector('button[type="submit"]').disabled = !isPrivate || !hasCashAccounts;
    }
    $('#investment-cash-transfer-form').querySelector('button[type="submit"]').disabled = !isPrivate || cash.investmentCashAccounts.length < 2;

    const statusRows = cash.investmentCashAccounts.map((item) => {
        const owner = accountById.get(item.investmentAccountId);
        const result = reconcileInvestmentCashAccount({ cashAccountId: item.id, ...cash, investmentTransactions: ledger.investmentTransactions });
        const detail = result.status === 'reconciled'
            ? money(result.expectedBalance.amount, item.currency)
            : result.status === 'difference'
                ? 'Difference ' + money(result.difference.amount, item.currency)
                : result.reason;
        return '<tr><td>' + escape(item.name) + '</td><td>' + escape(owner?.name ?? 'Unknown') + '</td><td>' + escape(item.currency)
            + '</td><td>' + escape(result.status) + '</td><td>' + escape(detail ?? 'Unavailable') + '</td></tr>';
    }).join('');
    $('#investment-cash-account-rows').innerHTML = statusRows;
    $('#investment-cash-movement-rows').innerHTML = [...cash.investmentCashMovements].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt)).map((item) => {
        const account = cash.investmentCashAccounts.find((candidate) => candidate.id === item.cashAccountId);
        return '<tr><td>' + escape(item.effectiveAt.slice(0, 10)) + '</td><td>' + escape(account?.name ?? 'Unknown') + '</td><td>' + escape(item.type)
            + '</td><td class="align-right">' + money(item.amount.amount, item.amount.currency) + '</td><td>' + escape(item.reason ?? item.openingBalanceSource ?? item.externalReference ?? '—') + '</td></tr>';
    }).join('');
    $('#investment-cash-transfer-rows').innerHTML = [...cash.investmentCashTransfers].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt)).map((item) => {
        const source = cash.investmentCashAccounts.find((candidate) => candidate.id === item.sourceCashAccountId);
        const destination = cash.investmentCashAccounts.find((candidate) => candidate.id === item.destinationCashAccountId);
        return '<tr><td>' + escape(item.effectiveAt.slice(0, 10)) + '</td><td>' + escape(source?.name ?? 'Unknown') + '</td><td>' + escape(destination?.name ?? 'Unknown')
            + '</td><td class="align-right">' + money(item.amount.amount, item.amount.currency) + '</td></tr>';
    }).join('');
    $('#investment-cash-statement-rows').innerHTML = [...cash.investmentCashStatements].sort((a, b) => b.statementAsOf.localeCompare(a.statementAsOf)).map((item) => {
        const account = cash.investmentCashAccounts.find((candidate) => candidate.id === item.cashAccountId);
        return '<tr><td>' + escape(item.statementAsOf.slice(0, 10)) + '</td><td>' + escape(account?.name ?? 'Unknown') + '</td><td class="align-right">'
            + money(item.closingBalance.amount, item.closingBalance.currency) + '</td><td>' + escape(item.sourceName) + '</td></tr>';
    }).join('');

}
function message(value) {
    $('#investment-cash-message').textContent = value;
    $('#investment-cash-message').hidden = false;
}
function bindForm(selector, handler) {
    $(selector).addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            handler(new FormData(event.currentTarget));
            event.currentTarget.reset();
            message('Cash-ledger event appended locally. No external bank or broker data was fetched.');
            render();
        } catch (error) {
            message(error instanceof Error ? error.message : 'Cash-ledger event could not be saved.');
        }
    });
}
function updateMovementFields() {
    const type = $('#investment-cash-movement-type').value;
    $('#investment-cash-opening-source-row').hidden = type !== 'OpeningBalance';
    $('#investment-cash-opening-source').required = type === 'OpeningBalance';
    $('#investment-cash-correction-fields').hidden = type !== 'Correction';
    $('#investment-cash-correction-reason').required = type === 'Correction';
    $('#investment-cash-correction-target').required = type === 'Correction';
}
export function initializeInvestmentCashWorkspace() {
    $('#investment-cash-movement-type').innerHTML = movementTypes.map((type) => '<option value="' + type + '">' + type + '</option>').join('');
    $('#investment-cash-movement-type').addEventListener('change', updateMovementFields);
    bindForm('#investment-cash-account-form', (form) => {
        const { ledger, cash } = readData();
        const owner = ledger.investmentAccounts.find((item) => item.id === form.get('investmentAccountId'));
        if (!owner) throw new Error('Select an existing investment account.');
        const account = { id: crypto.randomUUID(), investmentAccountId: owner.id, name: String(form.get('name')).trim(),
            currency: owner.currency, createdAt: new Date().toISOString() };
        persistCash({ ...cash, investmentCashAccounts: [...cash.investmentCashAccounts, account] });
    });
    bindForm('#investment-cash-movement-form', (form) => {
        const { cash } = readData();
        const account = cash.investmentCashAccounts.find((item) => item.id === form.get('cashAccountId'));
        if (!account) throw new Error('Select an existing investment cash account.');
        const type = String(form.get('type'));
        const item = { id: crypto.randomUUID(), cashAccountId: account.id, type,
            amount: { amount: Number(form.get('amount')), currency: account.currency },
            effectiveAt: timestamp(String(form.get('effectiveAt'))), recordedAt: new Date().toISOString() };
        if (type === 'OpeningBalance') item.openingBalanceSource = String(form.get('openingBalanceSource'));
        if (type === 'Correction') {
            item.reason = String(form.get('reason')).trim();
            item.reversesMovementId = String(form.get('reversesMovementId'));
        }
        persistCash({ ...cash, investmentCashMovements: [...cash.investmentCashMovements, item] });
    });
    bindForm('#investment-cash-transfer-form', (form) => {
        const { cash } = readData();
        const item = { id: crypto.randomUUID(), sourceCashAccountId: String(form.get('sourceCashAccountId')),
            destinationCashAccountId: String(form.get('destinationCashAccountId')),
            amount: { amount: Number(form.get('amount')), currency: '' },
            effectiveAt: timestamp(String(form.get('effectiveAt'))), recordedAt: new Date().toISOString() };
        const source = cash.investmentCashAccounts.find((account) => account.id === item.sourceCashAccountId);
        if (!source) throw new Error('Select a valid source cash account.');
        item.amount.currency = source.currency;
        persistCash({ ...cash, investmentCashTransfers: [...cash.investmentCashTransfers, item] });
    });
    bindForm('#investment-cash-statement-form', (form) => {
        const { cash } = readData();
        const account = cash.investmentCashAccounts.find((item) => item.id === form.get('cashAccountId'));
        if (!account) throw new Error('Select an existing investment cash account.');
        const statement = { id: crypto.randomUUID(), cashAccountId: account.id,
            closingBalance: { amount: Number(form.get('closingBalance')), currency: account.currency },
            periodStart: timestamp(String(form.get('periodStart'))), periodEnd: timestamp(String(form.get('periodEnd'))),
            statementAsOf: timestamp(String(form.get('statementAsOf'))), recordedAt: new Date().toISOString(),
            sourceName: String(form.get('sourceName')).trim() };
        persistCash({ ...cash, investmentCashStatements: [...cash.investmentCashStatements, statement] });
    });
    updateMovementFields();
    window.addEventListener('pfo:investment-updated', render);
    window.addEventListener('pfo:workspace-updated', render);
    render();
}
