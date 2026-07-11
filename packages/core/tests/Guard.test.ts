import { describe, expect, it } from 'vitest';

import { Guard } from '../src/guard/Guard.js';

describe('Guard', () => {
    it('should succeed for a valid value', () => {
        const result = Guard.againstNullOrUndefined('PFO', 'name');

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe('PFO');
    });

    it('should fail for null', () => {
        const result = Guard.againstNullOrUndefined<string>(null, 'name');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
    });

    it('should fail for whitespace', () => {
        const result = Guard.againstNullOrWhiteSpace('   ', 'name');

        expect(result.isFailure).toBe(true);
    });

    it('should fail for negative numbers', () => {
        const result = Guard.againstNegative(-1, 'amount');

        expect(result.isFailure).toBe(true);
    });

    it('should validate a value within range', () => {
        const result = Guard.againstOutOfRange(50, 0, 100, 'percentage');

        expect(result.isSuccess).toBe(true);
    });
});