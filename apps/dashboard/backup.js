export function validateBackupPayload(payload, expectedCurrency) {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.records)) {
        throw new Error('Unsupported backup format.');
    }
    if (payload.currency !== expectedCurrency) {
        throw new Error(`Backup currency must be ${expectedCurrency}; this file uses ${String(payload.currency ?? 'no currency')}. No records were imported.`);
    }

    return payload.records.map((item) => {
        if (!item || typeof item.name !== 'string' || item.name.trim() === ''
            || typeof item.category !== 'string' || item.category.trim() === ''
            || !['asset', 'liability'].includes(item.type)
            || !Number.isFinite(item.value) || item.value < 0) {
            throw new Error('The backup contains an invalid financial record.');
        }
        return {
            name: item.name.trim(),
            category: item.category.trim(),
            type: item.type,
            value: item.value
        };
    });
}
