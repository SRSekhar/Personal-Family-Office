import { describe, expect, it } from 'vitest';
import { validateBackupPayload } from '../backup.js';

const validBackup = {
    schemaVersion: 1,
    currency: 'INR',
    records: [
        { name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 1250 },
        { name: 'Home loan', category: 'Home loan', type: 'liability', value: 500 }
    ]
};

describe('validateBackupPayload', () => {
    it('accepts a supported backup in the workspace currency', () => {
        expect(validateBackupPayload(validBackup, 'INR')).toEqual(validBackup.records);
    });

    it('rejects a backup with a different currency before returning records', () => {
        expect(() => validateBackupPayload({ ...validBackup, currency: 'USD' }, 'INR'))
            .toThrow('Backup currency must be INR');
    });

    it('rejects a backup with a missing currency', () => {
        const withoutCurrency = { schemaVersion: 1, records: validBackup.records };
        expect(() => validateBackupPayload(withoutCurrency, 'INR'))
            .toThrow('Backup currency must be INR');
    });

    it('rejects unsupported schemas', () => {
        expect(() => validateBackupPayload({ ...validBackup, schemaVersion: 2 }, 'INR'))
            .toThrow('Unsupported backup format');
    });

    it('rejects invalid records without partially returning an import', () => {
        const invalidBackup = {
            ...validBackup,
            records: [...validBackup.records, { name: '', category: 'Other', type: 'asset', value: 1 }]
        };
        expect(() => validateBackupPayload(invalidBackup, 'INR'))
            .toThrow('invalid financial record');
    });

    it('trims record names and categories', () => {
        const backup = {
            schemaVersion: 1,
            currency: 'INR',
            records: [{ name: ' Savings ', category: ' Cash & deposits ', type: 'asset', value: 1250 }]
        };
        expect(validateBackupPayload(backup, 'INR')).toEqual([
            { name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 1250 }
        ]);
    });
});
