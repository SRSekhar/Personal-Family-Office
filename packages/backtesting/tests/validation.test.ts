import { describe, expect, it } from 'vitest';

import { Currency } from '@pfo/models';
import type {
    BacktestDataset,
    BacktestRunConfiguration,
    BacktestTradingCalendar,
    BacktestUniverse
} from '../src/contracts.js';
import {
    validateBacktestDataset,
    validateBacktestRunConfiguration,
    validateBacktestTradingCalendar,
    validateBacktestUniverse
} from '../src/validation.js';

const digest = 'a'.repeat(64);
const source = {
    kind: 'user-supplied' as const,
    name: 'Synthetic fixture',
    licenseName: 'Synthetic fixture terms',
    licenseStatus: 'reviewed' as const,
    attributionText: 'Synthetic test data; not live market data.',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    contentDigest: digest,
    licenseReviewedAt: '2026-01-01T00:00:00.000Z',
    pointInTimeStatus: 'per-observation' as const
};
const dataset: BacktestDataset = {
    id: 'dataset-1',
    version: 1,
    instrument: { instrumentId: 'instrument-1', name: 'Synthetic Instrument', currency: Currency.INR, symbol: 'SYN', exchange: 'SYNTH' },
    interval: '1d',
    adjustmentBasis: 'unadjusted',
    marketTimeZone: 'Asia/Kolkata',
    source,
    contentDigest: digest,
    recordedAt: '2026-01-02T12:00:00.000Z',
    coverage: {
        startAt: '2025-12-31T00:00:00.000Z',
        endAt: '2026-01-02T23:59:59.000Z',
        status: 'complete',
        expectedBarEndAt: ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']
    },
    bars: [
        {
            instrumentId: 'instrument-1', interval: '1d', startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z',
            open: 100, high: 110, low: 95, close: 105, currency: Currency.INR, volume: 1000, adjustmentBasis: 'unadjusted',
            marketTimeZone: 'Asia/Kolkata', availableAt: '2026-01-01T10:05:00.000Z', recordedAt: '2026-01-01T11:00:00.000Z'
        },
        {
            instrumentId: 'instrument-1', interval: '1d', startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-02T10:00:00.000Z',
            open: 110, high: 120, low: 108, close: 115, currency: Currency.INR, volume: 1200, adjustmentBasis: 'unadjusted',
            marketTimeZone: 'Asia/Kolkata', availableAt: '2026-01-02T10:05:00.000Z', recordedAt: '2026-01-02T11:00:00.000Z'
        }
    ]
};
const firstBar = dataset.bars[0];
if (!firstBar) {
    throw new Error('Synthetic backtesting fixture requires its first bar.');
}

const universe: BacktestUniverse = {
    id: 'universe-1',
    version: 1,
    name: 'Synthetic universe',
    pointInTimeComplete: true,
    recordedAt: '2026-01-01T00:00:00.000Z',
    memberships: [{
        id: 'membership-1',
        instrumentId: 'instrument-1',
        status: 'included',
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        availableAt: '2025-01-01T00:00:00.000Z',
        recordedAt: '2026-01-01T00:00:00.000Z',
        sourceEvidenceId: 'synthetic-evidence-1'
    }]
};
const calendar: BacktestTradingCalendar = {
    id: 'calendar-1',
    version: 1,
    exchange: 'SYNTH',
    interval: '1d',
    marketTimeZone: 'Asia/Kolkata',
    sourceName: 'Synthetic calendar',
    sourceEvidenceId: 'synthetic-calendar-evidence',
    recordedAt: '2026-01-01T00:00:00.000Z',
    coverage: {
        startAt: '2025-12-31T00:00:00.000Z',
        endAt: '2026-01-02T23:59:59.000Z',
        expectedBarEndAt: ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z']
    }
};
const configuration: BacktestRunConfiguration = {
    id: 'run-1',
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-01-02T23:59:59.000Z',
    recordedAtCutoff: '2026-01-03T00:00:00.000Z',
    currency: Currency.INR,
    initialCapital: { amount: 1000, currency: Currency.INR },
    datasetIds: ['dataset-1'],
    universeId: 'universe-1',
    universeVersion: 1,
    universeSelection: 'point-in-time',
    survivorshipBiasAcknowledged: false,
    calendarId: 'calendar-1',
    calendarVersion: 1,
    strategy: {
        id: 'strategy-1',
        version: '1.0.0',
        implementationDigest: digest,
        parametersDigest: digest,
        supportedIntervals: ['1d']
    },
    execution: {
        signalTiming: 'bar-close',
        fillTiming: 'next-bar-open',
        orderType: 'market',
        slippageBasisPoints: 0,
        maxVolumeParticipation: 0.1,
        missingVolumePolicy: 'reject-order',
        insufficientVolumePolicy: 'partial-fill',
        unfilledRemainderPolicy: 'expire'
    },
    costModel: {
        id: 'costs-1',
        version: '1',
        currency: Currency.INR,
        implementationDigest: digest,
        parametersDigest: digest
    },
    pointInTimeRequired: true,
    corporateActionPolicy: 'reject-any-action'
};

describe('backtesting contracts', () => {
    it('accepts a complete, explicit, point-in-time synthetic dataset', () => {
        expect(() => {
            validateBacktestDataset(dataset);
        }).not.toThrow();
    });

    it('rejects unknown adjustment basis and bars that are not chronologically ordered', () => {
        expect(() => {
            validateBacktestDataset({ ...dataset, adjustmentBasis: 'unknown' });
        }).toThrow(/adjustment basis/i);
        expect(() => {
            validateBacktestDataset({ ...dataset, bars: [...dataset.bars].reverse() });
        }).toThrow(/strictly ordered/i);
    });

    it('rejects impossible OHLC relationships and duplicate bars', () => {
        expect(() => {
            validateBacktestDataset({ ...dataset, bars: [{ ...firstBar, high: 90 }] });
        }).toThrow(/OHLC/i);
        expect(() => {
            validateBacktestDataset({ ...dataset, bars: [firstBar, firstBar] });
        }).toThrow(/duplicate/i);
    });

    it('does not infer point-in-time availability for observations', () => {
        const missingAvailability: BacktestDataset = {
            ...dataset,
            bars: dataset.bars.map((bar) => {
                const { availableAt: _availableAt, ...withoutAvailability } = bar;
                return withoutAvailability;
            })
        };
        expect(() => {
            validateBacktestDataset(missingAvailability);
        }).toThrow(/availableAt/i);
    });

    it('requires reviewed source licensing and explicit content digests before execution', () => {
        const unreviewedDataset: BacktestDataset = {
            ...dataset,
            source: { ...source, licenseStatus: 'unreviewed' }
        };
        expect(() => {
            validateBacktestDataset(unreviewedDataset);
        }).not.toThrow();
        expect(() => {
            validateBacktestRunConfiguration(configuration, { datasets: [unreviewedDataset], universe, calendar });
        }).toThrow(/license must be reviewed/i);
        expect(() => {
            validateBacktestDataset({ ...dataset, contentDigest: 'not-a-digest' });
        }).toThrow(/SHA-256/i);
    });

    it('rejects a bar imported before its evidenced availability and a dataset recorded before retrieval', () => {
        expect(() => {
            validateBacktestDataset({
                ...dataset,
                bars: [{ ...firstBar, recordedAt: '2026-01-01T10:00:00.000Z' }]
            });
        }).toThrow(/imported before/i);
        expect(() => {
            validateBacktestDataset({ ...dataset, recordedAt: '2025-12-31T00:00:00.000Z' });
        }).toThrow(/after its source retrieval/i);
    });

    it('requires bitemporal universe membership for point-in-time runs', () => {
        const staticUniverse: BacktestUniverse = {
            ...universe,
            pointInTimeComplete: false,
            memberships: universe.memberships.map((membership) => {
                const { availableAt: _availableAt, ...withoutAvailability } = membership;
                return withoutAvailability;
            })
        };
        expect(() => {
            validateBacktestUniverse(staticUniverse);
        }).not.toThrow();
        expect(() => {
            validateBacktestRunConfiguration(configuration, { datasets: [dataset], universe: staticUniverse, calendar });
        }).toThrow(/bitemporal/i);
    });

    it('requires explicit ordered trading calendar sessions', () => {
        expect(() => {
            validateBacktestTradingCalendar(calendar);
        }).not.toThrow();
        expect(() => {
            validateBacktestTradingCalendar({ ...calendar, coverage: { ...calendar.coverage, expectedBarEndAt: [] } });
        }).toThrow(/explicitly list/i);
        expect(() => {
            validateBacktestTradingCalendar({
                ...calendar,
                coverage: { ...calendar.coverage, expectedBarEndAt: [...calendar.coverage.expectedBarEndAt].reverse() }
            });
        }).toThrow(/strictly increasing/i);
    });

    it('requires full calendar and dataset coverage for the requested run window', () => {
        expect(() => {
            validateBacktestRunConfiguration({ ...configuration, endAt: '2026-01-03T00:00:00.000Z' },
                { datasets: [dataset], universe, calendar });
        }).toThrow(/cover the complete requested/i);
    });

    it('requires the selected calendar interval and timezone to match every dataset', () => {
        expect(() => {
            validateBacktestRunConfiguration(configuration, { datasets: [dataset], universe, calendar: { ...calendar, interval: '1w' } });
        }).toThrow(/same interval/i);
    });

    it('validates all run references and refuses cross-currency or implicit execution assumptions', () => {
        expect(() => {
            validateBacktestRunConfiguration(configuration, { datasets: [dataset], universe, calendar });
        }).not.toThrow();
        expect(() => {
            validateBacktestRunConfiguration({
                ...configuration,
                initialCapital: { amount: 1000, currency: Currency.USD }
            }, { datasets: [dataset], universe, calendar });
        }).toThrow(/run currency/i);
        expect(() => {
            validateBacktestRunConfiguration({
                ...configuration,
                execution: { ...configuration.execution, maxVolumeParticipation: 0 }
            }, { datasets: [dataset], universe, calendar });
        }).toThrow(/participation/i);
        expect(() => {
            validateBacktestRunConfiguration({
                ...configuration,
                pointInTimeRequired: false,
                universeSelection: 'static-exploratory',
                survivorshipBiasAcknowledged: false
            }, { datasets: [dataset], universe, calendar });
        }).toThrow(/survivorship-bias acknowledgement/i);
    });

    it('requires datasets, calendar, universe and cost model to use one explicit currency and interval context', () => {
        expect(() => {
            validateBacktestRunConfiguration({
                ...configuration,
                costModel: { ...configuration.costModel, currency: Currency.USD }
            }, { datasets: [dataset], universe, calendar });
        }).toThrow(/cost model currency/i);
        expect(() => {
            validateBacktestRunConfiguration({ ...configuration, endAt: configuration.startAt },
                { datasets: [dataset], universe, calendar });
        }).toThrow(/later than startAt/i);
    });
});
