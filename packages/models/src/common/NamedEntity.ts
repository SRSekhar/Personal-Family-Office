import { Entity, Identifier, Guard } from '@pfo/core';

export abstract class NamedEntity extends Entity {
    protected constructor(
        id: Identifier,
        public readonly name: string,
        public readonly description?: string
    ) {
        super(id);

        const result = Guard.againstNullOrWhiteSpace(
            name,
            'name'
        );

        if (result.isFailure) {
            throw new Error(result.error);
        }
    }
}