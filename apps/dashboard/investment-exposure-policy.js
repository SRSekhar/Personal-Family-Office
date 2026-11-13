const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const SCOPES = new Set(['portfolio', 'account']);
const COMPARATORS = new Set(['>', '>=']);

function requireText(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new TypeError(label + ' must be a non-empty string.');
    return value.trim();
}
function requireDate(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(label + ' must use YYYY-MM-DD.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new RangeError(label + ' must be a real calendar date.');
    }
    return value;
}
function requireTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical ISO-8601 timestamp.');
    }
    return value;
}
function validateClassificationContext({ accounts, instruments, classifications }) {
    if (!Array.isArray(accounts) || !Array.isArray(instruments) || !Array.isArray(classifications)) {
        throw new TypeError('Investment accounts, instruments and exposure classifications are required.');
    }
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    const groups = new Map();
    const dimensions = new Map();
    for (const classification of classifications) {
        const instrument = instrumentMap.get(classification.instrumentId);
        if (!instrument) throw new RangeError('An exposure classification references an unknown instrument.');
        const dimensionName = dimensions.get(classification.dimensionId);
        if (dimensionName !== undefined && dimensionName !== classification.dimensionName) {
            throw new RangeError('An exposure dimension ID cannot have conflicting display names.');
        }
        dimensions.set(classification.dimensionId, classification.dimensionName);
        for (const allocation of classification.allocations) {
            const key = [instrument.currency, classification.dimensionId, allocation.groupId].join('|');
            const existing = groups.get(key);
            if (existing !== undefined && existing !== allocation.groupName) {
                throw new RangeError('An exposure group ID cannot have conflicting display names within a dimension.');
            }
            groups.set(key, allocation.groupName);
        }
    }
    return { instrumentMap, accountMap, groups, dimensions };
}

/** Validate one immutable user-authored maximum exposure policy version. */
export function validateInvestmentExposurePolicy(policy, context = {}) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('An investment exposure policy is required.');
    const { accounts, instruments, classifications } = context;
    const references = validateClassificationContext({ accounts, instruments, classifications });
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
        const account = references.accountMap.get(accountId);
        if (!account || account.currency !== policy.currency) throw new RangeError('Exposure policy account must exist and use the policy currency.');
    }
    const dimensionId = requireText(policy.dimensionId, 'Exposure policy dimension ID');
    const dimensionName = requireText(policy.dimensionName, 'Exposure policy dimension name');
    if (references.dimensions.get(dimensionId) !== dimensionName) {
        throw new RangeError('Exposure policy dimension must match an existing stable classification dimension.');
    }
    const effectiveFrom = requireDate(policy.effectiveFrom, 'Exposure policy effective date');
    const recordedAt = requireTimestamp(policy.recordedAt, 'Exposure policy recorded-at timestamp');
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
        throw new RangeError('Exposure policy must contain at least one user-defined group limit.');
    }
    const seen = new Set();
    const rules = policy.rules.map((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError('Each exposure limit must be an object.');
        const groupId = requireText(rule.groupId, 'Exposure limit group ID');
        if (seen.has(groupId)) throw new RangeError('Exposure limit group IDs must be unique within a policy.');
        seen.add(groupId);
        if (!references.groups.has([policy.currency, dimensionId, groupId].join('|'))) {
            throw new RangeError('Exposure limit group must exist in a classification for the policy currency and dimension.');
        }
        if (!Number.isFinite(rule.maxWeightPercent) || rule.maxWeightPercent < 0 || rule.maxWeightPercent > 100) {
            throw new RangeError('User-defined maximum exposure must be a finite percentage from 0 through 100.');
        }
        if (!COMPARATORS.has(rule.operator)) throw new RangeError('Exposure limit operator must be > or >= and must be selected explicitly.');
        return { groupId, maxWeightPercent: rule.maxWeightPercent, operator: rule.operator };
    });
    return { id, policySetId, version: policy.version, name, currency: policy.currency, scope: policy.scope,
        ...(accountId ? { accountId } : {}), dimensionId, dimensionName, effectiveFrom, recordedAt, rules };
}

/** Validate immutable policy history and stable scope/dimension identity within each policy set. */
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
            throw new RangeError('Versions in one exposure policy set must retain currency, scope, account and dimension.');
        }
        ids.add(value.id);
        versions.add(versionKey);
        dimensionsBySet.set(value.policySetId, dimensions);
        return value;
    });
    return validated.sort((a, b) => a.policySetId.localeCompare(b.policySetId) || a.version - b.version);
}

/** Select the latest policy version both effective and recorded by the requested cutoffs. */
export function selectInvestmentExposurePolicy(policies, {
    asOfDate, recordedAtCutoff, policySetId, scope, currency, accountId, dimensionId
} = {}, context) {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Exposure policy selection requires valid effective and recorded-at cutoffs.');
    }
    const normalizedPolicySetId = requireText(policySetId, 'Exposure policy set ID');
    const validated = validateInvestmentExposurePolicies(policies, context);
    const eligible = validated.filter((policy) => policy.policySetId === normalizedPolicySetId
        && policy.currency === currency && policy.scope === scope
        && policy.dimensionId === dimensionId && (scope !== 'account' || policy.accountId === accountId)
        && Date.parse(policy.effectiveFrom + 'T00:00:00.000Z') <= asOfDate.getTime()
        && Date.parse(policy.recordedAt) <= recordedAtCutoff.getTime());
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.version - a.version);
    return eligible[0] ?? null;
}

/**
 * Evaluate only explicitly configured maximum group weights against a complete
 * look-through exposure result. Missing groups in an otherwise complete portfolio
 * have zero measured exposure. Unavailable/empty source analyses stay unavailable/empty.
 */
export function evaluateInvestmentExposurePolicy({
    exposure, policy, asOfDate, recordedAtCutoff = asOfDate, accounts, instruments, classifications
}) {
    if (!exposure || typeof exposure !== 'object' || Array.isArray(exposure)) {
        throw new TypeError('A complete look-through exposure result is required.');
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
    if (exposure.currency !== validated.currency || exposure.scope !== validated.scope
        || (validated.scope === 'account' && exposure.accountId !== validated.accountId)
        || (validated.scope === 'portfolio' && exposure.accountId !== undefined)
        || exposure.dimensionId !== validated.dimensionId || exposure.dimensionName !== validated.dimensionName) {
        throw new RangeError('Exposure policy dimensions must match the analyzed currency, scope, account and classification dimension.');
    }
    if (exposure.status === 'unavailable') {
        return { status: 'unavailable', policyId: validated.id, currency: validated.currency,
            reason: 'Exposure policy evaluation is unavailable because the underlying look-through data is incomplete: '
                + String(exposure.reason ?? 'required classification or valuation data is missing.'), results: [] };
    }
    if (exposure.status === 'empty') {
        return { status: 'empty', policyId: validated.id, currency: validated.currency,
            message: 'No positively valued open positions are available for this exposure policy scope.', results: [] };
    }
    if (exposure.status !== 'available' || !Array.isArray(exposure.rows)) {
        throw new TypeError('Look-through exposure must have available, empty or unavailable status.');
    }
    if (exposure.asOfDate !== asOfDate.toISOString() || exposure.recordedAtCutoff !== recordedAtCutoff.toISOString()) {
        throw new RangeError('Exposure policy cutoffs must exactly match the analyzed look-through result.');
    }
    if (!Number.isFinite(exposure.totalValue) || exposure.totalValue <= 0 || exposure.rows.length === 0) {
        throw new RangeError('An available exposure result must have a positive total value and at least one group.');
    }
    const actualByGroup = new Map();
    let actualWeightTotal = 0;
    for (const row of exposure.rows) {
        if (!row || typeof row.key !== 'string' || row.key.trim() === '' || !Number.isFinite(row.actualWeightPercent)
            || row.actualWeightPercent < 0 || row.actualWeightPercent > 100) {
            throw new RangeError('Exposure rows must contain valid group IDs and actual weights from 0 to 100%.');
        }
        if (actualByGroup.has(row.key)) throw new RangeError('Exposure result contains duplicate group IDs.');
        actualByGroup.set(row.key, row.actualWeightPercent);
        actualWeightTotal += row.actualWeightPercent;
    }
    if (!Number.isFinite(actualWeightTotal) || Math.abs(actualWeightTotal - 100) > 0.01) {
        throw new RangeError('Available exposure group weights must reconcile to 100% (tolerance 0.01 percentage points).');
    }
    const results = validated.rules.map((rule) => {
        const actualWeightPercent = actualByGroup.get(rule.groupId) ?? 0;
        const breached = rule.operator === '>' ? actualWeightPercent > rule.maxWeightPercent
            : actualWeightPercent >= rule.maxWeightPercent;
        return { groupId: rule.groupId, actualWeightPercent, maxWeightPercent: rule.maxWeightPercent,
            operator: rule.operator, status: breached ? 'breach' : 'withinLimit' };
    });
    const breachCount = results.filter((item) => item.status === 'breach').length;
    return { status: breachCount > 0 ? 'breach' : 'withinLimits', policyId: validated.id,
        policySetId: validated.policySetId, policyVersion: validated.version, currency: validated.currency,
        scope: validated.scope, ...(validated.accountId ? { accountId: validated.accountId } : {}),
        dimensionId: validated.dimensionId, dimensionName: validated.dimensionName,
        asOfDate: asOfDate.toISOString(), recordedAtCutoff: recordedAtCutoff.toISOString(),
        breachCount, evaluatedRuleCount: results.length, results };
}

/** Validate the persisted exposure-policy collection against ledger and classification references. */
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
