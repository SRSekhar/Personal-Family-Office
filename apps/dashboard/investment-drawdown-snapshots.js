import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentCashCollections } from './investment-cash-ledger.js';

const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const KINDS = new Set(['DailyClose', 'ExternalFlowPre', 'ExternalFlowPost']);
const SOURCE_TYPES = new Set(['manual', 'provider']);

function text(value, label) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be a non-empty string.');
    return value.trim();
}
function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}
function money(value, currency, label, allowNegative = false) {
    if (!value || typeof value !== 'object' || !Number.isFinite(value.amount)
        || typeof value.currency !== 'string' || value.currency !== currency || (!allowNegative && value.amount < 0)) {
        throw new Error(label + ' must be a finite amount in the snapshot currency; negative values are allowed only where the component contract permits them.');
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
function tolerance(currency) {
    return currency === 'JPY' ? 1 : 0.01;
}
function componentKey(component) {
    return component.type === 'position'
        ? JSON.stringify(['position', component.accountId, component.instrumentId])
        : JSON.stringify(['cash', component.cashAccountId]);
}

/**
 * Validate immutable, component-level portfolio valuation observations.
 * Every component is explicitly sourced at the snapshot effective timestamp;
 * this validator never carries forward a price or infers a missing component.
 */
export function validateInvestmentDrawdownSnapshots(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.investmentDrawdownSnapshots)) {
        throw new Error('Investment drawdown snapshots must be an array.');
    }
    const ledger = validateInvestmentLedgerCollections(input);
    const cash = validateInvestmentCashCollections({ ...input, ...ledger });
    const accounts = new Map(ledger.investmentAccounts.map((item) => [item.id, item]));
    const instruments = new Map(ledger.investmentInstruments.map((item) => [item.id, item]));
    const cashAccounts = new Map(cash.investmentCashAccounts.map((item) => [item.id, item]));
    const raw = input.investmentDrawdownSnapshots;
    unique(raw, 'Investment drawdown snapshot');

    const snapshots = raw.map((item) => {
        const id = text(item?.id, 'Investment drawdown snapshot ID');
        const scope = text(item.scope, 'Drawdown snapshot scope');
        if (!['portfolio', 'account'].includes(scope)) throw new Error('Drawdown snapshot scope must be portfolio or account.');
        const accountId = item.accountId === undefined ? undefined : text(item.accountId, 'Drawdown snapshot account ID');
        if (scope === 'account' && (!accountId || !accounts.has(accountId))) throw new Error('Account-scoped drawdown snapshots require a known investment account.');
        if (scope === 'portfolio' && accountId !== undefined) throw new Error('Portfolio-scoped drawdown snapshots cannot specify an account ID.');
        const currency = text(item.currency, 'Drawdown snapshot currency');
        if (!CURRENCIES.has(currency)) throw new Error('Drawdown snapshot currency is unsupported.');
        const kind = text(item.kind, 'Drawdown snapshot kind');
        if (!KINDS.has(kind)) throw new Error('Drawdown snapshot kind is unsupported.');
        const effectiveAt = timestamp(item.effectiveAt, 'Drawdown snapshot effectiveAt');
        const recordedAt = timestamp(item.recordedAt, 'Drawdown snapshot recordedAt');
        if (recordedAt < effectiveAt) throw new Error('Drawdown snapshot recordedAt cannot precede its effectiveAt timestamp.');
        const sourceType = text(item.sourceType, 'Drawdown snapshot source type');
        const sourceName = text(item.sourceName, 'Drawdown snapshot source name');
        if (!SOURCE_TYPES.has(sourceType)) throw new Error('Drawdown snapshot source type must be manual or provider.');
        const flowId = item.flowId === undefined ? undefined : text(item.flowId, 'Drawdown snapshot flow ID');
        if ((kind === 'DailyClose') === (flowId !== undefined)) throw new Error('Only external-flow boundary snapshots may specify a flow ID.');
        const complete = item.complete;
        if (typeof complete !== 'boolean') throw new Error('Drawdown snapshot completeness must be explicit.');
        const unavailableReason = item.unavailableReason === undefined ? undefined : text(item.unavailableReason, 'Drawdown snapshot unavailable reason');
        if (complete && unavailableReason !== undefined) throw new Error('A complete drawdown snapshot cannot have an unavailable reason.');
        if (!complete && unavailableReason === undefined) throw new Error('An incomplete drawdown snapshot must explain why it is incomplete.');
        if (!Array.isArray(item.components)) throw new Error('Drawdown snapshot components must be an array.');
        const components = item.components.map((component) => {
            const componentId = text(component?.id, 'Drawdown component ID');
            const type = text(component.type, 'Drawdown component type');
            const valuedAt = timestamp(component.valuedAt, 'Drawdown component valuedAt');
            if (valuedAt !== effectiveAt) throw new Error('Every component must be valued at the snapshot effective timestamp; stale carry-forward is not permitted.');
            const componentSourceType = text(component.sourceType, 'Drawdown component source type');
            const componentSourceName = text(component.sourceName, 'Drawdown component source name');
            if (!SOURCE_TYPES.has(componentSourceType)) throw new Error('Drawdown component source type must be manual or provider.');
            const value = money(component.value, currency, 'Drawdown component value', type === 'cash');
            if (type === 'position') {
                const componentAccountId = text(component.accountId, 'Position component account ID');
                const instrumentId = text(component.instrumentId, 'Position component instrument ID');
                const account = accounts.get(componentAccountId);
                const instrument = instruments.get(instrumentId);
                if (!account || !instrument) throw new Error('Position component references an unknown investment account or instrument.');
                if (account.currency !== currency || instrument.currency !== currency) throw new Error('Position component account and instrument must match the snapshot currency.');
                if (scope === 'account' && componentAccountId !== accountId) throw new Error('Account-scoped snapshots cannot include a position from another account.');
                if (!Number.isFinite(component.quantity) || component.quantity <= 0
                    || !component.unitPrice || !Number.isFinite(component.unitPrice.amount) || component.unitPrice.amount <= 0
                    || component.unitPrice.currency !== currency) throw new Error('Position components require a positive quantity and unit price in the snapshot currency.');
                if (Math.abs(component.quantity * component.unitPrice.amount - value.amount) > tolerance(currency)) {
                    throw new Error('Position component value must reconcile to quantity multiplied by unit price.');
                }
                return { id: componentId, type, accountId: componentAccountId, instrumentId, quantity: component.quantity,
                    unitPrice: { amount: component.unitPrice.amount, currency }, value, valuedAt,
                    sourceType: componentSourceType, sourceName: componentSourceName };
            }
            if (type === 'cash') {
                const cashAccountId = text(component.cashAccountId, 'Cash component account ID');
                const cashAccount = cashAccounts.get(cashAccountId);
                if (!cashAccount || cashAccount.currency !== currency) throw new Error('Cash component references an unknown cash account or mismatched currency.');
                if (scope === 'account' && cashAccount.investmentAccountId !== accountId) throw new Error('Account-scoped snapshots cannot include cash from another investment account.');
                if (component.quantity !== undefined || component.unitPrice !== undefined) throw new Error('Cash components cannot contain position quantity or unit price.');
                return { id: componentId, type, cashAccountId, value, valuedAt,
                    sourceType: componentSourceType, sourceName: componentSourceName };
            }
            throw new Error('Drawdown component type must be position or cash.');
        });
        unique(components, 'Drawdown component');
        const componentKeys = new Set(components.map(componentKey));
        if (componentKeys.size !== components.length) throw new Error('A drawdown snapshot cannot contain duplicate position or cash components.');
        const totalValue = money(item.totalValue, currency, 'Drawdown snapshot total value');
        const sum = components.reduce((value, component) => value + component.value.amount, 0);
        if (!Number.isFinite(sum) || Math.abs(sum - totalValue.amount) > tolerance(currency)) {
            throw new Error('Drawdown snapshot total must reconcile to its component values.');
        }
        if (complete && components.length === 0) throw new Error('A complete drawdown snapshot must contain at least one component.');
        const supersedesSnapshotId = item.supersedesSnapshotId === undefined
            ? undefined : text(item.supersedesSnapshotId, 'Superseded snapshot ID');
        return { id, scope, ...(accountId ? { accountId } : {}), currency, kind, effectiveAt, recordedAt,
            sourceType, sourceName, ...(flowId ? { flowId } : {}), complete,
            ...(unavailableReason ? { unavailableReason } : {}), components, totalValue,
            ...(supersedesSnapshotId ? { supersedesSnapshotId } : {}) };
    });

    const byId = new Map(snapshots.map((item) => [item.id, item]));
    const superseded = new Set();
    for (const snapshot of snapshots) {
        if (!snapshot.supersedesSnapshotId) continue;
        const previous = byId.get(snapshot.supersedesSnapshotId);
        if (!previous || previous.id === snapshot.id || superseded.has(previous.id)) {
            throw new Error('A drawdown snapshot correction must reference one existing, not-yet-superseded snapshot.');
        }
        if (previous.scope !== snapshot.scope || previous.accountId !== snapshot.accountId || previous.currency !== snapshot.currency
            || previous.kind !== snapshot.kind || previous.effectiveAt !== snapshot.effectiveAt || previous.flowId !== snapshot.flowId
            || snapshot.recordedAt <= previous.recordedAt) {
            throw new Error('A corrected drawdown snapshot must retain its scope, currency, event identity and effective time, and be recorded later.');
        }
        superseded.add(previous.id);
    }
    const latest = snapshots.filter((item) => !superseded.has(item.id));
    const timestampGroups = new Map();
    for (const snapshot of latest) {
        const key = JSON.stringify([snapshot.scope, snapshot.accountId ?? null, snapshot.currency, snapshot.effectiveAt]);
        const group = timestampGroups.get(key) ?? { daily: false, flowIds: new Set() };
        if (snapshot.kind === 'DailyClose') group.daily = true;
        else group.flowIds.add(snapshot.flowId);
        timestampGroups.set(key, group);
    }
    for (const group of timestampGroups.values()) {
        if (group.daily && group.flowIds.size > 0) {
            throw new Error('A timestamp cannot contain both a daily close and an external-flow boundary.');
        }
        if (group.flowIds.size > 1) {
            throw new Error('Only one external flow may be represented at an exact timestamp; sequence simultaneous flows explicitly.');
        }
    }
    const flowGroups = new Map();
    for (const snapshot of latest) {
        if (!snapshot.flowId) continue;
        const key = JSON.stringify([snapshot.scope, snapshot.accountId ?? null, snapshot.currency, snapshot.flowId]);
        const group = flowGroups.get(key) ?? {};
        if (group[snapshot.kind]) throw new Error('Each external flow may have only one current snapshot per boundary kind and scope.');
        group[snapshot.kind] = snapshot;
        flowGroups.set(key, group);
    }
    for (const group of flowGroups.values()) {
        const pre = group.ExternalFlowPre;
        const post = group.ExternalFlowPost;
        if (!pre || !post) throw new Error('External-flow snapshots require both pre-flow and post-flow boundaries.');
        if (pre.effectiveAt !== post.effectiveAt) throw new Error('External-flow boundary snapshots must share the exact effective timestamp.');
        const preKeys = pre.components.map(componentKey).sort();
        const postKeys = post.components.map(componentKey).sort();
        if (JSON.stringify(preKeys) !== JSON.stringify(postKeys)) throw new Error('Paired external-flow snapshots must cover the same component universe.');
    }
    return { investmentDrawdownSnapshots: snapshots };
}

/** Select the latest known version of each observation without rewriting its effective time. */
export function buildInvestmentDrawdownObservations({ investmentDrawdownSnapshots, scope, accountId, currency, startAt, endAt, recordedAtCutoff }) {
    for (const [value, label] of [[startAt, 'Analysis start'], [endAt, 'Analysis end'], [recordedAtCutoff, 'Recorded-at cutoff']]) timestamp(value, label);
    if (startAt > endAt) throw new RangeError('Analysis start must not be after analysis end.');
    if (!['portfolio', 'account'].includes(scope)) throw new Error('A portfolio or account scope is required.');
    if (!CURRENCIES.has(currency)) throw new Error('Analysis currency is unsupported.');
    if (scope === 'account') text(accountId, 'Analysis account ID');
    if (scope === 'portfolio' && accountId !== undefined) throw new Error('Portfolio analysis cannot specify an account ID.');
    const candidates = investmentDrawdownSnapshots.filter((item) => item.scope === scope
        && item.accountId === accountId && item.currency === currency
        && item.effectiveAt >= startAt && item.effectiveAt <= endAt && item.recordedAt <= recordedAtCutoff);
    const latest = new Map();
    for (const item of candidates) {
        const key = JSON.stringify([item.kind, item.effectiveAt, item.flowId ?? null]);
        const current = latest.get(key);
        if (!current || item.recordedAt > current.recordedAt) latest.set(key, item);
        else if (item.recordedAt === current.recordedAt) throw new Error('Drawdown snapshot revisions have an ambiguous recorded-at timestamp.');
    }
    const supersededIds = new Set(candidates.map((item) => item.supersedesSnapshotId).filter(Boolean));
    const selected = [...latest.values()].filter((item) => !supersededIds.has(item.id))
        .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.kind.localeCompare(b.kind));
    return selected.map((item) => ({
        id: item.id, scopeId: scope === 'account' ? accountId : 'portfolio', currency,
        kind: item.kind, effectiveAt: item.effectiveAt, recordedAt: item.recordedAt,
        portfolioValue: item.totalValue.amount, complete: item.complete,
        ...(item.unavailableReason ? { unavailableReason: item.unavailableReason } : {}),
        ...(item.flowId ? { flowId: item.flowId } : {})
    }));
}
