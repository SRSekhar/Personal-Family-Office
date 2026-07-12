import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    Money,
    Property,
    PropertyType
} from '../src/index.js';

describe('Property', () => {
    it('should create a property', () => {
        const property = new Property(
            Identifier.create(),
            'Hyderabad House',
            PropertyType.Residential,
            new Money(12_500_000, Currency.INR)
        );

        expect(property.name).toBe('Hyderabad House');
        expect(property.marketValue.amount).toBe(12_500_000);
    });

    it('should update market value', () => {
        const property = new Property(
            Identifier.create(),
            'Hyderabad House',
            PropertyType.Residential,
            new Money(12_500_000)
        );

        const updated = property.updateMarketValue(
            new Money(14_000_000)
        );

        expect(updated.marketValue.amount).toBe(14_000_000);
        expect(updated.id.equals(property.id)).toBe(true);
    });

    it('should preserve immutability', () => {
        const property = new Property(
            Identifier.create(),
            'Hyderabad House',
            PropertyType.Residential,
            new Money(12_500_000)
        );

        const updated = property.updateMarketValue(
            new Money(15_000_000)
        );

        expect(property.marketValue.amount).toBe(12_500_000);
        expect(updated.marketValue.amount).toBe(15_000_000);
    });

    it('should reject an empty name', () => {
        expect(() =>
            new Property(
                Identifier.create(),
                '',
                PropertyType.Residential,
                new Money(1000)
            )
        ).toThrow();
    });
});