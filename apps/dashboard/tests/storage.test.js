import { describe, expect, it, vi } from 'vitest';
import { persistJson, readJsonArray } from '../storage.js';

describe('persistJson', () => {
    it('writes the complete next value as JSON', () => {
        const storage = { setItem: vi.fn() };
        const value = [{ id: 'record-1', name: 'Savings', value: 1250 }];

        expect(persistJson(storage, 'pfo-records', value)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledOnce();
        expect(storage.setItem).toHaveBeenCalledWith('pfo-records', JSON.stringify(value));
    });

    it('returns false when storage rejects a write', () => {
        const storage = { setItem: vi.fn(() => { throw new Error('Quota exceeded'); }) };

        expect(persistJson(storage, 'pfo-records', [{ id: 'record-1' }])).toBe(false);
    });

    it('returns false when the value cannot be serialized', () => {
        const storage = { setItem: vi.fn() };
        const value = {};
        value.self = value;

        expect(persistJson(storage, 'pfo-records', value)).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});

describe('readJsonArray', () => {
    const isRecord = (item) => item && typeof item.id === 'string' && item.id.trim() !== ''
        && Number.isFinite(item.value) && item.value >= 0;

    it('returns an empty array when no saved value exists', () => {
        expect(readJsonArray({ getItem: vi.fn(() => null) }, 'pfo-records', isRecord))
            .toEqual({ ok: true, records: [] });
    });

    it('reads a fully valid saved array', () => {
        const records = [{ id: 'record-1', value: 1250 }];
        expect(readJsonArray({ getItem: vi.fn(() => JSON.stringify(records)) }, 'pfo-records', isRecord))
            .toEqual({ ok: true, records });
    });

    it('rejects malformed JSON without returning a partial dataset', () => {
        expect(readJsonArray({ getItem: vi.fn(() => '{broken') }, 'pfo-records', isRecord))
            .toEqual({ ok: false, records: [] });
    });

    it('rejects a non-array root without returning a partial dataset', () => {
        expect(readJsonArray({ getItem: vi.fn(() => JSON.stringify({ id: 'record-1', value: 1 })) }, 'pfo-records', isRecord))
            .toEqual({ ok: false, records: [] });
    });

    it('rejects the entire dataset when any record is invalid', () => {
        const serialized = JSON.stringify([{ id: 'record-1', value: 1250 }, { id: '', value: -1 }]);
        expect(readJsonArray({ getItem: vi.fn(() => serialized) }, 'pfo-records', isRecord))
            .toEqual({ ok: false, records: [] });
    });

    it('rejects duplicate record identifiers', () => {
        const seenIds = new Set();
        const isUniqueRecord = (item) => {
            if (!isRecord(item) || seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
        };
        const records = [{ id: 'record-1', value: 10 }, { id: 'record-1', value: 20 }];
        expect(readJsonArray({ getItem: vi.fn(() => JSON.stringify(records)) }, 'pfo-records', isUniqueRecord))
            .toEqual({ ok: false, records: [] });
    });

    it('fails closed when browser storage cannot be read', () => {
        const storage = { getItem: vi.fn(() => { throw new Error('Storage unavailable'); }) };
        expect(readJsonArray(storage, 'pfo-records', isRecord)).toEqual({ ok: false, records: [] });
    });
});
