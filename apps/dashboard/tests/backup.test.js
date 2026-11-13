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


describe('version 6 investment cash-ledger backup validation', () => {
    const version6 = {
        schemaVersion: 6, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [{ id: 'transaction-1', accountId: 'account-1', instrumentId: 'instrument-1', type: 'Purchase',
            cashAmount: { amount: -200, currency: 'INR' }, quantity: 2, unitPrice: { amount: 100, currency: 'INR' },
            date: '2026-10-01T00:00:00.000Z', recordedAt: '2026-10-02T00:00:00.000Z' }],
        investmentValuations: [{ instrumentId: 'instrument-1', price: { amount: 110, currency: 'INR' },
            asOf: '2026-10-03T00:00:00.000Z', recordedAt: '2026-10-03T00:00:00.000Z', sourceType: 'manual', sourceName: 'User-entered' }],
        investmentCashAccounts: [{ id: 'cash-1', investmentAccountId: 'account-1', name: 'Broker cash', currency: 'INR', createdAt: '2026-10-01T00:00:00.000Z' }],
        investmentCashMovements: [{ id: 'opening-1', cashAccountId: 'cash-1', type: 'OpeningBalance',
            amount: { amount: 500, currency: 'INR' }, effectiveAt: '2026-10-01T00:00:00.000Z',
            recordedAt: '2026-10-01T00:00:00.000Z', openingBalanceSource: 'statement' }],
        investmentCashTransfers: [], investmentCashStatements: []
    };

    it('validates all four cash-ledger collections and preserves them in the normalized backup', () => {
        const result = validateBackupPayload(version6, 'INR');
        expect(result.includesInvestmentCashLedger).toBe(true);
        expect(result.investmentCashAccounts).toEqual(version6.investmentCashAccounts);
        expect(result.investmentCashMovements).toEqual(version6.investmentCashMovements);
        expect(summarizeValidatedBackup(result)).toMatchObject({
            includesInvestmentCashLedger: true, investmentCashAccountCount: 1, investmentCashMovementCount: 1,
            investmentCashTransferCount: 0, investmentCashStatementCount: 0
        });
    });

    it('requires all cash collections and validates references before import', () => {
        const missing = { ...version6 }; delete missing.investmentCashStatements;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow('Unsupported backup format');
        const invalid = structuredClone(version6);
        invalid.investmentCashMovements[0].cashAccountId = 'unknown';
        expect(() => validateBackupPayload(invalid, 'INR')).toThrow(/unknown cash account/i);
    });

    it('keeps schema-v5 backup imports valid without inventing cash accounts or balances', () => {
        const legacy = structuredClone(version6);
        legacy.schemaVersion = 5;
        delete legacy.investmentCashAccounts; delete legacy.investmentCashMovements;
        delete legacy.investmentCashTransfers; delete legacy.investmentCashStatements;
        const result = validateBackupPayload(legacy, 'INR');
        expect(result.includesInvestmentLedger).toBe(true);
        expect(result).not.toHaveProperty('includesInvestmentCashLedger');
        expect(result).not.toHaveProperty('investmentCashAccounts');
        expect(result).not.toHaveProperty('investmentCashMovements');
    });
});


describe('version 7 investment allocation policy backup validation', () => {
    const version7 = {
        schemaVersion: 7, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [], investmentValuations: [],
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [],
        investmentAllocationPolicies: [{
            id: 'allocation-policy-v1', policySetId: 'long-term', version: 1, name: 'Long-term allocation',
            currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType',
            effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
            targets: [{ key: 'MutualFund', weightPercent: 100 }]
        }]
    };

    it('validates, retains and previews the append-only allocation policy collection', () => {
        const validated = validateBackupPayload(version7, 'INR');
        expect(validated.includesInvestmentAllocationPolicies).toBe(true);
        expect(validated.investmentAllocationPolicies).toEqual(version7.investmentAllocationPolicies);
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesInvestmentAllocationPolicies: true, investmentAllocationPolicyCount: 1,
            includesInvestmentLedger: true, includesInvestmentCashLedger: true
        });
    });

    it('requires the policy collection and validates policy references and target totals', () => {
        const missing = { ...version7 }; delete missing.investmentAllocationPolicies;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow('Unsupported backup format');
        const wrongInstrument = structuredClone(version7);
        wrongInstrument.investmentAllocationPolicies[0].groupBy = 'instrument';
        wrongInstrument.investmentAllocationPolicies[0].targets = [{ key: 'missing-instrument', weightPercent: 100 }];
        expect(() => validateBackupPayload(wrongInstrument, 'INR')).toThrow(/existing instrument/i);
        const invalidWeights = structuredClone(version7);
        invalidWeights.investmentAllocationPolicies[0].targets[0].weightPercent = 90;
        expect(() => validateBackupPayload(invalidWeights, 'INR')).toThrow(/total 100%/);
    });

    it('does not treat the empty collection added by v6 migration as an imported policy collection', () => {
        const migrated = { ...version7, investmentAllocationPolicies: [], allocationPoliciesMigratedFromV6: true };
        const validated = validateBackupPayload(migrated, 'INR');
        expect(validated.investmentAllocationPolicies).toEqual([]);
        expect(validated).not.toHaveProperty('includesInvestmentAllocationPolicies');
        const inconsistent = { ...migrated, investmentAllocationPolicies: version7.investmentAllocationPolicies };
        expect(() => validateBackupPayload(inconsistent, 'INR')).toThrow(/Unsupported backup format/);
    });

    it('keeps schema-v6 imports compatible and does not claim allocation policies were included', () => {
        const legacy = structuredClone(version7);
        legacy.schemaVersion = 6;
        delete legacy.investmentAllocationPolicies;
        const validated = validateBackupPayload(legacy, 'INR');
        expect(validated).not.toHaveProperty('includesInvestmentAllocationPolicies');
        expect(validated).not.toHaveProperty('investmentAllocationPolicies');
    });
});

describe('version 8 user-defined concentration policy backup validation', () => {
    const version8 = {
        schemaVersion: 8, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [
            { id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' },
            { id: 'instrument-2', name: 'Example Equity', type: 'Equity', currency: 'INR' }
        ],
        investmentTransactions: [], investmentValuations: [],
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [],
        investmentAllocationPolicies: [],
        investmentConcentrationPolicies: [{
            id: 'concentration-v1', policySetId: 'portfolio-limits', version: 1, name: 'User concentration limits',
            currency: 'INR', scope: 'portfolio', groupBy: 'instrumentType',
            effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
            rules: [{ key: 'Equity', maxWeightPercent: 25, operator: '>=' }]
        }]
    };

    it('validates and previews user-authored concentration policies in schema v8', () => {
        const validated = validateBackupPayload(version8, 'INR');
        expect(validated.includesInvestmentConcentrationPolicies).toBe(true);
        expect(validated.investmentConcentrationPolicies).toEqual(version8.investmentConcentrationPolicies);
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesInvestmentConcentrationPolicies: true, investmentConcentrationPolicyCount: 1,
            includesInvestmentAllocationPolicies: true, investmentAllocationPolicyCount: 0
        });
    });

    it('requires the concentration collection and validates group references and explicit limits', () => {
        const missing = { ...version8 }; delete missing.investmentConcentrationPolicies;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow('Unsupported backup format');
        const unknownGroup = structuredClone(version8);
        unknownGroup.investmentConcentrationPolicies[0].rules[0].key = 'UnknownType';
        expect(() => validateBackupPayload(unknownGroup, 'INR')).toThrow(/unsupported instrument type/i);
        const invalidLimit = structuredClone(version8);
        invalidLimit.investmentConcentrationPolicies[0].rules[0].maxWeightPercent = 101;
        expect(() => validateBackupPayload(invalidLimit, 'INR')).toThrow(/from 0 to 100/);
    });

    it('preserves schema-v7 backups and distinguishes a v7-migrated empty collection from user data', () => {
        const legacy = structuredClone(version8);
        legacy.schemaVersion = 7;
        delete legacy.investmentConcentrationPolicies;
        const old = validateBackupPayload(legacy, 'INR');
        expect(old).not.toHaveProperty('includesInvestmentConcentrationPolicies');
        expect(old).not.toHaveProperty('investmentConcentrationPolicies');

        const migrated = { ...version8, investmentConcentrationPolicies: [], concentrationPoliciesMigratedFromV7: true };
        const result = validateBackupPayload(migrated, 'INR');
        expect(result.investmentConcentrationPolicies).toEqual([]);
        expect(result).not.toHaveProperty('includesInvestmentConcentrationPolicies');
        const inconsistent = { ...migrated, investmentConcentrationPolicies: version8.investmentConcentrationPolicies };
        expect(() => validateBackupPayload(inconsistent, 'INR')).toThrow(/Unsupported backup format/);
    });
});


describe('version 9 weighted investment exposure backup validation', () => {
    const version9 = {
        schemaVersion: 9, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [], investmentValuations: [],
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [],
        investmentAllocationPolicies: [], investmentConcentrationPolicies: [],
        investmentExposureClassifications: [{
            id: 'exposure-v1', instrumentId: 'instrument-1', dimensionId: 'sector', dimensionName: 'Sector',
            effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
            sourceType: 'manual', sourceName: 'User-entered',
            allocations: [
                { groupId: 'technology', groupName: 'Technology', weightPercent: 60 },
                { groupId: 'healthcare', groupName: 'Healthcare', weightPercent: 40 }
            ]
        }]
    };

    it('validates and previews weighted classifications with provenance and bitemporal history', () => {
        const validated = validateBackupPayload(version9, 'INR');
        expect(validated.includesInvestmentExposureClassifications).toBe(true);
        expect(validated.investmentExposureClassifications).toEqual(version9.investmentExposureClassifications);
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesInvestmentExposureClassifications: true, investmentExposureClassificationCount: 1,
            includesInvestmentConcentrationPolicies: true, investmentConcentrationPolicyCount: 0
        });
    });

    it('requires the classification collection and validates weights and instrument references', () => {
        const missing = { ...version9 }; delete missing.investmentExposureClassifications;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow('Unsupported backup format');
        const invalidWeights = structuredClone(version9);
        invalidWeights.investmentExposureClassifications[0].allocations[0].weightPercent = 50;
        expect(() => validateBackupPayload(invalidWeights, 'INR')).toThrow(/reconcile to 100%/);
        const unknownInstrument = structuredClone(version9);
        unknownInstrument.investmentExposureClassifications[0].instrumentId = 'missing';
        expect(() => validateBackupPayload(unknownInstrument, 'INR')).toThrow(/unknown investment instrument/i);
    });

    it('preserves schema-v8 imports and recognizes the empty collection created by v8 migration', () => {
        const legacy = structuredClone(version9);
        legacy.schemaVersion = 8;
        delete legacy.investmentExposureClassifications;
        const old = validateBackupPayload(legacy, 'INR');
        expect(old).not.toHaveProperty('includesInvestmentExposureClassifications');
        expect(old).not.toHaveProperty('investmentExposureClassifications');

        const migrated = { ...version9, investmentExposureClassifications: [], exposureClassificationsMigratedFromV8: true };
        const result = validateBackupPayload(migrated, 'INR');
        expect(result.investmentExposureClassifications).toEqual([]);
        expect(result).not.toHaveProperty('includesInvestmentExposureClassifications');
        const inconsistent = { ...migrated, investmentExposureClassifications: version9.investmentExposureClassifications };
        expect(() => validateBackupPayload(inconsistent, 'INR')).toThrow(/Unsupported backup format/);
    });
});


describe('version 10 investment exposure policy backup validation', () => {
    const version10 = {
        schemaVersion: 10, currency: 'INR', records: validRecords, goals: [validGoal],
        cashFlowEntries: [validCashFlowEntry], budgets: [validBudget], historicalSnapshots: [validHistoricalSnapshot],
        investmentAccounts: [{ id: 'account-1', name: 'Brokerage', institution: 'Example', type: 'Brokerage', currency: 'INR' }],
        investmentInstruments: [{ id: 'instrument-1', name: 'Example Fund', type: 'MutualFund', currency: 'INR' }],
        investmentTransactions: [], investmentValuations: [],
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [],
        investmentAllocationPolicies: [], investmentConcentrationPolicies: [],
        investmentExposureClassifications: [{
            id: 'exposure-v1', instrumentId: 'instrument-1', dimensionId: 'sector', dimensionName: 'Sector',
            effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
            sourceType: 'manual', sourceName: 'User-entered',
            allocations: [{ groupId: 'technology', groupName: 'Technology', weightPercent: 100 }]
        }],
        investmentExposurePolicies: [{
            id: 'policy-v1', policySetId: 'sector-limits', version: 1, name: 'Sector limits',
            currency: 'INR', scope: 'portfolio', dimensionId: 'sector', dimensionName: 'Sector',
            effectiveFrom: '2026-01-01', recordedAt: '2026-01-01T00:00:00.000Z',
            rules: [{ groupId: 'technology', maxWeightPercent: 60, operator: '>=' }]
        }]
    };

    it('validates, retains and previews the complete exposure policy history', () => {
        const validated = validateBackupPayload(version10, 'INR');
        expect(validated.includesInvestmentExposurePolicies).toBe(true);
        expect(validated.investmentExposurePolicies).toEqual(version10.investmentExposurePolicies);
        expect(summarizeValidatedBackup(validated)).toMatchObject({
            includesInvestmentExposureClassifications: true, investmentExposureClassificationCount: 1,
            includesInvestmentExposurePolicies: true, investmentExposurePolicyCount: 1
        });
    });

    it('requires policy history and rejects unknown group references or invalid rules', () => {
        const missing = { ...version10 }; delete missing.investmentExposurePolicies;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow(/Unsupported backup format/);
        const unknownGroup = structuredClone(version10);
        unknownGroup.investmentExposurePolicies[0].rules[0].groupId = 'missing-group';
        expect(() => validateBackupPayload(unknownGroup, 'INR')).toThrow(/must exist in a classification/);
        const invalidLimit = structuredClone(version10);
        invalidLimit.investmentExposurePolicies[0].rules[0].maxWeightPercent = 101;
        expect(() => validateBackupPayload(invalidLimit, 'INR')).toThrow(/finite percentage/);
    });

    it('preserves schema-v9 imports and recognizes the empty collection created by v9 migration', () => {
        const legacy = structuredClone(version10);
        legacy.schemaVersion = 9;
        delete legacy.investmentExposurePolicies;
        const old = validateBackupPayload(legacy, 'INR');
        expect(old).not.toHaveProperty('includesInvestmentExposurePolicies');
        expect(old).not.toHaveProperty('investmentExposurePolicies');

        const migrated = { ...version10, investmentExposurePolicies: [], exposurePoliciesMigratedFromV9: true };
        const result = validateBackupPayload(migrated, 'INR');
        expect(result.investmentExposurePolicies).toEqual([]);
        expect(result).not.toHaveProperty('includesInvestmentExposurePolicies');
        const inconsistent = { ...migrated, investmentExposurePolicies: version10.investmentExposurePolicies };
        expect(() => validateBackupPayload(inconsistent, 'INR')).toThrow(/Unsupported backup format/);
    });
});
