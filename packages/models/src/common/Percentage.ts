import { DomainError, ValueObject } from '@pfo/core';

interface PercentageProperties {
    value: number;
}

export class Percentage extends ValueObject<PercentageProperties> {
    public constructor(value: number) {
        Percentage.validate(value);

        super({
            value
        });
    }

    public get value(): number {
        return this.properties.value;
    }

    public toDecimal(): number {
        return this.value / 100;
    }

    public add(other: Percentage): Percentage {
        return new Percentage(this.value + other.value);
    }

    public subtract(other: Percentage): Percentage {
        return new Percentage(this.value - other.value);
    }

    public multiply(multiplier: number): Percentage {
        return new Percentage(this.value * multiplier);
    }

    public isZero(): boolean {
        return this.value === 0;
    }

    public isHundred(): boolean {
        return this.value === 100;
    }

    private static validate(value: number): void {
        if (!Number.isFinite(value)) {
            throw DomainError.validation(
                'Percentage must be a valid number.'
            );
        }

        if (value < 0 || value > 100) {
            throw DomainError.validation(
                'Percentage must be between 0 and 100.'
            );
        }
    }

    public static zero(): Percentage {
        return new Percentage(0);
    }

    public static hundred(): Percentage {
        return new Percentage(100);
    }
}