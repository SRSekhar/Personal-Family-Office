import { describe, expect, it, vi } from 'vitest';
import { persistJson } from '../storage.js';

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
