import { describe, expect, it } from 'vitest';
import {
    evaluateInvestmentExposurePolicy,
    selectInvestmentExposurePolicy,
    validateInvestmentExposurePolicies,
    validateInvestmentExposurePolicy,
    validateInvestmentExposurePolicyCollections
} from './investment-exposure-policy.js';

const accounts = [{ id: 'a1', currency: 'INR' }, { id: 'usd', currency: 'USD' }];
const instruments = [{ id: 'fund', name: 'Diversified fund', currency: 'INR' }];
const classifications = [{
    id: 'classification-1', instrumentId: 'fund', dimensionId: 'sector', dimensionName: 'Sector',
    effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
    sourceType: 'manual', sourceName: 'Factsheet',
    allocations: [
        { groupId: 'technology', groupName: 'Technology', weightPercent: 60 },
        { groupId: 'healthcare', groupName: 'Healthcare', weightPercent: 40 }
    ]
}];
const policy = (overrides = {}) => ({
    id: 'policy-v1', policySetId: 'policy-set-1', version: 1, name: 'My sector limits',
    currency: 'INR', scope: 'portfolio', dimensionId: 'sector', dimensionName: 'Sector',
    effectiveFrom: '2026-01-01', recordedAt: '2026-01-02T00:00:00.000Z',
    rules: [{ groupId: 'technology', groupName: 'Technology', maxWeightPercent: 50, operator: '>' }],
    ...overrides
});
const cutoffs = {
    asOfDate: new Date('2026-11-01T23:59:59.999Z'),
    recordedAtCutoff: new Date('2026-11-02T00:00:00.000Z')
};
const exposure = (overrides = {}) => ({
    status: 'available', currency: 'INR', scope: 'portfolio', dimensionId: 'sector',
    dimensionName: 'Sector', totalValue: 1000,
    rows: [
        { key: 'technology', groupName: 'Technology', actualValue: 600, actualWeightPercent: 60 },
        { key: 'healthcare', groupName: 'Healthcare', actualValue: 400, actualWeightPercent: 40 }
    ],
    ...overrides
});
const context = { accounts, instruments, classifications };

describe('investment exposure policy validation', () => {
    it('accepts explicit user-defined limits against known classification groups', () => {
        expect(validateInvestmentExposurePolicy(policy(), context)).toMatchObject({
            policySetId: 'policy-set-1', version: 1, dimensionId: 'sector',
            rules: [{ groupId: 'technology', maxWeightPercent: 50, operator: '>' }]
        });
    });
    it('rejects empty policies, duplicate groups and non-finite or out-of-range limits', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [] }), context)).toThrow(/at least one user-defined/);
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'technology', groupName: 'Technology', maxWeightPercent: 50, operator: '>' },
            { groupId: 'technology', groupName: 'Technology', maxWeightPercent: 60, operator: '>=' }
        ] }), context)).toThrow(/unique/);
        for (const value of [-0.1, 100.1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() => validateInvestmentExposurePolicy(policy({ rules: [
                { groupId: 'technology', groupName: 'Technology', maxWeightPercent: value, operator: '>' }
            ] }), context)).toThrow(/finite percentage/);
        }
    });
    it('requires a known group, matching name, supported comparator and dimension', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'issuer-x', groupName: 'Issuer X', maxWeightPercent: 20, operator: '>' }
        ] }), context)).toThrow(/reference a group/);
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'technology', groupName: 'Tech', maxWeightPercent: 20, operator: '>' }
        ] }), context)).toThrow(/stable classification group name/);
        expect(() => validateInvestmentExposurePolicy(policy({ dimensionName: 'Industry' }), context)).toThrow(/stable classification dimension name/);
        expect(() => validateInvestmentExposurePolicy(policy({ rules: [
            { groupId: 'technology', groupName: 'Technology', maxWeightPercent: 20, operator: '==' }
        ] }), context)).toThrow(/operator/);
    });
    it('validates currency, scope, account ownership and canonical bitemporal dates', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ currency: 'BTC' }), context)).toThrow(/currency/);
        expect(() => validateInvestmentExposurePolicy(policy({ scope: 'account', accountId: 'usd' }), context)).toThrow(/must exist and use/);
        expect(() => validateInvestmentExposurePolicy(policy({ scope: 'account' }), context)).toThrow(/exactly one account/);
        expect(() => validateInvestmentExposurePolicy(policy({ effectiveFrom: '2026-02-30' }), context)).toThrow(/calendar date/);
        expect(() => validateInvestmentExposurePolicy(policy({ recordedAt: '2026-01-02' }), context)).toThrow(/canonical ISO-8601/);
    });
    it('rejects policy dimensions without validated classifications', () => {
        expect(() => validateInvestmentExposurePolicy(policy({ dimensionId: 'region', dimensionName: 'Region' }), context))
            .toThrow(/must exist in validated investment classifications/);
    });
    it('validates immutable policy set versions and stable dimensions', () => {
        const version2 = policy({ id: 'policy-v2', version: 2, recordedAt: '2026-02-01T00:00:00.000Z' });
        expect(validateInvestmentExposurePolicies([policy(), version2], context)).toHaveLength(2);
        expect(() => validateInvestmentExposurePolicies([policy(), policy()], context)).toThrow(/IDs must be unique/);
        expect(() => validateInvestmentExposurePolicies([policy(), policy({ id: 'other', version: 1 })], context)).toThrow(/version must be unique/);
        expect(() => validateInvestmentExposurePolicies([policy(), policy({
            id: 'policy-v2', version: 2, currency: 'USD'
        })], context)).toThrow(/retain currency, scope, account and classification dimension/);
    });
    it('validates the persisted policy collection against its workspace references', () => {
        expect(validateInvestmentExposurePolicyCollections({
            investmentAccounts: accounts, investmentInstruments: instruments,
            investmentExposureClassifications: classifications, investmentExposurePolicies: [policy()]
        }).investmentExposurePolicies).toHaveLength(1);
        expect(() => validateInvestmentExposurePolicyCollections({
            investmentAccounts: accounts, investmentInstruments: instruments,
            investmentExposureClassifications: classifications, investmentExposurePolicies: 'invalid'
        })).toThrow(/must be an array/);
    });
});

describe('investment exposure policy bitemporal selection', () => {
    it('selects the latest version both effective and recorded at the cutoffs', () => {
        const versions = [
            policy(),
            policy({ id: 'v2', version: 2, effectiveFrom: '2026-06-01', recordedAt: '2026-06-02T00:00:00.000Z' }),
            policy({ id: 'future-effective', version: 3, effectiveFrom: '2026-12-01', recordedAt: '2026-01-03T00:00:00.000Z' }),
            policy({ id: 'late-known', version: 4, effectiveFrom: '2026-08-01', recordedAt: '2026-12-01T00:00:00.000Z' })
        ];
        expect(selectInvestmentExposurePolicy(versions, {
            ...cutoffs, scope: 'portfolio', currency: 'INR', dimensionId: 'sector'
        }, context).id).toBe('v2');
    });
    it('returns null when no policy is effective and known for the requested scope', () => {
        expect(selectInvestmentExposurePolicy([policy()], {
            asOfDate: new Date('2025-12-31T23:59:59.999Z'),
            recordedAtCutoff: new Date('2026-11-02T00:00:00.000Z'),
            scope: 'portfolio', currency: 'INR', dimensionId: 'sector'
        }, context)).toBeNull();
    });
});

describe('investment exposure policy evaluation', () => {
    it('reports a breach against a user-authored maximum', () => {
        const result = evaluateInvestmentExposurePolicy({
            exposure: exposure(), policy: policy(), ...cutoffs, ...context
        });
        expect(result).toMatchObject({
            status: 'breach', breachCount: 1, evaluatedRuleCount: 1,
            results: [{ groupId: 'technology', actualWeightPercent: 60, maxWeightPercent: 50, status: 'breach' }]
        });
    });
    it('honors strict and inclusive comparison operators exactly', () => {
        const strict = evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 50 }] }),
            policy: policy({ rules: [{ groupId: 'technology', groupName: 'Technology', maxWeightPercent: 50, operator: '>' }] }),
            ...cutoffs, ...context
        });
        const inclusive = evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 50 }] }),
            policy: policy({ rules: [{ groupId: 'technology', groupName: 'Technology', maxWeightPercent: 50, operator: '>=' }] }),
            ...cutoffs, ...context
        });
        expect(strict.status).toBe('withinLimits');
        expect(inclusive.status).toBe('breach');
    });
    it('treats groups absent from a complete exposure result as zero weight', () => {
        const result = evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'healthcare', actualWeightPercent: 100 }] }),
            policy: policy(), ...cutoffs, ...context
        });
        expect(result).toMatchObject({ status: 'withinLimits', results: [{ actualWeightPercent: 0 }] });
    });
    it('propagates unavailable and empty exposure without inventing a result', () => {
        expect(evaluateInvestmentExposurePolicy({
            exposure: exposure({ status: 'unavailable', reason: 'An open position is unclassified.', rows: [] }),
            policy: policy(), ...cutoffs, ...context
        })).toMatchObject({ status: 'unavailable', results: [] });
        expect(evaluateInvestmentExposurePolicy({
            exposure: exposure({ status: 'empty', rows: [] }), policy: policy(), ...cutoffs, ...context
        })).toMatchObject({ status: 'empty', results: [] });
    });
    it('rejects dimension mismatches, malformed rows and policies outside cutoffs', () => {
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ dimensionId: 'region' }), policy: policy(), ...cutoffs, ...context
        })).toThrow(/dimensions must match/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure({ rows: [{ key: 'technology', actualWeightPercent: 101 }] }),
            policy: policy(), ...cutoffs, ...context
        })).toThrow(/valid group IDs and actual weights/);
        expect(() => evaluateInvestmentExposurePolicy({
            exposure: exposure(), policy: policy({ effectiveFrom: '2026-12-01' }), ...cutoffs, ...context
        })).toThrow(/not both effective and known/);
    });
});
