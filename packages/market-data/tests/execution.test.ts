import { describe, expect, it } from 'vitest';

import {
    executeMarketDataOperation,
    MarketDataMemoryCache,
    MarketDataProviderError,
    sanitizeMarketDataError,
    validateMarketDataExecutionPolicy
} from '../src/execution.js';
import type { MarketDataExecutionPolicy } from '../src/execution.js';

const policy: MarketDataExecutionPolicy = {
    timeoutMs: 100,
    maxAttempts: 2,
    retryDelayMs: 0,
    cacheTtlMs: 1_000,
    maxCacheEntries: 2
};

describe('market-data execution boundary', () => {
    it('rejects unbounded timeout, retry, delay and cache policies', () => {
        expect(() => { validateMarketDataExecutionPolicy({ ...policy, timeoutMs: 60_001 }); }).toThrow(/timeout/i);
        expect(() => { validateMarketDataExecutionPolicy({ ...policy, maxAttempts: 4 }); }).toThrow(/attempts/i);
        expect(() => { validateMarketDataExecutionPolicy({ ...policy, retryDelayMs: 5_001 }); }).toThrow(/retry delay/i);
        expect(() => { validateMarketDataExecutionPolicy({ ...policy, cacheTtlMs: 3_600_001 }); }).toThrow(/cache TTL/i);
        expect(() => { validateMarketDataExecutionPolicy({ ...policy, maxCacheEntries: 1_001 }); }).toThrow(/cache entry/i);
    });

    it('retries only classified transient provider errors and caches successful results', async () => {
        const cache = new MarketDataMemoryCache(policy.maxCacheEntries);
        let calls = 0;
        const first = await executeMarketDataOperation({
            cacheKey: 'provider|quote|instrument-1|2026-01-01T00:00:00.000Z',
            cache, policy, sleep: () => Promise.resolve(),
            operation: () => {
                calls += 1;
                return calls === 1
                    ? Promise.reject(new MarketDataProviderError('unavailable'))
                    : Promise.resolve({ price: 123 });
            }
        });
        expect(first).toMatchObject({ value: { price: 123 }, cache: 'miss', attempts: 2 });
        const second = await executeMarketDataOperation({
            cacheKey: 'provider|quote|instrument-1|2026-01-01T00:00:00.000Z',
            cache, policy,
            operation: () => {
                calls += 1;
                return Promise.resolve({ price: 999 });
            }
        });
        expect(second).toMatchObject({ value: { price: 123 }, cache: 'hit', attempts: 0 });
        expect(calls).toBe(2);
    });

    it('does not retry authorization and validation errors', async () => {
        let calls = 0;
        await expect(executeMarketDataOperation({
            policy, operation: () => {
                calls += 1;
                return Promise.reject(new MarketDataProviderError('unauthorized'));
            }
        })).rejects.toMatchObject({ code: 'unauthorized', retryable: false });
        expect(calls).toBe(1);
    });

    it('times out a hung provider operation and retries only within the configured bound', async () => {
        let calls = 0;
        await expect(executeMarketDataOperation({
            policy: { ...policy, timeoutMs: 100, maxAttempts: 1 },
            operation: (signal) => new Promise<number>((_resolve, reject) => {
                calls += 1;
                signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            })
        })).rejects.toMatchObject({ code: 'timeout', retryable: true });
        expect(calls).toBe(1);
    });

    it('does not cache failures or call a provider when the request is already cancelled', async () => {
        const cache = new MarketDataMemoryCache(policy.maxCacheEntries);
        const controller = new AbortController();
        controller.abort();
        let calls = 0;
        await expect(executeMarketDataOperation({
            cacheKey: 'cancelled', cache, policy, signal: controller.signal,
            operation: () => {
                calls += 1;
                return Promise.resolve(1);
            }
        })).rejects.toMatchObject({ code: 'cancelled' });
        expect(calls).toBe(0);
        expect(cache.size).toBe(0);
    });

    it('sanitizes unknown provider errors without exposing raw details', () => {
        const result = sanitizeMarketDataError(new Error('token=super-secret response body'));
        expect(result).toEqual({ code: 'unknown', message: 'The market-data provider request failed.' });
        expect(JSON.stringify(result)).not.toContain('super-secret');
    });
});
