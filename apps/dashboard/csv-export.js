const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+@-]/;

function escapeSpreadsheetText(value) {
    const text = String(value ?? '');
    const safeText = FORMULA_PREFIX.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
}

function escapeCsvCell(value, { text = false } = {}) {
    if (text) return escapeSpreadsheetText(value);
    return String(value ?? '');
}

export function recordsToCsv(records, currency = 'INR') {
    if (!Array.isArray(records)) {
        throw new TypeError('Records must be an array.');
    }
    if (typeof currency !== 'string' || currency.trim() === '') {
        throw new TypeError('Currency must be a non-empty string.');
    }

    const header = ['Name', 'Category', 'Type', 'Value', 'Currency'];
    const rows = records.map((record) => {
        if (!record || typeof record.name !== 'string'
            || typeof record.category !== 'string'
            || !['asset', 'liability'].includes(record.type)
            || !Number.isFinite(record.value) || record.value < 0) {
            throw new TypeError('Cannot export an invalid financial record.');
        }
        return [
            escapeCsvCell(record.name, { text: true }),
            escapeCsvCell(record.category, { text: true }),
            escapeCsvCell(record.type, { text: true }),
            String(record.value),
            escapeCsvCell(currency, { text: true })
        ];
    });

    return [header.join(','), ...rows.map((row) => row.join(','))].join('\r\n') + '\r\n';
}
