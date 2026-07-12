import { DomainError, ValueObject } from '@pfo/core';

import { Currency } from './Currency.js';

interface MoneyProperties {
    amount: number;
    currency: Currency;
}

export class Money extends ValueObject<MoneyProperties> {
    public constructor(
        amount: number,
        currency: Currency = Currency.INR
    ) {
        Money.validate(amount);

        super({
            amount,
            currency
        });
    }

    public get amount(): number {
        return this.properties.amount;
    }

    public get currency(): Currency {
        return this.properties.currency;
    }

    public add(other: Money): Money {
        this.ensureSameCurrency(other);

        return new Money(
            this.amount + other.amount,
            this.currency
        );
    }

    public subtract(other: Money): Money {
        this.ensureSameCurrency(other);

        return new Money(
            this.amount - other.amount,
            this.currency
        );
    }

    public multiply(multiplier: number): Money {
        return new Money(
            this.amount * multiplier,
            this.currency
        );
    }

    public divide(divisor: number): Money {
        if (divisor === 0) {
            throw DomainError.validation(
                'Division by zero is not allowed.'
            );
        }

        return new Money(
            this.amount / divisor,
            this.currency
        );
    }

    public isGreaterThan(other: Money): boolean {
        this.ensureSameCurrency(other);

        return this.amount > other.amount;
    }

    public isLessThan(other: Money): boolean {
        this.ensureSameCurrency(other);

        return this.amount < other.amount;
    }

    public isZero(): boolean {
        return this.amount === 0;
    }

    public isPositive(): boolean {
        return this.amount > 0;
    }

    public isNegative(): boolean {
        return this.amount < 0;
    }

    public negate(): Money {
        return new Money(
            -this.amount,
            this.currency
        );
    }

    public format(): string {
        return `${this.currency} ${this.amount.toFixed(2)}`;
    }

    private ensureSameCurrency(other: Money): void {
        if (this.currency !== other.currency) {
            throw DomainError.validation(
                'Money operations require matching currencies.'
            );
        }
    }

    private static validate(amount: number): void {
        if (!Number.isFinite(amount)) {
            throw DomainError.validation(
                'Amount must be a valid number.'
            );
        }
    }

    public static zero(
        currency: Currency = Currency.INR
    ): Money {
        return new Money(0, currency);
    }
}