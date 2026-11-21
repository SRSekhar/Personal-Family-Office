import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { Currency } from '@pfo/models';

import type { BacktestDatasetCsvImportMetadata } from '../src/csv-import.js';
import { importBacktestDatasetCsv } from '../src/csv-import.js';

const metadata: BacktestDatasetCsvImportMetadata = {
    id: 'dataset-csv-1',
    version: 1,
    instrument: { instrumentId: 'instrument-1', name: 'Synthetic Instrument', currency: Currency.INR, symbol: 'SYN', exchange: 'NSE' },
    interval: '1d',
    adjustmentBasis: 'unadjusted',
    marketTimeZone: 'Asia/Kolkata',
    source: {
        kind: 'user-supplied',
        name: 'Synthetic fixture',
        licenseName: 'Synthetic fixture terms',
        licenseStatus: 'reviewed',
        attributionText: 'Synthetic test data; not live market data.',
        retrievedAt: '2026-01-01T00:00:00.000Z',
        licenseReviewedAt: '2026-01-01T00:00:00.000Z',
        pointInTimeStatus: 'per-observation'
    },
    recordedAt: '2026-01-03T12:00:00.000Z',
    coverage: {
        startAt: '2025-12-31T00:00:00.000Z',
        endAt: '2026-01-02T23:59:59.000Z',
        status: 'complete',
        expectedBarEndAt: ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']
    }
};
const manifest = '#PFO-BACKTEST-DATASET,1,OHLCV';
const headers = 'startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId';
const first = '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,100,110,95,105,1000,2026-01-01T10:05:00.000Z,2026-01-01T11:00:00.000Z,SYN-1';
const second = '2026-01-02T00:00:00.000Z,2026-01-02T10:00:00.000Z,110,120,108,115,1200,2026-01-02T10:05:00.000Z,2026-01-02T11:00:00.000Z,SYN-1';
const csv = [manifest, headers, first, second].join('\r\n') + '\r\n';

describe('backtest dataset CSV import', () => {
    it('imports canonical OHLCV rows and binds explicit dataset metadata', () => {
        const dataset = importBacktestDatasetCsv(csv, metadata);
        expect(dataset.id).toBe('dataset-csv-1');
        expect(dataset.instrument).toEqual(metadata.instrument);
        expect(dataset.bars).toHaveLength(2);
        expect(dataset.bars[0]).toMatchObject({
            instrumentId: 'instrument-1', providerInstrumentId: 'SYN-1', interval: '1d',
            currency: Currency.INR, adjustmentBasis: 'unadjusted', marketTimeZone: 'Asia/Kolkata',
            open: 100, high: 110, low: 95, close: 105, volume: 1000,
            availableAt: '2026-01-01T10:05:00.000Z', recordedAt: '2026-01-01T11:00:00.000Z'
        });
        expect(dataset.source.contentDigest).toBe(createHash('sha256').update(csv, 'utf8').digest('hex'));
        expect(dataset.contentDigest).toMatch(/^[a-f0-9]{64}$/u);
    });

    it('rejects exchanges and intervals outside the approved first-release scope', () => {
        expect(() => importBacktestDatasetCsv(csv, {
            ...metadata,
            instrument: { ...metadata.instrument, exchange: 'BSE' }
        })).toThrow(/NSE instruments only/i);
        expect(() => importBacktestDatasetCsv(csv, {
            ...metadata,
            interval: '1h'
        })).toThrow(/daily \(1d\) OHLCV only/i);
    });

    it('supports a UTF-8 BOM, LF endings and blank optional values', () => {
        const row1 = '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,"100","110","95","105",,2026-01-01T10:05:00.000Z,2026-01-01T11:00:00.000Z,';
        const row2 = '2026-01-02T00:00:00.000Z,2026-01-02T10:00:00.000Z,110,120,108,115,1200,2026-01-02T10:05:00.000Z,2026-01-02T11:00:00.000Z,SYN-1';
        const dataset = importBacktestDatasetCsv('\uFEFF' + [manifest, headers, row1, row2].join('\n'), metadata);
        expect(dataset.bars[0]?.volume).toBeUndefined();
        expect(dataset.bars[0]?.availableAt).toBe('2026-01-01T10:05:00.000Z');
        expect(dataset.bars[0]?.providerInstrumentId).toBeUndefined();
    });

    it('preserves unknown availability rather than substituting a timestamp', () => {
        const unknownMetadata = { ...metadata, source: { ...metadata.source, pointInTimeStatus: 'unknown' as const } };
        const row = '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,100,110,95,105,1000,,2026-01-01T11:00:00.000Z,';
        const dataset = importBacktestDatasetCsv([manifest, headers, row].join('\r\n'), {
            ...unknownMetadata,
            coverage: { ...metadata.coverage, status: 'partial', expectedBarEndAt: ['2026-01-01T10:00:00.000Z'] }
        });
        expect(dataset.bars[0]?.availableAt).toBeUndefined();
    });

    it('does not sort source rows or manufacture a complete calendar', () => {
        expect(() => importBacktestDatasetCsv([manifest, headers, second, first].join('\r\n'), metadata))
            .toThrow(/strictly ordered/i);
        expect(() => importBacktestDatasetCsv([manifest, headers, first].join('\r\n'), metadata))
            .toThrow(/every explicitly expected bar/i);
    });

    it('rejects a point-in-time source when observation availability is absent', () => {
        const row = '2026-01-01T00:00:00.000Z,2026-01-01T10:00:00.000Z,100,110,95,105,1000,,2026-01-01T11:00:00.000Z,';
        expect(() => importBacktestDatasetCsv([manifest, headers, row].join('\r\n'), {
            ...metadata,
            coverage: { ...metadata.coverage, status: 'partial', expectedBarEndAt: ['2026-01-01T10:00:00.000Z'] }
        })).toThrow(/availableAt/i);
    });

    it('rejects an invalid manifest, header, duplicate columns and unsupported version', () => {
        expect(() => importBacktestDatasetCsv(csv.replace(manifest, '#PFO-BACKTEST-DATASET,2,OHLCV'), metadata)).toThrow(/manifest/i);
        expect(() => importBacktestDatasetCsv(csv.replace(headers, headers.replace('open', 'Open')), metadata)).toThrow(/canonical PFO OHLCV/i);
        expect(() => importBacktestDatasetCsv(csv.replace(headers, headers.replace('open', 'startAt')), metadata)).toThrow(/canonical PFO OHLCV/i);
    });

    it('rejects malformed quoting, wrong column counts and blank records', () => {
        expect(() => importBacktestDatasetCsv([manifest, headers, '"2026-01-01'].join('\r\n'), metadata)).toThrow(/unterminated/i);
        expect(() => importBacktestDatasetCsv([manifest, headers, first + ',extra'].join('\r\n'), metadata)).toThrow(/expected 10/i);
        expect(() => importBacktestDatasetCsv([manifest, headers, first, '', second].join('\r\n'), metadata)).toThrow(/expected 10/i);
    });

    it('rejects non-decimal numeric values and non-canonical timestamps', () => {
        const invalidNumber = first.replace(',100,110,95,105,', ',1,1,1,not-a-price,');
        expect(() => importBacktestDatasetCsv([manifest, headers, invalidNumber, second].join('\r\n'), metadata)).toThrow(/plain finite decimal/i);
        const invalidTimestamp = first.replace('2026-01-01T00:00:00.000Z', '2026-01-01');
        expect(() => importBacktestDatasetCsv([manifest, headers, invalidTimestamp, second].join('\r\n'), metadata)).toThrow(/canonical UTC/i);
    });

    it('rejects invalid OHLC and duplicate observations', () => {
        const invalidOhlc = first.replace(',100,110,95,105,', ',100,90,95,105,');
        expect(() => importBacktestDatasetCsv([manifest, headers, invalidOhlc, second].join('\r\n'), metadata)).toThrow(/OHLC/i);
        expect(() => importBacktestDatasetCsv([manifest, headers, first, first].join('\r\n'), metadata)).toThrow(/duplicate/i);
    });

    it('produces a stable normalized digest but distinct raw artifact digests', () => {
        const lfCsv = csv.replaceAll('\r\n', '\n');
        const crlf = importBacktestDatasetCsv(csv, metadata);
        const lf = importBacktestDatasetCsv(lfCsv, metadata);
        expect(crlf.source.contentDigest).not.toBe(lf.source.contentDigest);
        expect(crlf.contentDigest).toBe(lf.contentDigest);
    });

    it('retains licensing metadata without claiming it is approved for execution', () => {
        const unreviewed = { ...metadata, source: { ...metadata.source, licenseStatus: 'unreviewed' as const } };
        const dataset = importBacktestDatasetCsv(csv, unreviewed);
        expect(dataset.source.licenseStatus).toBe('unreviewed');
    });
});
