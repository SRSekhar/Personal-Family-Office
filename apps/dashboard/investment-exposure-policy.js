const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const SCOPES = new Set(['portfolio', 'account']);
const COMPARATORS = new Set(['>', '>=']);

function requireText(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new TypeError(label + ' must be a non-empty string.');
    return value.trim();
}
function requireDate(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || !Number.isFinite(Date.parse(value + 'T00:00:00.000Z'))
        || new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value) {
        throw new TypeError(label + ' must be a real YYYY-MM-DD calendar date.');
    }
    return value;
}
function requireTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical ISO-8601 timestamp.');
    }
    return value;
}

function classificationGroups(classifications, dimensionId) {
    const groups = new Map();
    for (const classification of classifications) {
        if (classification.dimensionId !== dimensionId) continue;
        for (const allocation of classification.allocations) {
            const existing = groups.get(allocation.groupId);
            if (existing !== undefined && existing !== allocation.groupName) {
                throw new RangeError('Exposure classification history contains conflicting names for one group ID.');
            }
            groups.set(allocation.groupId, allocation.groupName);
        }
    }
    return groups;
}

/**
 * Validate one immutable, user-authored exposure policy version.
 * Every threshold and comparison boundary is explicit; the application supplies no defaults.
 */
export function validateInvestmentExposurePolicy(policy, { accounts, instruments, classifications } = {}) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('An investment exposure policy is required.');
    if (!Array.isArray(accounts) || !Array.isArray(instruments) || !Array.isArray(classifications)) {
        throw new TypeError('Investment accounts, instruments and classifications are required for exposure policy validation.');
    }
    const id = requireText(policy.id, 'Exposure policy ID');
    const policySetId = requireText(policy.policySetId, 'Exposure policy set ID');
    const name = requireText(policy.name, 'Exposure policy name');
    if (!Number.isSafeInteger(policy.version) || policy.version < 1) throw new RangeError('Exposure policy version must be a positive integer.');
    if (!CURRENCIES.has(policy.currency)) throw new RangeError('Exposure policy currency is unsupported.');
    if (!SCOPES.has(policy.scope)) throw new RangeError('Exposure policy scope must be portfolio or account.');
    const accountId = policy.accountId === undefined ? undefined : requireText(policy.accountId, 'Exposure policy account ID');
    if ((policy.scope === 'account') !== Boolean(accountId)) {
        throw new RangeError('Account-scoped exposure policies require exactly one account ID; portfolio policies must not specify one.');
    }
    if (accountId) {
        const account = accounts.find((item) => item.id === accountId);
        if (!account || account.currency !== policy.currency) throw new RangeError('Exposure policy account must exist and use the policy currency.');
    }
    const dimensionId = requireText(policy.dimensionId, 'Exposure policy dimension ID');
    const dimensionName = requireText(policy.dimensionName, 'Exposure policy dimension name');
    const effectiveFrom = requireDate(policy.effectiveFrom, 'Exposure policy effective date');
    const recordedAt = requireTimestamp(policy.recordedAt, 'Exposure policy recorded-at timestamp');
    const groups = classificationGroups(classifications, dimensionId);
    if (!groups.size) throw new RangeError('Exposure policy dimension must exist in validated investment classifications.');
    const classificationDimension = classifications.find((item) => item.dimensionId === dimensionId);
    if (classificationDimension && classificationDimension.dimensionName !== dimensionName) {
        throw new RangeError('Exposure policy dimension name must match the stable classification dimension name.');
    }
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
        throw new RangeError('Exposure policy must contain at least one user-defined maximum exposure limit.');
    }
    const seen = new Set();
    const rules = policy.rules.map((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError('Each exposure limit must be an object.');
        const groupId = requireText(rule.groupId, 'Exposure limit group ID');
        const groupName = requireText(rule.groupName, 'Exposure limit group name');
        if (seen.has(groupId)) throw new RangeError('Exposure limit group IDs must be unique within a policy version.');
        seen.add(groupId);
        if (!groups.has(groupId)) throw new RangeError('Exposure limit must reference a group in the selected classification dimension.');
        if (groups.get(groupId) !== groupName) throw new RangeError('Exposure limit group name must match the stable classification group name.');
        if (!Number.isFinite(rule.maxWeightPercent) || rule.maxWeightPercent < 0 || rule.maxWeightPercent > 100) {
            throw new RangeError('User-defined maximum exposure must be a finite percentage from 0 to 100.');
        }
        if (!COMPARATORS.has(rule.operator)) throw new RangeError('Exposure limit operator must be > or >= and must be selected explicitly.');
        return { groupId, groupName, maxWeightPercent: rule.maxWeightPercent, operator: rule.operator };
    });
    return { id, policySetId, version: policy.version, name, currency: policy.currency, scope,
        ...(accountId ? { accountId } : {}), dimensionId, dimensionName, effectiveFrom, recordedAt, rules };
}

/** Validate append-only policy history and stable dimensions within each policy set. */
export function validateInvestmentExposurePolicies(policies, context) {
    if (!Array.isArray(policies)) throw new TypeError('Investment exposure policies must be an array.');
    const ids = new Set(), versions = new Set(), dimensionsBySet = new Map();
    const validated = policies.map((policy) => {
        const value = validateInvestmentExposurePolicy(policy, context);
        if (ids.has(value.id)) throw new RangeError('Exposure policy IDs must be unique.');
        const versionKey = value.policySetId + ':' + value.version;
        if (versions.has(versionKey)) throw new RangeError('Each exposure policy set version must be unique.');
        const dimensions = JSON.stringify([value.currency, value.scope, value.accountId ?? null, value.dimensionId, value.dimensionName]);
        const existing = dimensionsBySet.get(value.policySetId);
        if (existing !== undefined && existing !== dimensions) {
            throw new RangeError('Versions in one exposure policy set must retain currency, scope, account and classification dimension.');
        }
        ids.add(value.id);
        versions.add(versionKey);
        dimensionsBySet.set(value.policySetId, dimensions);
        return value;
    });
    return validated.sort((a, b) => a.policySetId.localeCompare(b.policySetId) || a.version - b.version);
}

/** Select the latest policy version both effective and known at the requested cutoffs. */
export function selectInvestmentExposurePolicy(policies, {
    asOfDate, recordedAtCutoff, scope, currency, accountId, dimensionId
} = {}, context) {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Exposure policy selection requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentExposurePolicies(policies, context);
    const eligible = validated.filter((policy) => policy.currency === currency && policy.scope === scope
        && (scope !== 'account' || policy.accountId === accountId) && policy.dimensionId === dimensionId
        && Date.parse(policy.effectiveFrom + 'T00:00:00.000Z') <= asOfDate.getTime()
        && Date.parse(policy.recordedAt) <= recordedAtCutoff.getTime());
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.version - a.version);
    return eligible[0] ?? null;
}

/**
 * Evaluate explicit maximum group-weight limits against a complete weighted exposure result.
 * Incomplete exposure is propagated as unavailable; no partial or guessed risk score is produced.
 */
export function evaluateInvestmentExposurePolicy({
    exposure, policy, asOfDate, recordedAtCutoff = asOfDate, accounts, instruments, classifications
}) {
    if (!exposure || typeof exposure !== 'object' || Array.isArray(exposure)) {
        throw new TypeError('A complete weighted exposure result is required.');
    }
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Exposure policy evaluation requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentExposurePolicy(policy, { accounts, instruments, classifications });
    if (Date.parse(validated.effectiveFrom + 'T00:00:00.000Z') > asOfDate.getTime()
        || Date.parse(validated.recordedAt) > recordedAtCutoff.getTime()) {
        throw new RangeError('The exposure policy was not both effective and known at the requested cutoffs.');
    }
    if (exposure.currency !== undefined && exposure.currency !== validated.currency
        || exposure.scope !== undefined && exposure.scope !== validated.scope
        || exposure.scope === 'account' && exposure.accountId !== validated.accountId
        || exposure.dimensionId !== undefined && exposure.dimensionId !== validated.dimensionId) {
        throw new RangeError('Exposure policy dimensions must match the analyzed exposure currency, scope and classification dimension.');
    }
    const dimensions = { policyId: validated.id, policySetId: validated.policySetId,
        policyVersion: validated.version, currency: validated.currency, scope: validated.scope,
        ...(validated.accountId ? { accountId: validated.accountId } : {}),
        dimensionId: validated.dimensionId, dimensionName: validated.dimensionName };
    if (exposure.status === 'unavailable') {
        return { status: 'unavailable', ...dimensions,
            reason: 'Exposure policy evaluation is unavailable because the underlying exposure is incomplete: '
                + String(exposure.reason ?? 'required valuation or classification data is missing.'), results: [] };
    }
    if (exposure.status === 'empty') {
        return { status: 'empty', ...dimensions,
            message: 'No positively valued open positions are available for this exposure policy scope.', results: [] };
    }
    if (exposure.status !== 'available' || !Array.isArray(exposure.rows)) {
        throw new TypeError('Weighted exposure must have available, empty or unavailable status.');
    }
    if (exposure.currency !== validated.currency || exposure.scope !== validated.scope
        || (validated.scope === 'account' && exposure.accountId !== validated.accountId)
        || exposure.dimensionId !== validated.dimensionId) {
        throw new RangeError('Exposure policy dimensions must match the analyzed exposure currency, scope and classification dimension.');
    }
    const actualByGroup = new Map();
    for (const row of exposure.rows) {
        if (!row || typeof row.key !== 'string' || !Number.isFinite(row.actualWeightPercent)
            || row.actualWeightPercent < 0 || row.actualWeightPercent > 100) {
            throw new RangeError('Exposure rows must contain valid group IDs and actual weights from 0 to 100%.');
        }
        if (actualByGroup.has(row.key)) throw new RangeError('Exposure result contains duplicate group IDs.');
        actualByGroup.set(row.key, row.actualWeightPercent);
    }
    const results = validated.rules.map((rule) => {
        const actualWeightPercent = actualByGroup.get(rule.groupId) ?? 0;
        const breached = rule.operator === '>' ? actualWeightPercent > rule.maxWeightPercent
            : actualWeightPercent >= rule.maxWeightPercent;
        return { groupId: rule.groupId, groupName: rule.groupName, actualWeightPercent,
            maxWeightPercent: rule.maxWeightPercent, operator: rule.operator,
            status: breached ? 'breach' : 'withinLimit' };
    });
    const breachCount = results.filter((item) => item.status === 'breach').length;
    return { status: breachCount > 0 ? 'breach' : 'withinLimits', ...dimensions,
        asOfDate: asOfDate.toISOString(), recordedAtCutoff: recordedAtCutoff.toISOString(),
        breachCount, evaluatedRuleCount: results.length, results };
}

/** Validate the persisted exposure-policy collection against current ledger and classification references. */
export function validateInvestmentExposurePolicyCollections(payload) {
    if (!payload || !Array.isArray(payload.investmentExposurePolicies)) {
        throw new TypeError('Investment exposure policies must be an array.');
    }
    return {
        investmentExposurePolicies: validateInvestmentExposurePolicies(payload.investmentExposurePolicies, {
            accounts: payload.investmentAccounts, instruments: payload.investmentInstruments,
            classifications: payload.investmentExposureClassifications
        })
    };
}
