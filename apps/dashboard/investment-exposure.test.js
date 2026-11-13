import { describe, expect, it } from 'vitest';
import {
    analyzeInvestmentExposurePositions,
    selectInvestmentExposureClassification,
    validateInvestmentExposureClassification,
    validateInvestmentExposureClassifications
} from './investment-exposure.js';

const accounts = [
    { id: 'a1', currency: 'INR' }, { id: 'a2', currency: 'INR' }, { id: 'usd', currency: 'USD' }
];
const instruments = [
    { id: 'equity', name: 'Direct equity', currency: 'INR' },
    { id: 'fund', name: 'Diversified fund', currency: 'INR' },
    { id: 'bond', name: 'USD bond', currency: 'USD' }
];
const classification = (overrides = {}) => ({
    id: 'fund-sector-v1', instrumentId: 'fund', dimensionId: 'sector', dimensionName: 'Sector',
    effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
    sourceType: 'manual', sourceName: 'User-entered',
    allocations: [
        { groupId: 'technology', groupName: 'Technology', weightPercent: 60 },
        { groupId: 'healthcare', groupName: 'Healthcare', weightPercent: 40 }
    ],
    ...overrides
});
const positions = [
    { accountId: 'a1', instrumentId: 'fund', quantity: 10, marketValue: 600, currency: 'INR' },
    { accountId: 'a2', instrumentId: 'equity', quantity: 10, marketValue: 400, currency: 'INR' },
    { accountId: 'usd', instrumentId: 'bond', quantity: 2, marketValue: 500, currency: 'USD' }
];
const cutoffs = {
    asOfDate: new Date('2026-11-01T23:59:59.999Z'),
    recordedAtCutoff: new Date('2026-11-02T00:00:00.000Z')
};
const direct = classification({
    id: 'equity-sector-v1', instrumentId: 'equity',
    allocations: [{ groupId: 'industrials', groupName: 'Industrials', weightPercent: 100 }]
});

describe('investment exposure classification validation', () => {
    it('accepts a fully reconciled weighted look-through classification', () => {
        expect(validateInvestmentExposureClassification(classification(), { instruments })).toMatchObject({
            instrumentId: 'fund', dimensionId: 'sector',
            allocations: [{ groupId: 'technology', weightPercent: 60 }, { groupId: 'healthcare', weightPercent: 40 }]
        });
    });
    it('requires weights to reconcile to 100 percent within 0.01 percentage points', () => {
        expect(() => validateInvestmentExposureClassification(classification({
            allocations: [{ groupId: 'x', groupName: 'X', weightPercent: 60 }]
        }), { instruments })).toThrow(/reconcile to 100%/);
        expect(() => validateInvestmentExposureClassification(classification({
            allocations: [{ groupId: 'x', groupName: 'X', weightPercent: 60 },
                { groupId: 'y', groupName: 'Y', weightPercent: 39.98 }]
        }), { instruments })).toThrow(/reconcile to 100%/);
    });
    it('rejects duplicate groups, zero/negative weights, conflicting dimension labels and unknown instruments', () => {
        expect(() => validateInvestmentExposureClassification(classification({
            allocations: [{ groupId: 'x', groupName: 'X', weightPercent: 50 },
                { groupId: 'x', groupName: 'X again', weightPercent: 50 }]
        }), { instruments })).toThrow(/unique/);
        expect(() => validateInvestmentExposureClassification(classification({
            allocations: [{ groupId: 'x', groupName: 'X', weightPercent: 0 },
                { groupId: 'y', groupName: 'Y', weightPercent: 100 }]
        }), { instruments })).toThrow(/greater than 0/);
        expect(() => validateInvestmentExposureClassification(classification({ instrumentId: 'missing' }), { instruments })).toThrow(/unknown/);
        expect(() => validateInvestmentExposureClassifications([classification(), classification({ id: 'other', instrumentId: 'equity', dimensionName: 'Industry' })], { instruments })).toThrow(/conflicting display names/);
    });
    it('requires provenance and canonical bitemporal dates', () => {
        expect(() => validateInvestmentExposureClassification(classification({ sourceName: '' }), { instruments })).toThrow(/source name/);
        expect(() => validateInvestmentExposureClassification(classification({ sourceType: 'guess' }), { instruments })).toThrow(/source type/);
        expect(() => validateInvestmentExposureClassification(classification({ effectiveFrom: '2026-02-30' }), { instruments })).toThrow(/calendar date/);
        expect(() => validateInvestmentExposureClassification(classification({ recordedAt: '2026-01-01' }), { instruments })).toThrow(/canonical ISO-8601/);
    });
    it('rejects duplicate IDs and duplicate bitemporal snapshots', () => {
        expect(() => validateInvestmentExposureClassifications([classification(), classification()], { instruments })).toThrow(/IDs must be unique/);
        expect(() => validateInvestmentExposureClassifications([
            classification(), classification({ id: 'other' })
        ], { instruments })).toThrow(/duplicate effective and recorded-at snapshots/);
    });
});

describe('investment exposure classification selection', () => {
    it('uses both effective date and recorded-at cutoff', () => {
        const history = [
            classification(),
            classification({ id: 'future-effective', effectiveFrom: '2026-12-01', recordedAt: '2026-01-02T00:00:00.000Z' }),
            classification({ id: 'late-known', effectiveFrom: '2026-06-01', recordedAt: '2026-12-01T00:00:00.000Z' })
        ];
        expect(selectInvestmentExposureClassification(history, {
            instrumentId: 'fund', dimensionId: 'sector', ...cutoffs
        }).id).toBe('fund-sector-v1');
    });
    it('selects the latest eligible effective snapshot', () => {
        const history = [classification(), classification({
            id: 'v2', effectiveFrom: '2026-06-01', recordedAt: '2026-06-02T00:00:00.000Z'
        })];
        expect(selectInvestmentExposureClassification(history, {
            instrumentId: 'fund', dimensionId: 'sector', ...cutoffs
        }).id).toBe('v2');
    });
});

describe('weighted investment exposure analysis', () => {
    it('hand-calculates direct and diversified positions without double counting', () => {
        const result = analyzeInvestmentExposurePositions({
            positions, instruments, accounts, classifications: [classification(), direct],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', ...cutoffs
        });
        expect(result).toMatchObject({ status: 'available', totalValue: 1000, currency: 'INR', scope: 'portfolio' });
        expect(result.rows).toEqual([
            { key: 'healthcare', groupName: 'Healthcare', actualValue: 240, actualWeightPercent: 24 },
            { key: 'industrials', groupName: 'Industrials', actualValue: 400, actualWeightPercent: 40 },
            { key: 'technology', groupName: 'Technology', actualValue: 360, actualWeightPercent: 36 }
        ]);
        expect(result.rows.reduce((sum, row) => sum + row.actualValue, 0)).toBe(1000);
        expect(result.rows.reduce((sum, row) => sum + row.actualWeightPercent, 0)).toBe(100);
    });
    it('normalizes a permitted rounding tolerance so total exposure still reconciles to 100%', () => {
        const rounded = classification({ allocations: [
            { groupId: 'technology', groupName: 'Technology', weightPercent: 60 },
            { groupId: 'healthcare', groupName: 'Healthcare', weightPercent: 39.995 }
        ] });
        const result = analyzeInvestmentExposurePositions({
            positions: [positions[0]], instruments, accounts, classifications: [rounded],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', ...cutoffs
        });
        expect(result.rows.reduce((sum, row) => sum + row.actualValue, 0)).toBeCloseTo(600, 8);
        expect(result.rows.reduce((sum, row) => sum + row.actualWeightPercent, 0)).toBeCloseTo(100, 8);
    });
    it('rejects an account scope whose account is missing or uses a different currency', () => {
        expect(() => analyzeInvestmentExposurePositions({
            positions, instruments, accounts, classifications: [classification(), direct],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', scope: 'account', accountId: 'usd', ...cutoffs
        })).toThrow(/must exist and use the requested currency/);
    });
    it('aggregates the same instrument held in separate accounts', () => {
        const result = analyzeInvestmentExposurePositions({
            positions: [positions[0], { ...positions[0], accountId: 'a2', marketValue: 400 }],
            instruments, accounts, classifications: [classification()],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', ...cutoffs
        });
        expect(result.rows.map((row) => row.actualValue)).toEqual([400, 600]);
        expect(result.totalValue).toBe(1000);
    });
    it('keeps unclassified positions visible and suppresses partial exposure', () => {
        const result = analyzeInvestmentExposurePositions({
            positions: [positions[0], positions[1]], instruments, accounts, classifications: [classification()],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', ...cutoffs
        });
        expect(result).toMatchObject({
            status: 'unavailable', rows: [],
            unclassifiedPositions: [{ instrumentId: 'equity', instrumentName: 'Direct equity', marketValue: 400 }]
        });
        expect(result.reason).toMatch(/partial exposure is suppressed/);
    });
    it('keeps currency and account scope separate', () => {
        const result = analyzeInvestmentExposurePositions({
            positions, instruments, accounts, classifications: [classification(), direct],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'USD', ...cutoffs
        });
        expect(result).toMatchObject({ status: 'unavailable', currency: 'USD' });
        const accountResult = analyzeInvestmentExposurePositions({
            positions: [positions[0], positions[1]], instruments, accounts, classifications: [classification(), direct],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', scope: 'account', accountId: 'a1', ...cutoffs
        });
        expect(accountResult).toMatchObject({ status: 'available', scope: 'account', accountId: 'a1', totalValue: 600 });
    });
    it('suppresses missing valuations and reports empty scopes', () => {
        const common = { instruments, accounts, classifications: [classification(), direct],
            dimensionId: 'sector', dimensionName: 'Sector', currency: 'INR', ...cutoffs };
        expect(analyzeInvestmentExposurePositions({
            ...common, positions: [{ ...positions[0], marketValue: null }]
        })).toMatchObject({ status: 'unavailable', rows: [] });
        expect(analyzeInvestmentExposurePositions({ ...common, positions: [] }))
            .toMatchObject({ status: 'empty', totalValue: 0, rows: [] });
    });
});
