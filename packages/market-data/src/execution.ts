export type MarketDataProviderErrorCode =
    | 'rate-limited'
    | 'unavailable'
    | 'unauthorized'
    | 'forbidden'
    | 'not-found'
    | 'invalid-request'
    | 'unsupported'
    | 'timeout'
    | 'cancelled'
    | 'unknown';

const safeMessages: Readonly<Record<MarketDataProviderErrorCode, string>> = {
    'rate-limited': 'The market-data provider rate limit was reached.',
    unavailable: 'The market-data provider is temporarily unavailable.',
    unauthorized: 'The market-data provider rejected the configured credentials.',
    forbidden: 'The configured provider account is not permitted to access this data.',
    'not-found': 'The provider has no matching market-data record.',
    'invalid-request': 'The market-data request was rejected as invalid.',
    unsupported: 'The provider does not support this market-data capability.',
    timeout: 'The market-data provider request timed out.',
    cancelled: 'The market-data request was cancelled.',
    unknown: 'The market-data provider request failed.'
};

const retryableCodes = new Set<MarketDataProviderErrorCode>(['rate-limited', 'unavailable', 'timeout']);

export class MarketDataProviderError extends Error {
    public readonly code: MarketDataProviderErrorCode;
    public readonly retryable: boolean;

    public constructor(code: MarketDataProviderErrorCode) {
        super(safeMessages[code]);
        this.name = 'MarketDataProviderError';
        this.code = code;
        this.retryable = retryableCodes.has(code);
    }
}

export interface MarketDataExecutionPolicy {
    readonly timeoutMs: number;
    readonly maxAttempts: number;
    readonly retryDelayMs: number;
    readonly cacheTtlMs: number;
    readonly maxCacheEntries: number;
}

export function validateMarketDataExecutionPolicy(policy: MarketDataExecutionPolicy): void {
    if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 100 || policy.timeoutMs > 60_000) {
        throw new RangeError('Market-data timeout must be between 100 and 60000 milliseconds.');
    }
    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 3) {
        throw new RangeError('Market-data attempts must be between one and three.');
    }
    if (!Number.isInteger(policy.retryDelayMs) || policy.retryDelayMs < 0 || policy.retryDelayMs > 5_000) {
        throw new RangeError('Market-data retry delay must be between zero and 5000 milliseconds.');
    }
    if (!Number.isInteger(policy.cacheTtlMs) || policy.cacheTtlMs < 0 || policy.cacheTtlMs > 3_600_000) {
        throw new RangeError('Market-data cache TTL must be between zero and one hour.');
    }
    if (!Number.isInteger(policy.maxCacheEntries) || policy.maxCacheEntries < 0 || policy.maxCacheEntries > 1_000) {
        throw new RangeError('Market-data cache entry limit must be between zero and 1000.');
    }
}

interface CacheEntry {
    readonly value: unknown;
    readonly expiresAt: number;
}

export class MarketDataMemoryCache {
    private readonly entries = new Map<string, CacheEntry>();

    public constructor(private readonly maxEntries: number) {
        if (!Number.isInteger(maxEntries) || maxEntries < 0 || maxEntries > 1_000) {
            throw new RangeError('Market-data cache entry limit must be between zero and 1000.');
        }
    }

    public get(key: string, now = Date.now()): unknown {
        const entry = this.entries.get(key);
        if (!entry) {
            return undefined;
        }
        if (entry.expiresAt <= now) {
            this.entries.delete(key);
            return undefined;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    public set(key: string, value: unknown, expiresAt: number, now = Date.now()): void {
        if (this.maxEntries === 0 || expiresAt <= now) {
            return;
        }
        this.entries.delete(key);
        while (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            this.entries.delete(oldest);
        }
        this.entries.set(key, { value, expiresAt });
    }

    public get size(): number {
        return this.entries.size;
    }
}

export interface MarketDataExecutionOptions<T> {
    readonly cacheKey?: string;
    readonly policy: MarketDataExecutionPolicy;
    readonly cache?: MarketDataMemoryCache;
    readonly signal?: AbortSignal;
    readonly operation: (signal: AbortSignal) => Promise<T>;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly now?: () => number;
}

export interface MarketDataExecutionResult<T> {
    readonly value: T;
    readonly cache: 'hit' | 'miss' | 'disabled';
    readonly attempts: number;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Execute one explicitly invoked provider operation with bounded timeout, retry, and in-memory cache. */
export async function executeMarketDataOperation<T>(
    options: MarketDataExecutionOptions<T>
): Promise<MarketDataExecutionResult<T>> {
    const policy = options.policy;
    validateMarketDataExecutionPolicy(policy);
    const now = options.now ?? Date.now;
    const cacheEnabled = policy.cacheTtlMs > 0 && policy.maxCacheEntries > 0;
    if (cacheEnabled && options.cacheKey !== undefined && options.cache !== undefined) {
        const cached = options.cache.get(options.cacheKey, now());
        if (cached !== undefined) {
            return { value: cached as T, cache: 'hit', attempts: 0 };
        }
    }
    if (options.signal && options.signal.aborted) {
        throw new MarketDataProviderError('cancelled');
    }

    const sleep = options.sleep ?? defaultSleep;
    let attempts = 0;
    while (attempts < policy.maxAttempts) {
        attempts += 1;
        const controller = new AbortController();
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, policy.timeoutMs);
        const onAbort = (): void => { controller.abort(); };
        options.signal?.addEventListener('abort', onAbort, { once: true });
        try {
            const value = await Promise.race([
                options.operation(controller.signal),
                new Promise<never>((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new MarketDataProviderError(timedOut ? 'timeout' : 'cancelled'));
                    }, { once: true });
                })
            ]);
            clearTimeout(timeout);
            options.signal?.removeEventListener('abort', onAbort);
            if (cacheEnabled && options.cacheKey !== undefined && options.cache !== undefined) {
                options.cache.set(options.cacheKey, value, now() + policy.cacheTtlMs, now());
            }
            return { value, cache: cacheEnabled && options.cacheKey !== undefined && options.cache !== undefined ? 'miss' : 'disabled', attempts };
        } catch (error) {
            clearTimeout(timeout);
            options.signal?.removeEventListener('abort', onAbort);
            let normalized: MarketDataProviderError;
            if (error instanceof MarketDataProviderError) {
                normalized = error;
            } else if (timedOut) {
                normalized = new MarketDataProviderError('timeout');
            } else if (options.signal && options.signal.aborted) {
                normalized = new MarketDataProviderError('cancelled');
            } else {
                normalized = new MarketDataProviderError('unknown');
            }
            if (!normalized.retryable || attempts >= policy.maxAttempts) {
                throw normalized;
            }
            await sleep(policy.retryDelayMs * attempts);
        }
    }
    throw new MarketDataProviderError('unknown');
}

export function sanitizeMarketDataError(error: unknown): { readonly code: MarketDataProviderErrorCode; readonly message: string } {
    if (error instanceof MarketDataProviderError) {
        return { code: error.code, message: safeMessages[error.code] };
    }
    return { code: 'unknown', message: safeMessages.unknown };
}
