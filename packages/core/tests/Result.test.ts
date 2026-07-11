import { describe, expect, it } from 'vitest';

import { Result } from '../src/result/Result.js';

describe('Result', () => {
    it('should create a successful result', () => {
        const result = Result.success(100);

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBe(100);
        expect(result.error).toBeUndefined();
    });

    it('should create a failed result', () => {
        const result = Result.failure<number>('Something went wrong.');

        expect(result.isSuccess).toBe(false);
        expect(result.isFailure).toBe(true);
        expect(result.value).toBeUndefined();
        expect(result.error).toBe('Something went wrong.');
    });
});