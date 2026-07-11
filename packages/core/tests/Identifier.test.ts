import { describe, expect, it } from 'vitest';

import { Identifier } from '../src/domain/Identifier.js';

describe('Identifier', () => {
    it('should generate a unique identifier when no value is supplied', () => {
        const identifier = Identifier.create();

        expect(identifier.value).toBeDefined();
        expect(identifier.value.length).toBeGreaterThan(0);
    });

    it('should use the supplied identifier value', () => {
        const identifier = Identifier.create('ABC123');

        expect(identifier.value).toBe('ABC123');
    });

    it('should consider two identifiers with the same value equal', () => {
        const first = Identifier.create('ID-001');
        const second = Identifier.create('ID-001');

        expect(first.equals(second)).toBe(true);
    });

    it('should consider two identifiers with different values unequal', () => {
        const first = Identifier.create('ID-001');
        const second = Identifier.create('ID-002');

        expect(first.equals(second)).toBe(false);
    });

    it('should return the identifier value from toString()', () => {
        const identifier = Identifier.create('PFO-001');

        expect(identifier.toString()).toBe('PFO-001');
    });
});