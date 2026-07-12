export class Dictionary<TKey extends PropertyKey, TValue> {
    private readonly items = new Map<TKey, TValue>();

    public set(key: TKey, value: TValue): void {
        this.items.set(key, value);
    }

    public get(key: TKey): TValue | undefined {
        return this.items.get(key);
    }

    public has(key: TKey): boolean {
        return this.items.has(key);
    }

    public remove(key: TKey): boolean {
        return this.items.delete(key);
    }

    public clear(): void {
        this.items.clear();
    }

    public keys(): readonly TKey[] {
    return [...this.items.keys()];
    }

    public values(): readonly TValue[] {
        return [...this.items.values()];
    }

    public entries(): ReadonlyArray<readonly [TKey, TValue]> {
        return [...this.items.entries()];
    }

    public get count(): number {
        return this.items.size;
    }

    public get isEmpty(): boolean {
        return this.items.size === 0;
    }

    public toMap(): ReadonlyMap<TKey, TValue> {
        return new Map(this.items);
    }
}