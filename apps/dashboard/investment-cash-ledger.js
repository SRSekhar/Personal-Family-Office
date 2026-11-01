const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const MOVEMENT_TYPES = new Set(['OpeningBalance', 'ExternalContribution', 'ExternalWithdrawal', 'Correction']);

function text(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(label + ' must be a non-empty string.');
    return value.trim();
}
function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical ISO-8601 timestamp.');
    }
    return value;
}
function amount(value, label) {
    if (!value || typeof value !== 'object' || !Number.isFinite(value.amount)
        || typeof value.currency !== 'string' || !CURRENCIES.has(value.currency)) {
        throw new Error(label + ' must contain a finite amount and supported currency.');
    }
    return { amount: value.amount, currency: value.currency };
}
function unique(items, label) {
    const seen = new Set();
    for (const item of items) {
        const id = text(item?.id, label + ' ID');
        if (seen.has(id)) throw new Error(label + ' IDs must be unique.');
        seen.add(id);
    }
}
function byRecordedAndEffectiveDate(items, effectiveKey, asOf, recordedCutoff) {
    return items.filter((item) => item[effectiveKey] <= asOf && item.recordedAt <= recordedCutoff)
        .sort((a, b) => a[effectiveKey].localeCompare(b[effectiveKey]) || a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
}

/** Validate schema-v6 cash collections without inferring balances or creating cash accounts. */
export function validateInvestmentCashCollections(input) {
    if (!input || typeof input !== 'object') throw new Error('Investment cash collections are required.');
    const { investmentAccounts, investmentCashAccounts, investmentCashMovements, investmentCashTransfers, investmentCashStatements,
        investmentTransactions } = input;
    for (const [items, label] of [
        [investmentAccounts, 'Investment accounts'], [investmentCashAccounts, 'Investment cash accounts'],
        [investmentCashMovements, 'Investment cash movements'], [investmentCashTransfers, 'Investment cash transfers'],
        [investmentCashStatements, 'Investment cash statements'], [investmentTransactions, 'Investment transactions']
    ]) if (!Array.isArray(items)) throw new Error(label + ' must be arrays.');

    const accounts = new Map(investmentAccounts.map((item) => [text(item?.id, 'Investment account ID'), item]));
    const cashAccounts = investmentCashAccounts.map((item) => {
        const id = text(item?.id, 'Investment cash account ID');
        const investmentAccountId = text(item.investmentAccountId, 'Owning investment account ID');
        const owner = accounts.get(investmentAccountId);
        if (!owner) throw new Error('Investment cash account references an unknown investment account.');
        const currency = text(item.currency, 'Investment cash account currency');
        if (!CURRENCIES.has(currency) || currency !== owner.currency) throw new Error('Investment cash account currency must match its owning investment account.');
        if (typeof item.name !== 'string' || item.name.trim() === '') throw new Error('Investment cash account name must be a non-empty string.');
        return { id, investmentAccountId, name: item.name.trim(), currency,
            createdAt: timestamp(item.createdAt, 'Cash account createdAt') };
    });
    unique(cashAccounts, 'Investment cash account');
    const cashById = new Map(cashAccounts.map((item) => [item.id, item]));

    const movements = investmentCashMovements.map((item) => {
        const id = text(item?.id, 'Cash movement ID');
        const cashAccountId = text(item.cashAccountId, 'Cash movement account ID');
        const cashAccount = cashById.get(cashAccountId);
        if (!cashAccount) throw new Error('Cash movement references an unknown cash account.');
        const type = text(item.type, 'Cash movement type');
        if (!MOVEMENT_TYPES.has(type)) throw new Error('Cash movement type is unsupported.');
        const cashAmount = amount(item.amount, 'Cash movement amount');
        if (cashAmount.currency !== cashAccount.currency) throw new Error('Cash movement currency must match its cash account.');
        if (type === 'ExternalContribution' && cashAmount.amount <= 0) throw new Error('External contribution must increase cash.');
        if (type === 'ExternalWithdrawal' && cashAmount.amount >= 0) throw new Error('External withdrawal must decrease cash.');
        if (type === 'Correction' && (!Number.isFinite(cashAmount.amount) || cashAmount.amount === 0
            || typeof item.reason !== 'string' || item.reason.trim() === '' || typeof item.reversesMovementId !== 'string' || item.reversesMovementId.trim() === '')) {
            throw new Error('Cash correction requires a non-zero amount, reason, and original movement reference.');
        }
        if (type === 'OpeningBalance' && item.openingBalanceSource !== 'statement' && item.openingBalanceSource !== 'manual') {
            throw new Error('Opening balance requires an explicit statement or manual source.');
        }
        if (cashAmount.amount === 0 && type !== 'OpeningBalance') throw new Error('Cash movement amount must be non-zero unless it is an explicit opening balance.');
        return { id, cashAccountId, type, amount: cashAmount,
            effectiveAt: timestamp(item.effectiveAt, 'Cash movement effectiveAt'),
            recordedAt: timestamp(item.recordedAt, 'Cash movement recordedAt'),
            ...(item.externalReference === undefined ? {} : { externalReference: text(item.externalReference, 'Cash movement external reference') }),
            ...(item.reason === undefined ? {} : { reason: text(item.reason, 'Cash movement reason') }),
            ...(item.reversesMovementId === undefined ? {} : { reversesMovementId: text(item.reversesMovementId, 'Reversed movement ID') }),
            ...(item.openingBalanceSource === undefined ? {} : { openingBalanceSource: item.openingBalanceSource }) };
    });
    unique(movements, 'Cash movement');
    const movementById = new Map(movements.map((item) => [item.id, item]));
    for (const movement of movements) if (movement.reversesMovementId) {
        const original = movementById.get(movement.reversesMovementId);
        if (!original) throw new Error('Cash correction references an unknown original movement.');
        if (original.id === movement.id || original.type === 'Correction' || original.cashAccountId !== movement.cashAccountId) {
            throw new Error('Cash correction must reference a different, non-correction movement in the same cash account.');
        }
        if (movement.effectiveAt < original.effectiveAt || movement.recordedAt < original.recordedAt) {
            throw new Error('Cash correction cannot predate its referenced movement.');
        }
    }
    const openingByAccount = new Map();
    for (const movement of movements) if (movement.type === 'OpeningBalance') {
        const opening = openingByAccount.get(movement.cashAccountId);
        if (opening) throw new Error('A cash account can have only one explicit opening-balance event.');
        openingByAccount.set(movement.cashAccountId, movement);
    }
    for (const movement of movements) {
        const opening = openingByAccount.get(movement.cashAccountId);
        if (opening && movement.effectiveAt < opening.effectiveAt) {
            throw new Error('Cash movements cannot predate the explicit opening-balance baseline.');
        }
    }

    const transfers = investmentCashTransfers.map((item) => {
        const id = text(item?.id, 'Cash transfer ID');
        const sourceCashAccountId = text(item.sourceCashAccountId, 'Transfer source account ID');
        const destinationCashAccountId = text(item.destinationCashAccountId, 'Transfer destination account ID');
        const source = cashById.get(sourceCashAccountId);
        const destination = cashById.get(destinationCashAccountId);
        if (!source || !destination) throw new Error('Cash transfer references an unknown cash account.');
        if (sourceCashAccountId === destinationCashAccountId) throw new Error('Cash transfer source and destination must differ.');
        if (source.currency !== destination.currency) throw new Error('Cross-currency cash transfers are not supported.');
        const transferAmount = amount(item.amount, 'Cash transfer amount');
        if (transferAmount.amount <= 0 || transferAmount.currency !== source.currency) throw new Error('Cash transfer amount must be positive and match both cash accounts.');
        return { id, sourceCashAccountId, destinationCashAccountId, amount: transferAmount,
            effectiveAt: timestamp(item.effectiveAt, 'Transfer effectiveAt'), recordedAt: timestamp(item.recordedAt, 'Transfer recordedAt'),
            ...(item.externalReference === undefined ? {} : { externalReference: text(item.externalReference, 'Transfer external reference') }) };
    });
    unique(transfers, 'Cash transfer');

    const statements = investmentCashStatements.map((item) => {
        const id = text(item?.id, 'Cash statement ID');
        const cashAccount = cashById.get(text(item.cashAccountId, 'Statement cash account ID'));
        if (!cashAccount) throw new Error('Cash statement references an unknown cash account.');
        const closingBalance = amount(item.closingBalance, 'Statement closing balance');
        if (closingBalance.currency !== cashAccount.currency) throw new Error('Statement currency must match its cash account.');
        const periodStart = timestamp(item.periodStart, 'Statement periodStart');
        const periodEnd = timestamp(item.periodEnd, 'Statement periodEnd');
        const statementAsOf = timestamp(item.statementAsOf, 'Statement statementAsOf');
        if (periodStart > periodEnd || statementAsOf < periodStart || statementAsOf > periodEnd) throw new Error('Cash statement period is invalid.');
        return { id, cashAccountId: cashAccount.id, closingBalance, periodStart, periodEnd, statementAsOf,
            recordedAt: timestamp(item.recordedAt, 'Statement recordedAt'), sourceName: text(item.sourceName, 'Statement source name'),
            ...(item.externalReference === undefined ? {} : { externalReference: text(item.externalReference, 'Statement external reference') }) };
    });
    unique(statements, 'Cash statement');

    const transactions = investmentTransactions.map((item) => {
        if (item.cashAccountId === undefined) return { ...item };
        const cashAccount = cashById.get(text(item.cashAccountId, 'Transaction cash account ID'));
        if (!cashAccount) throw new Error('Investment transaction references an unknown cash account.');
        const owner = accounts.get(item.accountId);
        if (!owner || cashAccount.investmentAccountId !== owner.id) throw new Error('Transaction cash account must belong to the transaction investment account.');
        if (item.cashAmount?.currency !== cashAccount.currency) throw new Error('Transaction currency must match its linked cash account.');
        const cashAccountLinkedAt = item.cashAccountLinkedAt ?? item.recordedAt;
        timestamp(cashAccountLinkedAt, 'Investment transaction cash-account link recordedAt');
        if (cashAccountLinkedAt < item.recordedAt) throw new Error('Cash-account link cannot predate the investment transaction record.');
        return { ...item, cashAccountId: cashAccount.id, cashAccountLinkedAt };
    });
    for (const account of cashAccounts) {
        const opening = openingByAccount.get(account.id);
        if (!opening) continue;
        for (const transaction of transactions) if (transaction.cashAccountId === account.id && transaction.date < opening.effectiveAt) {
            throw new Error('Linked investment transactions cannot predate the explicit cash opening-balance baseline.');
        }
        for (const transfer of transfers) if ((transfer.sourceCashAccountId === account.id || transfer.destinationCashAccountId === account.id)
            && transfer.effectiveAt < opening.effectiveAt) {
            throw new Error('Cash transfers cannot predate the explicit cash opening-balance baseline.');
        }
    }

    return { investmentCashAccounts: cashAccounts, investmentCashMovements: movements,
        investmentCashTransfers: transfers, investmentCashStatements: statements, investmentTransactions: transactions };
}

/**
 * Reconcile one cash account to one statement. A real opening-balance event is mandatory;
 * unlinked legacy investment transactions make the result incomplete, never silently zero.
 */
export function reconcileInvestmentCashAccount({ cashAccountId, investmentCashAccounts, investmentCashMovements,
    investmentCashTransfers, investmentCashStatements, investmentTransactions, statementId, recordedAt = new Date().toISOString() }) {
    const cashAccount = investmentCashAccounts.find((item) => item.id === cashAccountId);
    if (!cashAccount) throw new Error('A known investment cash account is required for reconciliation.');
    timestamp(recordedAt, 'Reconciliation recordedAt');
    const statement = statementId
        ? investmentCashStatements.find((item) => item.id === statementId && item.cashAccountId === cashAccountId)
        : investmentCashStatements.filter((item) => item.cashAccountId === cashAccountId && item.recordedAt <= recordedAt)
            .sort((a, b) => b.statementAsOf.localeCompare(a.statementAsOf) || b.recordedAt.localeCompare(a.recordedAt))[0];
    if (!statement || statement.recordedAt > recordedAt) return { status: 'incomplete', reason: 'No eligible statement observation exists.', expectedBalance: null, statementBalance: null, difference: null };
    const movements = byRecordedAndEffectiveDate(investmentCashMovements.filter((item) => item.cashAccountId === cashAccountId),
        'effectiveAt', statement.statementAsOf, recordedAt);
    const opening = movements.filter((item) => item.type === 'OpeningBalance');
    const missingOpening = opening.length === 0;
    const linkedTransactions = investmentTransactions.filter((item) => item.accountId === cashAccount.investmentAccountId
        && item.date <= statement.statementAsOf && item.recordedAt <= recordedAt);
    const unmatchedTransactions = linkedTransactions.filter((item) => item.cashAccountId === undefined
        || (item.cashAccountLinkedAt ?? item.recordedAt) > recordedAt);
    const transfers = byRecordedAndEffectiveDate(investmentCashTransfers.filter((item) =>
        item.sourceCashAccountId === cashAccountId || item.destinationCashAccountId === cashAccountId),
    'effectiveAt', statement.statementAsOf, recordedAt);
    let expected = movements.reduce((sum, item) => sum + item.amount.amount, 0);
    for (const transfer of transfers) expected += transfer.destinationCashAccountId === cashAccountId ? transfer.amount.amount : -transfer.amount.amount;
    for (const transaction of linkedTransactions.filter((item) => item.cashAccountId === cashAccountId
        && (item.cashAccountLinkedAt ?? item.recordedAt) <= recordedAt)) expected += transaction.cashAmount.amount;
    const unmatchedCount = unmatchedTransactions.length;
    if (missingOpening || unmatchedCount > 0) return {
        status: 'incomplete', reason: missingOpening ? 'An explicit opening balance is missing.' : 'One or more investment transactions are not linked to this cash account.',
        expectedBalance: null, statementBalance: statement.closingBalance, difference: null,
        eventCount: movements.length + transfers.length + linkedTransactions.length, unmatchedCount, coverageStart: statement.periodStart, coverageEnd: statement.statementAsOf
    };
    const difference = expected - statement.closingBalance.amount;
    const tolerance = cashAccount.currency === 'JPY' ? 1 : 0.01;
    return { status: Math.abs(difference) <= tolerance ? 'reconciled' : 'difference',
        expectedBalance: { amount: expected, currency: cashAccount.currency }, statementBalance: statement.closingBalance,
        difference: { amount: difference, currency: cashAccount.currency }, eventCount: movements.length + transfers.length + linkedTransactions.length,
        unmatchedCount: 0, coverageStart: statement.periodStart, coverageEnd: statement.statementAsOf };
}

/** External investor flows only. Transfers and instrument transactions are intentionally excluded. */
export function buildInvestmentExternalCashFlows({ cashAccountId, investmentCashMovements, recordedAt }) {
    timestamp(recordedAt, 'Cash-flow recordedAt');
    return investmentCashMovements.filter((item) => item.cashAccountId === cashAccountId && item.recordedAt <= recordedAt
        && (item.type === 'OpeningBalance' || item.type === 'ExternalContribution' || item.type === 'ExternalWithdrawal' || item.type === 'Correction'))
        .map((item) => ({ date: new Date(item.effectiveAt), amount: -item.amount.amount, currency: item.amount.currency, sourceId: item.id }))
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.sourceId.localeCompare(b.sourceId));
}
