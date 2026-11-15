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
const digestPattern = /^[a-f0-9]{64}$/u;

function requireText(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || value.trim() === '') throw new RangeError(label + ' must be a non-empty string.');
}

function requireTimestamp(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new RangeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
}

function requireDigest(value: unknown, label: string): asserts value is string {
    if (typeof value !== 'string' || !digestPattern.test(value)) throw new RangeError(label + ' must be a lowercase SHA-256 hex digest.');
}

function requireVersion(value: unknown, label: string): asserts value is number {
    if (!Number.isSafeInteger(value) || (value as number) < 1) throw new RangeError(label + ' must be a positive safe integer.');
}

function validateSource(source: BacktestDataset['source']): void {
    requireText(source.kind, 'Dataset source kind');
    requireText(source.name, 'Dataset source name');
    requireText(source.licenseName, 'Dataset license name');
    requireText(source.attributionText, 'Dataset attribution');
    requireTimestamp(source.retrievedAt, 'Dataset source retrievedAt');
    requireDigest(source.contentDigest, 'Dataset source content digest');
    if (!['provider', 'exchange', 'issuer', 'user-supplied', 'other'].includes(source.kind)) throw new RangeError('Dataset source kind is unsupported.');
    if (!['reviewed', 'unreviewed', 'restricted'].includes(source.licenseStatus)) throw new RangeError('Dataset license status is unsupported.');
    if (source.licenseStatus === 'reviewed') {
        requireTimestamp(source.licenseReviewedAt, 'Dataset licenseReviewedAt');
    } else if (source.licenseReviewedAt !== undefined) {
        requireTimestamp(source.licenseReviewedAt, 'Dataset licenseReviewedAt');
    }
    if (source.url !== undefined) {
        requireText(source.url, 'Dataset source URL');
        if (new URL(source.url).protocol !== 'https:') throw new RangeError('Dataset source URL must use HTTPS.');
    }
    if (source.termsUrl !== undefined) {
        requireText(source.termsUrl, 'Dataset terms URL');
        if (new URL(source.termsUrl).protocol !== 'https:') throw new RangeError('Dataset terms URL must use HTTPS.');
    }
    if (!['per-observation', 'snapshot-only', 'not-guaranteed', 'unknown'].includes(source.pointInTimeStatus)) {
        throw new RangeError('Dataset point-in-time status is unsupported.');
    }
    if (source.pointInTimeLimitation !== undefined) requireText(source.pointInTimeLimitation, 'Dataset point-in-time limitation');
}

function validateBar(bar: BacktestBarObservation, dataset: BacktestDataset): void {
    if (bar.instrumentId !== dataset.instrument.instrumentId) throw new RangeError('Every bar must match the dataset instrument ID.');
    if (bar.interval !== dataset.interval || bar.currency !== dataset.instrument.currency
        || bar.adjustmentBasis !== dataset.adjustmentBasis || bar.marketTimeZone !== dataset.marketTimeZone) {
        throw new RangeError('Every bar must match the dataset interval, currency, adjustment basis and market timezone.');
    }
    requireTimestamp(bar.startAt, 'Bar startAt');
    requireTimestamp(bar.endAt, 'Bar endAt');
    requireTimestamp(bar.recordedAt, 'Bar recordedAt');
    if (bar.endAt <= bar.startAt) throw new RangeError('Bar endAt must be later than startAt.');
    for (const [name, value] of [['open', bar.open], ['high', bar.high], ['low', bar.low], ['close', bar.close]] as const) {
        if (!Number.isFinite(value) || value <= 0) throw new RangeError('Bar ' + name + ' must be a positive finite price.');
    }
    if (bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close, bar.high)) {
        throw new RangeError('Bar OHLC values do not satisfy high/low consistency.');
    }
    if (bar.volume !== undefined && (!Number.isFinite(bar.volume) || bar.volume < 0)) {
        throw new RangeError('Bar volume must be a non-negative finite number when supplied.');
    }
    if (bar.availableAt !== undefined) {
        requireTimestamp(bar.availableAt, 'Bar availableAt');
        if (bar.availableAt < bar.endAt) throw new RangeError('Bar availability cannot precede the completed bar end.');
    }
    if (bar.providerInstrumentId !== undefined) requireText(bar.providerInstrumentId, 'Bar provider instrument ID');
}

export function validateBacktestDataset(dataset: BacktestDataset): void {
    requireText(dataset.id, 'Dataset ID');
    requireVersion(dataset.version, 'Dataset version');
    requireText(dataset.instrument.instrumentId, 'Dataset instrument ID');
    requireText(dataset.instrument.name, 'Dataset instrument name');
    if (!currencies.has(dataset.instrument.currency)) throw new RangeError('Dataset instrument currency is unsupported.');
    requireText(dataset.marketTimeZone, 'Dataset market timezone');
    requireTimestamp(dataset.recordedAt, 'Dataset recordedAt');
    requireDigest(dataset.contentDigest, 'Dataset normalized content digest');
    validateSource(dataset.source);
    requireTimestamp(dataset.coverage.startAt, 'Dataset coverage startAt');
    requireTimestamp(dataset.coverage.endAt, 'Dataset coverage endAt');
    if (dataset.coverage.endAt <= dataset.coverage.startAt) throw new RangeError('Dataset coverage endAt must be later than startAt.');
    if (!Array.isArray(dataset.bars) || dataset.bars.length === 0) throw new RangeError('Dataset must contain at least one historical bar.');
    if (!Array.isArray(dataset.coverage.expectedBarEndAt)) throw new RangeError('Dataset requires an explicit expected bar schedule.');
    const expected = new Set<string>();
    for (let index = 0; index < dataset.coverage.expectedBarEndAt.length; index += 1) {
        const timestamp = dataset.coverage.expectedBarEndAt[index];
        requireTimestamp(timestamp, 'Expected bar end timestamp');
        if (timestamp < dataset.coverage.startAt || timestamp > dataset.coverage.endAt) throw new RangeError('Expected bar end must fall within dataset coverage.');
        if (expected.has(timestamp)) throw new RangeError('Expected bar end timestamps must be unique.');
        if (index > 0 && timestamp <= dataset.coverage.expectedBarEndAt[index - 1]!) throw new RangeError('Expected bar end timestamps must be strictly increasing.');
        expected.add(timestamp);
    }
    if (!['complete', 'partial', 'unknown'].includes(dataset.coverage.status)) throw new RangeError('Dataset coverage status is unsupported.');
    const barIds = new Set<string>();
    for (const bar of dataset.bars) {
        validateBar(bar, dataset);
        if (bar.endAt < dataset.coverage.startAt || bar.endAt > dataset.coverage.endAt) throw new RangeError('Bar endAt is outside dataset coverage.');
        const key = bar.instrumentId + ':' + bar.interval + ':' + bar.startAt;
        if (barIds.has(key)) throw new RangeError('Dataset contains duplicate instrument/interval/bar-start observations.');
        barIds.add(key);
        if (dataset.coverage.status === 'complete' && !expected.has(bar.endAt)) throw new RangeError('A complete dataset contains a bar outside its expected calendar.');
    }
    if (dataset.coverage.status === 'complete') {
        const observed = new Set(dataset.bars.map((bar) => bar.endAt));
        if (observed.size !== expected.size || [...expected].some((timestamp) => !observed.has(timestamp))) {
            throw new RangeError('A complete dataset must contain every explicitly expected bar.');
        }
    }
    if (dataset.source.pointInTimeStatus === 'per-observation') {
        for (const bar of dataset.bars) if (!bar.availableAt) throw new RangeError('Per-observation point-in-time data requires availableAt on every bar.');
    }
}

export function validateBacktestUniverse(universe: BacktestUniverse): void {
    requireText(universe.id, 'Universe ID');
    requireText(universe.name, 'Universe name');
    requireVersion(universe.version, 'Universe version');
    requireTimestamp(universe.recordedAt, 'Universe recordedAt');
    if (typeof universe.pointInTimeComplete !== 'boolean') throw new RangeError('Universe point-in-time completeness must be explicit.');
    if (!Array.isArray(universe.memberships)) throw new RangeError('Universe memberships must be an array.');
    const ids = new Set<string>();
    for (const membership of universe.memberships) {
        requireText(membership.id, 'Universe membership ID');
        requireText(membership.instrumentId, 'Universe membership instrument ID');
        requireText(membership.sourceEvidenceId, 'Universe membership source evidence ID');
        requireTimestamp(membership.effectiveFrom, 'Membership effectiveFrom');
        requireTimestamp(membership.recordedAt, 'Membership recordedAt');
        if (membership.effectiveTo !== undefined) {
            requireTimestamp(membership.effectiveTo, 'Membership effectiveTo');
            if (membership.effectiveTo <= membership.effectiveFrom) throw new RangeError('Membership effectiveTo must be later than effectiveFrom.');
        }
        if (membership.availableAt !== undefined) requireTimestamp(membership.availableAt, 'Membership availableAt');
        if (!['included', 'excluded'].includes(membership.status)) throw new RangeError('Universe membership status is unsupported.');
        if (ids.has(membership.id)) throw new RangeError('Universe membership IDs must be unique.');
        ids.add(membership.id);
        if (universe.pointInTimeComplete && !membership.availableAt) throw new RangeError('Point-in-time-complete universe membership requires availableAt.');
    }
}

export function validateBacktestTradingCalendar(calendar: BacktestTradingCalendar): void {
    requireText(calendar.id, 'Trading calendar ID');
    requireVersion(calendar.version, 'Trading calendar version');
    requireText(calendar.exchange, 'Trading calendar exchange');
    requireText(calendar.marketTimeZone, 'Trading calendar market timezone');
    requireText(calendar.sourceName, 'Trading calendar source name');
    requireText(calendar.sourceEvidenceId, 'Trading calendar source evidence ID');
    requireTimestamp(calendar.recordedAt, 'Trading calendar recordedAt');
    requireTimestamp(calendar.coverage.startAt, 'Trading calendar coverage startAt');
    requireTimestamp(calendar.coverage.endAt, 'Trading calendar coverage endAt');
    if (calendar.coverage.endAt <= calendar.coverage.startAt) throw new RangeError('Trading calendar coverage endAt must be later than startAt.');
    if (!Array.isArray(calendar.coverage.expectedBarEndAt) || calendar.coverage.expectedBarEndAt.length === 0) {
        throw new RangeError('Trading calendar must explicitly list expected bar ends.');
    }
    for (let index = 0; index < calendar.coverage.expectedBarEndAt.length; index += 1) {
        const timestamp = calendar.coverage.expectedBarEndAt[index];
        requireTimestamp(timestamp, 'Trading calendar expected bar end');
        if (timestamp < calendar.coverage.startAt || timestamp > calendar.coverage.endAt) throw new RangeError('Expected bar end is outside trading calendar coverage.');
        if (index > 0 && timestamp <= calendar.coverage.expectedBarEndAt[index - 1]!) throw new RangeError('Trading calendar expected bar ends must be strictly increasing and unique.');
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
    if (configuration.endAt <= configuration.startAt) throw new RangeError('Backtest endAt must be later than startAt.');
    if (!currencies.has(configuration.currency)) throw new RangeError('Backtest currency is unsupported.');
    if (!Number.isFinite(configuration.initialCapital.amount) || configuration.initialCapital.amount <= 0
        || configuration.initialCapital.currency !== configuration.currency) {
        throw new RangeError('Initial capital must be positive and use the run currency.');
    }
    if (!Array.isArray(configuration.datasetIds) || configuration.datasetIds.length === 0
        || new Set(configuration.datasetIds).size !== configuration.datasetIds.length) {
        throw new RangeError('Backtest dataset IDs must be a non-empty unique array.');
    }
    if (context.datasets.length !== configuration.datasetIds.length
        || configuration.datasetIds.some((id) => !context.datasets.some((dataset) => dataset.id === id))) {
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
    const selected = context.datasets;
    const first = selected[0]!;
    for (const dataset of selected) {
        validateBacktestDataset(dataset);
        if (dataset.recordedAt > configuration.recordedAtCutoff) throw new RangeError('Selected dataset must be recorded by the selected PFO knowledge-state cutoff.');
        if (dataset.instrument.currency !== configuration.currency) throw new RangeError('All backtest instruments must use the run currency; FX is not supported.');
        if (dataset.interval !== first.interval || dataset.marketTimeZone !== first.marketTimeZone
            || dataset.adjustmentBasis !== first.adjustmentBasis) {
            throw new RangeError('All selected datasets must use the same interval, timezone and adjustment basis.');
        }
        if (dataset.source.licenseStatus !== 'reviewed') throw new RangeError('Dataset license must be reviewed before backtest execution.');
        if (dataset.instrument.exchange !== context.calendar.exchange) throw new RangeError('Dataset exchange must match the selected trading calendar.');
        const expected = new Set(context.calendar.coverage.expectedBarEndAt);
        if (dataset.bars.some((bar) => !expected.has(bar.endAt))) throw new RangeError('Every selected bar must belong to the selected explicit trading calendar.');
        if (configuration.pointInTimeRequired) {
            if (dataset.source.pointInTimeStatus !== 'per-observation' || dataset.bars.some((bar) => !bar.availableAt)) {
                throw new RangeError('Point-in-time runs require per-observation availability evidence for every bar.');
            }
        }
    }
    if (configuration.universeSelection === 'point-in-time') {
        if (!context.universe.pointInTimeComplete) throw new RangeError('Point-in-time universe selection requires complete bitemporal membership evidence.');
    } else if (configuration.universeSelection === 'static-exploratory') {
        if (!configuration.survivorshipBiasAcknowledged) throw new RangeError('Static exploratory universe requires explicit survivorship-bias acknowledgement.');
    } else {
        throw new RangeError('Backtest universe selection mode is unsupported.');
    }
    if (configuration.pointInTimeRequired && configuration.universeSelection !== 'point-in-time') {
        throw new RangeError('Point-in-time-required runs cannot use a static exploratory universe.');
    }
    const strategy = configuration.strategy;
    requireText(strategy.id, 'Strategy ID');
    requireText(strategy.version, 'Strategy version');
    requireDigest(strategy.implementationDigest, 'Strategy implementation digest');
    requireDigest(strategy.parametersDigest, 'Strategy parameters digest');
    if (!strategy.supportedIntervals.includes(first.interval)) throw new RangeError('Strategy does not declare support for the selected dataset interval.');
    const execution = configuration.execution;
    if (execution.signalTiming !== 'bar-close' || execution.fillTiming !== 'next-bar-open' || execution.orderType !== 'market') {
        throw new RangeError('The initial backtesting contract supports only bar-close signals and next-bar-open market fills.');
    }
    if (!Number.isFinite(execution.slippageBasisPoints) || execution.slippageBasisPoints < 0 || execution.slippageBasisPoints > 10_000) {
        throw new RangeError('Slippage basis points must be between zero and 10000.');
    }
    if (!Number.isFinite(execution.maxVolumeParticipation) || execution.maxVolumeParticipation <= 0 || execution.maxVolumeParticipation > 1) {
        throw new RangeError('Maximum volume participation must be greater than zero and at most one.');
    }
    if (execution.missingVolumePolicy !== 'reject-order') throw new RangeError('Missing volume policy must explicitly reject the order.');
    if (!['partial-fill', 'reject-order'].includes(execution.insufficientVolumePolicy) || execution.unfilledRemainderPolicy !== 'expire') {
        throw new RangeError('Insufficient-volume and remainder policies are unsupported.');
    }
    const costModel = configuration.costModel;
    requireText(costModel.id, 'Cost model ID');
    requireText(costModel.version, 'Cost model version');
    requireDigest(costModel.implementationDigest, 'Cost model implementation digest');
    requireDigest(costModel.parametersDigest, 'Cost model parameters digest');
    if (costModel.currency !== configuration.currency) throw new RangeError('Cost model currency must match the backtest currency.');
    if (!['require-complete-events', 'exclude-affected-periods', 'reject-any-action'].includes(configuration.corporateActionPolicy)) {
        throw new RangeError('A corporate-action policy must be explicitly selected.');
    }
}
