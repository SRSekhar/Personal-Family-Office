import { createHash } from 'node:crypto';

import type { BarInterval, InstrumentReference, PriceAdjustmentBasis } from '@pfo/market-data';
import type { BacktestDataset, BacktestDatasetSource, IsoTimestamp } from './contracts.js';
import { validateBacktestDataset } from './validation.js';

const MANIFEST = ['#PFO-BACKTEST-DATASET', '1', 'OHLCV'] as const;
const HEADERS = ['startAt', 'endAt', 'open', 'high', 'low', 'close', 'volume', 'availableAt', 'recordedAt', 'providerInstrumentId'] as const;
type CsvBarField = typeof HEADERS[number];

export interface BacktestDatasetCsvImportMetadata {
    readonly id: string;
    readonly version: number;
    readonly instrument: InstrumentReference;
    readonly interval: BarInterval;
    readonly adjustmentBasis: Exclude<PriceAdjustmentBasis, 'unknown'>;
    readonly marketTimeZone: string;
    readonly source: Omit<BacktestDatasetSource, 'contentDigest'>;
    readonly recordedAt: IsoTimestamp;
    readonly coverage: BacktestDataset['coverage'];
}

interface ParsedCsvBar {
    readonly startAt: IsoTimestamp;
    readonly endAt: IsoTimestamp;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume?: number;
    readonly availableAt?: IsoTimestamp;
    readonly recordedAt: IsoTimestamp;
    readonly providerInstrumentId?: string;
}

function parseCsvRows(source: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    let closedQuote = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (quoted) {
            if (character === '"') {
                if (source[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    quoted = false;
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
                throw new RangeError('CSV contains characters after a closing quote.');
            }
            continue;
        }
        if (character === '"') {
            if (field.length > 0) throw new RangeError('CSV contains a quote inside an unquoted field.');
            quoted = true;
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
    if (quoted) throw new RangeError('CSV contains an unterminated quoted field.');
    if (field.length > 0 || row.length > 0 || closedQuote) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

function parseNumber(value: string, field: CsvBarField, rowNumber: number): number {
    const normalized = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(normalized)) {
        throw new RangeError('CSV row ' + rowNumber + ' ' + field + ' must be a plain finite decimal number.');
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) throw new RangeError('CSV row ' + rowNumber + ' ' + field + ' must be finite.');
    return parsed;
}

function parseTimestamp(value: string, field: CsvBarField, rowNumber: number): IsoTimestamp {
    const normalized = value.trim();
    if (!normalized) throw new RangeError('CSV row ' + rowNumber + ' ' + field + ' is required.');
    if (!Number.isFinite(Date.parse(normalized)) || new Date(normalized).toISOString() !== normalized) {
        throw new RangeError('CSV row ' + rowNumber + ' ' + field + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return normalized;
}

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.keys(record).sort().filter((key) => record[key] !== undefined)
                .map((key) => [key, canonicalize(record[key])])
        );
    }
    return value;
}

function parseBar(columns: readonly string[], rowNumber: number): ParsedCsvBar {
    if (columns.length !== HEADERS.length) {
        throw new RangeError('CSV row ' + rowNumber + ' has ' + columns.length + ' columns; expected ' + HEADERS.length + '.');
    }
    const [rawStartAt, rawEndAt, rawOpen, rawHigh, rawLow, rawClose, rawVolume, rawAvailableAt, rawRecordedAt, rawProviderInstrumentId] = columns;
    if (rawStartAt === undefined || rawEndAt === undefined || rawOpen === undefined || rawHigh === undefined
        || rawLow === undefined || rawClose === undefined || rawVolume === undefined || rawAvailableAt === undefined
        || rawRecordedAt === undefined || rawProviderInstrumentId === undefined) {
        throw new RangeError('CSV row ' + rowNumber + ' is incomplete.');
    }
    const volume = rawVolume.trim() === '' ? undefined : parseNumber(rawVolume, 'volume', rowNumber);
    const availableAt = rawAvailableAt.trim() === '' ? undefined : parseTimestamp(rawAvailableAt, 'availableAt', rowNumber);
    const providerInstrumentId = rawProviderInstrumentId.trim() === '' ? undefined : rawProviderInstrumentId.trim();
    return {
        startAt: parseTimestamp(rawStartAt, 'startAt', rowNumber),
        endAt: parseTimestamp(rawEndAt, 'endAt', rowNumber),
        open: parseNumber(rawOpen, 'open', rowNumber),
        high: parseNumber(rawHigh, 'high', rowNumber),
        low: parseNumber(rawLow, 'low', rowNumber),
        close: parseNumber(rawClose, 'close', rowNumber),
        ...(volume === undefined ? {} : { volume }),
        ...(availableAt === undefined ? {} : { availableAt }),
        recordedAt: parseTimestamp(rawRecordedAt, 'recordedAt', rowNumber),
        ...(providerInstrumentId === undefined ? {} : { providerInstrumentId })
    };
}

function normalizedDatasetDigest(dataset: Omit<BacktestDataset, 'contentDigest'>): string {
    const { contentDigest: _sourceArtifactDigest, ...sourceWithoutArtifactDigest } = dataset.source;
    const digestInput = {
        id: dataset.id,
        version: dataset.version,
        instrument: dataset.instrument,
        interval: dataset.interval,
        adjustmentBasis: dataset.adjustmentBasis,
        marketTimeZone: dataset.marketTimeZone,
        source: sourceWithoutArtifactDigest,
        recordedAt: dataset.recordedAt,
        coverage: dataset.coverage,
        bars: dataset.bars
    };
    return sha256(JSON.stringify(canonicalize(digestInput)));
}

/**
 * Imports a PFO-native OHLCV CSV into a validated dataset snapshot.
 * Identity, provenance, coverage and knowledge-time metadata must be supplied explicitly.
 * The importer never invents availability timestamps, trading sessions or missing bars.
 */
export function importBacktestDatasetCsv(
    sourceCsv: string,
    metadata: BacktestDatasetCsvImportMetadata
): BacktestDataset {
    if (typeof sourceCsv !== 'string' || sourceCsv.trim() === '') throw new RangeError('Backtest dataset CSV is empty.');
    const rows = parseCsvRows(sourceCsv.replace(/^\uFEFF/u, ''));
    if (rows.length < 3 || rows[0]?.length !== MANIFEST.length
        || !MANIFEST.every((value, index) => rows[0]?.[index] === value)) {
        throw new RangeError('CSV manifest must be #PFO-BACKTEST-DATASET,1,OHLCV.');
    }
    const headers = rows[1];
    if (!headers || headers.length !== HEADERS.length
        || headers.some((value, index) => value !== HEADERS[index])
        || new Set(headers).size !== HEADERS.length) {
        throw new RangeError('CSV columns do not match the canonical PFO OHLCV dataset schema.');
    }

    const bars = rows.slice(2).map((columns, index) => parseBar(columns, index + 3));
    if (bars.length === 0) throw new RangeError('Backtest dataset CSV contains no observations.');

    const sourceMetadata: BacktestDatasetSource = {
        ...metadata.source,
        contentDigest: sha256(sourceCsv)
    };
    const datasetWithoutDigest: Omit<BacktestDataset, 'contentDigest'> = {
        id: metadata.id,
        version: metadata.version,
        instrument: metadata.instrument,
        interval: metadata.interval,
        adjustmentBasis: metadata.adjustmentBasis,
        marketTimeZone: metadata.marketTimeZone,
        source: sourceMetadata,
        recordedAt: metadata.recordedAt,
        coverage: {
            startAt: metadata.coverage.startAt,
            endAt: metadata.coverage.endAt,
            status: metadata.coverage.status,
            expectedBarEndAt: [...metadata.coverage.expectedBarEndAt]
        },
        bars: bars.map((bar) => ({
            instrumentId: metadata.instrument.instrumentId,
            ...(bar.providerInstrumentId === undefined ? {} : { providerInstrumentId: bar.providerInstrumentId }),
            interval: metadata.interval,
            startAt: bar.startAt,
            endAt: bar.endAt,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            currency: metadata.instrument.currency,
            ...(bar.volume === undefined ? {} : { volume: bar.volume }),
            adjustmentBasis: metadata.adjustmentBasis,
            marketTimeZone: metadata.marketTimeZone,
            ...(bar.availableAt === undefined ? {} : { availableAt: bar.availableAt }),
            recordedAt: bar.recordedAt
        }))
    };
    const dataset: BacktestDataset = {
        ...datasetWithoutDigest,
        contentDigest: normalizedDatasetDigest(datasetWithoutDigest)
    };
    try {
        validateBacktestDataset(dataset);
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown dataset validation failure.';
        throw new RangeError('Imported backtest dataset failed validation: ' + detail);
    }
    return dataset;
}

export const BACKTEST_DATASET_CSV_MANIFEST = '#PFO-BACKTEST-DATASET,1,OHLCV';
export const BACKTEST_DATASET_CSV_HEADERS = HEADERS;
