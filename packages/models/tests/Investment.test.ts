import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    Investment,
    InvestmentType,
    Money
} from '../src/index.js';

describe('Investment', () => {
    it('should create an investment', () => {
        const investment = new Investment(
            Identifier.create(),
            'PPF',
            InvestmentType.PublicProvidentFund,
            new Money(1_000_000, Currency.INR)
        );

        expect(investment.name).toBe('PPF');
        expect(investment.type).toBe(
            InvestmentType.PublicProvidentFund
        );
        expect(investment.currentValue.amount).toBe(1_000_000);
    });

    it('should update current value', () => {
        const investment = new Investment(
            Identifier.create(),
            'PPF',
            InvestmentType.PublicProvidentFund,
            new Money(1_000_000)
        );

        const updated = investment.updateCurrentValue(
            new Money(1_250_000)
        );

        expect(updated.currentValue.amount).toBe(1_250_000);
        expect(updated.id.equals(investment.id)).toBe(true);
    });

    it('should preserve immutability', () => {
        const investment = new Investment(
            Identifier.create(),
            'PPF',
            InvestmentType.PublicProvidentFund,
            new Money(1_000_000)
        );

        const updated = investment.updateCurrentValue(
            new Money(2_000_000)
        );

        expect(investment.currentValue.amount).toBe(1_000_000);
        expect(updated.currentValue.amount).toBe(2_000_000);
    });

    it('should reject an empty name', () => {
        expect(() =>
            new Investment(
                Identifier.create(),
                '',
                InvestmentType.PublicProvidentFund,
                new Money(1000)
            )
        ).toThrow();
    });
});