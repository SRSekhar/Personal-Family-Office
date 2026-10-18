export function calculateFinancialTotals(records) {
    if (!Array.isArray(records)) {
        throw new TypeError('Financial records must be an array.');
    }

    let assets = 0;
    let liabilities = 0;

    for (const record of records) {
        if (!record || !['asset', 'liability'].includes(record.type)
            || !Number.isFinite(record.value) || record.value < 0) {
            throw new TypeError('Financial records must have a valid type and a finite non-negative value.');
        }

        if (record.type === 'asset') {
            assets += record.value;
            if (!Number.isFinite(assets)) {
                throw new RangeError('Total assets exceed the supported numeric range.');
            }
        } else {
            liabilities += record.value;
            if (!Number.isFinite(liabilities)) {
                throw new RangeError('Total liabilities exceed the supported numeric range.');
            }
        }
    }

    const netWorth = assets - liabilities;
    if (!Number.isFinite(netWorth)) {
        throw new RangeError('Net worth exceeds the supported numeric range.');
    }

    return { assets, liabilities, netWorth };
}
