import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    Insurance,
    InsuranceType,
    Money
} from '../src/index.js';

describe('Insurance', () => {
    it('should create insurance', () => {
        const insurance = new Insurance(
            Identifier.create(),
            'Term Insurance',
            InsuranceType.TermLife,
            new Money(18_000, Currency.INR)
        );

        expect(insurance.name).toBe('Term Insurance');
        expect(insurance.annualPremium.amount).toBe(18_000);
    });

    it('should update annual premium', () => {
        const insurance = new Insurance(
            Identifier.create(),
            'Term Insurance',
            InsuranceType.TermLife,
            new Money(18_000)
        );

        const updated = insurance.updateAnnualPremium(
            new Money(20_000)
        );

        expect(updated.annualPremium.amount).toBe(20_000);
        expect(updated.id.equals(insurance.id)).toBe(true);
    });

    it('should preserve immutability', () => {
        const insurance = new Insurance(
            Identifier.create(),
            'Term Insurance',
            InsuranceType.TermLife,
            new Money(18_000)
        );

        const updated = insurance.updateAnnualPremium(
            new Money(20_000)
        );

        expect(insurance.annualPremium.amount).toBe(18_000);
        expect(updated.annualPremium.amount).toBe(20_000);
    });

    it('should reject an empty name', () => {
        expect(() =>
            new Insurance(
                Identifier.create(),
                '',
                InsuranceType.TermLife,
                new Money(1000)
            )
        ).toThrow();
    });
});