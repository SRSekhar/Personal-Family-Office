import { describe, expect, it } from 'vitest';
import {
    evaluateInvestmentConcentrationPolicy,
    selectInvestmentConcentrationPolicy,
    validateInvestmentConcentrationPolicies,
    validateInvestmentConcentrationPolicy
} from './investment-concentration.js';

const accounts = [
    { id: 'account-inr-1', name: 'Account one', currency: 'INR' },
    { id: 'account-inr-2', name: 'Account two', currency: 'INR' },
    { id: 'account-usd', name: 'USD account', currency: 'USD' }
];
const instruments = [
    { id: 'equity-1', name: 'Equity one', type: 'Equity', currency: 'INR' },
    { id: 'fund-1', name: 'Fund one', type: 'MutualFund', currency: 'INR' },
    { id: 'bond-usd', name: 'USD bond', type: 'Bond', currency: 'USD' }
];
const policy = (overrides = {}) => ({
    id: 'concentration-v1', policySetId: 'portfolio-limits', version: 1, name: 'User concentration limits',
    currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType',
    effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
    rules: [{ key: 'Equity', maxWeightPercent: 60, operator: '>' }],
    ...overrides
});
const allocation = (overrides = {}) => ({
    status: 'available', currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType',
    asOfDate: '2026-11-01T23:59:59.999Z', recordedAtCutoff: '2026-11-01T23:59:59.999Z',
    totalValue: 1000,
    rows: [
        { key: 'Equity', actualValue: 650, actualWeightPercent: 65 },
        { key: 'MutualFund', actualValue: 350, actualWeightPercent: 35 }
    ],
    ...overrides
});
const context = { accounts, instruments };
const asOfDate = new Date('2026-11-01T23:59:59.999Z');
const recordedAtCutoff = new Date('2026-11-02T00:00:00.000Z');

describe('investment concentration policy validation', () => {
    it('accepts explicit user-defined percentage limits and comparison operators', () => {
        expect(validateInvestmentConcentrationPolicy(policy(), context).rules).toEqual([
            { key: 'Equity', maxWeightPercent: 60, operator: '>' }
        ]);
    });
    it('requires at least one explicitly configured rule; no default threshold exists', () => {
        expect(() => validateInvestmentConcentrationPolicy(policy({ rules: [] }), context)).toThrow(/at least one user-defined limit/);
        expect(() => validateInvestmentConcentrationPolicy({ ...policy(), rules: undefined }, context)).toThrow(/at least one user-defined limit/);
    });
    it('rejects invalid percentages, operators and duplicate group keys', () => {
        expect(() => validateInvestmentConcentrationPolicy(policy({ rules: [{ key: 'Equity', maxWeightPercent: 101, operator: '>' }] }), context)).toThrow(/from 0 to 100/);
        expect(() => validateInvestmentConcentrationPolicy(policy({ rules: [{ key: 'Equity', maxWeightPercent: 60, operator: '>' }, { key: 'Equity', maxWeightPercent: 70, operator: '>=' }] }), context)).toThrow(/unique/);
        expect(() => validateInvestmentConcentrationPolicy(policy({ rules: [{ key: 'Equity', maxWeightPercent: 60, operator: 'approx' }] }), context)).toThrow(/operator/);
    });
    it('validates account scope, currency and instrument references', () => {
        expect(() => validateInvestmentConcentrationPolicy(policy({ scope: 'account' }), context)).toThrow(/exactly one account ID/);
        expect(() => validateInvestmentConcentrationPolicy(policy({ scope: 'account', accountId: 'account-usd' }), context)).toThrow(/policy currency/);
        expect(() => validateInvestmentConcentrationPolicy(policy({ groupBy: 'instrument', rules: [{ key: 'bond-usd', maxWeightPercent: 20, operator: '>' }] }), context)).toThrow(/policy currency/);
    });
    it('rejects empty or invalid effective dates and non-canonical timestamps', () => {
        expect(() => validateInvestmentConcentrationPolicy(policy({ effectiveFrom: '2026-02-30' }), context)).toThrow(/real calendar date/);
        expect(() => validateInvestmentConcentrationPolicy(policy({ recordedAt: '2026-01-01' }), context)).toThrow(/canonical ISO-8601/);
    });
    it('validates immutable policy set versions and stable dimensions', () => {
        const second = policy({ id: 'v2', version: 2, effectiveFrom: '2026-06-01', rules: [{ key: 'Equity', maxWeightPercent: 55, operator: '>=' }] });
        expect(validateInvestmentConcentrationPolicies([second, policy()], context).map((item) => item.version)).toEqual([1, 2]);
        expect(() => validateInvestmentConcentrationPolicies([policy(), policy({ id: 'duplicate' })], context)).toThrow(/version must be unique/);
        expect(() => validateInvestmentConcentrationPolicies([policy(), policy({ id: 'other', version: 2, groupBy: 'instrument' })], context)).toThrow(/retain currency, scope, account and grouping/);
    });
});

describe('investment concentration policy evaluation', () => {
    it('reports a breach only when actual category weight exceeds the user limit', () => {
        const result = evaluateInvestmentConcentrationPolicy({ allocation: allocation(), policy: policy(), asOfDate, recordedAtCutoff, ...context });
        expect(result).toMatchObject({ status: 'breach', breachCount: 1, evaluatedRuleCount: 1 });
        expect(result.results).toEqual([{ key: 'Equity', actualWeightPercent: 65, maxWeightPercent: 60, operator: '>', status: 'breach' }]);
    });
    it('supports a user-selected inclusive boundary operator', () => {
        const result = evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ rows: [{ key: 'Equity', actualWeightPercent: 60 }] }),
            policy: policy({ rules: [{ key: 'Equity', maxWeightPercent: 60, operator: '>=' }] }),
            asOfDate, recordedAtCutoff, ...context
        });
        expect(result.status).toBe('breach');
    });
    it('treats an unconfigured category as no rule and an explicitly configured absent category as zero weight', () => {
        const result = evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ rows: [{ key: 'Equity', actualWeightPercent: 65 }] }),
            policy: policy({ rules: [{ key: 'MutualFund', maxWeightPercent: 1, operator: '>' }] }),
            asOfDate, recordedAtCutoff, ...context
        });
        expect(result.results[0]).toMatchObject({ actualWeightPercent: 0, status: 'withinLimit' });
    });
    it('returns withinLimits when all user-authored limits are met', () => {
        const result = evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ rows: [{ key: 'Equity', actualWeightPercent: 55 }] }),
            policy: policy(), asOfDate, recordedAtCutoff, ...context
        });
        expect(result.status).toBe('withinLimits');
        expect(result.breachCount).toBe(0);
    });
    it('suppresses evaluation when the underlying allocation is incomplete or empty', () => {
        expect(evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ status: 'unavailable', reason: 'Missing valuation' }),
            policy: policy(), asOfDate, recordedAtCutoff, ...context
        })).toMatchObject({ status: 'unavailable', results: [] });
        expect(evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ status: 'empty' }),
            policy: policy(), asOfDate, recordedAtCutoff, ...context
        })).toMatchObject({ status: 'empty', results: [] });
    });
    it('rejects mismatched currency, scope and grouping instead of silently mixing dimensions', () => {
        expect(() => evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ currency: 'USD' }), policy: policy(), asOfDate, recordedAtCutoff, ...context
        })).toThrow(/dimensions must match/);
        expect(() => evaluateInvestmentConcentrationPolicy({
            allocation: allocation({ scope: 'account' }), policy: policy(), asOfDate, recordedAtCutoff, ...context
        })).toThrow(/dimensions must match/);
    });
    it('rejects policies that are future-effective or not yet recorded', () => {
        expect(() => evaluateInvestmentConcentrationPolicy({
            allocation: allocation(), policy: policy({ effectiveFrom: '2026-12-01' }), asOfDate, recordedAtCutoff, ...context
        })).toThrow(/not both effective and known/);
        expect(() => evaluateInvestmentConcentrationPolicy({
            allocation: allocation(), policy: policy({ recordedAt: '2026-12-01T00:00:00.000Z' }), asOfDate, recordedAtCutoff, ...context
        })).toThrow(/not both effective and known/);
    });
    it('selects policy versions using both effective and recorded-at cutoffs', () => {
        const selected = selectInvestmentConcentrationPolicy([
            policy(),
            policy({ id: 'v2', version: 2, effectiveFrom: '2026-12-01', recordedAt: '2026-11-01T00:00:00.000Z' }),
            policy({ id: 'v3', version: 3, effectiveFrom: '2026-06-01', recordedAt: '2026-12-01T00:00:00.000Z' })
        ], { asOfDate, recordedAtCutoff, scope: 'portfolio', currency: 'INR' }, context);
        expect(selected.id).toBe('concentration-v1');
    });
});
