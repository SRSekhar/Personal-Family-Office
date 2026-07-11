import { describe, expect, it } from 'vitest';

import { Entity, Identifier } from '../src/index.js';

class TestEntity extends Entity {
    public constructor(id: Identifier) {
        super(id);
    }
}

describe('Entity', () => {
    it('should consider the same instance equal', () => {
        const entity = new TestEntity(
            Identifier.create('ENTITY-001')
        );

        expect(entity.equals(entity)).toBe(true);
    });

    it('should consider entities with the same identifier equal', () => {
        const id = Identifier.create('ENTITY-001');

        const first = new TestEntity(id);
        const second = new TestEntity(id);

        expect(first.equals(second)).toBe(true);
    });

    it('should consider entities with different identifiers unequal', () => {
        const first = new TestEntity(
            Identifier.create('ENTITY-001')
        );

        const second = new TestEntity(
            Identifier.create('ENTITY-002')
        );

        expect(first.equals(second)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
        const entity = new TestEntity(
            Identifier.create('ENTITY-001')
        );

        expect(entity.equals(undefined)).toBe(false);
    });

    it('should return a readable string representation', () => {
        const entity = new TestEntity(
            Identifier.create('ENTITY-001')
        );

        expect(entity.toString()).toContain('TestEntity');
        expect(entity.toString()).toContain('ENTITY-001');
    });
});