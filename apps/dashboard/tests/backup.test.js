import { describe, expect, it } from 'vitest';
import { summarizeValidatedBackup, validateBackupPayload } from '../backup.js';

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
            cashFlowEntries: [],
            budgets: [],
            historicalSnapshots: [],
            includesGoals: false,
            includesCashFlow: false,
            includesHistoricalSnapshots: false
        });
    });

    it('accepts version 2 backups with valid goals', () => {
        expect(validateBackupPayload({
            schemaVersion: 2, currency: 'INR', records: validRecords, goals: [validGoal]
        }, 'INR')).toEqual({
            records: validRecords,
            goals: [validGoal],
            cashFlowEntries: [],
            budgets: [],
            historicalSnapshots: [],
            includesGoals: true,
            includesCashFlow: false,
            includesHistoricalSnapshots: false
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
        expect(() => validateBackupPayload({ ...validBackup, schemaVersion: 5 }, 'INR'))
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

const validCashFlowEntry = {
    id: 'entry-1', date: '2026-10-01', type: 'expense', category: 'Food',
    description: 'Groceries', amount: 25, recurring: false
};
const validBudget = { month: '2026-10', category: 'Food', amount: 200 };

describe('version 3 full workspace backup validation', () => {
    const version3 = {
        schemaVersion: 3, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget]
    };

    it('validates all persisted data collections in schema version 3 and preserves compatibility', () => {
        expect(validateBackupPayload(version3, 'INR')).toEqual({
            records: validRecords,
            goals: [validGoal],
            cashFlowEntries: [validCashFlowEntry],
            budgets: [validBudget],
            historicalSnapshots: [],
            includesGoals: true,
            includesCashFlow: true,
            includesHistoricalSnapshots: false
        });
    });

    it('rejects invalid cash-flow entries and duplicate budget categories before restore', () => {
        expect(() => validateBackupPayload({
            ...version3, cashFlowEntries: [{ ...validCashFlowEntry, amount: -1 }]
        }, 'INR')).toThrow('invalid or duplicate transaction');
        expect(() => validateBackupPayload({
            ...version3, budgets: [validBudget, { ...validBudget, category: ' food ' }]
        }, 'INR')).toThrow('duplicate month/category');
    });

    it('rejects a full backup when either cash-flow transactions or budgets are missing', () => {
        expect(() => validateBackupPayload({ ...version3, budgets: undefined }, 'INR')).toThrow('Unsupported backup format');
        expect(() => validateBackupPayload({ ...version3, cashFlowEntries: undefined }, 'INR')).toThrow('Unsupported backup format');
    });
});


describe('validated backup import preview', () => {
    it('summarizes all collections and financial totals for a full workspace backup', () => {
        const validated = validateBackupPayload({
            schemaVersion: 3,
            currency: 'INR',
            records: validRecords,
            goals: [validGoal],
            cashFlowEntries: [validCashFlowEntry],
            budgets: [validBudget]
        }, 'INR');

        expect(summarizeValidatedBackup(validated)).toEqual({
            recordCount: 2,
            assets: 1250,
            liabilities: 500,
            netWorth: 750,
            includesGoals: true,
            goalCount: 1,
            includesCashFlow: true,
            cashFlowTransactionCount: 1,
            cashFlowIncome: 0,
            cashFlowExpenses: 25,
            cashFlowNet: -25,
            budgetCount: 1,
            includesHistoricalSnapshots: false,
            historicalSnapshotCount: null
        });
    });

    it('marks collections absent from legacy backups as not included rather than implying they will be replaced', () => {
        const validated = validateBackupPayload(validBackup, 'INR');
        expect(summarizeValidatedBackup(validated)).toEqual({
            recordCount: 2,
            assets: 1250,
            liabilities: 500,
            netWorth: 750,
            includesGoals: false,
            goalCount: null,
            includesCashFlow: false,
            cashFlowTransactionCount: null,
            cashFlowIncome: null,
            cashFlowExpenses: null,
            cashFlowNet: null,
            budgetCount: null,
            includesHistoricalSnapshots: false,
            historicalSnapshotCount: null
        });
    });

    it('rejects an unvalidated preview input', () => {
        expect(() => summarizeValidatedBackup({ records: [] })).toThrow('validated backup payload');
    });
});

const validHistoricalSnapshot = {
    date: '2024-12-31',
    currency: 'INR',
    records: [
        { id: 'snapshot-cash-1', name: 'Savings', category: 'Cash & deposits', type: 'asset', value: 1250 },
        { id: 'snapshot-loan-1', name: 'Home loan', category: 'Home loan', type: 'liability', value: 500 }
    ]
};

describe('version 4 historical full workspace backup validation', () => {
    const version4 = {
        schemaVersion: 4, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot]
    };

    it('validates and normalizes historical snapshots as part of a full workspace backup', () => {
        const validated = validateBackupPayload(version4, 'INR');
        expect(validated.includesHistoricalSnapshots).toBe(true);
        expect(validated.historicalSnapshots).toHaveLength(1);
        expect(validated.historicalSnapshots[0]).toMatchObject({
            date: '2024-12-31', currency: 'INR',
            totals: { assets: 1250, liabilities: 500, netWorth: 750 }
        });
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesHistoricalSnapshots: true, historicalSnapshotCount: 1
        });
    });

    it('rejects malformed history before import', () => {
        expect(() => validateBackupPayload({
            ...version4, historicalSnapshots: [{ ...validHistoricalSnapshot, date: '2024-02-30' }]
        }, 'INR')).toThrow('Historical snapshots contain an invalid date');
        expect(() => validateBackupPayload({ ...version4, historicalSnapshots: undefined }, 'INR'))
            .toThrow('Unsupported backup format');
    });

    it('requires the history collection for schema v4 while old schemas omit it', () => {
        const legacy = validateBackupPayload({
            schemaVersion: 3, currency: 'INR', records: validRecords, goals: [], cashFlowEntries: [], budgets: []
        }, 'INR');
        expect(legacy.includesHistoricalSnapshots).toBe(false);
        expect(legacy.historicalSnapshots).toEqual([]);
    });
});



describe('version 5 investment workspace backup validation', () => {
    const version5 = {
        schemaVersion: 5, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [{ id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
            cashAmount: { amount: -200, currency: 'INR' }, quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
            date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z' }],
        investmentValuations: [{ instrumentId: 'instrument-1', price: { amount: 110, currency: 'INR' },
            asOf: '2026-10-03T00:00:00.000Z', recordedAt: '2026-10-03T00:00:00.000Z',
            sourceType: 'manual', sourceName: 'User-entered' }]
    };

    it('validates and retains all investment collections and provenance', () => {
        const validated = validateBackupPayload(version5, 'INR');
        expect(validated.includesInvestmentLedger).toBe(true);
        expect(validated.investmentAccounts).toEqual(version5.investmentAccounts);
        expect(validated.investmentTransactions[0].id).toBe('transaction-1');
        expect(validated.investmentValuations[0].sourceName).toBe('User-entered');
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesInvestmentLedger: true, investmentAccountCount: 1, investmentInstrumentCount: 1,
            investmentTransactionCount: 1, investmentValuationCount: 1
        });
    });

    it('requires every investment collection in v5 and validates references before import', () => {
        const missing = { ...version5 }; delete missing.investmentValuations;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow('Unsupported backup format');
        const invalid = structuredClone(version5);
        invalid.investmentTransactions[0].instrumentId = 'unknown';
        expect(() => validateBackupPayload(invalid, 'INR')).toThrow('unknown account or instrument');
    });

    it('keeps v1-v4 backup semantics unchanged and does not imply investment data was included', () => {
        const legacy = validateBackupPayload({
            schemaVersion: 4, currency: 'INR', records: validRecords, goals: [], cashFlowEntries: [],
            budgets: [], historicalSnapshots: []
        }, 'INR');
        expect(legacy).not.toHaveProperty('includesInvestmentLedger');
        expect(summarizeValidatedBackup(legacy)).not.toHaveProperty('investmentAccountCount');
    });
});
