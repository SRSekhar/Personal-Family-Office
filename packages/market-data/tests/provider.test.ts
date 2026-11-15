import { describe, expect, it } from 'vitest';
import { Currency } from '@pfo/models';

import { validateMarketDataProvider } from '../src/provider.js';
import type { MarketDataProvider } from '../src/provider.js';

const descriptor = {
    id: 'synthetic-provider',
    name: 'Synthetic Test Provider',
    version: '1.0.0',
    documentationUrl: 'https://example.test/docs',
    termsUrl: 'https://example.test/terms',
    licenseName: 'Synthetic test terms',
    attributionText: 'Synthetic test data; not for investment use.',
    capabilities: ['quotes'] as const
};

const provider: MarketDataProvider = {
    descriptor,
    quotes: {
        async getQuote() {
            return {
                data: {
                    instrumentId: 'instrument-1',
                    providerInstrumentId: 'provider-1',
                    price: { amount: 100, currency: Currency.INR },
                    quotedAt: '2026-01-01T10:00:00.000Z',
                    marketTimeZone: 'Asia/Kolkata',
                    session: 'regular'
                },
                source: {
                    providerId: descriptor.id,
                    providerName: descriptor.name,
                    providerVersion: descriptor.version,
                    licenseName: descriptor.licenseName,
                    termsUrl: descriptor.termsUrl,
                    attributionText: descriptor.attributionText,
                    retrievedAt: '2026-01-01T10:00:01.000Z',
                    marketTimeZone: 'Asia/Kolkata',
                    delay: { kind: 'delayed', seconds: 900 },
                    freshness: 'fresh',
                    coverage: { status: 'complete' },
                    pointInTime: { guaranteed: false, limitation: 'Synthetic fixture has no point-in-time guarantee.' }
                }
            };
        }
    }
};

describe('market-data provider contract', () => {
    it('accepts a provider with HTTPS disclosure and a matching declared capability', () => {
        expect(() => validateMarketDataProvider(provider)).not.toThrow();
    });

    it('rejects missing licensing or attribution disclosure', () => {
        expect(() => validateMarketDataProvider({
            ...provider,
            descriptor: { ...descriptor, licenseName: '' }
        })).toThrow(/license/i);
        expect(() => validateMarketDataProvider({
            ...provider,
            descriptor: { ...descriptor, attributionText: ' ' }
        })).toThrow(/attribution/i);
    });

    it('rejects insecure documentation and terms URLs', () => {
        expect(() => validateMarketDataProvider({
            ...provider,
            descriptor: { ...descriptor, termsUrl: 'http://example.test/terms' }
        })).toThrow(/HTTPS/i);
    });

    it('rejects declared capabilities without an implementation', () => {
        expect(() => validateMarketDataProvider({
            descriptor: { ...descriptor, capabilities: ['quotes', 'historical-bars'] },
            quotes: provider.quotes
        })).toThrow(/without implementing/i);
    });

    it('rejects implementations that are not declared', () => {
        expect(() => validateMarketDataProvider({
            descriptor: { ...descriptor, capabilities: [] },
            quotes: provider.quotes
        })).toThrow(/undeclared capability/i);
    });
});
