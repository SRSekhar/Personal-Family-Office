import { describe, expect, it } from 'vitest';
import { summarizeValidatedBackup, validateBackupPayload } from './backup.js';

function payload(schemaVersion = 13, overrides = {}) {
    return {
        schemaVersion, currency: 'INR', exportedAt: '2026-11-15T00:00:00.000Z',
        records: [], goals: [], cashFlowEntries: [], budgets: [], historicalSnapshots: [],
        investmentAccounts: [], investmentInstruments: [], investmentTransactions: [], investmentValuations: [],
        investmentCashAccounts: [], investmentCashMovements: [], investmentCashTransfers: [], investmentCashStatements: [],
        investmentAllocationPolicies: [], investmentConcentrationPolicies: [], investmentExposureClassifications: [],
        investmentExposurePolicies: [], investmentDrawdownSnapshots: [], investmentDrawdownCalendars: [],
        ...(schemaVersion >= 13 ? { investmentStatementEvidence: [] } : {}),
        ...overrides
    };
}
describe('statement evidence backup compatibility', () => {
    it('accepts schema v13 and includes the statement evidence collection in the validated payload', () => {
        const result = validateBackupPayload(payload(), 'INR');
        expect(result).toMatchObject({ includesInvestmentStatementEvidence: true, investmentStatementEvidence: [] });
        expect(summarizeValidatedBackup(result)).toMatchObject({ includesInvestmentStatementEvidence: true, investmentStatementEvidenceCount: 0 });
    });
    it('rejects schema v13 when the evidence collection is absent or invalid', () => {
        const missing = payload();
        delete missing.investmentStatementEvidence;
        expect(() => validateBackupPayload(missing, 'INR')).toThrow(/unsupported backup format/i);
        expect(() => validateBackupPayload(payload(13, { investmentStatementEvidence: [{ id: 'evidence-1', kind: 'transactions', accountId: 'missing' }] }), 'INR')).toThrow(/unknown investment account/i);
    });
    it('continues to import schema v12 without inventing statement evidence', () => {
        const result = validateBackupPayload(payload(12), 'INR');
        expect(result).not.toHaveProperty('includesInvestmentStatementEvidence');
        expect(result).not.toHaveProperty('investmentStatementEvidence');
    });
});
