import { describe, expect, it, vi } from 'vitest';
import { GOALS_STORAGE_KEY, isValidSavedGoal, readSavedGoals, saveSavedGoals } from '../goals-storage.js';

const goal = {
    id: 'goal-1',
    name: 'Emergency fund',
    targetAmount: 500000,
    currentAmount: 125000,
    targetDate: '2027-12-31',
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z'
};

describe('saved financial goal validation', () => {
    it('accepts a complete valid goal', () => {
        expect(isValidSavedGoal(goal)).toBe(true);
    });

    it.each([
        ['empty identifier', { id: ' ' }],
        ['empty name', { name: ' ' }],
        ['overlong name', { name: 'x'.repeat(81) }],
        ['zero target', { targetAmount: 0 }],
        ['negative target', { targetAmount: -1 }],
        ['negative progress', { currentAmount: -1 }],
        ['non-finite target', { targetAmount: Number.POSITIVE_INFINITY }],
        ['unrenderable progress ratio', { targetAmount: 0.01, currentAmount: Number.MAX_VALUE }],
        ['impossible calendar date', { targetDate: '2027-02-29' }],
        ['malformed calendar date', { targetDate: '31-12-2027' }],
        ['invalid creation timestamp', { createdAt: 'not-a-date' }],
        ['invalid update timestamp', { updatedAt: 'not-a-date' }]
    ])('rejects %s', (_label, changes) => {
        expect(isValidSavedGoal({ ...goal, ...changes })).toBe(false);
    });
});

describe('readSavedGoals', () => {
    it('reads a valid collection and its dedicated storage key', () => {
        const storage = { getItem: vi.fn(() => JSON.stringify([goal])) };
        expect(readSavedGoals(storage)).toEqual({ ok: true, records: [goal] });
        expect(storage.getItem).toHaveBeenCalledWith(GOALS_STORAGE_KEY);
    });

    it('rejects the whole collection if any item is invalid', () => {
        const storage = { getItem: vi.fn(() => JSON.stringify([goal, { ...goal, id: 'bad', targetAmount: 0 }])) };
        expect(readSavedGoals(storage)).toEqual({ ok: false, records: [] });
    });

    it('rejects duplicate goal IDs', () => {
        const storage = { getItem: vi.fn(() => JSON.stringify([goal, { ...goal, name: 'Duplicate' }])) };
        expect(readSavedGoals(storage)).toEqual({ ok: false, records: [] });
    });

    it('fails closed if local storage cannot be read', () => {
        expect(readSavedGoals({ getItem: () => { throw new Error('unavailable'); } }))
            .toEqual({ ok: false, records: [] });
    });
});

describe('saveSavedGoals', () => {
    it('writes valid goals to a separate key from financial records', () => {
        const storage = { setItem: vi.fn() };
        expect(saveSavedGoals(storage, [goal])).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(GOALS_STORAGE_KEY, JSON.stringify([goal]));
        expect(GOALS_STORAGE_KEY).not.toBe('pfo-os.dashboard.private.v1');
    });

    it('rejects invalid or duplicate goals without writing partial data', () => {
        const storage = { setItem: vi.fn() };
        expect(saveSavedGoals(storage, [{ ...goal, targetAmount: 0 }])).toBe(false);
        expect(saveSavedGoals(storage, [goal, { ...goal, name: 'Duplicate' }])).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('preserves the prior saved value if the browser rejects a write', () => {
        const storage = { setItem: vi.fn(() => { throw new Error('quota exceeded'); }) };
        expect(saveSavedGoals(storage, [goal])).toBe(false);
    });
});
