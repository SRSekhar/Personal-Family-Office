import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    FinancialSnapshot,
    Money,
    Portfolio
} from '../src/index.js';

function portfolio(): Portfolio {
    return new Portfolio(Identifier.create(), 'Personal', [], [], [], []);
}

describe('FinancialSnapshot', () => {
    it('should calculate net worth', () => {
        const snapshot = FinancialSnapshot.create(
            Identifier.create(),
            portfolio(),
            new Date('2026-01-01T00:00:00.000Z'),
            new Money(1000),
            new Money(400)
        );

        expect(snapshot.netWorth.amount).toBe(600);
    });

    it('allows liabilities to exceed assets while reconciling negative net worth', () => {
        const snapshot = FinancialSnapshot.create(
            Identifier.create(),
            portfolio(),
            new Date('2026-01-01T00:00:00.000Z'),
            new Money(100),
            new Money(400)
        );
        expect(snapshot.netWorth.amount).toBe(-300);
    });

    it('rejects invalid capture dates and negative asset or liability totals', () => {
        expect(() => FinancialSnapshot.create(
            Identifier.create(), portfolio(), new Date(Number.NaN), new Money(100), new Money(50)
        )).toThrow('valid date');
        expect(() => FinancialSnapshot.create(
            Identifier.create(), portfolio(), new Date(), new Money(-1), new Money(0)
        )).toThrow('non-negative');
        expect(() => FinancialSnapshot.create(
            Identifier.create(), portfolio(), new Date(), new Money(100), new Money(-1)
        )).toThrow('non-negative');
    });

    it('rejects mixed currencies even when directly constructed', () => {
        expect(() => new FinancialSnapshot(
            Identifier.create(),
            portfolio(),
            new Date(),
            new Money(100, Currency.INR),
            new Money(50, Currency.USD),
            new Money(50, Currency.INR)
        )).toThrow('same currency');
    });

    it('rejects directly constructed snapshots with inconsistent net worth', () => {
        expect(() => new FinancialSnapshot(
            Identifier.create(),
            portfolio(),
            new Date(),
            new Money(100),
            new Money(50),
            new Money(60)
        )).toThrow('must equal total assets minus total liabilities');
    });

});
