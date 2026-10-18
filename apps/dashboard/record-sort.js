const SORT_ORDERS = new Set(['default', 'name-asc', 'value-desc', 'value-asc']);

export function sortFinancialRecords(records, sortOrder = 'default') {
    if (!Array.isArray(records)) {
        throw new TypeError('Records must be an array.');
    }
    if (!SORT_ORDERS.has(sortOrder)) {
        throw new TypeError('Sort order must be default, name-asc, value-desc, or value-asc.');
    }
    if (sortOrder === 'default') return [...records];

    return records
        .map((record, index) => ({ record, index }))
        .sort((left, right) => {
            let comparison;
            if (sortOrder === 'name-asc') {
                const leftName = String(left.record.name).toLowerCase();
                const rightName = String(right.record.name).toLowerCase();
                comparison = leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
            } else {
                comparison = sortOrder === 'value-desc'
                    ? right.record.value - left.record.value
                    : left.record.value - right.record.value;
            }
            return comparison || left.index - right.index;
        })
        .map(({ record }) => record);
}
