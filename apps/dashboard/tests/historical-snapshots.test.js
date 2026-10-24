import { describe, expect, it } from 'vitest';
import {
    captureHistoricalSnapshot,
    summarizeHistoricalSnapshots,
    validateHistoricalSnapshots
} from '../historical-snapshots.js';

const records2022 = [
    { id: 'cash', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 100000 },
    { id: 'loan', name: 'Home loan', category: 'Home loan', type: 'liability', value: 50000 }
];
const records2024 = [
    { id: 'cash', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 150000 },
    { id: 'loan', name: 'Home loan', category: 'Home loan', type: 'liability', value: 30000 }
];
const snapshots = [
    { date: '2022-12-31', currency: 'INR', records: records2022 },
    { date: '2024-12-31', currency: 'INR', records: records2024 }
];

describe('historical financial snapshots', () => {
    it('validates and sorts dated snapshots without inventing missing years', () => {
        const result = validateHistoricalSnapshots([...snapshots].reverse(), 'INR');
        expect(result.map((snapshot) => snapshot.date)).toEqual(['2022-12-31', '2024-12-31']);
        expect(result).toHaveLength(2);
        expect(result[1].totals).toEqual({ assets: 150000, liabilities: 30000, netWorth: 120000 });
    });

    it('captures an immutable copy of the current balance sheet on a unique date', () => {
        const result = captureHistoricalSnapshot({
            records: records2024, date: '2025-12-31', currency: 'INR', existingSnapshots: snapshots
        });
        expect(result.map((snapshot) => snapshot.date)).toEqual(['2022-12-31', '2024-12-31', '2025-12-31']);
        expect(result[2].records).toEqual(records2024);
        expect(result[2].totals.netWorth).toBe(120000);
        expect(() => captureHistoricalSnapshot({
            records: records2024, date: '2024-12-31', currency: 'INR', existingSnapshots: snapshots
        })).toThrow('already exists');
    });

    it('calculates change from the previous available snapshot and leaves missing years absent', () => {
        expect(summarizeHistoricalSnapshots(snapshots, 'INR')).toEqual([
            {
                date: '2022-12-31', currency: 'INR', recordCount: 2,
                assets: 100000, liabilities: 50000, netWorth: 50000,
                netWorthChange: null, netWorthChangePercent: null
            },
            {
                date: '2024-12-31', currency: 'INR', recordCount: 2,
                assets: 150000, liabilities: 30000, netWorth: 120000,
                netWorthChange: 70000, netWorthChangePercent: 140
            }
        ]);
    });

    it.each([
        ['impossible calendar date', [{ ...snapshots[0], date: '2023-02-29' }]],
        ['duplicate date', [snapshots[0], { ...snapshots[1], date: snapshots[0].date }]],
        ['currency mismatch', [{ ...snapshots[0], currency: 'USD' }]],
        ['duplicate record IDs', [{ ...snapshots[0], records: [records2022[0], records2022[0]] }],
        ['invalid record value', [{ ...snapshots[0], records: [{ ...records2022[0], value: -1 }] }]
    ])('rejects %s', (_label, invalid) => {
        expect(() => validateHistoricalSnapshots(invalid, 'INR')).toThrow();
    });

    it('rejects malformed capture dates and non-finite totals', () => {
        expect(() => captureHistoricalSnapshot({
            records: records2024, date: '2024-02-30', currency: 'INR'
        })).toThrow('real calendar date');
        expect(() => captureHistoricalSnapshot({
            records: [{ id: 'a', name: 'A', category: 'Other', type: 'asset', value: Number.MAX_VALUE },
                { id: 'b', name: 'B', category: 'Other', type: 'asset', value: Number.MAX_VALUE }],
            date: '2025-01-01', currency: 'INR'
        })).toThrow('numeric range');
    });
});
