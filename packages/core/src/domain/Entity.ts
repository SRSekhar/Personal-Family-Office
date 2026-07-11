import { Identifier } from './Identifier.js';

export abstract class Entity<TId extends Identifier = Identifier> {
    protected constructor(
        public readonly id: TId
    ) {}

    public equals(object?: Entity<TId>): boolean {
        if (object === undefined) {
            return false;
        }

        if (this === object) {
            return true;
        }

        if (this.constructor !== object.constructor) {
            return false;
        }

        return this.id.equals(object.id);
    }

    public toString(): string {
        return `${this.constructor.name} (${this.id})`;
    }
}