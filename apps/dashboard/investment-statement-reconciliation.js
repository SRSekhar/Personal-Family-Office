import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const TRANSACTION_TYPES = new Set(['Purchase', 'Sale', 'Dividend', 'Interest', 'Fee', 'Tax']);
const EPSILON = 1e-8;
const MONEY_TOLERANCE = 0.01;

function text(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(label + ' must be a non-empty string.');
    return value.trim();
}
function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}
function unique(items, label) {
    const seen = new Set();
    for (const item of items) {
        const id = text(item?.id, label + ' ID');
        if (seen.has(id)) throw new Error(label + ' IDs must be unique.');
        seen.add(id);
    }
}
function money(value, label) {
    if (!value || typeof value !== 'object' || !Number.isFinite(value.amount)
        || typeof value.currency !== 'string' || !CURRENCIES.has(value.currency)) {
        throw new Error(label + ' must contain a finite amount and supported currency.');
    }
    return { amount: value.amount, currency: value.currency };
}
function optionalText(value, label) {
    return value === undefined || value === null || value === '' ? undefined : text(value, label);
}
function normalizeTransactionRow(row, statement, instrumentById, index) {
    const label = 'Transaction statement row ' + (index + 1);
    const sourceRowId = text(row?.sourceRowId, label + ' sourceRowId');
    const effectiveAt = timestamp(row.effectiveAt, label + ' effectiveAt');
    if (effectiveAt < statement.periodStart || effectiveAt > statement.periodEnd) throw new Error(label + ' effectiveAt must fall inside the statement period.');
    const instrumentId = text(row.instrumentId, label + ' instrumentId');
    const instrument = instrumentById.get(instrumentId);
    if (!instrument || instrument.currency !== statement.currency) throw new Error(label + ' must reference a known instrument in the statement currency.');
    if (!TRANSACTION_TYPES.has(row.type)) throw new Error(label + ' transaction type is unsupported.');
    const cashAmount = money(row.cashAmount, label + ' cashAmount');
    if (cashAmount.currency !== statement.currency) throw new Error(label + ' currency must match the statement.');
    const trade = row.type === 'Purchase' || row.type === 'Sale';
    let quantity;
    let unitPrice;
    if (trade) {
        if (!Number.isFinite(row.quantity) || row.quantity <= 0) throw new Error(label + ' trade quantity must be positive and finite.');
        quantity = row.quantity;
        unitPrice = money(row.unitPrice, label + ' unitPrice');
        if (unitPrice.currency !== statement.currency || unitPrice.amount <= 0
            || !Number.isFinite(quantity * unitPrice.amount)
            || Math.abs(Math.abs(cashAmount.amount) - quantity * unitPrice.amount) > MONEY_TOLERANCE) {
            throw new Error(label + ' trade cash amount must reconcile to quantity multiplied by unit price.');
        }
        if ((row.type === 'Purchase' && cashAmount.amount >= 0) || (row.type === 'Sale' && cashAmount.amount <= 0)) {
            throw new Error(label + ' purchase/sale cash direction is invalid.');
        }
    } else {
        if (row.quantity !== undefined || row.unitPrice !== undefined) throw new Error(label + ' non-trade rows cannot contain quantity or unitPrice.');
        if ((row.type === 'Fee' || row.type === 'Tax') && cashAmount.amount >= 0) throw new Error(label + ' fee and tax amounts must be negative.');
        if ((row.type === 'Dividend' || row.type === 'Interest') && cashAmount.amount <= 0) throw new Error(label + ' dividend and interest amounts must be positive.');
    }
    const externalReference = optionalText(row.externalReference, label + ' externalReference');
    return { sourceRowId, effectiveAt, instrumentId, type: row.type, cashAmount,
        ...(quantity === undefined ? {} : { quantity, unitPrice }),
        ...(externalReference === undefined ? {} : { externalReference }) };
}
function normalizeHoldingRow(row, statement, instrumentById, index) {
    const label = 'Holdings statement row ' + (index + 1);
    const sourceRowId = text(row?.sourceRowId, label + ' sourceRowId');
    const instrumentId = text(row.instrumentId, label + ' instrumentId');
    const instrument = instrumentById.get(instrumentId);
    if (!instrument || instrument.currency !== statement.currency) throw new Error(label + ' must reference a known instrument in the statement currency.');
    if (!Number.isFinite(row.quantity) || row.quantity < 0) throw new Error(label + ' quantity must be finite and non-negative.');
    return { sourceRowId, instrumentId, quantity: row.quantity };
}

/** Validate immutable, source-backed transaction and holdings statement evidence. */
export function validateInvestmentStatementEvidence(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.investmentAccounts)
        || !Array.isArray(input.investmentInstruments) || !Array.isArray(input.investmentStatementEvidence)) {
        throw new Error('Investment accounts, instruments and statement evidence collections are required.');
    }
    const accountById = new Map(input.investmentAccounts.map((item) => [text(item?.id, 'Investment account ID'), item]));
    const instrumentById = new Map(input.investmentInstruments.map((item) => [text(item?.id, 'Investment instrument ID'), item]));
    if (accountById.size !== input.investmentAccounts.length || instrumentById.size !== input.investmentInstruments.length) {
        throw new Error('Investment account and instrument IDs must be unique.');
    }
    const evidence = input.investmentStatementEvidence.map((item) => {
        const id = text(item?.id, 'Statement evidence ID');
        const kind = item.kind;
        if (!['transactions', 'holdings'].includes(kind)) throw new Error('Statement evidence kind must be transactions or holdings.');
        const accountId = text(item.accountId, 'Statement account ID');
        const account = accountById.get(accountId);
        if (!account) throw new Error('Statement evidence references an unknown investment account.');
        const currency = text(item.currency, 'Statement currency');
        if (!CURRENCIES.has(currency) || currency !== account.currency) throw new Error('Statement currency must match its investment account.');
        const periodStart = timestamp(item.periodStart, 'Statement periodStart');
        const periodEnd = timestamp(item.periodEnd, 'Statement periodEnd');
        const statementAsOf = timestamp(item.statementAsOf, 'Statement statementAsOf');
        const recordedAt = timestamp(item.recordedAt, 'Statement recordedAt');
        if (periodStart > periodEnd || statementAsOf < periodStart || statementAsOf > periodEnd) throw new Error('Statement period and as-of timestamps are inconsistent.');
        if (recordedAt < statementAsOf) throw new Error('Statement evidence cannot be recorded before its statement as-of timestamp.');
        if (!Array.isArray(item.rows) || item.rows.length === 0) throw new Error('Statement evidence must contain at least one source row.');
        const rows = kind === 'transactions'
            ? item.rows.map((row, index) => normalizeTransactionRow(row, { periodStart, periodEnd, currency }, instrumentById, index))
            : item.rows.map((row, index) => normalizeHoldingRow(row, { currency }, instrumentById, index));
        const rowIds = new Set();
        for (const row of rows) {
            if (rowIds.has(row.sourceRowId)) throw new Error('Statement source row IDs must be unique within a statement.');
            rowIds.add(row.sourceRowId);
        }
        if (kind === 'holdings' && new Set(rows.map((row) => row.instrumentId)).size !== rows.length) {
            throw new Error('A holdings statement may contain only one row per instrument and account.');
        }
        const sourceName = text(item.sourceName, 'Statement source name');
        const statementReference = optionalText(item.statementReference, 'Statement reference');
        return { id, kind, accountId, currency, periodStart, periodEnd, statementAsOf, recordedAt,
            sourceName, ...(statementReference === undefined ? {} : { statementReference }), rows };
    });
    unique(evidence, 'Statement evidence');
    return { investmentStatementEvidence: evidence };
}

function transactionDetailsMatch(row, transaction) {
    const instrumentMatches = row.instrumentId === transaction.instrumentId;
    const typeMatches = row.type === transaction.type;
    const dateMatches = row.effectiveAt === transaction.date;
    const amountMatches = row.cashAmount.currency === transaction.cashAmount.currency
        && Math.abs(row.cashAmount.amount - transaction.cashAmount.amount) <= MONEY_TOLERANCE;
    const quantityMatches = row.quantity === undefined
        ? transaction.quantity === undefined
        : Number.isFinite(transaction.quantity) && Math.abs(row.quantity - transaction.quantity) <= EPSILON;
    const unitPriceMatches = row.unitPrice === undefined
        ? transaction.unitPrice === undefined
        : Number.isFinite(transaction.unitPrice?.amount) && row.unitPrice.currency === transaction.unitPrice.currency
            && Math.abs(row.unitPrice.amount - transaction.unitPrice.amount) <= MONEY_TOLERANCE;
    return { instrumentMatches, typeMatches, dateMatches, amountMatches, quantityMatches, unitPriceMatches,
        matches: instrumentMatches && typeMatches && dateMatches && amountMatches && quantityMatches && unitPriceMatches };
}
function transactionCandidates(row, statement, transactions, recordedAtCutoff) {
    const eligible = transactions.filter((item) => item.accountId === statement.accountId
        && item.recordedAt <= recordedAtCutoff && item.date >= statement.periodStart && item.date <= statement.periodEnd);
    if (row.externalReference) {
        const byReference = eligible.filter((item) => item.externalReference === row.externalReference);
        return byReference;
    }
    return eligible.filter((item) => item.instrumentId === row.instrumentId && item.type === row.type && item.date === row.effectiveAt);
}

/** Reconcile one evidence document without changing, creating or deleting ledger transactions. */
export function reconcileInvestmentStatement({ statement, investmentAccounts, investmentInstruments, investmentTransactions,
    investmentValuations, recordedAtCutoff = new Date().toISOString() }) {
    timestamp(recordedAtCutoff, 'Reconciliation recorded-at cutoff');
    const ledger = validateInvestmentLedgerCollections({ investmentAccounts, investmentInstruments, investmentTransactions, investmentValuations });
    const validated = validateInvestmentStatementEvidence({
        ...ledger, investmentStatementEvidence: [statement]
    }).investmentStatementEvidence[0];
    if (validated.recordedAt > recordedAtCutoff) {
        return { statementId: validated.id, kind: validated.kind, status: 'unavailable',
            reason: 'The selected recorded-at cutoff predates this statement evidence.', recordedAtCutoff, rows: [] };
    }
    if (validated.kind === 'transactions') {
        const matchedLedgerIds = new Set();
        const seenReferences = new Set();
        const rows = validated.rows.map((row) => {
            if (row.externalReference && seenReferences.has(row.externalReference)) {
                return { sourceRowId: row.sourceRowId, status: 'duplicate-statement', reason: 'The statement repeats an external reference.' };
            }
            if (row.externalReference) seenReferences.add(row.externalReference);
            const candidates = transactionCandidates(row, validated, ledger.investmentTransactions, recordedAtCutoff);
            if (candidates.length === 0) return { sourceRowId: row.sourceRowId, status: 'unmatched-statement', reason: 'No ledger transaction matches the statement reference or exact account, instrument, type and timestamp.' };
            let candidate = candidates[0];
            if (candidates.length > 1) {
                const exact = candidates.filter((item) => transactionDetailsMatch(row, item).matches);
                if (exact.length === 1) candidate = exact[0];
                else return { sourceRowId: row.sourceRowId, status: 'ambiguous', candidateTransactionIds: candidates.map((item) => item.id),
                    reason: 'More than one ledger transaction could match this statement row.' };
            }
            matchedLedgerIds.add(candidate.id);
            const details = transactionDetailsMatch(row, candidate);
            if (!details.matches) return { sourceRowId: row.sourceRowId, transactionId: candidate.id, status: 'mismatch',
                differences: Object.entries(details).filter(([key, value]) => key !== 'matches' && !value).map(([key]) => key),
                reason: 'A reference/date candidate exists, but amount, quantity or unit price differs.' };
            return { sourceRowId: row.sourceRowId, transactionId: candidate.id, status: 'matched' };
        });
        const ledgerRows = ledger.investmentTransactions.filter((item) => item.accountId === validated.accountId
            && item.date >= validated.periodStart && item.date <= validated.periodEnd && item.recordedAt <= recordedAtCutoff
            && !matchedLedgerIds.has(item.id)).map((item) => ({ transactionId: item.id, status: 'unmatched-ledger',
                reason: 'No statement row reconciles to this ledger transaction.' }));
        const allRows = [...rows, ...ledgerRows];
        const status = allRows.every((item) => item.status === 'matched') ? 'reconciled'
            : allRows.some((item) => item.status === 'mismatch') ? 'difference' : 'incomplete';
        return { statementId: validated.id, kind: validated.kind, accountId: validated.accountId, currency: validated.currency,
            periodStart: validated.periodStart, periodEnd: validated.periodEnd, statementAsOf: validated.statementAsOf,
            recordedAtCutoff, status, rows: allRows,
            counts: { matched: rows.filter((item) => item.status === 'matched').length,
                unmatchedStatement: rows.filter((item) => item.status === 'unmatched-statement').length,
                unmatchedLedger: ledgerRows.length, mismatched: rows.filter((item) => item.status === 'mismatch').length,
                ambiguous: rows.filter((item) => item.status === 'ambiguous').length,
                duplicates: rows.filter((item) => item.status === 'duplicate-statement').length } };
    }

    const positions = analyzeInvestmentPortfolio({
        accounts: ledger.investmentAccounts, instruments: ledger.investmentInstruments, transactions: ledger.investmentTransactions,
        valuations: ledger.investmentValuations, asOfDate: new Date(validated.statementAsOf), recordedAtCutoff: new Date(recordedAtCutoff)
    }).filter((item) => item.accountId === validated.accountId && item.quantity > EPSILON);
    const positionByInstrument = new Map(positions.map((item) => [item.instrumentId, item]));
    const rows = [];
    for (const holding of validated.rows) {
        const position = positionByInstrument.get(holding.instrumentId);
        if (!position) {
            rows.push({ sourceRowId: holding.sourceRowId, instrumentId: holding.instrumentId,
                statementQuantity: holding.quantity, ledgerQuantity: 0, status: holding.quantity <= EPSILON ? 'matched' : 'unmatched-statement',
                ...(holding.quantity <= EPSILON ? {} : { reason: 'The statement reports a holding that has no open FIFO ledger position.' }) });
        } else {
            const difference = holding.quantity - position.quantity;
            rows.push({ sourceRowId: holding.sourceRowId, instrumentId: holding.instrumentId,
                statementQuantity: holding.quantity, ledgerQuantity: position.quantity, difference,
                status: Math.abs(difference) <= EPSILON ? 'matched' : 'quantity-mismatch',
                ...(Math.abs(difference) <= EPSILON ? {} : { reason: 'Statement quantity differs from the FIFO-projected ledger quantity.' }) });
            positionByInstrument.delete(holding.instrumentId);
        }
    }
    for (const position of positionByInstrument.values()) rows.push({
        instrumentId: position.instrumentId, statementQuantity: null, ledgerQuantity: position.quantity,
        status: 'unmatched-ledger', reason: 'An open FIFO ledger position is absent from the holdings statement.'
    });
    const status = rows.every((item) => item.status === 'matched') ? 'reconciled'
        : rows.some((item) => item.status === 'quantity-mismatch') ? 'difference' : 'incomplete';
    return { statementId: validated.id, kind: validated.kind, accountId: validated.accountId, currency: validated.currency,
        statementAsOf: validated.statementAsOf, recordedAtCutoff, status, rows,
        counts: { matched: rows.filter((item) => item.status === 'matched').length,
            unmatchedStatement: rows.filter((item) => item.status === 'unmatched-statement').length,
            unmatchedLedger: rows.filter((item) => item.status === 'unmatched-ledger').length,
            mismatched: rows.filter((item) => item.status === 'quantity-mismatch').length } };
}

/** Reconcile every eligible statement and keep transaction and holdings results separate. */
export function reconcileInvestmentStatementEvidence(input) {
    const validated = validateInvestmentStatementEvidence(input).investmentStatementEvidence;
    const cutoff = timestamp(input.recordedAtCutoff, 'Reconciliation recorded-at cutoff');
    const reports = validated.filter((item) => item.recordedAt <= cutoff).map((statement) => reconcileInvestmentStatement({
        ...input, statement, recordedAtCutoff: cutoff
    }));
    return { recordedAtCutoff: cutoff, reports,
        summary: { statementCount: reports.length,
            reconciled: reports.filter((item) => item.status === 'reconciled').length,
            differences: reports.filter((item) => item.status === 'difference').length,
            incomplete: reports.filter((item) => item.status === 'incomplete' || item.status === 'unavailable').length } };
}
