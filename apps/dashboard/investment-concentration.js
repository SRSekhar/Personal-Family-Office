const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const SCOPES = new Set(['portfolio', 'account']);
const GROUPINGS = new Set(['instrumentType', 'instrument']);
const COMPARATORS = new Set(['>', '>=']);
const INSTRUMENT_TYPES = new Set(['Equity', 'MutualFund', 'ETF', 'Bond', 'FixedDeposit', 'PublicProvidentFund', 'NationalPensionSystem', 'EmployeesProvidentFund', 'Gold', 'Silver', 'RealEstateInvestment', 'Cryptocurrency', 'AlternativeInvestment', 'Other']);

function requireText(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new TypeError(label + ' must be a non-empty string.');
    return value.trim();
}
function requireDate(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(label + ' must use YYYY-MM-DD.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new RangeError(label + ' must be a real calendar date.');
    return value;
}
function requireTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical ISO-8601 timestamp.');
    }
    return value;
}

/**
 * Validate one immutable, user-authored concentration policy version.
 * Each rule limits the percentage of the selected currency/scope held in one allocation group.
 * The application supplies no thresholds: every rule and comparison operator is explicit.
 */
export function validateInvestmentConcentrationPolicy(policy, { accounts, instruments } = {}) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('A concentration policy is required.');
    if (!Array.isArray(accounts) || !Array.isArray(instruments)) throw new TypeError('Investment accounts and instruments are required for policy validation.');
    const id = requireText(policy.id, 'Concentration policy ID');
    const policySetId = requireText(policy.policySetId, 'Concentration policy set ID');
    const name = requireText(policy.name, 'Concentration policy name');
    if (!Number.isSafeInteger(policy.version) || policy.version < 1) throw new RangeError('Concentration policy version must be a positive integer.');
    if (!CURRENCIES.has(policy.currency)) throw new RangeError('Concentration policy currency is unsupported.');
    if (!SCOPES.has(policy.scope)) throw new RangeError('Concentration policy scope must be portfolio or account.');
    const accountId = policy.accountId === undefined ? undefined : requireText(policy.accountId, 'Concentration policy account ID');
    if ((policy.scope === 'account') !== Boolean(accountId)) throw new RangeError('Account-scoped concentration policies require exactly one account ID; portfolio policies must not specify one.');
    if (accountId) {
        const account = accounts.find((item) => item.id === accountId);
        if (!account || account.currency !== policy.currency) throw new RangeError('Concentration policy account must exist and use the policy currency.');
    }
    if (!GROUPINGS.has(policy.groupBy)) throw new RangeError('Concentration policy grouping must be instrumentType or instrument.');
    const effectiveFrom = requireDate(policy.effectiveFrom, 'Concentration policy effective date');
    const recordedAt = requireTimestamp(policy.recordedAt, 'Concentration policy recorded-at timestamp');
    if (!Array.isArray(policy.rules) || policy.rules.length === 0) throw new RangeError('Concentration policy must contain at least one user-defined limit.');
    const seen = new Set();
    const rules = policy.rules.map((rule) => {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError('Each concentration limit must be an object.');
        const key = requireText(rule.key, 'Concentration limit group key');
        if (seen.has(key)) throw new RangeError('Concentration limit group keys must be unique within a policy.');
        seen.add(key);
        if (!Number.isFinite(rule.maxWeightPercent) || rule.maxWeightPercent < 0 || rule.maxWeightPercent > 100) {
            throw new RangeError('User-defined maximum concentration must be a finite percentage from 0 to 100.');
        }
        if (!COMPARATORS.has(rule.operator)) throw new RangeError('Concentration limit operator must be > or >= and must be selected explicitly.');
        if (policy.groupBy === 'instrumentType') {
            if (!INSTRUMENT_TYPES.has(key)) throw new RangeError('Concentration limit contains an unsupported instrument type: ' + key);
        } else {
            const instrument = instruments.find((item) => item.id === key);
            if (!instrument || instrument.currency !== policy.currency) {
                throw new RangeError('Instrument concentration limits must reference an existing instrument in the policy currency.');
            }
        }
        return { key, maxWeightPercent: rule.maxWeightPercent, operator: rule.operator };
    });
    return { id, policySetId, version: policy.version, name, currency: policy.currency, scope: policy.scope,
        ...(accountId ? { accountId } : {}), groupBy: policy.groupBy, effectiveFrom, recordedAt, rules };
}

/** Validate append-only policy history and stable dimensions within each policy set. */
export function validateInvestmentConcentrationPolicies(policies, context) {
    if (!Array.isArray(policies)) throw new TypeError('Investment concentration policies must be an array.');
    const ids = new Set(), versions = new Set(), dimensionsBySet = new Map();
    const validated = policies.map((policy) => {
        const value = validateInvestmentConcentrationPolicy(policy, context);
        if (ids.has(value.id)) throw new RangeError('Concentration policy IDs must be unique.');
        const versionKey = value.policySetId + ':' + value.version;
        if (versions.has(versionKey)) throw new RangeError('Each concentration policy set version must be unique.');
        const dimensions = JSON.stringify([value.currency, value.scope, value.accountId ?? null, value.groupBy]);
        const existing = dimensionsBySet.get(value.policySetId);
        if (existing !== undefined && existing !== dimensions) {
            throw new RangeError('Versions in one concentration policy set must retain currency, scope, account and grouping.');
        }
        ids.add(value.id);
        versions.add(versionKey);
        dimensionsBySet.set(value.policySetId, dimensions);
        return value;
    });
    return validated.sort((a, b) => a.policySetId.localeCompare(b.policySetId) || a.version - b.version);
}

/** Select the immutable policy version effective and known at the requested cutoffs. */
export function selectInvestmentConcentrationPolicy(policies, { asOfDate, recordedAtCutoff, scope, currency, accountId } = {}, context) {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Concentration policy selection requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentConcentrationPolicies(policies, context);
    const eligible = validated.filter((policy) => policy.currency === currency && policy.scope === scope
        && (scope !== 'account' || policy.accountId === accountId)
        && Date.parse(policy.effectiveFrom + 'T00:00:00.000Z') <= asOfDate.getTime()
        && Date.parse(policy.recordedAt) <= recordedAtCutoff.getTime());
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.version - a.version);
    return eligible[0] ?? null;
}

/**
 * Evaluate explicit per-group maximum weight limits against a complete allocation result.
 * The metric is actual group market value / total market value in the selected currency and scope.
 * No cross-currency conversion, inferred limit, severity score or recommended action is produced.
 */
export function evaluateInvestmentConcentrationPolicy({ allocation, policy, asOfDate, recordedAtCutoff = asOfDate, accounts, instruments }) {
    if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) throw new TypeError('A complete allocation analysis result is required.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Concentration evaluation requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentConcentrationPolicy(policy, { accounts, instruments });
    if (Date.parse(validated.effectiveFrom + 'T00:00:00.000Z') > asOfDate.getTime()
        || Date.parse(validated.recordedAt) > recordedAtCutoff.getTime()) {
        throw new RangeError('The concentration policy was not both effective and known at the requested cutoffs.');
    }
    if (allocation.status === 'unavailable') {
        return { status: 'unavailable', policyId: validated.id, currency: validated.currency,
            reason: 'Concentration evaluation is unavailable because the underlying allocation is incomplete: ' + String(allocation.reason ?? 'required valuation data is missing.') , results: [] };
    }
    if (allocation.status === 'empty') {
        return { status: 'empty', policyId: validated.id, currency: validated.currency,
            message: 'No positively valued open positions are available for this concentration policy scope.', results: [] };
    }
    if (allocation.status !== 'available' || !Array.isArray(allocation.rows)) throw new TypeError('Allocation analysis must have available, empty or unavailable status.');
    if (allocation.currency !== validated.currency || allocation.scope !== validated.scope
        || (validated.scope === 'account' && allocation.accountId !== validated.accountId)
        || allocation.groupBy !== validated.groupBy) {
        throw new RangeError('Concentration policy dimensions must match the analyzed allocation currency, scope and grouping.');
    }
    const actualByKey = new Map();
    for (const row of allocation.rows) {
        if (!row || typeof row.key !== 'string' || !Number.isFinite(row.actualWeightPercent)
            || row.actualWeightPercent < 0 || row.actualWeightPercent > 100) {
            throw new RangeError('Allocation rows must contain valid group keys and actual weights from 0 to 100%.');
        }
        if (actualByKey.has(row.key)) throw new RangeError('Allocation result contains duplicate group keys.');
        actualByKey.set(row.key, row.actualWeightPercent);
    }
    const results = validated.rules.map((rule) => {
        const actualWeightPercent = actualByKey.get(rule.key) ?? 0;
        const breached = rule.operator === '>' ? actualWeightPercent > rule.maxWeightPercent
            : actualWeightPercent >= rule.maxWeightPercent;
        return { key: rule.key, actualWeightPercent, maxWeightPercent: rule.maxWeightPercent,
            operator: rule.operator, status: breached ? 'breach' : 'withinLimit' };
    });
    const breachCount = results.filter((item) => item.status === 'breach').length;
    return { status: breachCount > 0 ? 'breach' : 'withinLimits', policyId: validated.id,
        policySetId: validated.policySetId, policyVersion: validated.version, currency: validated.currency,
        scope: validated.scope, ...(validated.accountId ? { accountId: validated.accountId } : {}),
        groupBy: validated.groupBy, asOfDate: asOfDate.toISOString(), recordedAtCutoff: recordedAtCutoff.toISOString(),
        breachCount, evaluatedRuleCount: results.length, results };
}
