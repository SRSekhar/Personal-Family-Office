import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    Liability,
    LiabilityType,
    Money
} from '../src/index.js';

describe('Liability', () => {
    it('should create a liability', () => {
        const liability = new Liability(
            Identifier.create(),
            'Home Loan',
            LiabilityType.HomeLoan,
            new Money(5_000_000, Currency.INR)
        );

        expect(liability.name).toBe('Home Loan');
        expect(liability.type).toBe(LiabilityType.HomeLoan);
        expect(liability.outstandingAmount.amount).toBe(5_000_000);
    });

    it('should update the outstanding amount', () => {
        const liability = new Liability(
            Identifier.create(),
            'Home Loan',
            LiabilityType.HomeLoan,
            new Money(5_000_000)
        );

        const updated = liability.updateOutstandingAmount(
            new Money(4_500_000)
        );

        expect(updated.outstandingAmount.amount).toBe(4_500_000);
    });

    it('should preserve identifier after update', () => {
        const liability = new Liability(
            Identifier.create(),
            'Home Loan',
            LiabilityType.HomeLoan,
            new Money(5_000_000)
        );

        const updated = liability.updateOutstandingAmount(
            new Money(4_000_000)
        );

        expect(updated.id.equals(liability.id)).toBe(true);
    });

    it('should preserve immutability', () => {
        const liability = new Liability(
            Identifier.create(),
            'Home Loan',
            LiabilityType.HomeLoan,
            new Money(5_000_000)
        );

        const updated = liability.updateOutstandingAmount(
            new Money(4_000_000)
        );

        expect(liability.outstandingAmount.amount).toBe(5_000_000);
        expect(updated.outstandingAmount.amount).toBe(4_000_000);
    });

    it('should reject an empty name', () => {
        expect(() =>
            new Liability(
                Identifier.create(),
                '',
                LiabilityType.HomeLoan,
                new Money(1000)
            )
        ).toThrow();
    });
});