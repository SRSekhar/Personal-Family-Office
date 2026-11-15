import { Currency } from '@pfo/models';
import type {
    BacktestBarObservation,
    BacktestDataset,
    BacktestRunConfiguration,
    BacktestRunValidationContext,
    BacktestTradingCalendar,
    BacktestUniverse
} from './contracts.js';

const currencies = new Set<string>(Object.values(Currency));
const intervals = new Set<string>(['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1mo']);
const adjustmentBases = new Set<string>(['unadjusted', 'split-adjusted', 'total-return-adjusted']);
const digestPattern = /^[a-f0-9]{64}$/u;

function requireText(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new RangeError(label + ' must be a non-empty string.');
    }
}

function requireTimestamp(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new RangeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
}

function requireDigest(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || !digestPattern.test(value)) {
        throw new RangeError(label + ' must be a lowercase SHA-256 hex digest.');
    }
}

function requireVersion(value: unknown, label: string): asserts value is number {
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
        throw new RangeError(label + ' must be a positive safe integer.');
    }
}

function validateHttpsUrl(value: string, label: string): void {
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

function validateSource(source: BacktestDataset['source']): void {
    requireText(source.kind, 'Dataset source kind');
    requireText(source.name, 'Dataset source name');
    requireText(source.licenseName, 'Dataset license name');
    requireText(source.attributionText, 'Dataset attribution');
    requireTimestamp(source.retrievedAt, 'Dataset source retrievedAt');
    requireDigest(source.contentDigest, 'Dataset source content digest');

    if (!['provider', 'exchange', 'issuer', 'user-supplied', 'other'].includes(source.kind)) {
        throw new RangeError('Dataset source kind is unsupported.');
    }
    if (!['reviewed', 'unreviewed', 'restricted'].includes(source.licenseStatus)) {
        throw new RangeError('Dataset license status is unsupported.');
    }
    if (source.licenseStatus === 'reviewed') {
        requireTimestamp(source.licenseReviewedAt, 'Dataset licenseReviewedAt');
    } else if (source.licenseReviewedAt !== undefined) {
        requireTimestamp(source.licenseReviewedAt, 'Dataset licenseReviewedAt');
    }
    if (source.url !== undefined) {
        requireText(source.url, 'Dataset source URL');
        validateHttpsUrl(source.url, 'Dataset source URL');
    }
    if (source.termsUrl !== undefined) {
        requireText(source.termsUrl, 'Dataset terms URL');
        validateHttpsUrl(source.termsUrl, 'Dataset terms URL');
    }
    if (!['per-observation', 'snapshot-only', 'not-guaranteed', 'unknown'].includes(source.pointInTimeStatus)) {
        throw new RangeError('Dataset point-in-time status is unsupported.');
    }
    if (source.pointInTimeLimitation !== undefined) {
        requireText(source.pointInTimeLimitation, 'Dataset point-in-time limitation');
    }
}

function validateBar(bar: BacktestBarObservation, dataset: BacktestDataset): void {
    if (bar.instrumentId !== dataset.instrument.instrumentId) {
        throw new RangeError('Every bar must match the dataset instrument ID.');
    }
    if (bar.interval !== dataset.interval || bar.currency !== dataset.instrument.currency
        || bar.adjustmentBasis !== dataset.adjustmentBasis || bar.marketTimeZone !== dataset.marketTimeZone) {
        throw new RangeError('Every bar must match the dataset interval, currency, adjustment basis and market timezone.');
    }
    requireTimestamp(bar.startAt, 'Bar startAt');
    requireTimestamp(bar.endAt, 'Bar endAt');
    requireTimestamp(bar.recordedAt, 'Bar recordedAt');
    if (bar.endAt <= bar.startAt) {
        throw new RangeError('Bar endAt must be later than startAt.');
    }
    for (const [name, value] of [['open', bar.open], ['high', bar.high], ['low', bar.low], ['close', bar.close]] as const) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new RangeError('Bar ' + name + ' must be a positive finite price.');
        }
    }
    if (bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close, bar.high)) {
        throw new RangeError('Bar OHLC values do not satisfy high/low consistency.');
    }
    if (bar.volume !== undefined && (!Number.isFinite(bar.volume) || bar.volume < 0)) {
        throw new RangeError('Bar volume must be a non-negative finite number when supplied.');
    }
    if (bar.availableAt !== undefined) {
        requireTimestamp(bar.availableAt, 'Bar availableAt');
        if (bar.availableAt < bar.endAt) {
            throw new RangeError('Bar availability cannot precede the completed bar end.');
        }
    }
    if (bar.providerInstrumentId !== undefined) {
        requireText(bar.providerInstrumentId, 'Bar provider instrument ID');
    }
}

export function validateBacktestDataset(dataset: BacktestDataset): void {
    requireText(dataset.id, 'Dataset ID');
    requireVersion(dataset.version, 'Dataset version');
    requireText(dataset.instrument.instrumentId, 'Dataset instrument ID');
    requireText(dataset.instrument.name, 'Dataset instrument name');
    if (!currencies.has(dataset.instrument.currency)) {
        throw new RangeError('Dataset instrument currency is unsupported.');
    }
    if (!intervals.has(dataset.interval)) {
        throw new RangeError('Dataset interval is unsupported.');
    }
    if (!adjustmentBases.has(dataset.adjustmentBasis)) {
        throw new RangeError('Dataset price-adjustment basis must be explicit and supported.');
    }
    requireText(dataset.marketTimeZone, 'Dataset market timezone');
    requireTimestamp(dataset.recordedAt, 'Dataset recordedAt');
    requireDigest(dataset.contentDigest, 'Dataset normalized content digest');
    validateSource(dataset.source);
    if (dataset.source.retrievedAt > dataset.recordedAt) {
        throw new RangeError('Dataset must be recorded at or after its source retrieval timestamp.');
    }
    requireTimestamp(dataset.coverage.startAt, 'Dataset coverage startAt');
    requireTimestamp(dataset.coverage.endAt, 'Dataset coverage endAt');
    if (dataset.coverage.endAt <= dataset.coverage.startAt) {
        throw new RangeError('Dataset coverage endAt must be later than startAt.');
    }

    const rawBars: unknown = dataset.bars;
    if (!Array.isArray(rawBars) || rawBars.length === 0) {
        throw new RangeError('Dataset must contain at least one historical bar.');
    }
    const bars = rawBars as BacktestBarObservation[];
    const rawExpected: unknown = dataset.coverage.expectedBarEndAt;
    if (!Array.isArray(rawExpected)) {
        throw new RangeError('Dataset requires an explicit expected bar schedule.');
    }
    const expectedBarEndAt = rawExpected as string[];
    const expected = new Set<string>();
    for (let index = 0; index < expectedBarEndAt.length; index += 1) {
        const timestamp = expectedBarEndAt[index];
        requireTimestamp(timestamp, 'Expected bar end timestamp');
        if (timestamp < dataset.coverage.startAt || timestamp > dataset.coverage.endAt) {
            throw new RangeError('Expected bar end must fall within dataset coverage.');
        }
        if (expected.has(timestamp)) {
            throw new RangeError('Expected bar end timestamps must be unique.');
        }
        const previous = index > 0 ? expectedBarEndAt[index - 1] : undefined;
        if (previous !== undefined && timestamp <= previous) {
            throw new RangeError('Expected bar end timestamps must be strictly increasing.');
        }
        expected.add(timestamp);
    }
    if (!['complete', 'partial', 'unknown'].includes(dataset.coverage.status)) {
        throw new RangeError('Dataset coverage status is unsupported.');
    }

    const barIds = new Set<string>();
    let previousStartAt: string | undefined;
    for (const bar of bars) {
        validateBar(bar, dataset);
        if (bar.endAt < dataset.coverage.startAt || bar.endAt > dataset.coverage.endAt) {
            throw new RangeError('Bar endAt is outside dataset coverage.');
        }
        if (bar.recordedAt > dataset.recordedAt) {
            throw new RangeError('A bar cannot be recorded after its containing dataset snapshot.');
        }
        if (bar.availableAt !== undefined && bar.availableAt > bar.recordedAt) {
            throw new RangeError('A bar cannot be imported before its evidenced availability timestamp.');
        }
        if (previousStartAt !== undefined && bar.startAt <= previousStartAt) {
            throw new RangeError('Dataset bars must be strictly ordered by startAt.');
        }
        previousStartAt = bar.startAt;
        const key = JSON.stringify([bar.instrumentId, bar.interval, bar.startAt]);
        if (barIds.has(key)) {
            throw new RangeError('Dataset contains duplicate instrument/interval/bar-start observations.');
        }
        barIds.add(key);
        if (dataset.coverage.status === 'complete' && !expected.has(bar.endAt)) {
            throw new RangeError('A complete dataset contains a bar outside its expected calendar.');
        }
    }
    if (dataset.coverage.status === 'complete') {
        const observed = new Set(bars.map((bar) => bar.endAt));
        if (observed.size !== expected.size || [...expected].some((timestamp) => !observed.has(timestamp))) {
            throw new RangeError('A complete dataset must contain every explicitly expected bar.');
        }
    }
    if (dataset.source.pointInTimeStatus === 'per-observation') {
        for (const bar of bars) {
            if (!bar.availableAt) {
                throw new RangeError('Per-observation point-in-time data requires availableAt on every bar.');
            }
        }
    }
}

export function validateBacktestUniverse(universe: BacktestUniverse): void {
    requireText(universe.id, 'Universe ID');
    requireText(universe.name, 'Universe name');
    requireVersion(universe.version, 'Universe version');
    requireTimestamp(universe.recordedAt, 'Universe recordedAt');
    if (typeof universe.pointInTimeComplete !== 'boolean') {
        throw new RangeError('Universe point-in-time completeness must be explicit.');
    }
    const rawMemberships: unknown = universe.memberships;
    if (!Array.isArray(rawMemberships)) {
        throw new RangeError('Universe memberships must be an array.');
    }
    const memberships = rawMemberships as BacktestUniverse['memberships'][number][];
    const ids = new Set<string>();
    for (const membership of memberships) {
        requireText(membership.id, 'Universe membership ID');
        requireText(membership.instrumentId, 'Universe membership instrument ID');
        requireText(membership.sourceEvidenceId, 'Universe membership source evidence ID');
        requireTimestamp(membership.effectiveFrom, 'Membership effectiveFrom');
        requireTimestamp(membership.recordedAt, 'Membership recordedAt');
        if (membership.recordedAt > universe.recordedAt) {
            throw new RangeError('Membership cannot be recorded after its containing universe version.');
        }
        if (membership.effectiveTo !== undefined) {
            requireTimestamp(membership.effectiveTo, 'Membership effectiveTo');
            if (membership.effectiveTo <= membership.effectiveFrom) {
                throw new RangeError('Membership effectiveTo must be later than effectiveFrom.');
            }
        }
        if (membership.availableAt !== undefined) {
            requireTimestamp(membership.availableAt, 'Membership availableAt');
            if (membership.availableAt > membership.recordedAt) {
                throw new RangeError('Universe membership cannot be recorded before its evidenced availability timestamp.');
            }
        }
        if (!['included', 'excluded'].includes(membership.status)) {
            throw new RangeError('Universe membership status is unsupported.');
        }
        if (ids.has(membership.id)) {
            throw new RangeError('Universe membership IDs must be unique.');
        }
        ids.add(membership.id);
        if (universe.pointInTimeComplete && !membership.availableAt) {
            throw new RangeError('Point-in-time-complete universe membership requires availableAt.');
        }
    }
}

export function validateBacktestTradingCalendar(calendar: BacktestTradingCalendar): void {
    requireText(calendar.id, 'Trading calendar ID');
    requireVersion(calendar.version, 'Trading calendar version');
    requireText(calendar.exchange, 'Trading calendar exchange');
    if (!intervals.has(calendar.interval)) {
        throw new RangeError('Trading calendar interval is unsupported.');
    }
    requireText(calendar.marketTimeZone, 'Trading calendar market timezone');
    requireText(calendar.sourceName, 'Trading calendar source name');
    requireText(calendar.sourceEvidenceId, 'Trading calendar source evidence ID');
    requireTimestamp(calendar.recordedAt, 'Trading calendar recordedAt');
    requireTimestamp(calendar.coverage.startAt, 'Trading calendar coverage startAt');
    requireTimestamp(calendar.coverage.endAt, 'Trading calendar coverage endAt');
    if (calendar.coverage.endAt <= calendar.coverage.startAt) {
        throw new RangeError('Trading calendar coverage endAt must be later than startAt.');
    }
    const rawExpected: unknown = calendar.coverage.expectedBarEndAt;
    if (!Array.isArray(rawExpected) || rawExpected.length === 0) {
        throw new RangeError('Trading calendar must explicitly list expected bar ends.');
    }
    const expectedBarEndAt = rawExpected as string[];
    for (let index = 0; index < expectedBarEndAt.length; index += 1) {
        const timestamp = expectedBarEndAt[index];
        requireTimestamp(timestamp, 'Trading calendar expected bar end');
        if (timestamp < calendar.coverage.startAt || timestamp > calendar.coverage.endAt) {
            throw new RangeError('Expected bar end is outside trading calendar coverage.');
        }
        const previous = index > 0 ? expectedBarEndAt[index - 1] : undefined;
        if (previous !== undefined && timestamp <= previous) {
            throw new RangeError('Trading calendar expected bar ends must be strictly increasing and unique.');
        }
    }
}

export function validateBacktestRunConfiguration(
    configuration: BacktestRunConfiguration,
    context: BacktestRunValidationContext
): void {
    requireText(configuration.id, 'Backtest run ID');
    requireTimestamp(configuration.startAt, 'Backtest startAt');
    requireTimestamp(configuration.endAt, 'Backtest endAt');
    requireTimestamp(configuration.recordedAtCutoff, 'Backtest recordedAtCutoff');
    if (configuration.endAt <= configuration.startAt) {
        throw new RangeError('Backtest endAt must be later than startAt.');
    }
    if (!currencies.has(configuration.currency)) {
        throw new RangeError('Backtest currency is unsupported.');
    }
    if (!Number.isFinite(configuration.initialCapital.amount) || configuration.initialCapital.amount <= 0
        || configuration.initialCapital.currency !== configuration.currency) {
        throw new RangeError('Initial capital must be positive and use the run currency.');
    }
    if (configuration.datasetIds.length === 0 || new Set(configuration.datasetIds).size !== configuration.datasetIds.length) {
        throw new RangeError('Backtest dataset IDs must be a non-empty unique array.');
    }
    const resolvedDatasetIds = new Set(context.datasets.map((dataset) => dataset.id));
    if (resolvedDatasetIds.size !== context.datasets.length || context.datasets.length !== configuration.datasetIds.length
        || configuration.datasetIds.some((id) => !resolvedDatasetIds.has(id))) {
        throw new RangeError('Backtest configuration must resolve every selected dataset exactly once.');
    }

    validateBacktestUniverse(context.universe);
    validateBacktestTradingCalendar(context.calendar);
    requireText(configuration.universeId, 'Backtest universe ID');
    requireVersion(configuration.universeVersion, 'Backtest universe version');
    requireText(configuration.calendarId, 'Backtest calendar ID');
    requireVersion(configuration.calendarVersion, 'Backtest calendar version');
    if (context.universe.id !== configuration.universeId || context.universe.version !== configuration.universeVersion) {
        throw new RangeError('Backtest universe reference does not match the supplied immutable universe version.');
    }
    if (context.calendar.id !== configuration.calendarId || context.calendar.version !== configuration.calendarVersion) {
        throw new RangeError('Backtest calendar reference does not match the supplied immutable calendar version.');
    }
    if (context.universe.recordedAt > configuration.recordedAtCutoff || context.calendar.recordedAt > configuration.recordedAtCutoff) {
        throw new RangeError('Universe and trading calendar must be recorded by the selected PFO knowledge-state cutoff.');
    }
    if (context.calendar.coverage.startAt > configuration.startAt || context.calendar.coverage.endAt < configuration.endAt) {
        throw new RangeError('Trading calendar must cover the complete requested backtest window.');
    }

    const selected = context.datasets;
    const first = selected.at(0);
    if (!first) {
        throw new RangeError('At least one backtest dataset must be selected.');
    }
    for (const dataset of selected) {
        validateBacktestDataset(dataset);
        if (!configuration.datasetIds.includes(dataset.id)) {
            throw new RangeError('Resolved dataset is not included in the run configuration.');
        }
        if (dataset.recordedAt > configuration.recordedAtCutoff) {
            throw new RangeError('Selected dataset must be recorded by the selected PFO knowledge-state cutoff.');
        }
        if (dataset.coverage.startAt > configuration.startAt || dataset.coverage.endAt < configuration.endAt) {
            throw new RangeError('Every selected dataset must cover the complete requested backtest window.');
        }
        if (dataset.instrument.currency !== configuration.currency) {
            throw new RangeError('All backtest instruments must use the run currency; FX is not supported.');
        }
        if (dataset.interval !== first.interval || dataset.marketTimeZone !== first.marketTimeZone
            || dataset.adjustmentBasis !== first.adjustmentBasis || context.calendar.interval !== dataset.interval
            || context.calendar.marketTimeZone !== dataset.marketTimeZone) {
            throw new RangeError('All selected datasets must use the same interval, timezone and adjustment basis.');
        }
        if (dataset.source.licenseStatus !== 'reviewed') {
            throw new RangeError('Dataset license must be reviewed before backtest execution.');
        }
        if (dataset.instrument.exchange !== context.calendar.exchange) {
            throw new RangeError('Dataset exchange must match the selected trading calendar.');
        }
        const expected = new Set(context.calendar.coverage.expectedBarEndAt);
        if (dataset.bars.some((bar) => !expected.has(bar.endAt))) {
            throw new RangeError('Every selected bar must belong to the selected explicit trading calendar.');
        }
        if (configuration.pointInTimeRequired) {
            if (dataset.coverage.status !== 'complete') {
                throw new RangeError('Point-in-time runs require complete expected-session coverage.');
            }
            if (dataset.source.pointInTimeStatus !== 'per-observation' || dataset.bars.some((bar) => !bar.availableAt)) {
                throw new RangeError('Point-in-time runs require per-observation availability evidence for every bar.');
            }
        }
    }

    const universeSelection: string = configuration.universeSelection;
    if (universeSelection === 'point-in-time') {
        if (!context.universe.pointInTimeComplete) {
            throw new RangeError('Point-in-time universe selection requires complete bitemporal membership evidence.');
        }
        const memberInstrumentIds = new Set(context.universe.memberships.filter((item) => item.status === 'included').map((item) => item.instrumentId));
        if (selected.some((dataset) => !memberInstrumentIds.has(dataset.instrument.instrumentId))) {
            throw new RangeError('Every selected dataset instrument must have explicit included universe membership evidence.');
        }
    } else if (universeSelection === 'static-exploratory') {
        if (!configuration.survivorshipBiasAcknowledged) {
            throw new RangeError('Static exploratory universe requires explicit survivorship-bias acknowledgement.');
        }
    } else {
        throw new RangeError('Backtest universe selection mode is unsupported.');
    }
    if (configuration.pointInTimeRequired && universeSelection !== 'point-in-time') {
        throw new RangeError('Point-in-time-required runs cannot use a static exploratory universe.');
    }

    const strategy = configuration.strategy;
    requireText(strategy.id, 'Strategy ID');
    requireText(strategy.version, 'Strategy version');
    requireDigest(strategy.implementationDigest, 'Strategy implementation digest');
    requireDigest(strategy.parametersDigest, 'Strategy parameters digest');
    if (strategy.supportedIntervals.length === 0 || new Set(strategy.supportedIntervals).size !== strategy.supportedIntervals.length
        || !strategy.supportedIntervals.includes(first.interval)) {
        throw new RangeError('Strategy must declare unique supported intervals including the selected dataset interval.');
    }

    const execution = configuration.execution;
    const signalTiming: string = execution.signalTiming;
    const fillTiming: string = execution.fillTiming;
    const orderType: string = execution.orderType;
    if (signalTiming !== 'bar-close' || fillTiming !== 'next-bar-open' || orderType !== 'market') {
        throw new RangeError('The initial backtesting contract supports only bar-close signals and next-bar-open market fills.');
    }
    if (!Number.isFinite(execution.slippageBasisPoints) || execution.slippageBasisPoints < 0 || execution.slippageBasisPoints > 10_000) {
        throw new RangeError('Slippage basis points must be between zero and 10000.');
    }
    if (!Number.isFinite(execution.maxVolumeParticipation) || execution.maxVolumeParticipation <= 0 || execution.maxVolumeParticipation > 1) {
        throw new RangeError('Maximum volume participation must be greater than zero and at most one.');
    }
    const missingVolumePolicy: string = execution.missingVolumePolicy;
    const remainderPolicy: string = execution.unfilledRemainderPolicy;
    if (missingVolumePolicy !== 'reject-order') {
        throw new RangeError('Missing volume policy must explicitly reject the order.');
    }
    if (!['partial-fill', 'reject-order'].includes(execution.insufficientVolumePolicy) || remainderPolicy !== 'expire') {
        throw new RangeError('Insufficient-volume and remainder policies are unsupported.');
    }

    const costModel = configuration.costModel;
    requireText(costModel.id, 'Cost model ID');
    requireText(costModel.version, 'Cost model version');
    requireDigest(costModel.implementationDigest, 'Cost model implementation digest');
    requireDigest(costModel.parametersDigest, 'Cost model parameters digest');
    if (costModel.currency !== configuration.currency) {
        throw new RangeError('Cost model currency must match the backtest currency.');
    }
    const corporateActionPolicy: string = configuration.corporateActionPolicy;
    if (!['require-complete-events', 'exclude-affected-periods', 'reject-any-action'].includes(corporateActionPolicy)) {
        throw new RangeError('A corporate-action policy must be explicitly selected.');
    }
}
