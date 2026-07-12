import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Asset,
    AssetType,
    Currency,
    Money
} from '../src/index.js';

describe('Asset', () => {
    it('should create an asset', () => {
        const asset = new Asset(
            Identifier.create(),
            'Emergency Fund',
            AssetType.BankAccount,
            new Money(500000, Currency.INR)
        );

        expect(asset.name).toBe('Emergency Fund');
        expect(asset.type).toBe(AssetType.BankAccount);
        expect(asset.value.amount).toBe(500000);
    });

    it('should update the asset value', () => {
        const asset = new Asset(
            Identifier.create(),
            'Emergency Fund',
            AssetType.BankAccount,
            new Money(500000)
        );

        const updated = asset.updateValue(
            new Money(750000)
        );

        expect(updated.value.amount).toBe(750000);
    });

    it('should preserve identifier after update', () => {
        const asset = new Asset(
            Identifier.create(),
            'Emergency Fund',
            AssetType.BankAccount,
            new Money(500000)
        );

        const updated = asset.updateValue(
            new Money(600000)
        );

        expect(updated.id.equals(asset.id)).toBe(true);
    });

    it('should preserve immutability', () => {
        const asset = new Asset(
            Identifier.create(),
            'Emergency Fund',
            AssetType.BankAccount,
            new Money(500000)
        );

        const updated = asset.updateValue(
            new Money(600000)
        );

        expect(asset.value.amount).toBe(500000);
        expect(updated.value.amount).toBe(600000);
    });

    it('should reject an empty name', () => {
        expect(() =>
            new Asset(
                Identifier.create(),
                '',
                AssetType.BankAccount,
                new Money(1000)
            )
        ).toThrow();
    });
});