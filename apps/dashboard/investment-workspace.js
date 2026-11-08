import { analyzeInvestmentPerformanceMath } from './calculators-runtime/InvestmentPerformanceMath.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentCashCollections } from './investment-cash-ledger.js';
import { initializeInvestmentPortfolioView } from './investment-portfolio.js';
import { initializeInvestmentCashWorkspace } from './investment-cash-workspace.js';
import { initializeInvestmentAllocationWorkspace } from './investment-allocation-workspace.js';

const keys = {
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
const accountTypes = ['Brokerage', 'MutualFund', 'Retirement', 'ProvidentFund', 'FixedDeposit', 'Other'];
const instrumentTypes = ['Equity', 'MutualFund', 'ETF', 'Bond', 'FixedDeposit', 'PublicProvidentFund', 'NationalPensionSystem', 'EmployeesProvidentFund', 'Gold', 'Silver', 'RealEstateInvestment', 'Cryptocurrency', 'AlternativeInvestment', 'Other'];
const transactionTypes = ['Purchase', 'Sale', 'Dividend', 'Interest', 'Fee', 'Tax'];
const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];
const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const money = (value, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const dateAtUtcStart = (date) => new Date(date + 'T00:00:00.000Z').toISOString();

function readLedger() {
    const collections = {};
    for (const [name, key] of Object.entries(keys)) {
        const raw = localStorage.getItem(key);
        const parsed = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Saved ' + name + ' data is not an array.');
        collections[name] = parsed;
    }
    return validateInvestmentLedgerCollections(collections);
}
function readCashAccounts(ledger) {
    const collections = {};
    for (const [name, key] of Object.entries(cashKeys)) {
        const raw = localStorage.getItem(key);
        const parsed = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Saved ' + name + ' data is not an array.');
        collections[name] = parsed;
    }
    return validateInvestmentCashCollections({ ...ledger, ...collections }).investmentCashAccounts;
}
function saveCollection(name, items) {
    const current = readLedger();
    const next = validateInvestmentLedgerCollections({ ...current, [name]: items });
    localStorage.setItem(keys[name], JSON.stringify(next[name]));
    window.dispatchEvent(new Event('pfo:investment-updated'));
    window.dispatchEvent(new Event('pfo:workspace-updated'));
}
function options(items, valueKey, label) {
    return items.map((item) => '<option value="' + escape(item[valueKey]) + '">' + escape(label(item)) + '</option>').join('');
}
function render() {
    const panel = $('#investment-ledger');
    if (!panel) return;
    const privateWorkspace = $('#workspace-label')?.textContent.includes('PRIVATE') === true;
    $('#investment-ledger-demo-note').hidden = privateWorkspace;
    if (!privateWorkspace) {
        $('#investment-ledger-error').hidden = true;
        panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = true; });
        panel.querySelectorAll('form input').forEach((control) => { control.value = ''; });
        for (const id of ['investment-account-count', 'investment-instrument-count', 'investment-transaction-count', 'investment-valuation-count']) {
            $('#' + id).textContent = '0';
        }
        for (const id of ['investment-transaction-account', 'investment-transaction-cash-account', 'investment-transaction-instrument', 'investment-valuation-instrument']) {
            $('#' + id).replaceChildren();
        }
        for (const id of ['investment-account-rows', 'investment-instrument-rows', 'investment-transaction-rows', 'investment-valuation-rows']) {
            $('#' + id).replaceChildren();
        }
        return;
    }
    let ledger;
    try { ledger = readLedger(); }
    catch (error) {
        $('#investment-ledger-error').textContent = error instanceof Error ? error.message : 'Investment data could not be read.';
        $('#investment-ledger-error').hidden = false;
        for (const id of ['investment-account-rows', 'investment-instrument-rows', 'investment-transaction-rows', 'investment-valuation-rows']) {
            $('#' + id).replaceChildren();
        }
        panel.querySelectorAll('form button').forEach((button) => { button.disabled = true; });
        return;
    }
    panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = false; });
    $('#investment-ledger-error').hidden = true;
    $('#investment-account-count').textContent = String(ledger.investmentAccounts.length);
    $('#investment-instrument-count').textContent = String(ledger.investmentInstruments.length);
    $('#investment-transaction-count').textContent = String(ledger.investmentTransactions.length);
    $('#investment-valuation-count').textContent = String(ledger.investmentValuations.length);
    const previousAccountId = $('#investment-transaction-account').value;
    $('#investment-transaction-account').innerHTML = options(ledger.investmentAccounts, 'id', (item) => item.name + ' · ' + item.institution);
    if (ledger.investmentAccounts.some((item) => item.id === previousAccountId)) {
        $('#investment-transaction-account').value = previousAccountId;
    }
    let cashAccounts = [];
    try { cashAccounts = readCashAccounts(ledger); }
    catch { /* the cash-ledger panel reports unreadable cash storage without blocking the rest of the ledger */ }
    const selectedInvestmentAccountId = $('#investment-transaction-account').value || ledger.investmentAccounts[0]?.id;
    const linkedCashAccounts = cashAccounts.filter((item) => item.investmentAccountId === selectedInvestmentAccountId);
    const previousCashAccountId = $('#investment-transaction-cash-account').value;
    $('#investment-transaction-cash-account').innerHTML = '<option value="">Not linked — reconciliation unavailable</option>'
        + options(linkedCashAccounts, 'id', (item) => item.name + ' · ' + item.currency).replace('<option value="">Select…</option>', '');
    if (linkedCashAccounts.some((item) => item.id === previousCashAccountId)) {
        $('#investment-transaction-cash-account').value = previousCashAccountId;
    }
    $('#investment-transaction-instrument').innerHTML = options(ledger.investmentInstruments, 'id', (item) => item.name + ' · ' + item.currency);
    $('#investment-valuation-instrument').innerHTML = options(ledger.investmentInstruments, 'id', (item) => item.name + ' · ' + item.currency);
    $('#investment-account-rows').innerHTML = ledger.investmentAccounts.map((item) => '<tr><td>' + escape(item.name) + '</td><td>' + escape(item.institution) + '</td><td>' + escape(item.type) + '</td><td>' + escape(item.currency) + '</td></tr>').join('');
    $('#investment-instrument-rows').innerHTML = ledger.investmentInstruments.map((item) => '<tr><td>' + escape(item.name) + '</td><td>' + escape(item.type) + '</td><td>' + escape(item.symbol ?? '—') + '</td><td>' + escape(item.currency) + '</td></tr>').join('');
    const instrumentById = new Map(ledger.investmentInstruments.map((item) => [item.id, item]));
    const accountById = new Map(ledger.investmentAccounts.map((item) => [item.id, item]));
    $('#investment-transaction-rows').innerHTML = [...ledger.investmentTransactions].sort((a, b) => b.date.localeCompare(a.date)).map((item) => {
        const instrument = instrumentById.get(item.instrumentId);
        const account = accountById.get(item.accountId);
        return '<tr><td>' + escape(item.date.slice(0, 10)) + '</td><td>' + escape(instrument?.name ?? 'Unknown') + '</td><td>' + escape(account?.name ?? 'Unknown') + '</td><td>' + escape(item.type) + '</td><td class="align-right">' + money(item.cashAmount.amount, item.cashAmount.currency) + '</td></tr>';
    }).join('');
    $('#investment-valuation-rows').innerHTML = [...ledger.investmentValuations].sort((a, b) => b.asOf.localeCompare(a.asOf)).map((item) => {
        const instrument = instrumentById.get(item.instrumentId);
        return '<tr><td>' + escape(item.asOf.slice(0, 10)) + '</td><td>' + escape(instrument?.name ?? 'Unknown') + '</td><td class="align-right">' + money(item.price.amount, item.price.currency) + '</td><td>' + escape(item.sourceName) + '</td></tr>';
    }).join('');
    const hasAccounts = ledger.investmentAccounts.length > 0;
    const hasInstruments = ledger.investmentInstruments.length > 0;
    $('#investment-transaction-form').querySelector('button[type="submit"]').disabled = !privateWorkspace || !hasAccounts || !hasInstruments;
    $('#investment-valuation-form').querySelector('button[type="submit"]').disabled = !privateWorkspace || !hasInstruments;
    $('#investment-transaction-type').dispatchEvent(new Event('change'));
}
function message(text) {
    $('#investment-ledger-message').textContent = text;
    $('#investment-ledger-message').hidden = false;
}
function bindForm(id, handler) {
    $(id).addEventListener('submit', (event) => {
        event.preventDefault();
        try { handler(new FormData(event.currentTarget)); event.currentTarget.reset(); message('Saved locally in this browser.'); render(); }
        catch (error) { message(error instanceof Error ? error.message : 'Could not save investment data.'); }
    });
}
export function initializeInvestmentWorkspace() {
    const accountSelect = $('#investment-account-type');
    const instrumentSelect = $('#investment-instrument-type');
    const transactionSelect = $('#investment-transaction-type');
    const currencyOptions = currencies.map((currency) => '<option value="' + currency + '">' + currency + '</option>').join('');
    accountSelect.innerHTML = accountTypes.map((type) => '<option value="' + type + '">' + type + '</option>').join('');
    instrumentSelect.innerHTML = instrumentTypes.map((type) => '<option value="' + type + '">' + type + '</option>').join('');
    transactionSelect.innerHTML = transactionTypes.map((type) => '<option value="' + type + '">' + type + '</option>').join('');
    $('#investment-account-currency').innerHTML = currencyOptions;
    $('#investment-instrument-currency').innerHTML = currencyOptions;
    $('#investment-transaction-account').addEventListener('change', render);
    $('#investment-transaction-type').addEventListener('change', () => {
        const trade = ['Purchase', 'Sale'].includes(transactionSelect.value);
        $('#investment-trade-fields').hidden = !trade;
        $('#investment-transaction-quantity').required = trade;
        $('#investment-transaction-unit-price').required = trade;
    });
    bindForm('#investment-account-form', (form) => {
        const current = readLedger();
        const next = [...current.investmentAccounts, { id: crypto.randomUUID(), name: String(form.get('name')).trim(),
            institution: String(form.get('institution')).trim(), type: String(form.get('type')), currency: String(form.get('currency')) }];
        saveCollection('investmentAccounts', next);
    });
    bindForm('#investment-instrument-form', (form) => {
        const current = readLedger();
        const symbol = String(form.get('symbol') ?? '').trim();
        const next = [...current.investmentInstruments, { id: crypto.randomUUID(), name: String(form.get('name')).trim(),
            type: String(form.get('type')), currency: String(form.get('currency')), ...(symbol ? { symbol } : {}) }];
        saveCollection('investmentInstruments', next);
    });
    bindForm('#investment-transaction-form', (form) => {
        const current = readLedger();
        const type = String(form.get('type'));
        const account = current.investmentAccounts.find((item) => item.id === form.get('accountId'));
        const instrument = current.investmentInstruments.find((item) => item.id === form.get('instrumentId'));
        if (!account || !instrument) throw new Error('Select an existing investment account and instrument.');
        if (account.currency !== instrument.currency) throw new Error('Account and instrument currencies must match. FX conversion is not supported.');
        const amount = Number(form.get('cashAmount'));
        const cashAccountId = String(form.get('cashAccountId') ?? '').trim();
        const cashAccount = cashAccountId ? readCashAccounts(current).find((item) => item.id === cashAccountId) : null;
        if (cashAccountId && (!cashAccount || cashAccount.investmentAccountId !== account.id || cashAccount.currency !== account.currency)) {
            throw new Error('Select a cash sub-account belonging to the chosen investment account and currency.');
        }
        const trade = type === 'Purchase' || type === 'Sale';
        const recordedAt = new Date().toISOString();
        const item = { id: crypto.randomUUID(), accountId: account.id, instrumentId: instrument.id, type,
            cashAmount: { amount, currency: account.currency }, date: dateAtUtcStart(String(form.get('date'))), recordedAt };
        if (cashAccount) { item.cashAccountId = cashAccount.id; item.cashAccountLinkedAt = recordedAt; }
        if (trade) {
            item.quantity = Number(form.get('quantity'));
            item.unitPrice = { amount: Number(form.get('unitPrice')), currency: account.currency };
        }
        saveCollection('investmentTransactions', [...current.investmentTransactions, item]);
    });
    bindForm('#investment-valuation-form', (form) => {
        const current = readLedger();
        const instrument = current.investmentInstruments.find((item) => item.id === form.get('instrumentId'));
        if (!instrument) throw new Error('Select an existing investment instrument.');
        const observation = { instrumentId: instrument.id, price: { amount: Number(form.get('price')), currency: instrument.currency },
            asOf: dateAtUtcStart(String(form.get('asOf'))), recordedAt: new Date().toISOString(), sourceType: 'manual', sourceName: 'User-entered' };
        saveCollection('investmentValuations', [...current.investmentValuations, observation]);
    });
    window.addEventListener('pfo:investment-updated', render);
    window.addEventListener('pfo:workspace-updated', render);
    render();
    initializeInvestmentPortfolioView(analyzeInvestmentPerformanceMath);
    initializeInvestmentCashWorkspace();
    initializeInvestmentAllocationWorkspace();
}
