import { describe, expect, it } from 'vitest';
import {
    buildInvestmentDrawdownObservations,
    validateInvestmentDrawdownSnapshots
} from './investment-drawdown-snapshots.js';

const account = { id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' };
const instrument = { id: 'instrument-1', name: 'Fund', type: 'MutualFund', currency: 'INR' };
const cashAccount = { id: 'cash-1', investmentAccountId: 'account-1', name: 'Cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' };
const base = {
    investmentAccounts: [account], investmentInstruments: [instrument], investmentTransactions: [], investmentValuations: [],
    investmentCashAccounts: [cashAccount], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: []
};
function positionComponent(id, amount, valuedAt = '2026-01-01T16:00:00.000Z') {
    return { id, type: 'position', accountId: 'account-1', instrumentId: 'instrument-1', quantity: 2,
        unitPrice: { amount: amount / 2, currency: 'INR' }, value: { amount, currency: 'INR' },
        valuedAt, sourceType: 'manual', sourceName: 'User valuation' };
}
function snapshot(overrides = {}) {
    const components = overrides.components ?? [positionComponent('position-1', 200)];
    return {
        id: 'snapshot-1', scope: 'portfolio', currency: 'INR', kind: 'DailyClose',
        effectiveAt: '2026-01-01T16:00:00.000Z', recordedAt: '2026-01-01T17:00:00.000Z',
        sourceType: 'manual', sourceName: 'Manual capture', complete: true,
        components, totalValue: { amount: components.reduce((sum, item) => sum + item.value.amount, 0), currency: 'INR' },
        ...overrides
    };
}
function validate(snapshots) {
    return validateInvestmentDrawdownSnapshots({ ...base, investmentDrawdownSnapshots: snapshots }).investmentDrawdownSnapshots;
}

describe('investment drawdown snapshot contract', () => {
    it('accepts a complete component-level daily valuation and preserves provenance', () => {
        const result = validate([snapshot()]);
        expect(result[0]).toMatchObject({ complete: true, sourceType: 'manual', totalValue: { amount: 200, currency: 'INR' } });
        expect(result[0].components[0]).toMatchObject({ type: 'position', quantity: 2, sourceName: 'User valuation' });
    });

    it('requires every component valuation to use the exact snapshot effective timestamp', () => {
        expect(() => validate([snapshot({ components: [positionComponent('p1', 200, '2026-01-01T15:59:00.000Z')] })]))
            .toThrow(/stale carry-forward is not permitted/i);
    });

    it('rejects position values that do not reconcile to quantity times unit price', () => {
        expect(() => validate([snapshot({ components: [{ ...positionComponent('p1', 200), unitPrice: { amount: 90, currency: 'INR' } }] })]))
            .toThrow(/must reconcile/i);
    });

    it('rejects unknown account, instrument and cash-account references', () => {
        expect(() => validate([snapshot({ components: [{ ...positionComponent('p1', 200), instrumentId: 'missing' }] })]))
            .toThrow(/unknown investment account or instrument/i);
        const cash = { id: 'cash-component', type: 'cash', cashAccountId: 'missing', value: { amount: 10, currency: 'INR' },
            valuedAt: '2026-01-01T16:00:00.000Z', sourceType: 'manual', sourceName: 'Statement' };
        expect(() => validate([snapshot({ components: [cash], totalValue: { amount: 10, currency: 'INR' } })]))
            .toThrow(/unknown cash account/i);
    });

    it('requires explicit reasons for incomplete observations', () => {
        expect(() => validate([snapshot({ complete: false })])).toThrow(/must explain why/i);
        expect(validate([snapshot({ complete: false, unavailableReason: 'Missing one position.' })])[0].complete).toBe(false);
    });

    it('requires snapshot totals to equal the component sum', () => {
        expect(() => validate([snapshot({ totalValue: { amount: 201, currency: 'INR' } })])).toThrow(/reconcile to its component values/i);
    });

    it('requires paired external-flow snapshots with exact time and identical component universes', () => {
        const pre = snapshot({ id: 'pre-1', kind: 'ExternalFlowPre', flowId: 'flow-1' });
        const post = snapshot({ id: 'post-1', kind: 'ExternalFlowPost', flowId: 'flow-1',
            components: [positionComponent('position-2', 220)], totalValue: { amount: 220, currency: 'INR' } });
        expect(validate([pre, post])).toHaveLength(2);
        const missing = snapshot({ id: 'post-2', kind: 'ExternalFlowPost', flowId: 'flow-2' });
        expect(() => validate([missing])).toThrow(/both pre-flow and post-flow/i);
        const mismatched = snapshot({ id: 'post-3', kind: 'ExternalFlowPost', flowId: 'flow-1',
            components: [{ id: 'cash-1', type: 'cash', cashAccountId: 'cash-1', value: { amount: 200, currency: 'INR' },
                valuedAt: '2026-01-01T16:00:00.000Z', sourceType: 'manual', sourceName: 'Statement' }] });
        expect(() => validate([pre, mismatched])).toThrow(/same component universe/i);
    });

    it('requires a correction to retain event identity and have a later recorded-at timestamp', () => {
        const original = snapshot();
        const correction = snapshot({ id: 'snapshot-2', recordedAt: '2026-01-02T17:00:00.000Z', supersedesSnapshotId: 'snapshot-1' });
        expect(validate([original, correction])).toHaveLength(2);
        expect(() => validate([original, { ...correction, effectiveAt: '2026-01-02T16:00:00.000Z' }]))
            .toThrow(/retain its scope, currency, event identity and effective time/i);
    });

    it('selects the latest revision known at the requested recorded-at cutoff', () => {
        const original = snapshot();
        const correction = snapshot({ id: 'snapshot-2', recordedAt: '2026-01-02T17:00:00.000Z',
            supersedesSnapshotId: 'snapshot-1', components: [positionComponent('position-1', 240)],
            totalValue: { amount: 240, currency: 'INR' } });
        const snapshots = validate([original, correction]);
        const args = { investmentDrawdownSnapshots: snapshots, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-01-03T00:00:00.000Z' };
        expect(buildInvestmentDrawdownObservations({ ...args, recordedAtCutoff: '2026-01-01T18:00:00.000Z' })[0].portfolioValue).toBe(200);
        expect(buildInvestmentDrawdownObservations({ ...args, recordedAtCutoff: '2026-01-03T00:00:00.000Z' })[0].portfolioValue).toBe(240);
    });
});
