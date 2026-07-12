import { describe, expect, it } from 'vitest';

import { Currency, Money } from '../src/index.js';

describe('Money', () => {
    it('should create a money instance', () => {
        const money = new Money(1000, Currency.INR);

        expect(money.amount).toBe(1000);
        expect(money.currency).toBe(Currency.INR);
    });

    it('should add two money values', () => {
        const first = new Money(100, Currency.INR);
        const second = new Money(50, Currency.INR);

        const result = first.add(second);

        expect(result.amount).toBe(150);
        expect(result.currency).toBe(Currency.INR);
    });

    it('should subtract two money values', () => {
        const first = new Money(100, Currency.INR);
        const second = new Money(40, Currency.INR);

        const result = first.subtract(second);

        expect(result.amount).toBe(60);
    });

    it('should multiply money', () => {
        const money = new Money(250, Currency.INR);

        const result = money.multiply(4);

        expect(result.amount).toBe(1000);
    });

    it('should divide money', () => {
        const money = new Money(1000, Currency.INR);

        const result = money.divide(4);

        expect(result.amount).toBe(250);
    });

    it('should identify zero values', () => {
        const money = Money.zero();

        expect(money.isZero()).toBe(true);
    });

    it('should identify positive values', () => {
        const money = new Money(10);

        expect(money.isPositive()).toBe(true);
    });

    it('should identify negative values', () => {
        const money = new Money(-10);

        expect(money.isNegative()).toBe(true);
    });

    it('should negate a money value', () => {
        const money = new Money(500);

        const result = money.negate();

        expect(result.amount).toBe(-500);
    });

    it('should throw for different currencies', () => {
        const inr = new Money(100, Currency.INR);
        const usd = new Money(100, Currency.USD);

        expect(() => inr.add(usd)).toThrow();
    });

    it('should throw when dividing by zero', () => {
        const money = new Money(100);

        expect(() => money.divide(0)).toThrow();
    });
});