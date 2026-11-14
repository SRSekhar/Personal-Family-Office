import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentCashCollections } from './investment-cash-ledger.js';
import { analyzeInvestmentPortfolio } from './investment-portfolio.js';
import { validateInvestmentDrawdownSnapshots } from './investment-drawdown-snapshots.js';

const EPSILON = 1e-10;

function requireTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function requireScope({ scope, accountId, currency, investmentAccounts }) {
    if (!['portfolio', 'account'].includes(scope)) throw new Error('Drawdown scope must be portfolio or account.');
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/u.test(currency)) throw new Error('A three-letter currency code is required.');
    if (scope === 'portfolio' && accountId !== undefined) throw new Error('Portfolio scope cannot specify an account ID.');
    const accounts = investmentAccounts.filter((item) => item.currency === currency
        && (scope === 'portfolio' || item.id === accountId));
    if (scope === 'account' && !accounts.some((item) => item.id === accountId)) {
        throw new Error('The selected investment account does not exist in the requested currency.');
    }
    return accounts;
}

function componentKey(component) {
    return component.type === 'position'
        ? JSON.stringify(['position', component.accountId, component.instrumentId])
        : JSON.stringify(['cash', component.cashAccountId]);
}

function minorUnitTolerance(currency) {
    return currency === 'JPY' ? 1 : 0.01;
}

function uniqueReasons(reasons) {
    return [...new Set(reasons)];
}

/**
 * Derive the exact position/cash component universe from the immutable ledgers.
 * Values/prices for positions are deliberately not fabricated; callers supply
 * contemporaneous valuation evidence for each required position.
 */
export function buildInvestmentDrawdownSnapshotRequirements(input) {
    const effectiveAt = requireTimestamp(input?.effectiveAt, 'Snapshot effectiveAt');
    const recordedAtCutoff = requireTimestamp(input?.recordedAtCutoff, 'Snapshot recorded-at cutoff');
    const kind = input.kind ?? 'DailyClose';
    const flowId = input.flowId;
    if (!['DailyClose', 'ExternalFlowPre', 'ExternalFlowPost'].includes(kind)) throw new Error('Snapshot observation kind is unsupported.');
    if ((kind === 'DailyClose') === (flowId !== undefined)) throw new Error('Only flow-boundary snapshots may specify a flow ID.');
    if (recordedAtCutoff < effectiveAt) {
        throw new Error('Snapshot recorded-at cutoff cannot precede its effective timestamp.');
    }
    const ledger = validateInvestmentLedgerCollections(input);
    const cash = validateInvestmentCashCollections({ ...input, ...ledger });
    const accounts = requireScope({ ...input, investmentAccounts: ledger.investmentAccounts });
    const accountIds = new Set(accounts.map((item) => item.id));
    const instruments = ledger.investmentInstruments.filter((item) => item.currency === input.currency);
    const instrumentIds = new Set(instruments.map((item) => item.id));
    const transactions = ledger.investmentTransactions.filter((item) => accountIds.has(item.accountId)
        && instrumentIds.has(item.instrumentId));
    const valuations = ledger.investmentValuations.filter((item) => instrumentIds.has(item.instrumentId));
    const boundaryFlows = kind === 'DailyClose' ? null : buildInvestmentDrawdownExternalFlows({
        ...input, startAt: effectiveAt, endAt: effectiveAt, recordedAtCutoff
    });
    const boundaryFlow = boundaryFlows?.flows.find((item) => item.id === flowId);
    const boundarySourceIds = new Set(boundaryFlow?.sourceIds ?? []);
    const positions = analyzeInvestmentPortfolio({
        accounts,
        instruments,
        transactions,
        valuations,
        asOfDate: new Date(effectiveAt),
        recordedAtCutoff: new Date(recordedAtCutoff)
    }).filter((item) => item.quantity > EPSILON);
    const expectedComponents = positions.map((item) => ({
        type: 'position',
        accountId: item.accountId,
        instrumentId: item.instrumentId,
        quantity: item.quantity
    }));

    const reasons = [];
    if (kind !== 'DailyClose') {
        if (boundaryFlows.status === 'unavailable') reasons.push(boundaryFlows.reason);
        if (!boundaryFlow) reasons.push('The flow boundary ID is not present in the authoritative external-flow ledger.');
        const sameTimeTransactions = transactions.filter((item) => item.date === effectiveAt && item.recordedAt <= recordedAtCutoff);
        const sameTimeMovements = cash.investmentCashMovements.filter((item) => item.effectiveAt === effectiveAt
            && item.recordedAt <= recordedAtCutoff && accountIds.has(cash.investmentCashAccounts.find((account) => account.id === item.cashAccountId)?.investmentAccountId));
        const sameTimeTransfers = cash.investmentCashTransfers.filter((item) => item.effectiveAt === effectiveAt
            && item.recordedAt <= recordedAtCutoff
            && [item.sourceCashAccountId, item.destinationCashAccountId].some((id) => {
                const linkedAccount = cash.investmentCashAccounts.find((cashAccount) => cashAccount.id === id);
                return linkedAccount && accountIds.has(linkedAccount.investmentAccountId) && linkedAccount.currency === input.currency;
            }));
        if (sameTimeTransactions.length) reasons.push('Investment transactions share the external-flow timestamp and cannot be sequenced by the current ledger schema.');
        if (sameTimeMovements.some((item) => !boundarySourceIds.has((item.type === 'Correction' ? 'cash-correction:' : 'cash-movement:') + item.id))) reasons.push('Other cash movements share the external-flow timestamp and cannot be sequenced by the current ledger schema.');
        if (sameTimeTransfers.some((item) => !boundarySourceIds.has('cash-transfer:' + item.id))) reasons.push('Other cash transfers share the external-flow timestamp and cannot be sequenced by the current ledger schema.');
    }
    const cashAccounts = cash.investmentCashAccounts.filter((item) => accountIds.has(item.investmentAccountId)
        && item.currency === input.currency && item.createdAt <= effectiveAt);
    const cashAccountIds = new Set(cashAccounts.map((item) => item.id));
    const visibleTransactions = transactions.filter((item) => item.date <= effectiveAt && item.recordedAt <= recordedAtCutoff);
    for (const transaction of visibleTransactions) {
        if (!transaction.cashAccountId || (transaction.cashAccountLinkedAt ?? transaction.recordedAt) > recordedAtCutoff
            || !cashAccountIds.has(transaction.cashAccountId)) {
            reasons.push('Investment transaction ' + transaction.id + ' is not linked to an eligible cash account at the recorded-at cutoff.');
        }
    }

    const cashAccountById = new Map(cashAccounts.map((item) => [item.id, item]));
    for (const cashAccount of cashAccounts) {
        const movements = cash.investmentCashMovements.filter((item) => item.cashAccountId === cashAccount.id
            && item.effectiveAt <= effectiveAt && item.recordedAt <= recordedAtCutoff
            && !(kind === 'ExternalFlowPre' && (boundarySourceIds.has('cash-movement:' + item.id)
                || boundarySourceIds.has('cash-correction:' + item.id))));
        const opening = movements.filter((item) => item.type === 'OpeningBalance');
        if (opening.length !== 1) {
            reasons.push('Cash account ' + cashAccount.id + ' has no eligible opening-balance baseline at the snapshot time.');
            continue;
        }
        let balance = movements.reduce((sum, item) => sum + item.amount.amount, 0);
        for (const transfer of cash.investmentCashTransfers) {
            if (transfer.effectiveAt > effectiveAt || transfer.recordedAt > recordedAtCutoff
                || (kind === 'ExternalFlowPre' && boundarySourceIds.has('cash-transfer:' + transfer.id))) continue;
            const isSource = transfer.sourceCashAccountId === cashAccount.id;
            const isDestination = transfer.destinationCashAccountId === cashAccount.id;
            if (isSource) balance -= transfer.amount.amount;
            if (isDestination) balance += transfer.amount.amount;
            if (isSource || isDestination) {
                const otherId = isSource ? transfer.destinationCashAccountId : transfer.sourceCashAccountId;
                const other = cash.investmentCashAccounts.find((item) => item.id === otherId);
                if (!other || other.createdAt > transfer.effectiveAt) {
                    reasons.push('Cash transfer ' + transfer.id + ' references an account that did not yet exist at the transfer effective time.');
                }
            }
        }
        for (const transaction of visibleTransactions) {
            if (transaction.cashAccountId === cashAccount.id
                && (transaction.cashAccountLinkedAt ?? transaction.recordedAt) <= recordedAtCutoff) {
                balance += transaction.cashAmount.amount;
            }
        }
        if (!Number.isFinite(balance)) {
            reasons.push('Cash account ' + cashAccount.id + ' roll-forward exceeds the supported numeric range.');
            continue;
        }
        expectedComponents.push({ type: 'cash', cashAccountId: cashAccount.id, balance, currency: cashAccount.currency });
    }

    for (const transaction of visibleTransactions) {
        if (transaction.cashAccountId && !cashAccountById.has(transaction.cashAccountId)) {
            reasons.push('Investment transaction ' + transaction.id + ' links to a cash account outside the selected snapshot scope or currency.');
        }
    }

    if (expectedComponents.length === 0) reasons.push('No open investment positions or eligible cash accounts exist at the requested snapshot time.');
    return {
        status: uniqueReasons(reasons).length === 0 ? 'available' : 'incomplete',
        scope: input.scope,
        ...(input.scope === 'account' ? { accountId: input.accountId } : {}),
        currency: input.currency,
        effectiveAt,
        recordedAtCutoff,
        kind,
        ...(flowId ? { flowId } : {}),
        expectedComponents,
        reasons: uniqueReasons(reasons)
    };
}

/**
 * Independently verify a persisted snapshot against the ledger-derived component
 * universe and cash roll-forward. This does not invent missing position prices.
 */
export function validateInvestmentDrawdownSnapshotCompleteness({ snapshotId, ...input }) {
    if (typeof snapshotId !== 'string' || !snapshotId.trim()) throw new Error('A drawdown snapshot ID is required.');
    const validated = validateInvestmentDrawdownSnapshots(input).investmentDrawdownSnapshots;
    const snapshot = validated.find((item) => item.id === snapshotId);
    if (!snapshot) throw new Error('The requested drawdown snapshot does not exist.');
    const requirements = buildInvestmentDrawdownSnapshotRequirements({
        ...input,
        scope: snapshot.scope,
        accountId: snapshot.accountId,
        currency: snapshot.currency,
        effectiveAt: snapshot.effectiveAt,
        recordedAtCutoff: snapshot.recordedAt,
        kind: snapshot.kind,
        flowId: snapshot.flowId
    });
    const expected = new Map(requirements.expectedComponents.map((item) => [componentKey(item), item]));
    const actual = new Map(snapshot.components.map((item) => [componentKey(item), item]));
    const missingComponents = [...expected.keys()].filter((key) => !actual.has(key));
    const unexpectedComponents = [...actual.keys()].filter((key) => !expected.has(key));
    const mismatchedComponents = [];
    for (const [key, expectedComponent] of expected) {
        const actualComponent = actual.get(key);
        if (!actualComponent) continue;
        if (expectedComponent.type === 'position'
            && Math.abs(actualComponent.quantity - expectedComponent.quantity) > EPSILON) {
            mismatchedComponents.push({ key, reason: 'Position quantity does not match the bitemporal FIFO ledger.' });
        }
        if (expectedComponent.type === 'cash'
            && Math.abs(actualComponent.value.amount - expectedComponent.balance) > minorUnitTolerance(snapshot.currency)) {
            mismatchedComponents.push({ key, reason: 'Cash value does not match the bitemporal cash-ledger roll-forward.' });
        }
    }
    const reasons = [...requirements.reasons];
    if (!snapshot.complete) reasons.push(snapshot.unavailableReason || 'The stored snapshot is explicitly incomplete.');
    if (missingComponents.length) reasons.push('One or more ledger-derived components are missing from the snapshot.');
    if (unexpectedComponents.length) reasons.push('The snapshot contains components not present in the ledger-derived universe.');
    if (mismatchedComponents.length) reasons.push('One or more component quantities or cash balances do not reconcile to the ledgers.');
    return {
        status: uniqueReasons(reasons).length === 0 ? 'complete' : 'incomplete',
        complete: uniqueReasons(reasons).length === 0,
        snapshotId,
        scope: snapshot.scope,
        ...(snapshot.accountId ? { accountId: snapshot.accountId } : {}),
        currency: snapshot.currency,
        effectiveAt: snapshot.effectiveAt,
        recordedAt: snapshot.recordedAt,
        expectedComponentCount: expected.size,
        actualComponentCount: actual.size,
        missingComponents,
        unexpectedComponents,
        mismatchedComponents,
        reasons: uniqueReasons(reasons)
    };
}

/**
 * Classify external flows represented by the current cash ledger.
 * Opening balances, internal transfers and investment transactions are not
 * external flows. Corrections restate their referenced external movement only
 * when they share its effective timestamp; ambiguous corrections fail closed.
 */
export function buildInvestmentDrawdownExternalFlows(input) {
    const startAt = requireTimestamp(input?.startAt, 'Analysis start');
    const endAt = requireTimestamp(input?.endAt, 'Analysis end');
    const recordedAtCutoff = requireTimestamp(input?.recordedAtCutoff, 'Recorded-at cutoff');
    if (startAt > endAt) throw new Error('Analysis start must not be after analysis end.');
    const ledger = validateInvestmentLedgerCollections(input);
    const cash = validateInvestmentCashCollections({ ...input, ...ledger });
    const accounts = requireScope({ ...input, investmentAccounts: ledger.investmentAccounts });
    const accountIds = new Set(accounts.map((item) => item.id));
    const cashAccounts = new Map(cash.investmentCashAccounts.map((item) => [item.id, item]));
    const selectedCashIds = new Set(cash.investmentCashAccounts.filter((item) => accountIds.has(item.investmentAccountId)
        && item.currency === input.currency).map((item) => item.id));
    const movementById = new Map(cash.investmentCashMovements.map((item) => [item.id, item]));
    const correctionsByOriginal = new Map();
    for (const movement of cash.investmentCashMovements) {
        if (movement.type !== 'Correction' || movement.recordedAt > recordedAtCutoff) continue;
        const original = movementById.get(movement.reversesMovementId);
        if (!original || !['ExternalContribution', 'ExternalWithdrawal'].includes(original.type)
            || !selectedCashIds.has(original.cashAccountId) || original.amount.currency !== input.currency
            || original.recordedAt > recordedAtCutoff) continue;
        const group = correctionsByOriginal.get(original.id) ?? [];
        group.push(movement);
        correctionsByOriginal.set(original.id, group);
    }

    const flows = [];
    const reasons = [];
    for (const movement of cash.investmentCashMovements) {
        if (!['ExternalContribution', 'ExternalWithdrawal'].includes(movement.type)
            || !selectedCashIds.has(movement.cashAccountId) || movement.amount.currency !== input.currency
            || movement.recordedAt > recordedAtCutoff) continue;
        const corrections = correctionsByOriginal.get(movement.id) ?? [];
        const originalInWindow = movement.effectiveAt >= startAt && movement.effectiveAt <= endAt;
        const correctionInWindow = corrections.some((item) => item.effectiveAt >= startAt && item.effectiveAt <= endAt);
        if (!originalInWindow && !correctionInWindow) continue;
        if (corrections.some((item) => item.effectiveAt !== movement.effectiveAt)) {
            reasons.push('Correction for external cash movement ' + movement.id + ' has a different effective timestamp; its economic flow cannot be reconstructed unambiguously.');
            continue;
        }
        if (!originalInWindow) continue;
        const netAmount = movement.amount.amount + corrections.reduce((sum, item) => sum + item.amount.amount, 0);
        const expectedSign = movement.type === 'ExternalContribution' ? 1 : -1;
        if (netAmount !== 0 && Math.sign(netAmount) !== expectedSign) {
            reasons.push('Correction for external cash movement ' + movement.id + ' changes its economic direction; explicit event review is required.');
            continue;
        }
        if (netAmount === 0) continue;
        const recordedAt = corrections.reduce((latest, item) => item.recordedAt > latest ? item.recordedAt : latest, movement.recordedAt);
        flows.push({
            id: 'cash-movement:' + movement.id,
            effectiveAt: movement.effectiveAt,
            recordedAt,
            amount: { amount: netAmount, currency: input.currency },
            classification: movement.type,
            sourceIds: ['cash-movement:' + movement.id, ...corrections.map((item) => 'cash-correction:' + item.id)]
        });
    }

    for (const transfer of cash.investmentCashTransfers) {
        if (transfer.amount.currency !== input.currency || transfer.recordedAt > recordedAtCutoff
            || transfer.effectiveAt < startAt || transfer.effectiveAt > endAt) continue;
        const source = cashAccounts.get(transfer.sourceCashAccountId);
        const destination = cashAccounts.get(transfer.destinationCashAccountId);
        const sourceInScope = Boolean(source && accountIds.has(source.investmentAccountId) && source.currency === input.currency);
        const destinationInScope = Boolean(destination && accountIds.has(destination.investmentAccountId) && destination.currency === input.currency);
        if (sourceInScope === destinationInScope) continue;
        flows.push({
            id: 'cash-transfer:' + transfer.id,
            effectiveAt: transfer.effectiveAt,
            recordedAt: transfer.recordedAt,
            amount: { amount: destinationInScope ? transfer.amount.amount : -transfer.amount.amount, currency: input.currency },
            classification: destinationInScope ? 'TransferIntoScope' : 'TransferOutOfScope',
            sourceIds: ['cash-transfer:' + transfer.id]
        });
    }

    flows.sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.id.localeCompare(b.id));
    return {
        status: reasons.length === 0 ? 'available' : 'unavailable',
        reason: reasons.length ? uniqueReasons(reasons).join(' ') : null,
        scope: input.scope,
        ...(input.scope === 'account' ? { accountId: input.accountId } : {}),
        currency: input.currency,
        startAt,
        endAt,
        recordedAtCutoff,
        flows,
        limitations: [
            'OpeningBalance is a starting baseline, not an external flow unless separately evidenced outside the current cash-ledger model.',
            'In-kind contributions/withdrawals and corporate actions are not represented by the current cash-ledger event schema and require separately approved event support.'
        ]
    };
}
