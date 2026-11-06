const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const ACCOUNT_SCOPES = new Set(['portfolio', 'account']);
const GROUPINGS = new Set(['instrumentType', 'instrument']);
const INSTRUMENT_TYPES = new Set(['Equity', 'MutualFund', 'ETF', 'Bond', 'FixedDeposit', 'PublicProvidentFund', 'NationalPensionSystem', 'EmployeesProvidentFund', 'Gold', 'Silver', 'RealEstateInvestment', 'Cryptocurrency', 'AlternativeInvestment', 'Other']);
const WEIGHT_TOLERANCE = 1e-8;
const VALUE_TOLERANCE = 1e-8;

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
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new TypeError(label + ' must be a canonical ISO-8601 timestamp.');
    return value;
}

/** Validate one immutable allocation-policy version. Targets must total 100%. */
export function validateInvestmentAllocationPolicy(policy, { accounts, instruments } = {}) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new TypeError('An allocation policy is required.');
    if (!Array.isArray(accounts) || !Array.isArray(instruments)) throw new TypeError('Investment accounts and instruments are required for policy validation.');
    const id = requireText(policy.id, 'Allocation policy ID');
    const policySetId = requireText(policy.policySetId, 'Allocation policy set ID');
    const name = requireText(policy.name, 'Allocation policy name');
    if (!Number.isSafeInteger(policy.version) || policy.version < 1) throw new RangeError('Allocation policy version must be a positive integer.');
    if (!CURRENCIES.has(policy.currency)) throw new RangeError('Allocation policy currency is unsupported.');
    if (!ACCOUNT_SCOPES.has(policy.scope)) throw new RangeError('Allocation policy scope must be portfolio or account.');
    const accountId = policy.accountId === undefined ? undefined : requireText(policy.accountId, 'Allocation policy account ID');
    if ((policy.scope === 'account') !== Boolean(accountId)) throw new RangeError('Account-scoped policies require exactly one account ID; portfolio policies must not specify one.');
    if (accountId) {
        const account = accounts.find((item) => item.id === accountId);
        if (!account || account.currency !== policy.currency) throw new RangeError('Allocation policy account must exist and use the policy currency.');
    }
    if (!GROUPINGS.has(policy.groupBy)) throw new RangeError('Allocation policy grouping must be instrumentType or instrument.');
    const effectiveFrom = requireDate(policy.effectiveFrom, 'Allocation policy effective date');
    const recordedAt = requireTimestamp(policy.recordedAt, 'Allocation policy recorded-at timestamp');
    if (!Array.isArray(policy.targets) || policy.targets.length === 0) throw new RangeError('Allocation policy must contain at least one target.');
    const seen = new Set();
    const targets = policy.targets.map((target) => {
        if (!target || typeof target !== 'object' || Array.isArray(target)) throw new TypeError('Each allocation target must be an object.');
        const key = requireText(target.key, 'Allocation target key');
        if (seen.has(key)) throw new RangeError('Allocation target keys must be unique within a policy.');
        seen.add(key);
        if (!Number.isFinite(target.weightPercent) || target.weightPercent < 0 || target.weightPercent > 100) throw new RangeError('Allocation target weights must be finite percentages from 0 to 100.');
        if (policy.groupBy === 'instrumentType') {
            if (!INSTRUMENT_TYPES.has(key)) throw new RangeError('Allocation target contains an unsupported instrument type: ' + key);
        } else {
            const instrument = instruments.find((item) => item.id === key);
            if (!instrument || instrument.currency !== policy.currency) throw new RangeError('Instrument allocation targets must reference an existing instrument in the policy currency.');
        }
        return { key, weightPercent: target.weightPercent };
    });
    const totalWeight = targets.reduce((sum, target) => sum + target.weightPercent, 0);
    if (Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) throw new RangeError('Allocation target weights must total 100%; received ' + totalWeight + '%.');
    return { id, policySetId, version: policy.version, name, currency: policy.currency, scope: policy.scope,
        ...(accountId ? { accountId } : {}), groupBy: policy.groupBy, effectiveFrom, recordedAt, targets };
}

/** Validate append-only policy history: IDs and policy-set versions are unique. */
export function validateInvestmentAllocationPolicies(policies, context) {
    if (!Array.isArray(policies)) throw new TypeError('Investment allocation policies must be an array.');
    const ids = new Set(), versions = new Set();
    const validated = policies.map((policy) => {
        const value = validateInvestmentAllocationPolicy(policy, context);
        if (ids.has(value.id)) throw new RangeError('Allocation policy IDs must be unique.');
        const versionKey = value.policySetId + ':' + value.version;
        if (versions.has(versionKey)) throw new RangeError('Each allocation policy set version must be unique.');
        ids.add(value.id); versions.add(versionKey);
        return value;
    });
    return validated.sort((a, b) => a.policySetId.localeCompare(b.policySetId) || a.version - b.version);
}

/** Compare a policy with valued FIFO positions; missing valuation suppresses partial results. */
export function analyzeInvestmentAllocation({ positions, instruments, accounts, policy, asOfDate, recordedAtCutoff = asOfDate }) {
    if (!Array.isArray(positions) || !Array.isArray(instruments) || !Array.isArray(accounts)) throw new TypeError('Positions, instruments and accounts must be arrays.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime()) || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Allocation analysis requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentAllocationPolicy(policy, { accounts, instruments });
    if (Date.parse(validated.effectiveFrom + 'T00:00:00.000Z') > asOfDate.getTime()
        || Date.parse(validated.recordedAt) > recordedAtCutoff.getTime()) {
        throw new RangeError('The allocation policy was not both effective and known at the requested cutoffs.');
    }
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    const selected = positions.filter((position) => position.currency === validated.currency && (validated.scope === 'portfolio' || position.accountId === validated.accountId));
    const included = [];
    for (const position of selected) {
        const instrument = instrumentMap.get(position.instrumentId);
        const account = accountMap.get(position.accountId);
        if (!instrument || instrument.currency !== validated.currency || position.currency !== instrument.currency) throw new RangeError('A position references an unknown or wrong-currency instrument.');
        if (!account || account.currency !== instrument.currency) throw new RangeError('A position references an unknown account or an account with a different currency.');
        if (!Number.isFinite(position.quantity) || position.quantity < 0) throw new RangeError('Position quantity must be non-negative and finite.');
        if (position.quantity <= VALUE_TOLERANCE) continue;
        if (position.marketValue === null || position.marketValue === undefined) return {
            status: 'unavailable', currency: validated.currency,
            reason: 'At least one open position has no eligible valuation; partial allocation is suppressed.', rows: []
        };
        if (!Number.isFinite(position.marketValue) || position.marketValue < 0) throw new RangeError('Position market value must be non-negative and finite.');
        included.push({ position, instrument });
    }
    const totalValue = included.reduce((sum, item) => sum + item.position.marketValue, 0);
    if (!Number.isFinite(totalValue)) throw new RangeError('Portfolio market value exceeds the supported numeric range.');
    if (totalValue <= VALUE_TOLERANCE) return {
        status: 'empty', currency: validated.currency, totalValue: 0, rows: [],
        message: 'No positively valued open positions are available for this policy scope.'
    };
    const buckets = new Map();
    for (const { position, instrument } of included) {
        const key = validated.groupBy === 'instrumentType' ? instrument.type : instrument.id;
        const bucket = buckets.get(key) ?? { key, actualValue: 0 };
        bucket.actualValue += position.marketValue;
        buckets.set(key, bucket);
    }
    const targetMap = new Map(validated.targets.map((target) => [target.key, target.weightPercent]));
    const keys = [...new Set([...buckets.keys(), ...targetMap.keys()])].sort((a, b) => a.localeCompare(b));
    const rows = keys.map((key) => {
        const actualValue = buckets.get(key)?.actualValue ?? 0;
        const actualWeightPercent = actualValue / totalValue * 100;
        const targetWeightPercent = targetMap.get(key) ?? 0;
        const targetValue = totalValue * targetWeightPercent / 100;
        return { key, actualValue, actualWeightPercent, targetWeightPercent,
            driftPercentagePoints: actualWeightPercent - targetWeightPercent, driftValue: actualValue - targetValue };
    });
    const hhi = rows.reduce((sum, row) => sum + (row.actualWeightPercent / 100) ** 2, 0);
    return { status: 'available', policyId: validated.id, policySetId: validated.policySetId, policyVersion: validated.version,
        currency: validated.currency, scope: validated.scope, ...(validated.accountId ? { accountId: validated.accountId } : {}),
        groupBy: validated.groupBy, asOfDate: asOfDate.toISOString(), recordedAtCutoff: recordedAtCutoff.toISOString(),
        totalValue, hhi, effectiveCategoryCount: hhi > 0 ? 1 / hhi : null,
        largestCategorySharePercent: Math.max(...rows.map((row) => row.actualWeightPercent)), rows };
}

/** Select the policy version known at the recorded-at cutoff and effective on the requested date. */
export function selectInvestmentAllocationPolicy(policies, { asOfDate, recordedAtCutoff, scope, currency, accountId } = {}, context) {
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Policy selection requires valid effective and recorded-at cutoffs.');
    }
    const validated = validateInvestmentAllocationPolicies(policies, context);
    const eligible = validated.filter((policy) => policy.currency === currency && policy.scope === scope
        && (scope !== 'account' || policy.accountId === accountId)
        && Date.parse(policy.effectiveFrom + 'T00:00:00.000Z') <= asOfDate.getTime()
        && Date.parse(policy.recordedAt) <= recordedAtCutoff.getTime());
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.version - a.version);
    return eligible[0] ?? null;
}
