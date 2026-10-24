import { calculateFinancialTotals } from './financial-totals.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function isCalendarDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function validateSnapshotRecords(records) {
    if (!Array.isArray(records)) throw new TypeError('Historical snapshot records must be a list.');
    const ids = new Set();
    const validated = records.map((record) => {
        if (!record || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id)
            || typeof record.name !== 'string' || !record.name.trim()
            || typeof record.category !== 'string' || !record.category.trim()
            || !['asset', 'liability'].includes(record.type)
            || typeof record.value !== 'number' || !Number.isFinite(record.value) || record.value < 0) {
            throw new TypeError('Historical snapshot contains invalid or duplicate financial records.');
        }
        ids.add(record.id);
        return {
            id: record.id,
            name: record.name.trim(),
            category: record.category.trim(),
            type: record.type,
            value: record.value
        };
    });
    calculateFinancialTotals(validated);
    return validated;
}

/**
 * Validate and normalize user-captured historical balance-sheet snapshots.
 * Each snapshot is an immutable, explicitly dated copy of the records supplied
 * at capture time; this module never infers or fabricates missing history.
 */
export function validateHistoricalSnapshots(snapshots, expectedCurrency) {
    if (!Array.isArray(snapshots)) throw new TypeError('Historical snapshots must be a list.');
    if (typeof expectedCurrency !== 'string' || !CURRENCY_PATTERN.test(expectedCurrency)) {
        throw new RangeError('A valid three-letter workspace currency is required.');
    }

    const dates = new Set();
    const validated = snapshots.map((snapshot) => {
        if (!snapshot || !isCalendarDate(snapshot.date) || snapshot.currency !== expectedCurrency
            || dates.has(snapshot.date)) {
            throw new TypeError('Historical snapshots contain an invalid date, currency, or duplicate date.');
        }
        dates.add(snapshot.date);
        const records = validateSnapshotRecords(snapshot.records);
        const totals = calculateFinancialTotals(records);
        return {
            date: snapshot.date,
            currency: expectedCurrency,
            records,
            totals
        };
    });
    return validated.sort((a, b) => a.date.localeCompare(b.date));
}

/** Create a dated snapshot from the current validated balance sheet. */
export function captureHistoricalSnapshot({ records, date, currency, existingSnapshots = [] }) {
    if (!isCalendarDate(date)) throw new RangeError('Valuation date must be a real calendar date in YYYY-MM-DD format.');
    const existing = validateHistoricalSnapshots(existingSnapshots, currency);
    if (existing.some((snapshot) => snapshot.date === date)) {
        throw new RangeError('A historical snapshot already exists for this date.');
    }
    const validatedRecords = validateSnapshotRecords(records);
    const snapshot = {
        date,
        currency,
        records: validatedRecords,
        totals: calculateFinancialTotals(validatedRecords)
    };
    return [...existing, snapshot].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Return a validated history without one explicitly selected date.
 * The UI must ask for confirmation before persisting this change.
 */
export function removeHistoricalSnapshot({ snapshots, date, currency }) {
    if (!isCalendarDate(date)) throw new RangeError('Snapshot removal requires a real calendar date.');
    const validated = validateHistoricalSnapshots(snapshots, currency);
    if (!validated.some((snapshot) => snapshot.date === date)) {
        throw new RangeError('No historical snapshot exists for the selected date.');
    }
    return validated.filter((snapshot) => snapshot.date !== date);
}

/** Produce a chronological series using only snapshots that actually exist. */
export function summarizeHistoricalSnapshots(snapshots, expectedCurrency) {
    const validated = validateHistoricalSnapshots(snapshots, expectedCurrency);
    return validated.map((snapshot, index) => {
        const previous = index > 0 ? validated[index - 1] : null;
        const netWorthChange = previous ? snapshot.totals.netWorth - previous.totals.netWorth : null;
        const netWorthChangePercent = previous && previous.totals.netWorth !== 0
            ? netWorthChange / Math.abs(previous.totals.netWorth) * 100
            : null;
        return {
            date: snapshot.date,
            currency: snapshot.currency,
            recordCount: snapshot.records.length,
            assets: snapshot.totals.assets,
            liabilities: snapshot.totals.liabilities,
            netWorth: snapshot.totals.netWorth,
            netWorthChange,
            netWorthChangePercent
        };
    });
}
