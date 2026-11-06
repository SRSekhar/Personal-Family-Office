import { describe, expect, it } from 'vitest';
import { analyzeInvestmentAllocation, validateInvestmentAllocationPolicies, validateInvestmentAllocationPolicy } from './investment-allocation.js';

const accounts = [
    { id: 'account-1', name: 'Broker A', currency: 'INR' },
    { id: 'account-2', name: 'Broker B', currency: 'INR' },
    { id: 'account-usd', name: 'Foreign broker', currency: 'USD' }
];
const instruments = [
    { id: 'equity-1', name: 'Equity One', type: 'Equity', currency: 'INR' },
    { id: 'equity-2', name: 'Equity Two', type: 'Equity', currency: 'INR' },
    { id: 'fund-1', name: 'Fund One', type: 'MutualFund', currency: 'INR' },
    { id: 'bond-usd', name: 'USD Bond', type: 'Bond', currency: 'USD' }
];
const policy = (overrides = {}) => ({
    id: 'policy-v1', policySetId: 'long-term', version: 1, name: 'Long-term allocation', currency: 'INR',
    scope: 'portfolio', groupBy: 'instrumentType', effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
    targets: [{ key: 'Equity', weightPercent: 60 }, { key: 'MutualFund', weightPercent: 40 }], ...overrides
});
const position = (accountId, instrumentId, quantity, marketValue) => ({ accountId, instrumentId, quantity, marketValue, currency: 'INR' });
const asOfDate = new Date('2026-11-01T23:59:59.999Z');

describe('investment allocation policy validation', () => {
    it('accepts a complete 100% portfolio policy', () => {
        expect(validateInvestmentAllocationPolicy(policy(), { accounts, instruments }).targets)
            .toEqual([{ key: 'Equity', weightPercent: 60 }, { key: 'MutualFund', weightPercent: 40 }]);
    });
    it('requires target weights to total 100%', () => {
        expect(() => validateInvestmentAllocationPolicy(policy({ targets: [{ key: 'Equity', weightPercent: 60 }] }), { accounts, instruments })).toThrow(/total 100%/);
    });
    it('rejects duplicate keys and out-of-range weights', () => {
        expect(() => validateInvestmentAllocationPolicy(policy({ targets: [{ key: 'Equity', weightPercent: 50 }, { key: 'Equity', weightPercent: 50 }] }), { accounts, instruments })).toThrow(/unique/);
        expect(() => validateInvestmentAllocationPolicy(policy({ targets: [{ key: 'Equity', weightPercent: 101 }] }), { accounts, instruments })).toThrow(/from 0 to 100/);
    });
    it('requires valid account scope and same-currency account', () => {
        expect(() => validateInvestmentAllocationPolicy(policy({ scope: 'account' }), { accounts, instruments })).toThrow(/exactly one account ID/);
        expect(() => validateInvestmentAllocationPolicy(policy({ scope: 'account', accountId: 'account-usd' }), { accounts, instruments })).toThrow(/policy currency/);
    });
    it('validates instrument-specific targets against the selected currency', () => {
        expect(validateInvestmentAllocationPolicy(policy({ groupBy: 'instrument', targets: [{ key: 'equity-1', weightPercent: 100 }] }), { accounts, instruments }).groupBy).toBe('instrument');
        expect(() => validateInvestmentAllocationPolicy(policy({ groupBy: 'instrument', targets: [{ key: 'bond-usd', weightPercent: 100 }] }), { accounts, instruments })).toThrow(/policy currency/);
    });
    it('requires real effective dates and canonical recorded timestamps', () => {
        expect(() => validateInvestmentAllocationPolicy(policy({ effectiveFrom: '2026-02-30' }), { accounts, instruments })).toThrow(/real calendar date/);
        expect(() => validateInvestmentAllocationPolicy(policy({ recordedAt: '2026-01-01' }), { accounts, instruments })).toThrow(/canonical ISO-8601/);
    });
    it('keeps policy-set versions unique and ordered', () => {
        const values = validateInvestmentAllocationPolicies([policy({ id: 'v2', version: 2, effectiveFrom: '2026-06-01' }), policy()], { accounts, instruments });
        expect(values.map((item) => item.version)).toEqual([1, 2]);
        expect(() => validateInvestmentAllocationPolicies([policy(), policy({ id: 'duplicate-version' })], { accounts, instruments })).toThrow(/version must be unique/);
    });
});

describe('investment allocation analysis', () => {
    it('aggregates instrument types and reports percentage-point and value drift', () => {
        const result = analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', 10, 600), position('account-2', 'equity-2', 5, 200), position('account-1', 'fund-1', 4, 200)], instruments, accounts, policy: policy(), asOfDate });
        expect(result.status).toBe('available');
        expect(result.totalValue).toBe(1000);
        expect(result.rows).toEqual([
            { key: 'Equity', actualValue: 800, actualWeightPercent: 80, targetWeightPercent: 60, driftPercentagePoints: 20, driftValue: 200 },
            { key: 'MutualFund', actualValue: 200, actualWeightPercent: 20, targetWeightPercent: 40, driftPercentagePoints: -20, driftValue: -200 }
        ]);
        expect(result.hhi).toBeCloseTo(0.68);
        expect(result.effectiveCategoryCount).toBeCloseTo(1 / 0.68);
    });
    it('supports account-scoped policies without mixing accounts', () => {
        const result = analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', 1, 900), position('account-2', 'fund-1', 1, 100)], instruments, accounts,
            policy: policy({ scope: 'account', accountId: 'account-1', targets: [{ key: 'Equity', weightPercent: 100 }] }), asOfDate });
        expect(result.totalValue).toBe(900);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].driftPercentagePoints).toBe(0);
    });
    it('supports instrument-specific targets and exposes unplanned holdings at zero target', () => {
        const result = analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', 1, 700), position('account-1', 'fund-1', 1, 300)], instruments, accounts,
            policy: policy({ groupBy: 'instrument', targets: [{ key: 'equity-1', weightPercent: 100 }] }), asOfDate });
        expect(result.rows.map((row) => [row.key, row.targetWeightPercent, row.driftPercentagePoints])).toEqual([['equity-1', 70, -30], ['fund-1', 0, 30]]);
    });
    it('suppresses partial allocations when any open position lacks valuation', () => {
        const result = analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', 1, 700), position('account-1', 'fund-1', 1, null)], instruments, accounts, policy: policy(), asOfDate });
        expect(result.status).toBe('unavailable');
        expect(result.rows).toEqual([]);
    });
    it('keeps currencies separate and returns empty for no positive holdings', () => {
        const result = analyzeInvestmentAllocation({ positions: [position('account-usd', 'bond-usd', 1, 500)], instruments, accounts, policy: policy(), asOfDate });
        expect(result.totalValue).toBe(0);
        expect(result.status).toBe('empty');
    });
    it('rejects negative position quantities and market values', () => {
        expect(() => analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', -1, 10)], instruments, accounts, policy: policy(), asOfDate })).toThrow(/quantity/);
        expect(() => analyzeInvestmentAllocation({ positions: [position('account-1', 'equity-1', 1, -10)], instruments, accounts, policy: policy(), asOfDate })).toThrow(/market value/);
    });
});
