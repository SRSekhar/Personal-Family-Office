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

function linkInvestmentTransaction(transactionId, cashAccountId) {
    const ledger = validateInvestmentLedgerCollections(readCollections(ledgerKeys));
    const cash = validateInvestmentCashCollections({ ...ledger, ...readCollections(cashKeys) });
    const target = ledger.investmentTransactions.find((item) => item.id === transactionId);
    const cashAccount = cash.investmentCashAccounts.find((item) => item.id === cashAccountId);
    if (!target || target.cashAccountId !== undefined) throw new Error('The investment transaction is missing or already linked.');
    if (!cashAccount || cashAccount.investmentAccountId !== target.accountId || cashAccount.currency !== target.cashAmount.currency) {
        throw new Error('Choose a cash account belonging to this investment account and currency.');
    }
    const cashAccountLinkedAt = new Date().toISOString();
    const updatedLedger = validateInvestmentLedgerCollections({
        ...ledger,
        investmentTransactions: ledger.investmentTransactions.map((item) =>
            item.id === transactionId ? { ...item, cashAccountId, cashAccountLinkedAt } : item)
    });
    validateInvestmentCashCollections({ ...updatedLedger, ...cash, investmentTransactions: updatedLedger.investmentTransactions });
    const key = ledgerKeys.investmentTransactions;
    const previous = localStorage.getItem(key);
    try {
        localStorage.setItem(key, JSON.stringify(updatedLedger.investmentTransactions));
    } catch (error) {
        try {
            if (previous === null) localStorage.removeItem(key);
            else localStorage.setItem(key, previous);
        } catch {
            throw new Error('Settlement link save failed and browser-storage rollback was incomplete. Stop editing and export/recover the workspace.', { cause: error });
        }
        throw new Error(error instanceof Error ? error.message : 'Settlement link could not be saved; previous transaction data was restored.', { cause: error });
    }
    window.dispatchEvent(new Event('pfo:investment-updated'));
    window.dispatchEvent(new Event('pfo:workspace-updated'));
}
function options(items, label) {
    return '<option value="">Select…</option>' + items.map((item) =>
        '<option value="' + escape(item.id) + '">' + escape(label(item)) + '</option>').join('');
}
function setOptions(selector, items, label) {
    const select = $(selector);
    const previous = select.value;
    select.innerHTML = options(items, label);
    if (items.some((item) => item.id === previous)) select.value = previous;
}
function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function render() {
    const panel = $('#investment-cash-ledger');
    if (!panel) return;
    const isPrivate = privateWorkspace();
    $('#investment-cash-demo-note').hidden = isPrivate;
    if (!isPrivate) {
        $('#investment-cash-error').hidden = true;
        panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = true; });
        panel.querySelectorAll('form input').forEach((control) => { control.value = ''; });
        for (const selector of ['#investment-cash-owner', '#investment-cash-movement-account', '#investment-cash-statement-account',
            '#investment-cash-transfer-source', '#investment-cash-transfer-destination', '#investment-cash-correction-target']) {
            $(selector).replaceChildren();
        }
        for (const id of ['investment-cash-account-count', 'investment-cash-movement-count', 'investment-cash-transfer-count', 'investment-cash-statement-count']) {
            $('#' + id).textContent = '0';
        }
        for (const id of ['investment-cash-account-rows', 'investment-cash-unlinked-transaction-rows', 'investment-cash-movement-rows', 'investment-cash-transfer-rows', 'investment-cash-statement-rows']) {
            $('#' + id).replaceChildren();
        }
        return;
    }
    let data;
    try { data = readData(); }
    catch (error) {
        $('#investment-cash-error').textContent = error instanceof Error ? error.message : 'Cash-ledger data could not be read.';
        $('#investment-cash-error').hidden = false;
        $('#investment-cash-unlinked-transaction-rows').replaceChildren();
        panel.querySelectorAll('form button, button[data-link-transaction]').forEach((button) => { button.disabled = true; });
        return;
    }
    const { ledger, cash } = data;
    $('#investment-cash-error').hidden = true;
    panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = false; });
    $('#investment-cash-account-count').textContent = String(cash.investmentCashAccounts.length);
    $('#investment-cash-movement-count').textContent = String(cash.investmentCashMovements.length);
    $('#investment-cash-transfer-count').textContent = String(cash.investmentCashTransfers.length);
    $('#investment-cash-statement-count').textContent = String(cash.investmentCashStatements.length);

    const accountById = new Map(ledger.investmentAccounts.map((item) => [item.id, item]));
    const cashAccountLabel = (item) => item.name + ' · ' + item.currency;
    setOptions('#investment-cash-owner', ledger.investmentAccounts, (item) => item.name + ' · ' + item.institution + ' · ' + item.currency);
    setOptions('#investment-cash-movement-account', cash.investmentCashAccounts, cashAccountLabel);
    setOptions('#investment-cash-statement-account', cash.investmentCashAccounts, cashAccountLabel);
    setOptions('#investment-cash-transfer-source', cash.investmentCashAccounts, cashAccountLabel);
    setOptions('#investment-cash-transfer-destination', cash.investmentCashAccounts, cashAccountLabel);
    const correctionCashAccountId = $('#investment-cash-movement-account').value;
    setOptions('#investment-cash-correction-target', cash.investmentCashMovements.filter((item) =>
        item.cashAccountId === correctionCashAccountId && item.type !== 'Correction'),
    (item) => item.type + ' · ' + item.effectiveAt.slice(0, 10) + ' · ' + money(item.amount.amount, item.amount.currency));

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
    const unlinkedRows = ledger.investmentTransactions.filter((item) => item.cashAccountId === undefined);
    const unlinkedBody = $('#investment-cash-unlinked-transaction-rows');
    unlinkedBody.replaceChildren();
    if (!unlinkedRows.length) {
        const row = document.createElement('tr'), cell = document.createElement('td');
        cell.colSpan = 7; cell.textContent = 'All recorded investment transactions have explicit cash settlement links.';
        row.append(cell); unlinkedBody.append(row);
    } else {
        const instrumentById = new Map(ledger.investmentInstruments.map((item) => [item.id, item]));
        for (const transaction of unlinkedRows) {
            const owner = accountById.get(transaction.accountId), instrument = instrumentById.get(transaction.instrumentId);
            const row = document.createElement('tr'); row.dataset.transactionId = transaction.id;
            for (const value of [transaction.date.slice(0, 10), owner?.name ?? 'Unknown', instrument?.name ?? 'Unknown', transaction.type]) {
                const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
            }
            const amountCell = document.createElement('td'); amountCell.className = 'align-right';
            amountCell.textContent = money(transaction.cashAmount.amount, transaction.cashAmount.currency); row.append(amountCell);
            const linkCell = document.createElement('td'), select = document.createElement('select');
            select.className = 'investment-cash-link-select'; select.setAttribute('aria-label', 'Settlement cash account for ' + transaction.id);
            const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select cash account…'; select.append(placeholder);
            const candidates = cash.investmentCashAccounts.filter((item) =>
                item.investmentAccountId === transaction.accountId && item.currency === transaction.cashAmount.currency);
            for (const candidate of candidates) {
                const option = document.createElement('option'); option.value = candidate.id;
                option.textContent = candidate.name + ' · ' + candidate.currency; select.append(option);
            }
            linkCell.append(select); row.append(linkCell);
            const actionCell = document.createElement('td'), button = document.createElement('button');
            button.type = 'button'; button.className = 'button button-secondary button-small';
            button.textContent = 'Link'; button.dataset.linkTransaction = 'true'; button.disabled = !isPrivate || candidates.length === 0;
            actionCell.append(button); row.append(actionCell); unlinkedBody.append(row);
        }
    }
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
    updateMovementFields();
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
    $('#investment-cash-movement-account').addEventListener('change', render);
    $('#investment-cash-unlinked-transaction-rows').addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('button[data-link-transaction]') : null;
        if (!button) return;
        const row = button.closest('tr'), transactionId = row?.dataset.transactionId;
        const cashAccountId = row?.querySelector('select')?.value;
        if (!transactionId || !cashAccountId) {
            message('Select a settlement cash account before linking the transaction.');
            return;
        }
        try {
            linkInvestmentTransaction(transactionId, cashAccountId);
            message('Settlement account linked. The transaction financial values were not changed.');
            render();
        } catch (error) {
            message(error instanceof Error ? error.message : 'Settlement account could not be linked.');
        }
    });
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
