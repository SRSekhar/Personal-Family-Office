import type {
    CorporateActionObservation,
    CorporateActionsRequest,
    FundamentalObservation,
    FundamentalsRequest,
    HistoricalBar,
    HistoricalBarsRequest,
    InstrumentIdentityCandidate,
    MarketDataCapabilityName,
    MarketDataProviderDescriptor,
    MarketDataResult,
    QuoteObservation,
    QuoteRequest,
    ResolveInstrumentRequest
} from './contracts.js';

export interface InstrumentIdentityCapability {
    resolveInstrument(request: ResolveInstrumentRequest, signal: AbortSignal): Promise<MarketDataResult<readonly InstrumentIdentityCandidate[]>>;
}

export interface QuoteCapability {
    getQuote(request: QuoteRequest, signal: AbortSignal): Promise<MarketDataResult<QuoteObservation>>;
}

export interface HistoricalBarsCapability {
    getHistoricalBars(request: HistoricalBarsRequest, signal: AbortSignal): Promise<MarketDataResult<readonly HistoricalBar[]>>;
}

export interface FundamentalsCapability {
    getFundamentals(request: FundamentalsRequest, signal: AbortSignal): Promise<MarketDataResult<readonly FundamentalObservation[]>>;
}

export interface CorporateActionsCapability {
    getCorporateActions(request: CorporateActionsRequest, signal: AbortSignal): Promise<MarketDataResult<readonly CorporateActionObservation[]>>;
}

export interface MarketDataProvider {
    readonly descriptor: MarketDataProviderDescriptor;
    readonly instrumentIdentity?: InstrumentIdentityCapability;
    readonly quotes?: QuoteCapability;
    readonly historicalBars?: HistoricalBarsCapability;
    readonly fundamentals?: FundamentalsCapability;
    readonly corporateActions?: CorporateActionsCapability;
}

const capabilityMethods: readonly { readonly name: MarketDataCapabilityName; readonly property: keyof Omit<MarketDataProvider, 'descriptor'> }[] = [
    { name: 'instrument-identity', property: 'instrumentIdentity' },
    { name: 'quotes', property: 'quotes' },
    { name: 'historical-bars', property: 'historicalBars' },
    { name: 'fundamentals', property: 'fundamentals' },
    { name: 'corporate-actions', property: 'corporateActions' }
];

function requireText(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new RangeError(label + ' must be a non-empty string.');
    }
}

function requireHttpsUrl(value: string, label: string): void {
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new RangeError(label + ' must be a valid HTTPS URL.');
    }
    if (parsed.protocol !== 'https:') {
        throw new RangeError(label + ' must use HTTPS.');
    }
}

/** Validate provider disclosure and ensure each declared capability has exactly one implementation port. */
export function validateMarketDataProvider(provider: MarketDataProvider): void {
    const descriptor = provider.descriptor;
    requireText(descriptor.id, 'Provider ID');
    requireText(descriptor.name, 'Provider name');
    requireText(descriptor.version, 'Provider version');
    requireText(descriptor.licenseName, 'Provider license');
    requireText(descriptor.attributionText, 'Provider attribution');
    requireText(descriptor.documentationUrl, 'Provider documentation URL');
    requireText(descriptor.termsUrl, 'Provider terms URL');
    requireHttpsUrl(descriptor.documentationUrl, 'Provider documentation URL');
    requireHttpsUrl(descriptor.termsUrl, 'Provider terms URL');

    if (new Set(descriptor.capabilities).size !== descriptor.capabilities.length) {
        throw new RangeError('Provider capabilities must be a unique array.');
    }
    for (const capability of descriptor.capabilities) {
        const mapping = capabilityMethods.find((item) => item.name === capability);
        if (!mapping) {
            throw new RangeError('Provider declares an unsupported capability.');
        }
        if (!provider[mapping.property]) {
            throw new RangeError('Provider declares ' + capability + ' without implementing its capability port.');
        }
    }
    for (const mapping of capabilityMethods) {
        if (provider[mapping.property] && !descriptor.capabilities.includes(mapping.name)) {
            throw new RangeError('Provider implements an undeclared capability: ' + mapping.name + '.');
        }
    }
}
