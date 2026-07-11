import { Result } from '../result/Result.js';

export class Guard {
    private constructor() {}

    public static againstNullOrUndefined<T>(
        value: T | null | undefined,
        parameterName: string
    ): Result<T> {
        if (value === null || value === undefined) {
            return Result.failure<T>(
                `${parameterName} must not be null or undefined.`
            );
        }

        return Result.success(value);
    }

    public static againstNullOrWhiteSpace(
        value: string | null | undefined,
        parameterName: string
    ): Result<string> {
        if (
            value === null ||
            value === undefined ||
            value.trim().length === 0
        ) {
            return Result.failure<string>(
                `${parameterName} must not be null, empty or whitespace.`
            );
        }

        return Result.success(value);
    }

    public static againstEmptyArray<T>(
        value: readonly T[] | null | undefined,
        parameterName: string
    ): Result<readonly T[]> {
        if (value === null || value === undefined || value.length === 0) {
            return Result.failure<readonly T[]>(
                `${parameterName} must contain at least one element.`
            );
        }

        return Result.success(value);
    }

    public static againstNegative(
        value: number,
        parameterName: string
    ): Result<number> {
        if (value < 0) {
            return Result.failure<number>(
                `${parameterName} must not be negative.`
            );
        }

        return Result.success(value);
    }

    public static againstOutOfRange(
        value: number,
        minimum: number,
        maximum: number,
        parameterName: string
    ): Result<number> {
        if (value < minimum || value > maximum) {
            return Result.failure<number>(
                `${parameterName} must be between ${minimum} and ${maximum}.`
            );
        }

        return Result.success(value);
    }
}