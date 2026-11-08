import { analyzeInvestmentPortfolio as analyzePortfolio } from './investment-portfolio.js';
import { reconcileInvestmentCashAccount, validateInvestmentCashCollections } from './investment-cash-ledger.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const externalMovementTypes = new Set(['OpeningBalance', 'ExternalContribution', 'ExternalWithdrawal']);
const cashMovementTime = (value, label) => {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(time)) throw new RangeError(label + ' must be a valid timestamp.');
    return time;
};
const validMoney = (value, label) => {
    if (!Number.isFinite(value)) throw new RangeError(label + ' exceeds the supported numeric range.');
    return value;
};

/**
 * Calculate XIRR by currency from explicit external investor flows and a complete
 * terminal value. Every cash account must reconcile to a statement baseline; later
 * ledger events are projected from that baseline through the requested as-of date.
 */
export function analyzeInvestmentPortfolioXirr({
    investmentAccounts, investmentInstruments, investmentTransactions, investmentValuations,
    investmentCashAccounts, investmentCashMovements, investmentCashTransfers, investmentCashStatements,
    asOfDate, calculatePerformance
}) {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) throw new RangeError('A valid portfolio XIRR as-of date is required.');
    if (typeof calculatePerformance !== 'function') throw new TypeError('The shared investment performance calculator is required.');
    const ledger = validateInvestmentLedgerCollections({ investmentAccounts, investmentInstruments, investmentTransactions, investmentValuations });
    const cash = validateInvestmentCashCollections({ ...ledger, investmentCashAccounts, investmentCashMovements, investmentCashTransfers, investmentCashStatements });
    const asOfTime = asOfDate.getTime();
    const cutoff = asOfDate.toISOString();
    const positions = analyzePortfolio({ accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments,
        transactions: ledger.investmentTransactions, valuations: ledger.investmentValuations, asOfDate });
    const unavailable = [];
    for (const position of positions) {
        if (position.quantity > 0 && position.marketValue === null) {
            unavailable.push('Missing terminal valuation for ' + position.instrumentName + ' in ' + position.accountName + '.');
        }
    }

    const activeAccountIds = new Set(ledger.investmentTransactions
        .filter((item) => cashMovementTime(item.date, 'Investment transaction date') <= asOfTime
            && cashMovementTime(item.recordedAt, 'Investment transaction recordedAt') <= asOfTime)
        .map((item) => item.accountId));
    for (const position of positions) if (position.quantity > 0) activeAccountIds.add(position.accountId);
    const cashByOwner = new Map();
    for (const account of cash.investmentCashAccounts) {
        const list = cashByOwner.get(account.investmentAccountId) ?? [];
        list.push(account);
        cashByOwner.set(account.investmentAccountId, list);
    }
    for (const accountId of activeAccountIds) {
        if (!(cashByOwner.get(accountId)?.length)) unavailable.push('Investment account ' + accountId + ' has ledger activity but no explicitly created cash sub-account.');
    }
    for (const account of cash.investmentCashAccounts) {
        if (cashMovementTime(account.createdAt, 'Cash account createdAt') > asOfTime) continue;
        const statements = cash.investmentCashStatements.filter((item) => item.cashAccountId === account.id
            && cashMovementTime(item.statementAsOf, 'Cash statement date') <= asOfTime
            && cashMovementTime(item.recordedAt, 'Cash statement recordedAt') <= asOfTime)
            .sort((a, b) => b.statementAsOf.localeCompare(a.statementAsOf) || b.recordedAt.localeCompare(a.recordedAt));
        const statement = statements[0];
        if (!statement) {
            unavailable.push('Cash account ' + account.name + ' has no statement observation on or before the selected as-of date.');
            continue;
        }
        const reconciliation = reconcileInvestmentCashAccount({
            cashAccountId: account.id, ...cash, investmentTransactions: ledger.investmentTransactions,
            statementId: statement.id, recordedAt: cutoff
        });
        if (reconciliation.status !== 'reconciled' || !reconciliation.expectedBalance) {
            unavailable.push('Cash account ' + account.name + ' is ' + reconciliation.status + ': ' + (reconciliation.reason ?? 'statement balance does not reconcile.'));
            continue;
        }
        let balance = reconciliation.expectedBalance.amount;
        const afterStatement = (time) => time > Date.parse(statement.statementAsOf) && time <= asOfTime;
        for (const movement of cash.investmentCashMovements) {
            if (movement.cashAccountId === account.id && afterStatement(cashMovementTime(movement.effectiveAt, 'Cash movement date'))
                && cashMovementTime(movement.recordedAt, 'Cash movement recordedAt') <= asOfTime) {
                balance += movement.amount.amount;
            }
        }
        for (const transfer of cash.investmentCashTransfers) {
            if (!afterStatement(cashMovementTime(transfer.effectiveAt, 'Cash transfer date'))
                || cashMovementTime(transfer.recordedAt, 'Cash transfer recordedAt') > asOfTime) continue;
            if (transfer.sourceCashAccountId === account.id) balance -= transfer.amount.amount;
            if (transfer.destinationCashAccountId === account.id) balance += transfer.amount.amount;
        }
        const laterTransactions = ledger.investmentTransactions.filter((item) => item.accountId === account.investmentAccountId
            && afterStatement(cashMovementTime(item.date, 'Investment transaction date'))
            && cashMovementTime(item.recordedAt, 'Investment transaction recordedAt') <= asOfTime);
        const unlinked = laterTransactions.filter((item) => item.cashAccountId === undefined);
        if (unlinked.length) {
            unavailable.push('Cash account ' + account.name + ' has ' + unlinked.length + ' investment transaction(s) after its latest statement without cash-account links.');
            continue;
        }
        for (const transaction of laterTransactions) if (transaction.cashAccountId === account.id) balance += transaction.cashAmount.amount;
        account.terminalBalance = validMoney(balance, 'Cash account balance');
        account.terminalCurrency = account.currency;
    }

    const byCurrency = new Map();
    const getGroup = (currency) => {
        if (!byCurrency.has(currency)) byCurrency.set(currency, { currency, cashFlows: [], holdingsValue: 0, cashBalance: 0, cashAccountCount: 0, unavailable: [] });
        return byCurrency.get(currency);
    };
    for (const position of positions) {
        const group = getGroup(position.currency);
        if (position.quantity > 0) {
            if (position.marketValue === null) group.unavailable.push('Missing valuation for ' + position.instrumentName + '.');
            else group.holdingsValue += position.marketValue;
        }
    }
    for (const account of cash.investmentCashAccounts) {
        if (cashMovementTime(account.createdAt, 'Cash account createdAt') > asOfTime) continue;
        const group = getGroup(account.currency);
        if (typeof account.terminalBalance !== 'number') {
            group.unavailable.push('Cash balance unavailable for ' + account.name + '.');
            continue;
        }
        group.cashBalance += account.terminalBalance;
        group.cashAccountCount += 1;
        const movements = cash.investmentCashMovements.filter((item) => item.cashAccountId === account.id
            && cashMovementTime(item.effectiveAt, 'Cash movement date') <= asOfTime
            && cashMovementTime(item.recordedAt, 'Cash movement recordedAt') <= asOfTime);
        const movementById = new Map(movements.map((item) => [item.id, item]));
        for (const movement of movements) {
            let root = movement;
            const visited = new Set();
            while (root.type === 'Correction') {
                if (visited.has(root.id)) throw new RangeError('Cash correction references contain a cycle.');
                visited.add(root.id);
                const parent = movementById.get(root.reversesMovementId);
                if (!parent) throw new RangeError('Cash correction ancestry is unavailable for ' + movement.id + '.');
                root = parent;
            }
            if (externalMovementTypes.has(root.type)) {
                group.cashFlows.push({ date: new Date(movement.effectiveAt), amount: -movement.amount.amount });
            }
        }
    }
    const results = [];
    for (const group of [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))) {
        const terminalValue = validMoney(group.holdingsValue + group.cashBalance, 'Portfolio terminal value');
        const reasons = [...unavailable, ...group.unavailable];
        if (reasons.length) {
            results.push({ currency: group.currency, status: 'unavailable', reason: [...new Set(reasons)].join(' ') });
            continue;
        }
        if (!(terminalValue > 0)) {
            results.push({ currency: group.currency, status: 'unavailable', reason: 'Terminal portfolio value must be positive to calculate XIRR.' });
            continue;
        }
        const cashFlows = [...group.cashFlows, { date: asOfDate, amount: terminalValue }];
        try {
            const performance = calculatePerformance({ cashFlows });
            results.push({ currency: group.currency, status: 'available', performance, terminalValue,
                holdingsValue: group.holdingsValue, cashBalance: group.cashBalance, cashAccountCount: group.cashAccountCount });
        } catch (error) {
            results.push({ currency: group.currency, status: 'unavailable',
                reason: error instanceof Error ? error.message : 'XIRR could not be calculated for this currency.' });
        }
    }
    return results;
}

