import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const EPSILON = 1e-10;
const tradeTypes = new Set(['Purchase', 'Sale']);
const cashTypes = new Set(['Dividend', 'Interest', 'Fee', 'Tax']);
const $ = (selector) => document.querySelector(selector);

function validTime(value, label) {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(time)) throw new RangeError(label + ' must be valid.');
    return time;
}

/** Deterministic FIFO projection from immutable schema-v5 ledger events. No FX or market-data lookup. */
export function analyzeInvestmentPortfolio({ accounts, instruments, transactions, valuations, asOfDate }) {
    if (![accounts, instruments, transactions, valuations].every(Array.isArray)) throw new TypeError('All investment ledger collections must be arrays.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) throw new RangeError('A valid portfolio as-of date is required.');
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    if (accountMap.size !== accounts.length || instrumentMap.size !== instruments.length
        || new Set(transactions.map((item) => item.id)).size !== transactions.length) throw new RangeError('Investment ledger identifiers must be unique.');
    const positions = new Map();
    const ordered = transactions.map((transaction, index) => ({ transaction, index }))
        .sort((a, b) => Date.parse(a.transaction.date) - Date.parse(b.transaction.date) || a.index - b.index);
    for (const { transaction: tx } of ordered) {
        const account = accountMap.get(tx.accountId), instrument = instrumentMap.get(tx.instrumentId);
        if (!account || !instrument) throw new RangeError('Investment transaction references an unknown account or instrument.');
        if (account.currency !== instrument.currency || tx.cashAmount?.currency !== instrument.currency) throw new RangeError('Investment account, instrument and transaction currencies must match; FX conversion is not performed.');
        const effective = validTime(tx.date, 'Investment transaction date'), recorded = validTime(tx.recordedAt, 'Investment transaction recorded-at date');
        const cash = tx.cashAmount.amount;
        if (!Number.isFinite(cash) || cash === 0) throw new RangeError('Investment cash amount must be non-zero and finite.');
        if (effective > asOfDate.getTime() || recorded > asOfDate.getTime()) continue;
        const key = JSON.stringify([tx.accountId, tx.instrumentId]);
        let p = positions.get(key);
        if (!p) {
            p = { accountId: account.id, accountName: account.name, instrumentId: instrument.id, instrumentName: instrument.name,
                currency: instrument.currency, lots: [], realizedGain: 0, dividendIncome: 0, interestIncome: 0, fees: 0, taxes: 0 };
            positions.set(key, p);
        }
        if (tradeTypes.has(tx.type)) {
            const quantity = tx.quantity, price = tx.unitPrice?.amount;
            if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0
                || tx.unitPrice.currency !== instrument.currency || !Number.isFinite(quantity * price)
                || Math.abs(Math.abs(cash) - quantity * price) > 0.01) throw new RangeError('Investment trade quantity, unit price and cash amount do not reconcile.');
            if (tx.type === 'Purchase') {
                if (cash >= 0) throw new RangeError('Purchase cash movement must be negative.');
                p.lots.push({ quantity, unitCost: price });
            } else {
                if (cash <= 0) throw new RangeError('Sale cash movement must be positive.');
                const available = p.lots.reduce((sum, lot) => sum + lot.quantity, 0);
                if (quantity - available > EPSILON) throw new RangeError('Sale quantity exceeds the available FIFO position for ' + instrument.name + ' in ' + account.name + '.');
                let remaining = quantity, cost = 0;
                for (const lot of p.lots) {
                    if (remaining <= EPSILON) break;
                    const used = Math.min(lot.quantity, remaining);
                    cost += used * lot.unitCost; lot.quantity -= used; remaining -= used;
                }
                p.realizedGain += cash - cost;
            }
        } else if (cashTypes.has(tx.type)) {
            if (tx.quantity !== undefined || tx.unitPrice !== undefined) throw new RangeError('Non-trade investment transactions cannot contain quantity or unit price.');
            if ((tx.type === 'Dividend' || tx.type === 'Interest') && cash <= 0) throw new RangeError(tx.type + ' cash movement must be positive.');
            if ((tx.type === 'Fee' || tx.type === 'Tax') && cash >= 0) throw new RangeError(tx.type + ' cash movement must be negative.');
            if (tx.type === 'Dividend') p.dividendIncome += cash;
            if (tx.type === 'Interest') p.interestIncome += cash;
            if (tx.type === 'Fee') p.fees -= cash;
            if (tx.type === 'Tax') p.taxes -= cash;
        } else throw new RangeError('Unsupported investment transaction type: ' + String(tx.type));
    }
    const latest = new Map();
    for (const item of valuations) {
        const instrument = instrumentMap.get(item.instrumentId);
        if (!instrument) throw new RangeError('Investment valuation references an unknown instrument.');
        const price = item.price?.amount;
        if (!Number.isFinite(price) || price < 0 || item.price.currency !== instrument.currency) throw new RangeError('Investment valuation price must be non-negative and match instrument currency.');
        const effective = validTime(item.asOf, 'Investment valuation date'), recorded = validTime(item.recordedAt, 'Investment valuation recorded-at date');
        if (!['manual', 'provider'].includes(item.sourceType) || typeof item.sourceName !== 'string' || !item.sourceName.trim()) throw new RangeError('Investment valuation provenance is invalid.');
        if (effective > asOfDate.getTime() || recorded > asOfDate.getTime()) continue;
        const old = latest.get(item.instrumentId);
        if (!old || effective > old.effective || (effective === old.effective && recorded > old.recorded)) {
            latest.set(item.instrumentId, { effective, recorded, price, asOf: item.asOf, sourceName: item.sourceName, sourceType: item.sourceType });
        }
    }
    return [...positions.values()].map((p) => {
        const quantity = p.lots.reduce((sum, lot) => sum + lot.quantity, 0);
        const costBasis = p.lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0);
        const valuation = latest.get(p.instrumentId), marketValue = valuation ? quantity * valuation.price : null;
        const unrealizedGain = marketValue === null ? null : marketValue - costBasis;
        return { accountId: p.accountId, accountName: p.accountName, instrumentId: p.instrumentId, instrumentName: p.instrumentName,
            currency: p.currency, quantity: Math.abs(quantity) <= EPSILON ? 0 : quantity,
            openLotCount: p.lots.filter((lot) => lot.quantity > EPSILON).length, costBasis, realizedGain: p.realizedGain,
            dividendIncome: p.dividendIncome, interestIncome: p.interestIncome, fees: p.fees, taxes: p.taxes,
            marketPrice: valuation?.price ?? null, marketValue, unrealizedGain,
            netGain: unrealizedGain === null ? null : p.realizedGain + unrealizedGain + p.dividendIncome + p.interestIncome - p.fees - p.taxes,
            valuationAsOf: valuation?.asOf ?? null, valuationSource: valuation?.sourceName ?? null, valuationSourceType: valuation?.sourceType ?? null };
    }).sort((a, b) => a.instrumentName.localeCompare(b.instrumentName) || a.accountName.localeCompare(b.accountName));
}

function readLedger() {
    const keys = { investmentAccounts: 'pfo-os.investment-accounts.v1', investmentInstruments: 'pfo-os.investment-instruments.v1',
        investmentTransactions: 'pfo-os.investment-transactions.v1', investmentValuations: 'pfo-os.investment-valuations.v1' };
    const input = {};
    for (const [name, key] of Object.entries(keys)) {
        const raw = localStorage.getItem(key), value = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(value)) throw new Error('Saved ' + name + ' data is not an array.');
        input[name] = value;
    }
    return validateInvestmentLedgerCollections(input);
}
function addCell(row, value, align = false) {
    const cell = document.createElement('td'); cell.textContent = value;
    if (align) cell.className = 'align-right';
    row.append(cell);
}
function formatMoney(amount, currency) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
function renderPortfolio() {
    const rows = $('#investment-position-rows'), warnings = $('#investment-reconciliation-warnings'), summaries = $('#investment-portfolio-summaries');
    rows.replaceChildren(); warnings.replaceChildren(); summaries.replaceChildren();
    const isPrivate = $('#workspace-label')?.textContent.includes('PRIVATE');
    $('#investment-portfolio-demo-note').hidden = Boolean(isPrivate);
    if (!isPrivate) { const row = document.createElement('tr'); addCell(row, 'Switch to the private workspace to view portfolio positions.'); rows.append(row); return; }
    try {
        const date = $('#investment-portfolio-as-of').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Select a valid portfolio as-of date.');
        const [year, month, day] = date.split('-').map(Number), asOfDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        if (asOfDate.getUTCFullYear() !== year || asOfDate.getUTCMonth() !== month - 1 || asOfDate.getUTCDate() !== day) throw new Error('Select a valid calendar date.');
        const ledger = readLedger();
        const positions = analyzeInvestmentPortfolio({ accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
            transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations, asOfDate });
        for (const currency of [...new Set(positions.map((p) => p.currency))].sort()) {
            const items = positions.filter((p) => p.currency === currency), missing = items.some((p) => p.quantity > 0 && p.marketValue === null);
            const total = (field) => items.reduce((sum, p) => sum + p[field], 0);
            const card = document.createElement('article'); card.className = 'investment-portfolio-card';
            const title = document.createElement('h4'); title.textContent = 'Portfolio totals · ' + currency; card.append(title);
            const metrics = [['Open cost basis', formatMoney(total('costBasis'), currency)],
                ['Market value', missing ? 'Unavailable — valuation missing' : formatMoney(total('marketValue'), currency)],
                ['Realised P&L', formatMoney(total('realizedGain'), currency)],
                ['Unrealised P&L', missing ? 'Unavailable — valuation missing' : formatMoney(total('unrealizedGain'), currency)],
                ['Dividends + interest', formatMoney(total('dividendIncome') + total('interestIncome'), currency)],
                ['Fees + taxes', formatMoney(total('fees') + total('taxes'), currency)]];
            for (const [label, value] of metrics) { const line = document.createElement('div'), name = document.createElement('span'), amount = document.createElement('strong'); name.textContent = label; amount.textContent = value; line.append(name, amount); card.append(line); }
            summaries.append(card);
        }
        for (const p of positions) {
            const row = document.createElement('tr');
            addCell(row, p.instrumentName); addCell(row, p.accountName); addCell(row, p.currency);
            addCell(row, new Intl.NumberFormat('en-IN', { maximumFractionDigits: 8 }).format(p.quantity), true);
            addCell(row, formatMoney(p.costBasis, p.currency), true);
            addCell(row, p.marketValue === null ? 'Unavailable' : formatMoney(p.marketValue, p.currency), true);
            addCell(row, formatMoney(p.realizedGain, p.currency), true);
            addCell(row, p.unrealizedGain === null ? 'Unavailable' : formatMoney(p.unrealizedGain, p.currency), true);
            addCell(row, p.netGain === null ? 'Unavailable' : formatMoney(p.netGain, p.currency), true);
            addCell(row, p.valuationAsOf ? new Date(p.valuationAsOf).toLocaleDateString('en-IN', { timeZone: 'UTC' }) + ' · ' + p.valuationSource : p.quantity > 0 ? 'Missing' : '—');
            rows.append(row);
            if (p.quantity > 0 && p.marketValue === null) { const warning = document.createElement('p'); warning.className = 'investment-reconciliation-warning';
                warning.textContent = p.instrumentName + ' in ' + p.accountName + ' has an open quantity but no valuation on or before ' + date + '. Market value and unrealised P&L are unavailable.'; warnings.append(warning); }
        }
        if (!positions.length) { const row = document.createElement('tr'); addCell(row, 'No investment transactions are recorded on or before ' + date + '.'); rows.append(row); }
        if (!warnings.childElementCount) { const note = document.createElement('p'); note.className = 'form-note'; note.textContent = 'No missing-valuation or FIFO quantity exceptions were found for this as-of date.'; warnings.append(note); }
    } catch (error) {
        const warning = document.createElement('p'); warning.className = 'investment-reconciliation-error';
        warning.textContent = error instanceof Error ? error.message : 'Investment portfolio analysis could not be completed.'; warnings.append(warning);
    }
}
export function initializeInvestmentPortfolioView() {
    if (!$('#investment-portfolio-analysis')) return;
    $('#investment-portfolio-as-of').value = new Date().toISOString().slice(0, 10);
    $('#investment-portfolio-as-of').addEventListener('change', renderPortfolio);
    window.addEventListener('pfo:investment-updated', renderPortfolio); window.addEventListener('pfo:workspace-updated', renderPortfolio);
    renderPortfolio();
}
