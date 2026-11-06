import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const keys = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
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
    let ledger;
    try { ledger = readLedger(); }
    catch (error) {
        $('#investment-ledger-error').textContent = error instanceof Error ? error.message : 'Investment data could not be read.';
        $('#investment-ledger-error').hidden = false;
        panel.querySelectorAll('form button').forEach((button) => { button.disabled = true; });
        return;
    }
    const privateWorkspace = $('#workspace-label')?.textContent.includes('PRIVATE');
    $('#investment-ledger-demo-note').hidden = Boolean(privateWorkspace);
    panel.querySelectorAll('form input, form select, form button').forEach((control) => { control.disabled = !privateWorkspace; });
    $('#investment-ledger-error').hidden = true;
    $('#investment-account-count').textContent = String(ledger.investmentAccounts.length);
    $('#investment-instrument-count').textContent = String(ledger.investmentInstruments.length);
    $('#investment-transaction-count').textContent = String(ledger.investmentTransactions.length);
    $('#investment-valuation-count').textContent = String(ledger.investmentValuations.length);
    $('#investment-transaction-account').innerHTML = options(ledger.investmentAccounts, 'id', (item) => item.name + ' · ' + item.institution);
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
        const trade = type === 'Purchase' || type === 'Sale';
        const item = { id: crypto.randomUUID(), accountId: account.id, instrumentId: instrument.id, type,
            cashAmount: { amount, currency: account.currency }, date: dateAtUtcStart(String(form.get('date'))), recordedAt: new Date().toISOString() };
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
}
