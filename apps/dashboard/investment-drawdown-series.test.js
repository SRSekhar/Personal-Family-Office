import { describe, expect, it, vi } from 'vitest';
import { analyzeInvestmentDrawdownMath } from '../../packages/calculators/src/InvestmentDrawdownMath.ts';
import { analyzeInvestmentDrawdownSeries } from './investment-drawdown-series.js';
import { buildInvestmentDrawdownExternalFlows } from './investment-drawdown-acquisition.js';

const account = { id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' };
const instrument = { id: 'instrument-1', name: 'Fund', type: 'MutualFund', currency: 'INR' };
const cashAccount = { id: 'cash-1', investmentAccountId: 'account-1', name: 'Broker cash', currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z' };
const firstAt = '2026-01-05T16:00:00.000Z';
const secondAt = '2026-01-06T16:00:00.000Z';
const cutoff = '2026-01-07T00:00:00.000Z';

function calendar(overrides = {}) {
    return {
        id: 'calendar-1', calendarSetId: 'portfolio-inr-2026-01', version: 1,
        scope: 'portfolio', currency: 'INR', startAt: firstAt, endAt: secondAt,
        recordedAt: '2026-01-04T12:00:00.000Z',
        expectedDailyCloseAt: [firstAt, secondAt],
        ...overrides
    };
}

function ledger() {
    return {
        scope: 'portfolio',
        currency: 'INR',
        investmentAccounts: [account],
        investmentInstruments: [instrument],
        investmentTransactions: [{
            id: 'purchase-1', accountId: account.id, instrumentId: instrument.id, cashAccountId: cashAccount.id,
            type: 'Purchase', cashAmount: { amount: -200, currency: 'INR' }, quantity: 2,
            unitPrice: { amount: 100, currency: 'INR' }, date: '2026-01-03T10:00:00.000Z',
            recordedAt: '2026-01-03T11:00:00.000Z'
        }],
        investmentValuations: [],
        investmentCashAccounts: [cashAccount],
        investmentCashMovements: [{
            id: 'opening-1', cashAccountId: cashAccount.id, type: 'OpeningBalance',
            amount: { amount: 1000, currency: 'INR' }, effectiveAt: '2026-01-01T00:00:00.000Z',
            recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'statement'
        }],
        investmentCashTransfers: [],
        investmentCashStatements: []
    };
}

function snapshot(id, effectiveAt, recordedAt, price) {
    const components = [
        { id: id + '-position', type: 'position', accountId: account.id, instrumentId: instrument.id,
            quantity: 2, unitPrice: { amount: price, currency: 'INR' }, value: { amount: price * 2, currency: 'INR' },
            valuedAt: effectiveAt, sourceType: 'manual', sourceName: 'Broker statement' },
        { id: id + '-cash', type: 'cash', cashAccountId: cashAccount.id,
            value: { amount: 800, currency: 'INR' }, valuedAt: effectiveAt, sourceType: 'manual', sourceName: 'Cash statement' }
    ];
    return {
        id, scope: 'portfolio', currency: 'INR', kind: 'DailyClose', effectiveAt, recordedAt,
        sourceType: 'manual', sourceName: 'Manual capture', complete: true, components,
        totalValue: { amount: price * 2 + 800, currency: 'INR' }
    };
}


function independentAcceptanceFixture() {
    const times = {
        start: '2026-01-05T16:00:00.000Z',
        contribution: '2026-01-06T12:00:00.000Z',
        closeAfterContribution: '2026-01-06T16:00:00.000Z',
        withdrawal: '2026-01-07T12:00:00.000Z',
        scopeTransfer: '2026-01-07T14:00:00.000Z',
        sale: '2026-01-08T10:00:00.000Z',
        end: '2026-01-09T16:00:00.000Z',
        cutoff: '2026-01-10T00:00:00.000Z'
    };
    const secondAccount = {
        id: 'account-2', name: 'External brokerage', institution: 'Example',
        type: 'Brokerage', currency: 'INR'
    };
    const secondCashAccount = {
        id: 'cash-2', investmentAccountId: secondAccount.id, name: 'External cash',
        currency: 'INR', createdAt: '2026-01-01T00:00:00.000Z'
    };
    const input = ledger();
    input.investmentAccounts.push(secondAccount);
    input.investmentCashAccounts.push(secondCashAccount);
    input.investmentCashMovements.push(
        {
            id: 'opening-2', cashAccountId: secondCashAccount.id, type: 'OpeningBalance',
            amount: { amount: 0, currency: 'INR' }, effectiveAt: '2026-01-01T00:00:00.000Z',
            recordedAt: '2026-01-01T00:00:00.000Z', openingBalanceSource: 'statement'
        },
        {
            id: 'contribution-1', cashAccountId: cashAccount.id, type: 'ExternalContribution',
            amount: { amount: 500, currency: 'INR' }, effectiveAt: times.contribution,
            recordedAt: '2026-01-06T12:30:00.000Z'
        },
        {
            id: 'contribution-correction-1', cashAccountId: cashAccount.id, type: 'Correction',
            amount: { amount: -50, currency: 'INR' }, effectiveAt: times.contribution,
            recordedAt: '2026-01-06T12:45:00.000Z', reason: 'Corrected contribution amount',
            reversesMovementId: 'contribution-1'
        },
        {
            id: 'withdrawal-1', cashAccountId: cashAccount.id, type: 'ExternalWithdrawal',
            amount: { amount: -100, currency: 'INR' }, effectiveAt: times.withdrawal,
            recordedAt: '2026-01-07T12:30:00.000Z'
        }
    );
    input.investmentCashTransfers.push({
        id: 'scope-transfer', sourceCashAccountId: cashAccount.id, destinationCashAccountId: secondCashAccount.id,
        amount: { amount: 50, currency: 'INR' }, effectiveAt: times.scopeTransfer,
        recordedAt: '2026-01-07T14:30:00.000Z'
    });
    input.investmentTransactions.push(
        {
            id: 'fee-1', accountId: account.id, instrumentId: instrument.id, cashAccountId: cashAccount.id,
            type: 'Fee', cashAmount: { amount: -10, currency: 'INR' },
            date: '2026-01-04T10:00:00.000Z', recordedAt: '2026-01-04T10:05:00.000Z'
        },
        {
            id: 'tax-1', accountId: account.id, instrumentId: instrument.id, cashAccountId: cashAccount.id,
            type: 'Tax', cashAmount: { amount: -5, currency: 'INR' },
            date: '2026-01-04T11:00:00.000Z', recordedAt: '2026-01-04T11:05:00.000Z'
        },
        {
            id: 'sale-close-1', accountId: account.id, instrumentId: instrument.id, cashAccountId: cashAccount.id,
            type: 'Sale', cashAmount: { amount: 220, currency: 'INR' }, quantity: 2,
            unitPrice: { amount: 110, currency: 'INR' }, date: times.sale,
            recordedAt: '2026-01-08T10:30:00.000Z'
        }
    );

    function observation(id, kind, effectiveAt, price, cashBalance, flowId) {
        const components = [];
        let total = cashBalance;
        if (price !== null) {
            const value = price * 2;
            components.push({
                id: id + '-position', type: 'position', accountId: account.id, instrumentId: instrument.id,
                quantity: 2, unitPrice: { amount: price, currency: 'INR' },
                value: { amount: value, currency: 'INR' }, valuedAt: effectiveAt,
                sourceType: 'manual', sourceName: 'Independent acceptance valuation'
            });
            total += value;
        }
        components.push({
            id: id + '-cash', type: 'cash', cashAccountId: cashAccount.id,
            value: { amount: cashBalance, currency: 'INR' }, valuedAt: effectiveAt,
            sourceType: 'manual', sourceName: 'Independent acceptance cash statement'
        });
        return {
            id, scope: 'account', accountId: account.id, currency: 'INR', kind, effectiveAt,
            recordedAt: times.cutoff, sourceType: 'manual', sourceName: 'Hand-calculated acceptance fixture',
            ...(flowId ? { flowId } : {}), complete: true, components,
            totalValue: { amount: total, currency: 'INR' }
        };
    }

    const contributionFlow = 'cash-movement:contribution-1';
    const withdrawalFlow = 'cash-movement:withdrawal-1';
    const transferFlow = 'cash-transfer:scope-transfer';
    const snapshots = [
        observation('close-start', 'DailyClose', times.start, 100, 785),
        observation('contribution-pre', 'ExternalFlowPre', times.contribution, 100, 785, contributionFlow),
        observation('contribution-post', 'ExternalFlowPost', times.contribution, 100, 1235, contributionFlow),
        observation('close-after-contribution', 'DailyClose', times.closeAfterContribution, 90, 1235),
        observation('withdrawal-pre', 'ExternalFlowPre', times.withdrawal, 90, 1235, withdrawalFlow),
        observation('withdrawal-post', 'ExternalFlowPost', times.withdrawal, 90, 1135, withdrawalFlow),
        observation('transfer-pre', 'ExternalFlowPre', times.scopeTransfer, 90, 1135, transferFlow),
        observation('transfer-post', 'ExternalFlowPost', times.scopeTransfer, 90, 1085, transferFlow),
        observation('close-after-sale', 'DailyClose', times.end, null, 1305)
    ];
    const calendar = {
        id: 'acceptance-calendar', calendarSetId: 'account-1-acceptance', version: 1,
        scope: 'account', accountId: account.id, currency: 'INR',
        startAt: times.start, endAt: times.end, recordedAt: '2026-01-04T00:00:00.000Z',
        expectedDailyCloseAt: [times.start, times.closeAfterContribution, times.end]
    };
    return { input, times, snapshots, calendar };
}

describe('investment drawdown series orchestration', () => {
    it('reconciles ledger completeness and invokes the calculator with explicit calendar and authoritative flows', () => {
        const input = ledger();
        const snapshots = [
            snapshot('close-1', firstAt, '2026-01-05T17:00:00.000Z', 100),
            snapshot('close-2', secondAt, '2026-01-06T17:00:00.000Z', 110)
        ];
        const result = analyzeInvestmentDrawdownSeries({
            ...input,
            investmentDrawdownSnapshots: snapshots,
            startAt: firstAt,
            endAt: secondAt,
            recordedAtCutoff: cutoff,
            investmentDrawdownCalendars: [calendar()],
            analyzeInvestmentDrawdownMath
        });
        expect(result.status).toBe('available');
        expect(result.methodology).toBe('TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1');
        expect(result).toMatchObject({ calendarId: 'calendar-1', calendarVersion: 1 });
        expect(result.maximumDrawdown).toBe(0);
        expect(result.completeness).toHaveLength(2);
        expect(result.completeness.every((item) => item.complete)).toBe(true);
    });

    it('does not calculate when a declared-complete snapshot fails independent ledger reconciliation', () => {
        const input = ledger();
        const invalid = snapshot('close-1', firstAt, '2026-01-05T17:00:00.000Z', 100);
        invalid.components[1].value.amount = 999;
        invalid.totalValue.amount = 1199;
        const calculate = vi.fn(analyzeInvestmentDrawdownMath);
        const result = analyzeInvestmentDrawdownSeries({
            ...input,
            investmentDrawdownSnapshots: [invalid],
            startAt: firstAt,
            endAt: firstAt,
            recordedAtCutoff: cutoff,
            investmentDrawdownCalendars: [calendar({ endAt: firstAt, expectedDailyCloseAt: [firstAt] })],
            analyzeInvestmentDrawdownMath: calculate
        });
        expect(result.status).toBe('unavailable');
        expect(result.reason).toMatch(/cash balances do not reconcile/i);
        expect(calculate).not.toHaveBeenCalled();
    });

    it('requires an explicit calendar and calculator dependency instead of inferring either', () => {
        const common = {
            ...ledger(),
            investmentDrawdownSnapshots: [],
            startAt: firstAt,
            endAt: secondAt,
            recordedAtCutoff: cutoff
        };
        expect(() => analyzeInvestmentDrawdownSeries({
            ...common, analyzeInvestmentDrawdownMath, investmentDrawdownCalendars: undefined
        })).toThrow(/persisted daily-close calendar collection/i);
        expect(() => analyzeInvestmentDrawdownSeries({
            ...common, investmentDrawdownCalendars: [calendar()]
        })).toThrow(/calculator must be supplied/i);
    });
    it('matches an independent multi-flow hand calculation including corrections, fees, taxes, a scope transfer and a closed position', () => {
        const fixture = independentAcceptanceFixture();
        const { input, times, snapshots, calendar: acceptanceCalendar } = fixture;
        const flows = buildInvestmentDrawdownExternalFlows({
            ...input,
            scope: 'account',
            accountId: account.id,
            currency: 'INR',
            startAt: times.start,
            endAt: times.end,
            recordedAtCutoff: times.cutoff
        });
        expect(flows.status).toBe('available');
        expect(flows.flows.map((item) => [item.id, item.amount.amount])).toEqual([
            ['cash-movement:contribution-1', 450],
            ['cash-movement:withdrawal-1', -100],
            ['cash-transfer:scope-transfer', -50]
        ]);
        // Independent cash/NAV arithmetic:
        // Opening 1,000 - purchase 200 - fee 10 - tax 5 = 785 cash; + 200 position = 985.
        // Contribution 500 corrected by -50 => post-flow NAV 1,435.
        // The next close is 1,235 cash + 180 position = 1,415.
        // Withdrawal 100 and scope transfer 50 are external flows, not investment returns.
        // Sale closes the 2-unit position for 220; final cash/NAV is 1,305.
        // The only investment-return drawdown is 1,415 / 1,435 - 1.
        const result = analyzeInvestmentDrawdownSeries({
            ...input,
            scope: 'account',
            accountId: account.id,
            currency: 'INR',
            investmentDrawdownSnapshots: snapshots,
            investmentDrawdownCalendars: [acceptanceCalendar],
            startAt: times.start,
            endAt: times.end,
            recordedAtCutoff: times.cutoff,
            analyzeInvestmentDrawdownMath
        });
        expect(result.status).toBe('available');
        expect(result.methodology).toBe('TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1');
        expect(result.flowBoundaryCount).toBe(3);
        expect(result.observationCount).toBe(9);
        expect(result.maximumDrawdown).toBeCloseTo(1415 / 1435 - 1, 12);
        expect(result.peakAt).toBe(times.start);
        expect(result.troughAt).toBe(times.closeAfterContribution);
        expect(result.recoveryAt).toBe(times.end);
        expect(result.recovered).toBe(true);
        expect(result.completeness).toHaveLength(9);
        expect(result.completeness.every((item) => item.complete)).toBe(true);
        const finalCompleteness = result.completeness.find((item) => item.snapshotId === 'close-after-sale');
        expect(finalCompleteness).toMatchObject({ complete: true, expectedComponentCount: 1, actualComponentCount: 1 });
    });

    it('fails closed when an expected daily close is missing even though all supplied snapshots reconcile', () => {
        const fixture = independentAcceptanceFixture();
        const { input, times, snapshots, calendar: acceptanceCalendar } = fixture;
        const result = analyzeInvestmentDrawdownSeries({
            ...input,
            scope: 'account',
            accountId: account.id,
            currency: 'INR',
            investmentDrawdownSnapshots: snapshots.filter((item) => item.id !== 'close-after-contribution'),
            investmentDrawdownCalendars: [acceptanceCalendar],
            startAt: times.start,
            endAt: times.end,
            recordedAtCutoff: times.cutoff,
            analyzeInvestmentDrawdownMath
        });
        expect(result.status).toBe('unavailable');
        expect(result.reason).toMatch(/expected daily-close valuation is missing/i);
        expect(result.maximumDrawdown).toBeNull();
        expect(result.points).toEqual([]);
    });

});
