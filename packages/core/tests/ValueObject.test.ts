import { describe, expect, it } from 'vitest';

import { ValueObject } from '../src/index.js';

interface MoneyProperties {
    amount: number;
    currency: string;
}

class Money extends ValueObject<MoneyProperties> {
    public constructor(
        amount: number,
        currency: string
    ) {
        super({
            amount,
            currency
        });
    }
}

describe('ValueObject', () => {
    it('should consider equal value objects equal', () => {
        const first = new Money(100, 'USD');
        const second = new Money(100, 'USD');

        expect(first.equals(second)).toBe(true);
    });

    it('should consider different value objects unequal', () => {
        const first = new Money(100, 'USD');
        const second = new Money(200, 'USD');

        expect(first.equals(second)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
        const money = new Money(100, 'USD');

        expect(money.equals(undefined)).toBe(false);
    });

    it('should expose an immutable object representation', () => {
        const money = new Money(100, 'USD');

        const value = money.toObject();

        expect(value.amount).toBe(100);
        expect(value.currency).toBe('USD');

        expect(Object.isFrozen(value)).toBe(true);
    });

    it('should create independent immutable snapshots', () => {
        const money = new Money(100, 'USD');

        const first = money.toObject();
        const second = money.toObject();

        expect(first).not.toBe(second);
        expect(first).toEqual(second);
    });
});