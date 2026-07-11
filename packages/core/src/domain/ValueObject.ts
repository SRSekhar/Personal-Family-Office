export abstract class ValueObject<TProperties extends object> {
    protected constructor(
        protected readonly properties: Readonly<TProperties>
    ) {}

    public equals(object?: ValueObject<TProperties>): boolean {
        if (object === undefined) {
            return false;
        }

        if (this === object) {
            return true;
        }

        if (this.constructor !== object.constructor) {
            return false;
        }

        return this.areEqual(
            this.properties,
            object.properties
        );
    }

    public toObject(): Readonly<TProperties> {
        return Object.freeze({
            ...this.properties
        });
    }

    private areEqual(
        left: Readonly<TProperties>,
        right: Readonly<TProperties>
    ): boolean {
        return JSON.stringify(left) === JSON.stringify(right);
    }
}