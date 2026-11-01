import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentCashCollections } from './investment-cash-ledger.js';

const TEXT_PREFIX = '~pfo64~';
const COLLECTIONS = {
    investmentAccounts: [
        ['id', 'text'], ['name', 'text'], ['institution', 'text'], ['type', 'text'], ['currency', 'text'], ['description', 'text?']
    ],
    investmentInstruments: [
        ['id', 'text'], ['name', 'text'], ['type', 'text'], ['currency', 'text'], ['symbol', 'text?'], ['exchange', 'text?'], ['isin', 'text?'], ['description', 'text?']
    ],
    investmentTransactions: [
        ['id', 'text'], ['accountId', 'text'], ['instrumentId', 'text'], ['type', 'text'], ['cashAmount', 'json'],
        ['date', 'text'], ['recordedAt', 'text'], ['cashAccountId', 'text?'], ['cashAccountLinkedAt', 'text?'],
        ['quantity', 'number?'], ['unitPrice', 'json?'], ['externalReference', 'text?'], ['notes', 'text?']
    ],
    investmentValuations: [
        ['instrumentId', 'text'], ['price', 'json'], ['asOf', 'text'], ['recordedAt', 'text'], ['sourceType', 'text'], ['sourceName', 'text']
    ],
    investmentCashAccounts: [
        ['id', 'text'], ['investmentAccountId', 'text'], ['name', 'text'], ['currency', 'text'], ['createdAt', 'text']
    ],
    investmentCashMovements: [
        ['id', 'text'], ['cashAccountId', 'text'], ['type', 'text'], ['amount', 'json'], ['effectiveAt', 'text'], ['recordedAt', 'text'],
        ['externalReference', 'text?'], ['reason', 'text?'], ['reversesMovementId', 'text?'], ['openingBalanceSource', 'text?']
    ],
    investmentCashTransfers: [
        ['id', 'text'], ['sourceCashAccountId', 'text'], ['destinationCashAccountId', 'text'], ['amount', 'json'],
        ['effectiveAt', 'text'], ['recordedAt', 'text'], ['externalReference', 'text?']
    ],
    investmentCashStatements: [
        ['id', 'text'], ['cashAccountId', 'text'], ['closingBalance', 'json'], ['periodStart', 'text'], ['periodEnd', 'text'],
        ['statementAsOf', 'text'], ['recordedAt', 'text'], ['sourceName', 'text'], ['externalReference', 'text?']
    ]
};

function encodeText(value) {
    const text = String(value);
    if (!/^\\s*[=+@-]/u.test(text) && !text.startsWith(TEXT_PREFIX)) return text;
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return TEXT_PREFIX + btoa(binary);
}
function decodeText(value) {
    if (!value.startsWith(TEXT_PREFIX)) return value;
    const binary = atob(value.slice(TEXT_PREFIX.length));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function quote(value) {
    const text = String(value ?? '');
    return '"' + text.replaceAll('"', '""') + '"';
}
function parseRows(source) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let closed = false;
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (quoted) {
            if (char === '"') {
                if (source[i + 1] === '"') { field += '"'; i += 1; }
                else { quoted = false; closed = true; }
            } else field += char;
            continue;
        }
        if (closed) {
            if (char === ',') { row.push(field); field = ''; closed = false; }
            else if (char === '\r' || char === '\n') {
                row.push(field); rows.push(row); row = []; field = ''; closed = false;
                if (char === '\r' && source[i + 1] === '\n') i += 1;
            } else throw new Error('CSV contains characters after a closing quote.');
            continue;
        }
        if (char === '"') {
            if (field.length) throw new Error('CSV contains a quote inside an unquoted field.');
            quoted = true;
        } else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\r' || char === '\n') {
            row.push(field); rows.push(row); row = []; field = '';
            if (char === '\r' && source[i + 1] === '\n') i += 1;
        } else field += char;
    }
    if (quoted) throw new Error('CSV contains an unterminated quoted field.');
    if (field.length || row.length || closed) { row.push(field); rows.push(row); }
    return rows;
}
function readCell(value, type, label) {
    if (type === 'text') return decodeText(value);
    if (type === 'json') {
        try { return JSON.parse(value); } catch { throw new Error(label + ' contains invalid JSON.'); }
    }
    if (type === 'number') {
        const parsed = Number(value);
        if (value.trim() === '' || !Number.isFinite(parsed)) throw new Error(label + ' must be a finite number.');
        return parsed;
    }
    throw new Error('Unsupported CSV field type.');
}
function writeCell(value, type, label) {
    if (value === undefined || value === null) return '';
    if (type.startsWith('text')) return encodeText(value);
    if (type.startsWith('json')) return JSON.stringify(value);
    if (type.startsWith('number')) {
        if (!Number.isFinite(value)) throw new Error(label + ' must be a finite number.');
        return String(value);
    }
    throw new Error('Unsupported CSV field type.');
}

/** Export one typed collection. String cells use reversible UTF-8 base64 encoding to prevent spreadsheet formula execution. */
export function exportInvestmentCollectionCsv(collection, records) {
    const schema = COLLECTIONS[collection];
    if (!schema) throw new Error('Unsupported investment CSV collection.');
    if (!Array.isArray(records)) throw new TypeError('Investment CSV records must be an array.');
    const rows = records.map((record, index) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Investment CSV row ' + (index + 1) + ' must be an object.');
        return schema.map(([field, type]) => quote(writeCell(record[field], type, field)));
    });
    return ['#PFO-INVESTMENT-CSV,1,' + collection, schema.map(([field]) => quote(field)).join(','), ...rows.map((row) => row.join(','))].join('\r\n') + '\r\n';
}

/** Parse a PFO-native collection file without mutating any workspace state. */
export function parseInvestmentCollectionCsv(source, expectedCollection) {
    if (typeof source !== 'string' || source.trim() === '') throw new Error('Investment CSV file is empty.');
    const rows = parseRows(source.replace(/^\uFEFF/u, ''));
    const schema = COLLECTIONS[expectedCollection];
    if (!schema) throw new Error('Unsupported investment CSV collection.');
    if (rows.length < 2 || rows[0].length !== 3 || rows[0][0] !== '#PFO-INVESTMENT-CSV' || rows[0][1] !== '1'
        || rows[0][2] !== expectedCollection) throw new Error('CSV manifest does not match the selected collection and supported format version.');
    const expectedHeaders = schema.map(([field]) => field);
    if (rows[1].length !== expectedHeaders.length || rows[1].some((value, index) => value !== expectedHeaders[index])
        || new Set(rows[1]).size !== rows[1].length) throw new Error('CSV columns do not match the canonical PFO collection schema.');
    const records = rows.slice(2).map((columns, rowIndex) => {
        if (columns.length !== schema.length) throw new Error('CSV row ' + (rowIndex + 3) + ' has missing or extra columns.');
        const record = {};
        schema.forEach(([field, type], index) => {
            const raw = columns[index];
            if (raw === '' && type.endsWith('?')) return;
            if (raw === '') throw new Error('CSV row ' + (rowIndex + 3) + ' is missing required field ' + field + '.');
            record[field] = readCell(raw, type.replace('?', ''), field + ' at row ' + (rowIndex + 3));
        });
        return record;
    });
    return records;
}

/** Validate the entire candidate workspace before any caller persists it. */
export function validateInvestmentCsvWorkspace(current, imported, mode = 'replace') {
    if (!current || !imported || !['append', 'replace'].includes(mode)) throw new TypeError('Current workspace, import collections and a valid import mode are required.');
    const names = Object.keys(COLLECTIONS);
    for (const name of Object.keys(imported)) if (!names.includes(name) || !Array.isArray(imported[name])) throw new Error('Import contains an unsupported collection.');
    const candidate = { ...current };
    for (const name of names) {
        if (!Array.isArray(current[name])) throw new Error('Current workspace is missing collection ' + name + '.');
        if (Object.hasOwn(imported, name)) candidate[name] = mode === 'append' ? [...current[name], ...imported[name]] : imported[name];
    }
    const ledger = validateInvestmentLedgerCollections(candidate);
    const cash = validateInvestmentCashCollections({ ...ledger, ...candidate, ...cashCollectionView(candidate) });
    return { ...ledger, ...cash };
}
function cashCollectionView(value) {
    return {
        investmentCashAccounts: value.investmentCashAccounts,
        investmentCashMovements: value.investmentCashMovements,
        investmentCashTransfers: value.investmentCashTransfers,
        investmentCashStatements: value.investmentCashStatements
    };
}

/** Build an immutable preview. The caller must obtain confirmation before persisting the returned candidate. */
export function previewInvestmentCsvImport(current, imported, mode = 'replace') {
    const candidate = validateInvestmentCsvWorkspace(current, imported, mode);
    const counts = Object.fromEntries(Object.entries(imported).map(([name, records]) => [name, {
        imported: records.length, resulting: candidate[name].length, mode
    }]));
    return Object.freeze({ candidate, counts, mode, confirmed: false });
}

export const INVESTMENT_CSV_COLLECTIONS = Object.freeze(Object.keys(COLLECTIONS));
