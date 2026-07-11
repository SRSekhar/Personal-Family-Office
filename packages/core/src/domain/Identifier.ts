import { randomUUID } from 'node:crypto';

export class Identifier {
    public readonly value: string;

    public constructor(value?: string) {
        this.value = value ?? randomUUID();
    }

    public equals(other: Identifier): boolean {
        return this.value === other.value;
    }

    public toString(): string {
        return this.value;
    }

    public static create(value?: string): Identifier {
        return new Identifier(value);
    }
}