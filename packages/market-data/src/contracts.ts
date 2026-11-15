import type { Currency } from '@pfo/models';

export type IsoTimestamp = string;

export type MarketDataCapabilityName =
    | 'instrument-identity'
    | 'quotes'
    | 'historical-bars'
    | 'fundamentals'
    | 'corporate-actions';

export interface InstrumentReference {
    readonly instrumentId: string;
    readonly name: string;
    readonly currency: Currency;
    readonly symbol?: string;
    readonly exchange?: string;
    readonly isin?: string;
}

export interface MarketDataProviderDescriptor {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly documentationUrl: string;
    readonly termsUrl: string;
    readonly licenseName: string;
    readonly attributionText: string;
    readonly capabilities: readonly MarketDataCapabilityName[];
}

export type MarketDataDelayKind = 'real-time' | 'delayed' | 'end-of-day' | 'unknown';
export type MarketDataCoverageStatus = 'complete' | 'partial' | 'unsupported' | 'unknown';

export interface MarketDataSourceMetadata {
    readonly providerId: string;
    readonly providerName: string;
    readonly providerVersion: string;
    readonly licenseName: string;
    readonly termsUrl: string;
    readonly attributionText: string;
    readonly retrievedAt: IsoTimestamp;
    readonly marketTimeZone: string;
    readonly delay: {
        readonly kind: MarketDataDelayKind;
        readonly seconds?: number;
    };
    readonly freshness: 'fresh' | 'stale' | 'unknown';
    readonly coverage: {
        readonly status: MarketDataCoverageStatus;
        readonly details?: string;
    };
    readonly pointInTime: {
        readonly requestedKnownAtOrBefore?: IsoTimestamp;
        readonly guaranteed: boolean;
        readonly limitation?: string;
    };
}

export interface MarketDataResult<T> {
    readonly data: T;
    readonly source: MarketDataSourceMetadata;
}

export interface InstrumentIdentityCandidate {
    readonly instrumentId: string;
    readonly providerInstrumentId: string;
    readonly name: string;
    readonly currency: Currency;
    readonly symbol?: string;
    readonly exchange?: string;
    readonly isin?: string;
    readonly match: 'exact' | 'candidate';
}

export interface ResolveInstrumentRequest {
    readonly instrument: InstrumentReference;
}

export interface QuoteRequest {
    readonly instrument: InstrumentReference;
    readonly knownAtOrBefore?: IsoTimestamp;
}

export interface QuoteObservation {
    readonly instrumentId: string;
    readonly providerInstrumentId: string;
    readonly price: {
        readonly amount: number;
        readonly currency: Currency;
    };
    readonly quotedAt: IsoTimestamp;
    readonly marketTimeZone: string;
    readonly session: 'pre-market' | 'regular' | 'after-hours' | 'closed' | 'unknown';
}

export type BarInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1mo';
export type PriceAdjustmentBasis = 'unadjusted' | 'split-adjusted' | 'total-return-adjusted' | 'unknown';

export interface HistoricalBarsRequest {
    readonly instrument: InstrumentReference;
    readonly interval: BarInterval;
    readonly from: IsoTimestamp;
    readonly to: IsoTimestamp;
    readonly knownAtOrBefore: IsoTimestamp;
    readonly adjustmentBasis: PriceAdjustmentBasis;
}

export interface HistoricalBar {
    readonly instrumentId: string;
    readonly providerInstrumentId: string;
    readonly interval: BarInterval;
    readonly startAt: IsoTimestamp;
    readonly endAt: IsoTimestamp;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly currency: Currency;
    readonly volume?: number;
    readonly adjustmentBasis: PriceAdjustmentBasis;
    readonly marketTimeZone: string;
}

export type FundamentalValueUnit = 'currency' | 'currency-per-share' | 'shares' | 'ratio' | 'percent' | 'number' | 'days' | 'unknown';

export interface FundamentalsRequest {
    readonly instrument: InstrumentReference;
    readonly metricIds: readonly string[];
    readonly knownAtOrBefore: IsoTimestamp;
}

export interface FundamentalObservation {
    readonly instrumentId: string;
    readonly providerInstrumentId: string;
    readonly metricId: string;
    readonly value: number;
    readonly unit: FundamentalValueUnit;
    readonly currency?: Currency;
    readonly periodStart?: IsoTimestamp;
    readonly periodEnd: IsoTimestamp;
    readonly publishedAt?: IsoTimestamp;
}

export type CorporateActionType =
    | 'cash-dividend'
    | 'stock-split'
    | 'bonus-issue'
    | 'rights-issue'
    | 'merger'
    | 'spin-off'
    | 'symbol-change'
    | 'delisting'
    | 'other';

export interface CorporateActionsRequest {
    readonly instrument: InstrumentReference;
    readonly from: IsoTimestamp;
    readonly to: IsoTimestamp;
    readonly knownAtOrBefore: IsoTimestamp;
}

export interface CorporateActionObservation {
    readonly instrumentId: string;
    readonly providerInstrumentId: string;
    readonly providerActionId: string;
    readonly type: CorporateActionType;
    readonly announcedAt?: IsoTimestamp;
    readonly exDate?: IsoTimestamp;
    readonly recordDate?: IsoTimestamp;
    readonly payableDate?: IsoTimestamp;
    readonly effectiveAt: IsoTimestamp;
    readonly ratio?: {
        readonly numerator: number;
        readonly denominator: number;
    };
    readonly cashAmount?: {
        readonly amount: number;
        readonly currency: Currency;
    };
    readonly description?: string;
}

/** A normalized provider observation; it is evidence only, never a ledger event or valuation write. */
export interface MarketDataCapabilityResult<T> {
    readonly data: readonly T[];
    readonly source: MarketDataSourceMetadata;
}

/** A historical result is usable only when the provider explicitly guarantees the exact requested knowledge-time cutoff. */
export function hasPointInTimeGuarantee(
    source: MarketDataSourceMetadata,
    requestedKnownAtOrBefore: IsoTimestamp
): boolean {
    return source.pointInTime.guaranteed
        && source.pointInTime.requestedKnownAtOrBefore === requestedKnownAtOrBefore;
}
