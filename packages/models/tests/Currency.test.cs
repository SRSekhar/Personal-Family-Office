import { describe, expect, it } from 'vitest';

import { Currency } from '../src/index.js';

describe('Currency', () => {
    it('should expose INR', () => {
        expect(Currency.INR).toBe('INR');
    });

    it('should expose USD', () => {
        expect(Currency.USD).toBe('USD');
    });

    it('should contain common currencies', () => {
        expect(Object.values(Currency)).toContain('EUR');
        expect(Object.values(Currency)).toContain('GBP');
    });
});