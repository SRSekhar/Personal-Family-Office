import { describe, expect, it } from 'vitest';
import {
    evaluateInvestmentExposurePolicy,
    selectInvestmentExposurePolicy,
    validateInvestmentExposurePolicies,
    validateInvestmentExposurePolicy,
    validateInvestmentExposurePolicyCollections
} from './investment-exposure-policy.js';

const accounts = [{ id: 'a1', currency: 'INR' }, { id: 'a2', currency: 'INR' }, { id: 'usd', currency: 'USD' }];
const instruments = [{ id: 'fund', name: 'Diversified fund', currency: 'INR' },
    { id: 'equity', name: 'Direct equity', currency: 'INR' }, { id: 'bond', name: 'USD bond', currency: 'USD' }];
const classifications = [
    { id: 'fund-v1', instrumentId: 'fund', dimensionId: 'sector', dimensionName: 'Sector',
        effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', sourceType: 'manual', sourceName: 'User',
        allocations: [{ groupId: 'technology', groupName: 'Technology', weightPercent: 60 },
            { groupId: 'healthcare', groupName: 'Healthcare', weightPercent: 40 }] },
    { id: 'equity-v1', instrumentId: 'equity', dimensionId: 'sector', dimensionName: 'Sector',
        effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', sourceType: 'manual', sourceName: 'User',
        allocations: [{ groupId: 'industrials', groupName: 'Industrials', weightPercent: 100 }] },
    { id: 'bond-v1', instrumentId: 'bond', dimensionId: 'sector', dimensionName: 'Sector',
        effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z', sourceType: 'manual', sourceName: 'User',
        allocations: [{ groupId: 'sovereign', groupName: 'Sovereign', weightPercent: 100 }] }
];
const policy = (overrides = {}) => ({
    id: 'policy-v1', policySetId: 'sector-limits', version: 1, name: 'Sector exposure limits',
    currency: 'INR', scope: 'portfolio', dimensionId: 'sector', dimensionName: 'Sector',
    effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
    rules: [{ groupId: 'technology', maxWeightPercent: 35, operator: '>' },
        { groupId: 'healthcare', maxWeightPercent: 25, operator: '>=' }],
    ...overrides
});
const context = { accounts, instruments, classifications };
const cutoffs = { asOfDate: new Date('2026-11-01T23:59:59.999Z'),
    recordedAtCutoff: new Date('2026-11-02T00:00:00.000Z') };
const exposure = (overrides = {}) => ({
    status: 'available', currency: 'INR', scope: 'portfolio', dimensionId: 'sector', dimensionName: 'Sector',
    totalValue: 1000, asOfDate: cutoffs.asOfDate.toISOString(), recordedAtCutoff: cutoffs.recordedAtCutoff.toISOString(), rows: [
        { key: 'technology', groupName: 'Technology', actualValue: 360, actualWeightPercent: 36 },
        { key: 'healthcare', groupName: 'Healthcare', actualValue: 240, actualWeightPercent: 24 },
        { key: 'industrials', groupName: 'Industrials', actualValue: 400, actualWeightPercent: 40 }
    ], ...overrides
});

describe('investment exposure policy validation', () => {
    it('accepts explicit group limits and comparison operators', () => {
        expect(validateInvestmentExposurePolicy(policy(), context)).toMatchObject({
            dimensionId: 'sector', dimensionName: 'Sector',
            rules: [{ groupId: 'technology', maxWeightPercent: 35, operator: '>' },
                { groupId: 'healthcare', maxWeightPercent: 25, operator: '>=' }]
        });
    });
    it('rejects missing, unknown or wrong-currency group references', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [{ groupId: 'unknown', maxWeightPercent: 20, operator: '>' }] }), context))
            .toThrow(/must exist in a classification/);
        expect(() => validateInvestmentExposurePolicy(policy({ currency: 'USD',
            rules: [{ groupId: 'technology', maxWeightPercent: 20, operator: '>' }] }), context))
            .toThrow(/must exist in a classification/);
    });
    it('rejects unsupported dimensions and account/currency mismatches', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ dimensionId: 'issuer' }), context)).toThrow(/dimension must match/);
        expect(() => validateInvestmentExposurePolicy(policy({ scope: 'account', accountId: 'missing' }), context)).toThrow(/account must exist/);
        expect(() => validateInvestmentExposurePolicy(policy({ scope: 'account', accountId: 'usd' }), context)).toThrow(/account must exist/);
    });
    it('requires a non-empty name, positive version and at least one explicit rule', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ name: ' ' }), context)).toThrow(/name/);
        expect(() => validateInvestmentExposurePolicy(policy({ version: 0 }), context)).toThrow(/positive integer/);
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [] }), context)).toThrow(/at least one/);
    });
    it('rejects duplicate groups, invalid percentages and missing comparator semantics', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'technology', maxWeightPercent: 10, operator: '>' },
            { groupId: 'technology', maxWeightPercent: 20, operator: '>=' }
        ] }), context)).toThrow(/unique/);
        for (const value of [-0.01, 100.01, Number.NaN]) {
            expect(() => validateInvestmentExposurePolicy(policy({ rules: [
                { groupId: 'technology', maxWeightPercent: value, operator: '>' }
            ] }), context)).toThrow(/finite percentage/);
        }
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'technology', maxWeightPercent: 20, operator: '=' }
        ] }), context)).toThrow(/operator/);
    });
    it('validates immutable history IDs, versions and stable policy-set dimensions', () => {
        expect(() => validateInvestmentExposurePolicies([policy(), policy()], context)).toThrow(/IDs must be unique/);
        expect(() => validateInvestmentExposurePolicies([policy(), policy({ id: 'policy-v2' })], context)).toThrow(/version must be unique/);
        expect(() => validateInvestmentExposurePolicies([policy(), policy({ id: 'policy-v2', version: 2, dimensionId: 'other' })], context))
            .toThrow(/retain currency, scope, account and dimension/);
    });
    it('requires complete classification context when validating persisted policy collections', () => {
        expect(() => validateInvestmentExposurePolicyCollections({
            investmentExposurePolicies: [policy()], investmentAccounts: accounts, investmentInstruments: instruments,
            investmentExposureClassifications: []
        })).toThrow(/stable classification dimension/);
    });
});

describe('investment exposure policy historical selection', () => {
    it('selects only the latest version both effective and recorded at the requested cutoffs', () => {
        const history = [
            policy(),
            policy({ id: 'future-effective', version: 2, effectiveFrom: '2026-12-01', recordedAt: '2026-01-02T00:00:00.000Z' }),
            policy({ id: 'late-recorded', version: 3, effectiveFrom: '2026-06-01', recordedAt: '2026-12-01T00:00:00.000Z' }),
            policy({ id: 'eligible-v2', version: 4, effectiveFrom: '2026-06-01', recordedAt: '2026-06-02T00:00:00.000Z' })
        ];
        expect(selectInvestmentExposurePolicy(history, {
            ...cutoffs, policySetId: 'sector-limits', scope: 'portfolio', currency: 'INR', dimensionId: 'sector'
        }, context).id).toBe('eligible-v2');
    });
    it('separates currency, scope, account and dimension policy sets', () => {
        const accountPolicy = policy({ id: 'account-policy', policySetId: 'account-sector', scope: 'account', accountId: 'a1' });
        const selected = selectInvestmentExposurePolicy([accountPolicy], {
            ...cutoffs, policySetId: 'account-sector', scope: 'account', accountId: 'a1', currency: 'INR', dimensionId: 'sector'
        }, context);
        expect(selected.id).toBe('account-policy');
        expect(selectInvestmentExposurePolicy([accountPolicy], {
            ...cutoffs, policySetId: 'account-sector', scope: 'account', accountId: 'a2', currency: 'INR', dimensionId: 'sector'
        }, context)).toBeNull();
    });
});

describe('investment exposure policy evaluation', () => {
    it('evaluates group exposure against explicit thresholds', () => {
        const result = evaluateInvestmentExposurePolicy({
            exposure: exposure(), policy: policy(), ...cutoffs, ...context
        });
        expect(result).toMatchObject({ status: 'breach', breachCount: 1, evaluatedRuleCount: 2 });
        expect(result.results).toEqual([
            { groupId: 'technology', actualWeightPercent: 36, maxWeightPercent: 35, operator: '>', status: 'breach' },
            { groupId: 'healthcare', actualWeightPercent: 24, maxWeightPercent: 25, operator: '>=', status: 'withinLimit' }
        ]);
    });
    it('preserves strict and inclusive boundary semantics', () => {
        const exact = exposure({ rows: [
            { key: 'technology', actualWeightPercent: 35 }, { key: 'healthcare', actualWeightPercent: 25 }
        ] });
        const result = evaluateInvestmentExposurePolicy({ exposure: exact, policy: policy(), ...cutoffs, ...context });
        expect(result.results.map((item) => item.status)).toEqual(['withinLimit', 'breach']);
    });
    it('treats a configured group absent from a complete exposure result as zero', () => {
        const result = evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'industrials', actualWeightPercent: 100 }] }),
            policy: policy({ rules: [{ groupId: 'technology', maxWeightPercent: 0, operator: '>' }] }),
            ...cutoffs, ...context
        });
        expect(result).toMatchObject({ status: 'withinLimits', results: [
            { groupId: 'technology', actualWeightPercent: 0, status: 'withinLimit' }
        ] });
    });
    it('does not turn unavailable or empty exposure into a pass', () => {
        expect(evaluateInvestmentExposurePolicy({
            exposure: exposure({ status: 'unavailable', reason: 'unclassified position', rows: [] }),
            policy: policy(), ...cutoffs, ...context
        })).toMatchObject({ status: 'unavailable', results: [] });
        expect(evaluateInvestmentExposurePolicy({
            exposure: exposure({ status: 'empty', rows: [] }), policy: policy(), ...cutoffs, ...context
        })).toMatchObject({ status: 'empty', results: [] });
    });
    it('rejects mismatched analysis dimensions, source cutoffs and policies outside the cutoffs', () => {
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ dimensionId: 'issuer' }), policy: policy(), ...cutoffs, ...context
        })).toThrow(/dimensions must match/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ asOfDate: '2026-10-31T23:59:59.999Z' }), policy: policy(), ...cutoffs, ...context
        })).toThrow(/cutoffs must exactly match/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure(), policy: policy({ effectiveFrom: '2026-12-01' }), ...cutoffs, ...context
        })).toThrow(/not both effective and known/);
    });
    it('rejects available exposure whose weights or denominator are not complete', () => {
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ totalValue: 0 }), policy: policy(), ...cutoffs, ...context
        })).toThrow(/positive total value/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 60 }] }),
            policy: policy(), ...cutoffs, ...context
        })).toThrow(/reconcile to 100%/);
    });
    it('rejects malformed and duplicate exposure rows rather than trusting partial results', () => {
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 101 }] }),
            policy: policy(), ...cutoffs, ...context
        })).toThrow(/valid group IDs and actual weights/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 10 }, { key: 'technology', actualWeightPercent: 20 }] }),
            policy: policy(), ...cutoffs, ...context
        })).toThrow(/duplicate group IDs/);
    });
});
