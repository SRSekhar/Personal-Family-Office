import { describe, expect, it } from 'vitest';

import { Currency } from '@pfo/models';
import { hasPointInTimeGuarantee } from '../src/contracts.js';
import type {
    CorporateActionObservation,
    FundamentalObservation,
    HistoricalBar,
    MarketDataSourceMetadata,
    QuoteObservation
} from '../src/contracts.js';

describe('normalized market-data contracts', () => {
    it('supports distinct quote, bar, fundamentals and corporate-action observation shapes', () => {
        const source: MarketDataSourceMetadata = {
            providerId: 'fixture',
            providerName: 'Fixture',
            providerVersion: '1',
            licenseName: 'Fixture terms',
            termsUrl: 'https://example.test/terms',
            attributionText: 'Fixture data',
            retrievedAt: '2026-01-01T10:00:00.000Z',
            marketTimeZone: 'Asia/Kolkata',
            delay: { kind: 'unknown' },
            freshness: 'fresh',
            coverage: { status: 'complete' },
            pointInTime: { requestedKnownAtOrBefore: '2025-12-31T23:59:59.000Z', guaranteed: false, limitation: 'No historical revision guarantee.' }
        };
        const quote: QuoteObservation = {
            instrumentId: 'instrument-1', providerInstrumentId: 'provider-1',
            price: { amount: 100, currency: Currency.INR }, quotedAt: '2026-01-01T09:59:00.000Z',
            marketTimeZone: 'Asia/Kolkata', session: 'regular'
        };
        const bar: HistoricalBar = {
            instrumentId: 'instrument-1', providerInstrumentId: 'provider-1', interval: '1d',
            startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-01T23:59:59.000Z',
            open: 98, high: 102, low: 97, close: 100, currency: Currency.INR, volume: 1_000,
            adjustmentBasis: 'unadjusted', marketTimeZone: 'Asia/Kolkata'
        };
        const fundamental: FundamentalObservation = {
            instrumentId: 'instrument-1', providerInstrumentId: 'provider-1',
            metricId: 'earnings-per-share', value: 12.5, unit: 'currency-per-share',
            currency: Currency.INR, periodEnd: '2025-12-31T00:00:00.000Z', publishedAt: '2026-01-15T00:00:00.000Z'
        };
        const action: CorporateActionObservation = {
            instrumentId: 'instrument-1', providerInstrumentId: 'provider-1', providerActionId: 'action-1',
            type: 'cash-dividend', announcedAt: '2026-01-02T00:00:00.000Z',
            exDate: '2026-01-10T00:00:00.000Z', payableDate: '2026-01-20T00:00:00.000Z',
            effectiveAt: '2026-01-10T00:00:00.000Z', cashAmount: { amount: 2, currency: Currency.INR }
        };
        expect([quote, bar, fundamental, action]).toHaveLength(4);
        expect(source.pointInTime.guaranteed).toBe(false);
        expect(hasPointInTimeGuarantee(source, '2025-12-31T23:59:59.000Z')).toBe(false);
        expect(hasPointInTimeGuarantee({ ...source, pointInTime: { requestedKnownAtOrBefore: '2025-12-31T23:59:59.000Z', guaranteed: true } }, '2025-12-31T23:59:59.000Z')).toBe(true);
    });
});
