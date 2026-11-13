const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const SOURCE_TYPES = new Set(['manual', 'import', 'provider', 'correction']);
const WEIGHT_TOTAL_TOLERANCE = 0.01;

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

/**
 * Validate one immutable, user-authored look-through classification snapshot.
 * Every instrument/dimension snapshot must allocate 100% across distinct groups.
 */
export function validateInvestmentExposureClassification(classification, { instruments } = {}) {
    if (!classification || typeof classification !== 'object' || Array.isArray(classification)) {
        throw new TypeError('An investment exposure classification is required.');
    }
    if (!Array.isArray(instruments)) throw new TypeError('Investment instruments are required for classification validation.');
    const id = requireText(classification.id, 'Exposure classification ID');
    const instrumentId = requireText(classification.instrumentId, 'Exposure classification instrument ID');
    const instrument = instruments.find((item) => item.id === instrumentId);
    if (!instrument) throw new RangeError('Exposure classification references an unknown investment instrument.');
    const dimensionId = requireText(classification.dimensionId, 'Exposure dimension ID');
    const dimensionName = requireText(classification.dimensionName, 'Exposure dimension name');
    const effectiveFrom = requireDate(classification.effectiveFrom, 'Exposure effective date');
    const recordedAt = requireTimestamp(classification.recordedAt, 'Exposure recorded-at timestamp');
    if (!SOURCE_TYPES.has(classification.sourceType)) throw new RangeError('Exposure classification source type is unsupported.');
    const sourceName = requireText(classification.sourceName, 'Exposure classification source name');
    const evidenceReference = classification.evidenceReference === undefined
        ? undefined : requireText(classification.evidenceReference, 'Exposure evidence reference');
    if (!Array.isArray(classification.allocations) || classification.allocations.length === 0) {
        throw new RangeError('A classification must contain at least one group allocation.');
    }
    const seen = new Set();
    const allocations = classification.allocations.map((allocation) => {
        if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) {
            throw new TypeError('Each exposure group allocation must be an object.');
        }
        const groupId = requireText(allocation.groupId, 'Exposure group ID');
        const groupName = requireText(allocation.groupName, 'Exposure group name');
        if (seen.has(groupId)) throw new RangeError('Exposure group IDs must be unique within an instrument and dimension.');
        seen.add(groupId);
        if (!Number.isFinite(allocation.weightPercent) || allocation.weightPercent <= 0 || allocation.weightPercent > 100) {
            throw new RangeError('Exposure allocation weights must be finite percentages greater than 0 and at most 100.');
        }
        return { groupId, groupName, weightPercent: allocation.weightPercent };
    });
    const totalWeight = allocations.reduce((sum, item) => sum + item.weightPercent, 0);
    if (Math.abs(totalWeight - 100) > WEIGHT_TOTAL_TOLERANCE) {
        throw new RangeError('Exposure allocation weights must reconcile to 100% (tolerance 0.01 percentage points).');
    }
    return { id, instrumentId, dimensionId, dimensionName, effectiveFrom, recordedAt,
        sourceType: classification.sourceType, sourceName, allocations,
        ...(evidenceReference === undefined ? {} : { evidenceReference }) };
}

/** Validate immutable classification history and reject duplicate IDs or duplicate bitemporal snapshots. */
export function validateInvestmentExposureClassifications(classifications, context) {
    if (!Array.isArray(classifications)) throw new TypeError('Investment exposure classifications must be an array.');
    const validated = classifications.map((item) => validateInvestmentExposureClassification(item, context));
    const ids = new Set();
    const snapshots = new Set();
    const dimensionNames = new Map();
    for (const item of validated) {
        if (ids.has(item.id)) throw new RangeError('Exposure classification IDs must be unique.');
        ids.add(item.id);
        const knownDimensionName = dimensionNames.get(item.dimensionId);
        if (knownDimensionName !== undefined && knownDimensionName !== item.dimensionName) {
            throw new RangeError('A stable exposure dimension ID cannot have conflicting display names.');
        }
        dimensionNames.set(item.dimensionId, item.dimensionName);
        const key = [item.instrumentId, item.dimensionId, item.effectiveFrom, item.recordedAt].join('|');
        if (snapshots.has(key)) throw new RangeError('An instrument/dimension cannot have duplicate effective and recorded-at snapshots.');
        snapshots.add(key);
    }
    return validated;
}

/** Select the latest classification that was both effective and known at the requested cutoffs. */
export function selectInvestmentExposureClassification(validatedClassifications, { instrumentId, dimensionId, asOfDate, recordedAtCutoff }) {
    if (!Array.isArray(classifications)) throw new TypeError('Exposure classifications must be an array.');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Exposure classification selection requires valid effective and recorded-at cutoffs.');
    }
    const eligible = classifications.filter((item) => item.instrumentId === instrumentId && item.dimensionId === dimensionId
        && Date.parse(item.effectiveFrom + 'T00:00:00.000Z') <= asOfDate.getTime()
        && Date.parse(item.recordedAt) <= recordedAtCutoff.getTime());
    eligible.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)
        || Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    return eligible[0] ?? null;
}

/**
 * Aggregate weighted look-through market exposure from complete FIFO positions.
 * Any positively-held instrument without a complete eligible classification makes
 * the entire result unavailable; no partial denominator or silent exclusion is used.
 */
export function analyzeInvestmentExposurePositions({
    positions, instruments, accounts, classifications, dimensionId, dimensionName,
    currency, scope = 'portfolio', accountId, asOfDate, recordedAtCutoff = asOfDate
}) {
    if (![positions, instruments, accounts, classifications].every(Array.isArray)) {
        throw new TypeError('Positions, instruments, accounts and classifications must be arrays.');
    }
    if (!CURRENCIES.has(currency)) throw new RangeError('Exposure analysis currency is unsupported.');
    if (!['portfolio', 'account'].includes(scope) || (scope === 'account') !== Boolean(accountId)) {
        throw new RangeError('Exposure analysis scope must be portfolio or account with exactly one account ID.');
    }
    const normalizedDimensionId = requireText(dimensionId, 'Exposure dimension ID');
    const normalizedDimensionName = requireText(dimensionName, 'Exposure dimension name');
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())
        || !(recordedAtCutoff instanceof Date) || !Number.isFinite(recordedAtCutoff.getTime())) {
        throw new RangeError('Exposure analysis requires valid effective and recorded-at cutoffs.');
    }
    const validatedClassifications = validateInvestmentExposureClassifications(classifications, { instruments });
    const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    if (scope === 'account') {
        const selectedAccount = accountMap.get(accountId);
        if (!selectedAccount || selectedAccount.currency !== currency) {
            throw new RangeError('The selected exposure account must exist and use the requested currency.');
        }
    }
    const selected = positions.filter((position) => scope === 'portfolio'
        ? position.currency === currency : position.accountId === accountId);
    const included = [];
    const unclassifiedPositions = [];
    for (const position of selected) {
        const instrument = instrumentMap.get(position.instrumentId);
        const account = accountMap.get(position.accountId);
        if (!instrument || !account || instrument.currency !== position.currency || account.currency !== position.currency) {
            throw new RangeError('A position references an unknown or wrong-currency instrument/account.');
        }
        if (!Number.isFinite(position.quantity) || position.quantity < 0) throw new RangeError('Position quantity must be non-negative and finite.');
        if (position.quantity <= 1e-8) continue;
        if (position.marketValue === null || position.marketValue === undefined) {
            return { status: 'unavailable', currency, scope, ...(accountId ? { accountId } : {}),
                dimensionId: normalizedDimensionId, dimensionName: normalizedDimensionName,
                reason: 'At least one open position has no eligible valuation; partial exposure is suppressed.',
                unclassifiedPositions: [], rows: [] };
        }
        if (!Number.isFinite(position.marketValue) || position.marketValue < 0) {
            throw new RangeError('Position market value must be non-negative and finite.');
        }
        if (position.marketValue <= 1e-8) continue;
        const classification = selectInvestmentExposureClassification(validatedClassifications, {
            instrumentId: instrument.id, dimensionId: normalizedDimensionId, asOfDate, recordedAtCutoff
        });
        if (!classification) {
            unclassifiedPositions.push({ accountId: position.accountId, instrumentId: instrument.id,
                instrumentName: instrument.name, marketValue: position.marketValue, currency,
                reason: 'No classification was both effective and recorded by the selected cutoffs.' });
        } else {
            included.push({ position, classification });
        }
    }
    const dimensions = { currency, scope, ...(accountId ? { accountId } : {}),
        dimensionId: normalizedDimensionId, dimensionName: normalizedDimensionName };
    if (unclassifiedPositions.length) {
        return { status: 'unavailable', ...dimensions,
            reason: 'One or more open positions are unclassified for this dimension; partial exposure is suppressed.',
            unclassifiedPositions, rows: [] };
    }
    const totalValue = included.reduce((sum, item) => sum + item.position.marketValue, 0);
    if (!Number.isFinite(totalValue)) throw new RangeError('Portfolio market value exceeds the supported numeric range.');
    if (totalValue <= 1e-8) return { status: 'empty', ...dimensions, totalValue: 0, unclassifiedPositions: [], rows: [],
        message: 'No positively valued open positions are available for this exposure scope.' };
    const buckets = new Map();
    for (const { position, classification } of included) {
        const totalWeight = classification.allocations.reduce((sum, allocation) => sum + allocation.weightPercent, 0);
        for (const allocation of classification.allocations) {
            const actualValue = position.marketValue * allocation.weightPercent / totalWeight;
            const key = allocation.groupId;
            const bucket = buckets.get(key) ?? { key, groupName: allocation.groupName, actualValue: 0 };
            bucket.actualValue += actualValue;
            buckets.set(key, bucket);
        }
    }
    const rows = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
        .map((item) => ({ ...item, actualWeightPercent: item.actualValue / totalValue * 100 }));
    return { status: 'available', ...dimensions, totalValue, asOfDate: asOfDate.toISOString(),
        recordedAtCutoff: recordedAtCutoff.toISOString(), unclassifiedPositions: [], rows };
}
