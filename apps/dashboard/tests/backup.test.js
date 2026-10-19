import { describe, expect, it } from 'vitest';
import { validateBackupPayload } from '../backup.js';

const validRecords = [
    { name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 1250 },
    { name: 'Home loan', category: 'Home loan', type: 'liability', value: 500 }
];
const validGoal = {
    id: 'goal-1',
    name: 'Emergency fund',
    targetAmount: 500000,
    currentAmount: 125000,
    targetDate: '2027-12-31',
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z'
};
const validBackup = { schemaVersion: 1, currency: 'INR', records: validRecords };

describe('validateBackupPayload', () => {
    it('accepts a legacy version 1 backup and indicates goals are absent', () => {
        expect(validateBackupPayload(validBackup, 'INR')).toEqual({
            records: validRecords,
            goals: [],
            includesGoals: false
        });
    });

    it('accepts version 2 backups with valid goals', () => {
        expect(validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords, goals: [validGoal]
        }, 'INR')).toEqual({
            records: validRecords,
            goals: [validGoal],
            includesGoals: true
        });
    });

    it('allows an empty goals collection in a version 2 backup', () => {
        expect(validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords, goals: []
        }, 'INR')).toMatchObject({ records: validRecords, goals: [], includesGoals: true });
    });

    it('rejects a backup with a different currency before returning records', () => {
        expect(() => validateBackupPayload({ ...validBackup, currency: 'USD' }, 'INR'))
            .toThrow('Backup currency must be INR');
    });

    it('rejects a backup with a missing currency', () => {
        expect(() => validateBackupPayload({ schemaVersion: 1, records: validRecords }, 'INR'))
            .toThrow('Backup currency must be INR');
    });

    it('rejects unsupported schemas and malformed version 2 shape', () => {
        expect(() => validateBackupPayload({ ...validBackup, schemaVersion: 3 }, 'INR'))
            .toThrow('Unsupported backup format');
        expect(() => validateBackupPayload({ ...validBackup, schemaVersion: 2 }, 'INR'))
            .toThrow('Unsupported backup format');
    });

    it('rejects invalid records without partially returning an import', () => {
        const invalidBackup = {
            ...validBackup,
            records: [...validRecords, { name: '', category: 'Other', type: 'asset', value: 1 }]
        };
        expect(() => validateBackupPayload(invalidBackup, 'INR'))
            .toThrow('invalid financial record');
    });

    it('trims record names and categories', () => {
        expect(validateBackupPayload({
            schemaVersion: 1,
            currency: 'INR',
            records: [{ name: ' Savings ', category: ' Cash & deposits ', type: 'asset', value: 1250 }]
        }, 'INR')).toMatchObject({
            records: [{ name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 1250 }],
            includesGoals: false
        });
    });

    it.each([
        ['invalid target', { targetAmount: 0 }],
        ['invalid calendar date', { targetDate: '2027-02-29' }],
        ['invalid timestamp', { updatedAt: 'not-a-date' }]
    ])('rejects a goal with %s', (_label, changes) => {
        expect(() => validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords, goals: [{ ...validGoal, ...changes }]
        }, 'INR')).toThrow('invalid financial goal');
    });

    it('rejects duplicate goal IDs', () => {
        expect(() => validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords,
            goals: [validGoal, { ...validGoal, name: 'Duplicate' }]
        }, 'INR')).toThrow('invalid financial goal');
    });

    it('strips unknown fields from imported goals', () => {
        const result = validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords,
            goals: [{ ...validGoal, unexpected: 'not persisted' }]
        }, 'INR');
        expect(result.goals[0]).not.toHaveProperty('unexpected');
    });
});
