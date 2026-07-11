export interface IConfigurationProvider {
    get<T>(key: string): T;
    getOrDefault<T>(key: string, defaultValue: T): T;
    has(key: string): boolean;
}

export class Configuration implements IConfigurationProvider {
    private readonly values = new Map<string, unknown>();

    public constructor(
        values?: Readonly<Record<string, unknown>>
    ) {
        if (values !== undefined) {
            for (const [key, value] of Object.entries(values)) {
                this.values.set(key, value);
            }
        }
    }

    public get<T>(key: string): T {
        if (!this.values.has(key)) {
            throw new Error(
                `Configuration key '${key}' was not found.`
            );
        }

        return this.values.get(key) as T;
    }

    public getOrDefault<T>(
        key: string,
        defaultValue: T
    ): T {
        if (!this.values.has(key)) {
            return defaultValue;
        }

        return this.values.get(key) as T;
    }

    public has(key: string): boolean {
        return this.values.has(key);
    }

    public set<T>(
        key: string,
        value: T
    ): void {
        this.values.set(key, value);
    }

    public remove(key: string): boolean {
        return this.values.delete(key);
    }

    public clear(): void {
        this.values.clear();
    }

    public toObject(): Readonly<Record<string, unknown>> {
        return Object.freeze(
            Object.fromEntries(this.values)
        );
    }
}