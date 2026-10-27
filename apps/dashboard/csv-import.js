const HEADER = ['Name', 'Category', 'Type', 'Value', 'Currency'];

function parseCsvRows(source) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let closedQuote = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inQuotes) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                    closedQuote = true;
                }
            } else {
                field += character;
            }
            continue;
        }

        if (closedQuote) {
            if (character === ',') {
                row.push(field);
                field = '';
                closedQuote = false;
            } else if (character === '\r' || character === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
                closedQuote = false;
                if (character === '\r' && source[index + 1] === '\n') index += 1;
            } else {
                throw new Error('The CSV contains characters after a closing quote.');
            }
            continue;
        }

        if (character === '"') {
            if (field.length !== 0) throw new Error('The CSV contains a quote inside an unquoted field.');
            inQuotes = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\r' || character === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            if (character === '\r' && source[index + 1] === '\n') index += 1;
        } else {
            field += character;
        }
    }

    if (inQuotes) throw new Error('The CSV contains an unterminated quoted field.');
    if (field.length > 0 || row.length > 0 || closedQuote) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

export function parseRecordsCsv(source, expectedCurrency = 'INR') {
    if (typeof source !== 'string' || source.trim() === '') {
        throw new Error('The CSV file is empty.');
    }
    if (typeof expectedCurrency !== 'string' || expectedCurrency.trim() === '') {
        throw new TypeError('Currency must be a non-empty string.');
    }

    const rows = parseCsvRows(source.replace(/^\uFEFF/u, ''));
    if (!rows.length || rows[0].length !== HEADER.length
        || !HEADER.every((column, index) => rows[0][index] === column)) {
        throw new Error('Unsupported CSV format. Expected columns: Name, Category, Type, Value, Currency.');
    }
    if (rows.length === 1) {
        throw new Error('The CSV contains no financial records. Existing records were not changed.');
    }

    return rows.slice(1).map((columns) => {
        if (columns.length !== HEADER.length || columns.some((value) => value.trim() === '')) {
            throw new Error('The CSV contains an incomplete financial record.');
        }
        const [rawName, rawCategory, rawType, rawValue, rawCurrency] = columns;
        const name = rawName.trim();
        const category = rawCategory.trim();
        const type = rawType.trim();
        const value = Number(rawValue);
        const currency = rawCurrency.trim();

        if (!name || !category || !['asset', 'liability'].includes(type)
            || !Number.isFinite(value) || value < 0) {
            throw new Error('The CSV contains an invalid financial record.');
        }
        if (currency !== expectedCurrency) {
            throw new Error(`CSV currency must be ${expectedCurrency}; this file uses ${currency}. No records were imported.`);
        }
        return { name, category, type, value };
    });
}
