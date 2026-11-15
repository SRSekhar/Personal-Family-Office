import { describe, expect, it } from 'vitest';
import {
    buildInvestmentDrawdownExternalFlows,
    buildInvestmentDrawdownSnapshotRequirements,
    validateInvestmentDrawdownSnapshotCompleteness
} from './investment-drawdown-acquisition.js';

const effectiveAt = '2026-01-05T16:00:00.000Z';
const recordedAt = '2026-01-05T17:00:00.000Z';
const account = { id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' };
const instrument = { id: 'instrument-1', name: 'Fund', type: 'MutualFund', currency: 'INR' };
const cashAccount = { id: 'cash-1', investmentAccountId: 'account-1', name: 'Broker cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' };

function transaction(overrides = {}) {
    return {
        id: 'purchase-1', accountId: 'account-1', instrumentId: 'instrument-1', cashAccountId: 'cash-1',
        type: 'Purchase', cashAmount: { amount: -200, currency: 'INR' },
        quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
        date: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z',
        ...overrides
    };
}

function base() {
    return {
        investmentAccounts: [account],
        investmentInstruments: [instrument],
        investmentTransactions: [
            transaction(),
            transaction({
                id: 'sale-1', type: 'Sale', cashAmount: { amount: 60, currency: 'INR' },
                quantity: 0.5, unitPrice: { amount: 120, currency: 'INR' },
                date: '2026-01-04T10:00:00.000Z', recordedAt: '2026-01-04T11:00:00.000Z'
            })
        ],
        investmentValuations: [],
        investmentCashAccounts: [cashAccount],
        investmentCashMovements: [
            { id: 'opening-1', cashAccountId: 'cash-1', type: 'OpeningBalance',
                amount: { amount: 1000, currency: 'INR' }, effectiveAt: '2026-01-01T00:00:00.000Z',
                recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'statement' },
            { id: 'contribution-1', cashAccountId: 'cash-1', type: 'ExternalContribution',
                amount: { amount: 500, currency: 'INR' }, effectiveAt: '2026-01-02T10:00:00.000Z',
                recordedAt: '2026-01-02T11:00:00.000Z' }
        ],
        investmentCashTransfers: [],
        investmentCashStatements: []
    };
}

function snapshot(overrides = {}) {
    const components = overrides.components ?? [
        { id: 'position-component-1', type: 'position', accountId: 'account-1', instrumentId: 'instrument-1',
            quantity: 1.5, unitPrice: { amount: 100, currency: 'INR' }, value: { amount: 150, currency: 'INR' },
            valuedAt: effectiveAt, sourceType: 'manual', sourceName: 'Manual valuation' },
        { id: 'cash-component-1', type: 'cash', cashAccountId: 'cash-1',
            value: { amount: 1360, currency: 'INR' }, valuedAt: effectiveAt, sourceType: 'manual', sourceName: 'Bank balance' }
    ];
    return {
        id: 'snapshot-1', scope: 'portfolio', currency: 'INR', kind: 'DailyClose',
        effectiveAt, recordedAt, sourceType: 'manual', sourceName: 'Manual capture',
        complete: true, components,
        totalValue: { amount: components.reduce((sum, item) => sum + item.value.amount, 0), currency: 'INR' },
        ...overrides
    };
}

describe('investment drawdown acquisition and event taxonomy', () => {
    it('derives open FIFO positions and cash balances from effective and recorded ledger cutoffs', () => {
        const requirements = buildInvestmentDrawdownSnapshotRequirements({
            ...base(), scope: 'portfolio', currency: 'INR', effectiveAt, recordedAtCutoff: recordedAt
        });
        expect(requirements.status).toBe('available');
        expect(requirements.expectedComponents).toEqual([
            { type: 'position', accountId: 'account-1', instrumentId: 'instrument-1', quantity: 1.5 },
            { type: 'cash', cashAccountId: 'cash-1', balance: 1360, currency: 'INR' }
        ]);
    });

    it('certifies a snapshot only when every open position and eligible cash account is represented accurately', () => {
        const input = { ...base(), investmentDrawdownSnapshots: [snapshot()] };
        const result = validateInvestmentDrawdownSnapshotCompleteness({ ...input, snapshotId: 'snapshot-1' });
        expect(result).toMatchObject({ status: 'complete', complete: true, expectedComponentCount: 2, actualComponentCount: 2 });
    });

    it('rejects a declared-complete snapshot that omits an open FIFO position', () => {
        const cashOnly = [{ id: 'cash-component-1', type: 'cash', cashAccountId: 'cash-1',
            value: { amount: 1360, currency: 'INR' }, valuedAt: effectiveAt, sourceType: 'manual', sourceName: 'Bank balance' }];
        const input = { ...base(), investmentDrawdownSnapshots: [snapshot({ components: cashOnly, totalValue: { amount: 1360, currency: 'INR' } })] };
        const result = validateInvestmentDrawdownSnapshotCompleteness({ ...input, snapshotId: 'snapshot-1' });
        expect(result.status).toBe('incomplete');
        expect(result.missingComponents).toHaveLength(1);
    });

    it('requires an explicit opening-balance baseline and complete transaction-to-cash linkage', () => {
        const missingOpening = base();
        missingOpening.investmentCashMovements = missingOpening.investmentCashMovements.filter((item) => item.type !== 'OpeningBalance');
        const first = buildInvestmentDrawdownSnapshotRequirements({
            ...missingOpening, scope: 'portfolio', currency: 'INR', effectiveAt, recordedAtCutoff: recordedAt
        });
        expect(first.status).toBe('incomplete');
        expect(first.reasons.join(' ')).toMatch(/opening-balance baseline/i);

        const unlinked = base();
        unlinked.investmentTransactions[0] = { ...unlinked.investmentTransactions[0] };
        delete unlinked.investmentTransactions[0].cashAccountId;
        const second = buildInvestmentDrawdownSnapshotRequirements({
            ...unlinked, scope: 'portfolio', currency: 'INR', effectiveAt, recordedAtCutoff: recordedAt
        });
        expect(second.status).toBe('incomplete');
        expect(second.reasons.join(' ')).toMatch(/not linked to an eligible cash account/i);
    });

    it('excludes opening balances and internal transfers while classifying external deposits, withdrawals and scope-crossing transfers', () => {
        const input = base();
        input.investmentAccounts.push({ id: 'account-2', name: 'Second', institution: 'Example', type: 'Brokerage', currency: 'INR' });
        input.investmentCashAccounts.push(
            { id: 'cash-2', investmentAccountId: 'account-1', name: 'Second account-1 cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' },
            { id: 'cash-3', investmentAccountId: 'account-2', name: 'Account-2 cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' }
        );
        input.investmentCashMovements.push(
            { id: 'opening-2', cashAccountId: 'cash-2', type: 'OpeningBalance', amount: { amount: 0, currency: 'INR' },
                effectiveAt: '2026-01-01T00:00:00.000Z', recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'manual' },
            { id: 'opening-3', cashAccountId: 'cash-3', type: 'OpeningBalance', amount: { amount: 0, currency: 'INR' },
                effectiveAt: '2026-01-01T00:00:00.000Z', recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'manual' },
            { id: 'withdrawal-1', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z' }
        );
        input.investmentCashTransfers.push(
            { id: 'internal-transfer', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-2',
                amount: { amount: 25, currency: 'INR' }, effectiveAt: '2026-01-04T12:00:00.000Z', recordedAt: '2026-01-04T13:00:00.000Z' },
            { id: 'scope-transfer', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-3',
                amount: { amount: 50, currency: 'INR' }, effectiveAt: '2026-01-04T14:00:00.000Z', recordedAt: '2026-01-04T15:00:00.000Z' }
        );
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'account', accountId: 'account-1', currency: 'INR',
            startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.status).toBe('available');
        expect(flows.flows.map((item) => [item.id, item.amount.amount])).toEqual([
            ['cash-movement:contribution-1', 500],
            ['cash-movement:withdrawal-1', -100],
            ['cash-transfer:scope-transfer', -50]
        ]);
    });

    it('treats transfers between accounts inside a portfolio as internal', () => {
        const input = base();
        input.investmentAccounts.push({ id: 'account-2', name: 'Second', institution: 'Example', type: 'Brokerage', currency: 'INR' });
        input.investmentCashAccounts.push({ id: 'cash-2', investmentAccountId: 'account-2', name: 'Second cash',
            currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' });
        input.investmentCashMovements.push({ id: 'opening-2', cashAccountId: 'cash-2', type: 'OpeningBalance',
            amount: { amount: 0, currency: 'INR' }, effectiveAt: '2026-01-01T00:00:00.000Z',
            recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'manual' });
        input.investmentCashTransfers.push({ id: 'portfolio-internal', sourceCashAccountId: 'cash-1', destinationCashAccountId: 'cash-2',
            amount: { amount: 50, currency: 'INR' }, effectiveAt: '2026-01-04T14:00:00.000Z', recordedAt: '2026-01-04T15:00:00.000Z' });
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.flows.map((item) => item.id)).toEqual(['cash-movement:contribution-1']);
    });

    it('nets same-effective-time corrections into the original external flow without creating a second flow', () => {
        const input = base();
        input.investmentCashMovements.push(
            { id: 'withdrawal-1', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z' },
            { id: 'correction-1', cashAccountId: 'cash-1', type: 'Correction', amount: { amount: 20, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-04T18:00:00.000Z',
                reason: 'Partial reversal', reversesMovementId: 'withdrawal-1' }
        );
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.status).toBe('available');
        expect(flows.flows).toHaveLength(2);
        expect(flows.flows[1]).toMatchObject({
            id: 'cash-movement:withdrawal-1',
            amount: { amount: -80, currency: 'INR' },
            sourceIds: ['cash-movement:withdrawal-1', 'cash-correction:correction-1']
        });
    });

    it('marks a correction with a different effective timestamp unavailable rather than double-counting it', () => {
        const input = base();
        input.investmentCashMovements.push(
            { id: 'withdrawal-1', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z' },
            { id: 'correction-1', cashAccountId: 'cash-1', type: 'Correction', amount: { amount: 20, currency: 'INR' },
                effectiveAt: '2026-01-04T10:00:00.000Z', recordedAt: '2026-01-04T18:00:00.000Z',
                reason: 'Correction at a later effective time', reversesMovementId: 'withdrawal-1' }
        );
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.status).toBe('unavailable');
        expect(flows.reason).toMatch(/different effective timestamp/i);
    });

    it('does not apply corrections recorded after the requested knowledge cutoff', () => {
        const input = base();
        input.investmentCashMovements.push(
            { id: 'withdrawal-1', cashAccountId: 'cash-1', type: 'ExternalWithdrawal', amount: { amount: -100, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z' },
            { id: 'late-correction', cashAccountId: 'cash-1', type: 'Correction', amount: { amount: 20, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-07T18:00:00.000Z',
                reason: 'Not yet known', reversesMovementId: 'withdrawal-1' }
        );
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.status).toBe('available');
        expect(flows.flows[1].amount.amount).toBe(-100);
    });

    it('invalidates an in-window correction to an external flow originally outside the window', () => {
        const input = base();
        input.investmentCashMovements.push(
            { id: 'old-contribution', cashAccountId: 'cash-1', type: 'ExternalContribution', amount: { amount: 100, currency: 'INR' },
                effectiveAt: '2026-01-03T10:00:00.000Z', recordedAt: '2026-01-03T11:00:00.000Z' },
            { id: 'in-window-correction', cashAccountId: 'cash-1', type: 'Correction', amount: { amount: -10, currency: 'INR' },
                effectiveAt: '2026-01-04T10:00:00.000Z', recordedAt: '2026-01-04T11:00:00.000Z',
                reason: 'Late correction to an earlier flow', reversesMovementId: 'old-contribution' }
        );
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input, scope: 'portfolio', currency: 'INR',
            startAt: '2026-01-04T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z', recordedAtCutoff: '2026-01-06T00:00:00.000Z'
        });
        expect(flows.status).toBe('unavailable');
        expect(flows.reason).toMatch(/different effective timestamp/i);
    });


    it('uses distinct pre-flow and post-flow cash ledger boundaries at the same effective timestamp', () => {
        const input = base();
        const flowEffectiveAt = '2026-01-02T10:00:00.000Z';
        const common = {
            ...input, scope: 'portfolio', currency: 'INR', effectiveAt: flowEffectiveAt,
            recordedAtCutoff: '2026-01-05T17:00:00.000Z', flowId: 'cash-movement:contribution-1'
        };
        const pre = buildInvestmentDrawdownSnapshotRequirements({ ...common, kind: 'ExternalFlowPre' });
        const post = buildInvestmentDrawdownSnapshotRequirements({ ...common, kind: 'ExternalFlowPost' });
        expect(pre.status).toBe('available');
        expect(post.status).toBe('available');
        expect(pre.expectedComponents).toEqual([
            { type: 'cash', cashAccountId: 'cash-1', balance: 1000, currency: 'INR' }
        ]);
        expect(post.expectedComponents).toEqual([
            { type: 'cash', cashAccountId: 'cash-1', balance: 1500, currency: 'INR' }
        ]);

        const boundarySnapshot = (id, kind, value) => ({
            id, scope: 'portfolio', currency: 'INR', kind, flowId: 'cash-movement:contribution-1',
            effectiveAt: flowEffectiveAt, recordedAt: '2026-01-02T12:00:00.000Z',
            sourceType: 'manual', sourceName: 'Manual flow-boundary capture', complete: true,
            components: [{ id: id + '-cash', type: 'cash', cashAccountId: 'cash-1',
                value: { amount: value, currency: 'INR' }, valuedAt: flowEffectiveAt,
                sourceType: 'manual', sourceName: 'Bank balance' }],
            totalValue: { amount: value, currency: 'INR' }
        });
        const snapshots = [
            boundarySnapshot('pre-snapshot', 'ExternalFlowPre', 1000),
            boundarySnapshot('post-snapshot', 'ExternalFlowPost', 1500)
        ];
        const preCheck = validateInvestmentDrawdownSnapshotCompleteness({
            ...input, investmentDrawdownSnapshots: snapshots, snapshotId: 'pre-snapshot'
        });
        const postCheck = validateInvestmentDrawdownSnapshotCompleteness({
            ...input, investmentDrawdownSnapshots: snapshots, snapshotId: 'post-snapshot'
        });
        expect(preCheck.complete).toBe(true);
        expect(postCheck.complete).toBe(true);
    });

});
