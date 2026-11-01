import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { reconcileInvestmentCashAccount, validateInvestmentCashCollections } from './investment-cash-ledger.js';

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
export function analyzeInvestmentPortfolio({ accounts, instruments, transactions, valuations, asOfDate, recordedAtCutoff = asOfDate }) {
    if (![accounts, instruments, transactions, valuations].every(Array.isArray)) throw new TypeError('All investment ledger collections must be arrays.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) throw new RangeError('A valid portfolio as-of date is required.');
    if (!(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) throw new RangeError('A valid portfolio recorded-at cutoff is required.');
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
        if (effective > asOfDate.getTime() || recorded > recordedAtCutoff.getTime()) continue;
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
        if (effective > asOfDate.getTime() || recorded > recordedAtCutoff.getTime()) continue;
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
function renderPortfolio(performanceCalculator) {
    const rows = $('#investment-position-rows'), warnings = $('#investment-reconciliation-warnings'), summaries = $('#investment-portfolio-summaries'), performanceSummary = $('#investment-portfolio-performance');
    rows.replaceChildren(); warnings.replaceChildren(); summaries.replaceChildren(); performanceSummary.replaceChildren();
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
        try {
            const cashKeys = {
                investmentCashAccounts: 'pfo-os.investment-cash-accounts.v1',
                investmentCashMovements: 'pfo-os.investment-cash-movements.v1',
                investmentCashTransfers: 'pfo-os.investment-cash-transfers.v1',
                investmentCashStatements: 'pfo-os.investment-cash-statements.v1'
            };
            const cashCollections = {};
            for (const [name, key] of Object.entries(cashKeys)) {
                const raw = localStorage.getItem(key), value = raw === null ? [] : JSON.parse(raw);
                if (!Array.isArray(value)) throw new Error('Saved ' + name + ' data is not a collection.');
                cashCollections[name] = value;
            }
            const performance = analyzeInvestmentPortfolioPerformance({
                accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
                transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations,
                ...cashCollections, asOfDate, recordedAt: new Date(), performanceCalculator
            });
            if (!performance.length) {
                const note = document.createElement('p'); note.className = 'form-note';
                note.textContent = 'Portfolio XIRR will appear when explicit cash accounts, external cash flows and a complete terminal value are recorded.';
                performanceSummary.append(note);
            }
            for (const result of performance) {
                const card = document.createElement('article'); card.className = 'investment-portfolio-card';
                const title = document.createElement('h4'); title.textContent = 'Portfolio XIRR · ' + result.currency; card.append(title);
                const status = document.createElement('p'); status.className = result.status === 'available' ? 'investment-performance-available' : 'investment-reconciliation-warning';
                status.textContent = result.status === 'available'
                    ? new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 2 }).format(result.xirr) + ' annualized money-weighted return'
                    : 'Unavailable — ' + result.reason;
                card.append(status);
                if (result.status === 'available') {
                    for (const [label, amount] of [['Terminal value', result.terminalValue], ['Reconciled cash', result.cashBalance], ['Valued holdings', result.holdingsValue]]) {
                        const line = document.createElement('div'), name = document.createElement('span'), value = document.createElement('strong');
                        name.textContent = label; value.textContent = formatMoney(amount, result.currency); line.append(name, value); card.append(line);
                    }
                    const count = document.createElement('p'); count.className = 'form-note';
                    count.textContent = result.cashFlowCount + ' dated investor cash flows, including terminal value.';
                    card.append(count);
                }
                performanceSummary.append(card);
            }
        } catch (error) {
            const warning = document.createElement('p'); warning.className = 'investment-reconciliation-error';
            warning.textContent = error instanceof Error ? 'Portfolio XIRR unavailable: ' + error.message : 'Portfolio XIRR could not be calculated.';
            performanceSummary.append(warning);
        }
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
export function initializeInvestmentPortfolioView(performanceCalculator) {
    if (!$('#investment-portfolio-analysis')) return;
    $('#investment-portfolio-as-of').value = new Date().toISOString().slice(0, 10);
    $('#investment-portfolio-as-of').addEventListener('change', () => renderPortfolio(performanceCalculator));
    window.addEventListener('pfo:investment-updated', () => renderPortfolio(performanceCalculator)); window.addEventListener('pfo:workspace-updated', () => renderPortfolio(performanceCalculator));
    renderPortfolio(performanceCalculator);
}


/**
 * Calculate a per-currency portfolio XIRR from explicit investor cash flows
 * and a complete terminal value (reconciled cash + valued open positions).
 * Missing cash evidence or missing position valuations makes that currency
 * unavailable; this function never returns a partial performance result.
 */
export function analyzeInvestmentPortfolioPerformance({
    accounts, instruments, transactions, valuations,
    investmentCashAccounts, investmentCashMovements, investmentCashTransfers, investmentCashStatements,
    asOfDate, recordedAt, performanceCalculator
}) {
    if (typeof performanceCalculator !== 'function') throw new TypeError('A supported investment performance calculator is required.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAt instanceof Date) || !Number.isFinite(recordedAt.getTime())) {
        throw new RangeError('Portfolio performance requires valid as-of and recorded-at dates.');
    }
    if (asOfDate.toISOString().slice(0, 10) > recordedAt.toISOString().slice(0, 10)) {
        throw new RangeError('Portfolio XIRR cannot use a future as-of date.');
    }
    const ledger = validateInvestmentLedgerCollections({ investmentAccounts: accounts, investmentInstruments: instruments,
        investmentTransactions: transactions, investmentValuations: valuations });
    const cash = validateInvestmentCashCollections({ ...ledger, investmentCashAccounts, investmentCashMovements,
        investmentCashTransfers, investmentCashStatements });
    // Match the FIFO portfolio's bitemporal rule: both effective and recorded dates must be visible at the selected as-of point.
    const recordedCutoff = new Date(Math.min(recordedAt.getTime(), asOfDate.getTime()));
    const cutoff = recordedCutoff.toISOString();
    const asOf = asOfDate.toISOString();
    const visibleTransactions = cash.investmentTransactions.filter((item) =>
        Date.parse(item.date) <= asOfDate.getTime() && Date.parse(item.recordedAt) <= recordedCutoff.getTime());
    const accountById = new Map(ledger.investmentAccounts.map((item) => [item.id, item]));
    const positions = analyzeInvestmentPortfolio({ accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
        transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations, asOfDate, recordedAtCutoff: recordedCutoff });
    const currencies = [...new Set([
        ...cash.investmentCashAccounts.map((item) => item.currency),
        ...positions.map((item) => item.currency)
    ])].sort();

    return currencies.map((currency) => {
        const cashAccounts = cash.investmentCashAccounts.filter((item) => item.currency === currency);
        const currencyPositions = positions.filter((item) => item.currency === currency);
        const unavailable = (reason) => ({ currency, status: 'unavailable', reason, xirr: null, terminalValue: null,
            cashBalance: null, holdingsValue: null, cashFlowCount: 0 });
        if (cashAccounts.length === 0) return unavailable('No explicit cash accounts exist for this currency.');
        const unlinkedTransactions = visibleTransactions.filter((item) => (item.cashAccountId === undefined
            || (item.cashAccountLinkedAt ?? item.recordedAt) > cutoff)
            && accountById.get(item.accountId)?.currency === currency);
        if (unlinkedTransactions.length > 0) return unavailable('One or more investment transactions are not linked to an explicit cash account.');

        let cashBalance = 0;
        const externalFlows = [];
        for (const account of cashAccounts) {
            const statement = cash.investmentCashStatements
                .filter((item) => item.cashAccountId === account.id && item.statementAsOf <= asOf && item.recordedAt <= cutoff)
                .sort((a, b) => b.statementAsOf.localeCompare(a.statementAsOf) || b.recordedAt.localeCompare(a.recordedAt))[0];
            if (!statement) return unavailable('Cash account "' + account.name + '" has no statement on or before the selected as-of date.');
            const reconciliation = reconcileInvestmentCashAccount({
                cashAccountId: account.id, ...cash, investmentTransactions: ledger.investmentTransactions,
                statementId: statement.id, recordedAt: cutoff
            });
            if (reconciliation.status !== 'reconciled') {
                return unavailable('Cash account "' + account.name + '" is ' + reconciliation.status + ': ' + (reconciliation.reason ?? 'statement difference exists') + '.');
            }

            let currentBalance = statement.closingBalance.amount;
            for (const movement of cash.investmentCashMovements) {
                if (movement.cashAccountId === account.id && movement.effectiveAt > statement.statementAsOf
                    && movement.effectiveAt <= asOf && movement.recordedAt <= cutoff) currentBalance += movement.amount.amount;
            }
            for (const transfer of cash.investmentCashTransfers) {
                if (transfer.effectiveAt > statement.statementAsOf && transfer.effectiveAt <= asOf && transfer.recordedAt <= cutoff) {
                    if (transfer.sourceCashAccountId === account.id) currentBalance -= transfer.amount.amount;
                    if (transfer.destinationCashAccountId === account.id) currentBalance += transfer.amount.amount;
                }
            }
            for (const transaction of ledger.investmentTransactions) {
                if (transaction.cashAccountId === account.id && (transaction.cashAccountLinkedAt ?? transaction.recordedAt) <= cutoff
                    && transaction.date > statement.statementAsOf && transaction.date <= asOf && transaction.recordedAt <= cutoff) {
                    currentBalance += transaction.cashAmount.amount;
                }
            }
            cashBalance += currentBalance;

            for (const movement of cash.investmentCashMovements) {
                if (movement.cashAccountId === account.id && movement.effectiveAt <= asOf && movement.recordedAt <= cutoff
                    && ['OpeningBalance', 'ExternalContribution', 'ExternalWithdrawal', 'Correction'].includes(movement.type)) {
                    if (movement.amount.amount !== 0) externalFlows.push({ date: new Date(movement.effectiveAt), amount: -movement.amount.amount });
                }
            }
        }

        if (!Number.isFinite(cashBalance)) return unavailable('Reconciled cash balance exceeds the supported numeric range.');
        const missingValuation = currencyPositions.find((item) => item.quantity > EPSILON && item.marketValue === null);
        if (missingValuation) return unavailable('Open position "' + missingValuation.instrumentName + '" has no eligible valuation.');
        const holdingsValue = currencyPositions.reduce((sum, item) => sum + (item.marketValue ?? 0), 0);
        const terminalValue = cashBalance + holdingsValue;
        if (!Number.isFinite(terminalValue) || terminalValue <= 0) {
            return unavailable('The complete terminal portfolio value must be positive to calculate XIRR.');
        }
        externalFlows.push({ date: asOfDate, amount: terminalValue });
        try {
            const result = performanceCalculator({ cashFlows: externalFlows });
            return { currency, status: 'available', reason: null, xirr: result.annualizedMoneyWeightedReturn,
                terminalValue, cashBalance, holdingsValue, cashFlowCount: result.cashFlowCount,
                grossContributions: result.grossContributions, grossProceeds: result.grossProceeds,
                netGain: result.netGain, startDate: result.startDate, endDate: result.endDate };
        } catch (error) {
            return unavailable(error instanceof Error ? error.message : 'XIRR could not be calculated for this cash-flow series.');
        }
    });
}
