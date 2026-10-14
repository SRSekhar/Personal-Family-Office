export function persistJson(storage, key, value) {
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function readJsonArray(storage, key, isValidItem) {
    try {
        const serialized = storage.getItem(key);
        if (serialized === null) return { ok: true, records: [] };

        const parsed = JSON.parse(serialized);
        if (!Array.isArray(parsed) || !parsed.every(isValidItem)) {
            return { ok: false, records: [] };
        }

        return { ok: true, records: parsed };
    } catch {
        return { ok: false, records: [] };
    }
}
