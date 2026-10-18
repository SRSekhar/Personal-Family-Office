const RECORD_TYPES = new Set(['all', 'asset', 'liability']);

export function filterFinancialRecords(records, query = '', type = 'all', category = 'all') {
    if (!Array.isArray(records)) {
        throw new TypeError('Records must be an array.');
    }
    if (typeof query !== 'string') {
        throw new TypeError('Search query must be a string.');
    }
    if (!RECORD_TYPES.has(type)) {
        throw new TypeError('Record type filter must be all, asset, or liability.');
    }
    if (typeof category !== 'string' || category.trim() === '') {
        throw new TypeError('Record category filter must be a non-empty string.');
    }

    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
        const matchesType = type === 'all' || record.type === type;
        const matchesCategory = category === 'all' || record.category === category;
        const searchableText = `${record.name} ${record.category} ${record.type}`.toLowerCase();
        return matchesType && matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
}
