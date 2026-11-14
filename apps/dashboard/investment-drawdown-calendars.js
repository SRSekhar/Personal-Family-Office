const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);

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

/**
 * Validate immutable, explicitly authored daily-close schedules.
 * The calendar is a list of expected timestamps, not a generated business-day
 * calendar: weekends, holidays and market sessions are never inferred.
 */
export function validateInvestmentDrawdownCalendars(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.investmentDrawdownCalendars)) {
        throw new Error('Investment drawdown calendars must be an array.');
    }
    const calendars = input.investmentDrawdownCalendars;
    const accountIds = new Set(Array.isArray(input.investmentAccounts) ? input.investmentAccounts.map((account) => account.id) : []);
    const ids = new Set();
    for (const item of calendars) {
        const id = text(item?.id, 'Drawdown calendar ID');
        if (ids.has(id)) throw new Error('Investment drawdown calendar IDs must be unique.');
        ids.add(id);
    }

    const normalized = calendars.map((item) => {
        const id = text(item.id, 'Drawdown calendar ID');
        const calendarSetId = text(item.calendarSetId, 'Drawdown calendar set ID');
        if (!Number.isSafeInteger(item.version) || item.version < 1) throw new Error('Drawdown calendar version must be a positive integer.');
        const scope = text(item.scope, 'Drawdown calendar scope');
        if (!['portfolio', 'account'].includes(scope)) throw new Error('Drawdown calendar scope must be portfolio or account.');
        const accountId = item.accountId === undefined ? undefined : text(item.accountId, 'Drawdown calendar account ID');
        if ((scope === 'account') !== (accountId !== undefined)) throw new Error('Account-scoped calendars require an account ID; portfolio calendars cannot specify one.');
        if (scope === 'account' && Array.isArray(input.investmentAccounts) && !accountIds.has(accountId)) throw new Error('Account-scoped calendars must reference a known investment account.');
        const currency = text(item.currency, 'Drawdown calendar currency');
        if (!CURRENCIES.has(currency)) throw new Error('Drawdown calendar currency is unsupported.');
        const startAt = timestamp(item.startAt, 'Drawdown calendar startAt');
        const endAt = timestamp(item.endAt, 'Drawdown calendar endAt');
        const recordedAt = timestamp(item.recordedAt, 'Drawdown calendar recordedAt');
        if (startAt > endAt) throw new Error('Drawdown calendar startAt must not be after endAt.');
        if (!Array.isArray(item.expectedDailyCloseAt) || item.expectedDailyCloseAt.length === 0) {
            throw new Error('A drawdown calendar must explicitly list at least one expected daily close.');
        }
        const expectedDailyCloseAt = item.expectedDailyCloseAt.map((value) => timestamp(value, 'Expected daily-close timestamp'));
        for (let index = 0; index < expectedDailyCloseAt.length; index += 1) {
            const value = expectedDailyCloseAt[index];
            if (value < startAt || value > endAt) throw new Error('Every expected daily close must fall within the calendar window.');
            if (index > 0 && value <= expectedDailyCloseAt[index - 1]) {
                throw new Error('Expected daily closes must be strictly increasing and unique.');
            }
        }
        const supersedesCalendarId = item.supersedesCalendarId === undefined
            ? undefined : text(item.supersedesCalendarId, 'Superseded drawdown calendar ID');
        return {
            id, calendarSetId, version: item.version, scope,
            ...(accountId ? { accountId } : {}), currency, startAt, endAt, recordedAt,
            expectedDailyCloseAt,
            ...(supersedesCalendarId ? { supersedesCalendarId } : {})
        };
    });

    const byId = new Map(normalized.map((item) => [item.id, item]));
    const superseded = new Set();
    for (const calendar of normalized) {
        if (!calendar.supersedesCalendarId) continue;
        const previous = byId.get(calendar.supersedesCalendarId);
        if (!previous || previous.id === calendar.id || superseded.has(previous.id)) {
            throw new Error('A corrected drawdown calendar must reference one existing, not-yet-superseded calendar.');
        }
        if (previous.calendarSetId !== calendar.calendarSetId || previous.version + 1 !== calendar.version
            || previous.scope !== calendar.scope || previous.accountId !== calendar.accountId
            || previous.currency !== calendar.currency || previous.startAt !== calendar.startAt
            || previous.endAt !== calendar.endAt || calendar.recordedAt <= previous.recordedAt) {
            throw new Error('A corrected drawdown calendar must retain its set, scope, currency and window, increment the version, and be recorded later.');
        }
        superseded.add(previous.id);
    }
    return { investmentDrawdownCalendars: normalized };
}

/** Select the latest explicitly recorded calendar revision at a knowledge cutoff. */
export function selectInvestmentDrawdownCalendar(input) {
    const { scope, accountId, currency, startAt, endAt, recordedAtCutoff, investmentDrawdownCalendars } = input ?? {};
    timestamp(startAt, 'Analysis startAt');
    timestamp(endAt, 'Analysis endAt');
    timestamp(recordedAtCutoff, 'Recorded-at cutoff');
    if (startAt > endAt) throw new RangeError('Analysis startAt must not be after endAt.');
    if (!['portfolio', 'account'].includes(scope)) throw new Error('A portfolio or account scope is required.');
    if (scope === 'account') text(accountId, 'Analysis account ID');
    if (scope === 'portfolio' && accountId !== undefined) throw new Error('Portfolio analysis cannot specify an account ID.');
    const validated = validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars });
    const candidates = validated.investmentDrawdownCalendars.filter((item) =>
        item.scope === scope && item.accountId === accountId && item.currency === currency
        && item.startAt === startAt && item.endAt === endAt && item.recordedAt <= recordedAtCutoff);
    const latestBySet = new Map();
    for (const item of candidates) {
        const current = latestBySet.get(item.calendarSetId);
        if (!current || item.version > current.version) latestBySet.set(item.calendarSetId, item);
        else if (item.version === current.version) throw new Error('Drawdown calendar revisions have an ambiguous version.');
    }
    const selected = [...latestBySet.values()].filter((item) =>
        !candidates.some((candidate) => candidate.supersedesCalendarId === item.id));
    if (selected.length !== 1) {
        throw new Error(selected.length === 0
            ? 'No explicitly recorded daily-close calendar is available for this scope, currency, window and recorded-at cutoff.'
            : 'More than one daily-close calendar matches this scope, currency and window; selection is ambiguous.');
    }
    return {
        calendarId: selected[0].id, calendarSetId: selected[0].calendarSetId,
        version: selected[0].version, scope: selected[0].scope,
        ...(selected[0].accountId ? { accountId: selected[0].accountId } : {}),
        currency: selected[0].currency, startAt: selected[0].startAt, endAt: selected[0].endAt,
        recordedAt: selected[0].recordedAt,
        expectedDailyCloseAt: [...selected[0].expectedDailyCloseAt]
    };
}
