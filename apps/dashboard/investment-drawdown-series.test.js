import { describe, expect, it, vi } from 'vitest';
import { analyzeInvestmentDrawdownMath } from '../../packages/calculators/src/InvestmentDrawdownMath.ts';
import { analyzeInvestmentDrawdownSeries } from './investment-drawdown-series.js';

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
});
