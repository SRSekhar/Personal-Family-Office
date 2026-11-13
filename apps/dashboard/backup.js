import { isValidSavedGoal } from './goals-storage.js';
import { summarizeCashFlow, validateCashFlowEntries, validateCashFlowBudgets } from './cashflow-ledger.js';
import { calculateFinancialTotals } from './financial-totals.js';
import { validateHistoricalSnapshots } from './historical-snapshots.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';
import { validateInvestmentCashCollections } from './investment-cash-ledger.js';
import { validateInvestmentAllocationCollections } from './investment-allocation.js';
import { validateInvestmentConcentrationCollections } from './investment-concentration.js';
import { validateInvestmentExposureClassifications } from './investment-exposure.js';

export function validateBackupPayload(payload, expectedCurrency) {
    if (!payload || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(payload.schemaVersion) || !Array.isArray(payload.records)
        || ([2, 3, 4, 5, 6, 7, 8, 9].includes(payload.schemaVersion) && !Array.isArray(payload.goals))
        || ([3, 4, 5, 6, 7, 8, 9].includes(payload.schemaVersion) && (!Array.isArray(payload.cashFlowEntries) || !Array.isArray(payload.budgets)))
        || ([4, 5, 6, 7, 8, 9].includes(payload.schemaVersion) && !Array.isArray(payload.historicalSnapshots))
        || ([5, 6, 7, 8, 9].includes(payload.schemaVersion) && !['investmentAccounts', 'investmentInstruments', 'investmentTransactions', 'investmentValuations'].every((key) => Array.isArray(payload[key])))
        || ([6, 7, 8, 9].includes(payload.schemaVersion) && !['investmentCashAccounts', 'investmentCashMovements', 'investmentCashTransfers', 'investmentCashStatements'].every((key) => Array.isArray(payload[key])))
        || ([7, 8, 9].includes(payload.schemaVersion) && !Array.isArray(payload.investmentAllocationPolicies))
        || ([7, 8, 9].includes(payload.schemaVersion) && payload.allocationPoliciesMigratedFromV6 !== undefined && typeof payload.allocationPoliciesMigratedFromV6 !== 'boolean')
        || ([7, 8].includes(payload.schemaVersion) && payload.allocationPoliciesMigratedFromV6 === true && payload.investmentAllocationPolicies.length !== 0)
        || ([8, 9].includes(payload.schemaVersion) && !Array.isArray(payload.investmentConcentrationPolicies))
        || ([8, 9].includes(payload.schemaVersion) && payload.concentrationPoliciesMigratedFromV7 !== undefined && typeof payload.concentrationPoliciesMigratedFromV7 !== 'boolean')
        || ([8, 9].includes(payload.schemaVersion) && payload.concentrationPoliciesMigratedFromV7 === true && payload.investmentConcentrationPolicies.length !== 0)
        || (payload.schemaVersion === 9 && !Array.isArray(payload.investmentExposureClassifications))
        || (payload.schemaVersion === 9 && payload.exposureClassificationsMigratedFromV8 !== undefined && typeof payload.exposureClassificationsMigratedFromV8 !== 'boolean')
        || (payload.schemaVersion === 9 && payload.exposureClassificationsMigratedFromV8 === true && payload.investmentExposureClassifications.length !== 0)) {
        throw new Error('Unsupported backup format.');
    }
    if (payload.currency !== expectedCurrency) throw new Error(`Backup currency must be ${expectedCurrency}; this file uses ${String(payload.currency ?? 'no currency')}. No records were imported.`);
    const records = payload.records.map((item) => {
        if (!item || typeof item.name !== 'string' || item.name.trim() === '' || typeof item.category !== 'string' || item.category.trim() === ''
            || !['asset', 'liability'].includes(item.type) || !Number.isFinite(item.value) || item.value < 0) throw new Error('The backup contains an invalid financial record.');
        return { name: item.name.trim(), category: item.category.trim(), type: item.type, value: item.value };
    });
    calculateFinancialTotals(records);
    const goals = [];
    const seenGoalIds = new Set();
    if ([2, 3, 4, 5, 6, 7, 8, 9].includes(payload.schemaVersion)) for (const goal of payload.goals) {
        if (!isValidSavedGoal(goal) || seenGoalIds.has(goal.id)) throw new Error('The backup contains an invalid financial goal.');
        seenGoalIds.add(goal.id);
        goals.push({ id: goal.id, name: goal.name.trim(), targetAmount: goal.targetAmount, currentAmount: goal.currentAmount,
            targetDate: goal.targetDate, createdAt: goal.createdAt, updatedAt: goal.updatedAt });
    }
    const includesCashFlow = [3, 4, 5, 6, 7, 8, 9].includes(payload.schemaVersion);
    const includesHistoricalSnapshots = [4, 5, 6, 7, 8, 9].includes(payload.schemaVersion);
    const cashFlowEntries = includesCashFlow ? validateCashFlowEntries(payload.cashFlowEntries) : [];
    const budgets = includesCashFlow ? validateCashFlowBudgets(payload.budgets) : [];
    const historicalSnapshots = includesHistoricalSnapshots ? validateHistoricalSnapshots(payload.historicalSnapshots, expectedCurrency) : [];
    const investmentLedger = [5, 6, 7, 8, 9].includes(payload.schemaVersion) ? validateInvestmentLedgerCollections(payload) : null;
    const cashLedger = [6, 7, 8, 9].includes(payload.schemaVersion) ? validateInvestmentCashCollections(payload) : null;
    const allocationPolicies = [7, 8, 9].includes(payload.schemaVersion) ? validateInvestmentAllocationCollections(payload) : null;
    const concentrationPolicies = [8, 9].includes(payload.schemaVersion) ? validateInvestmentConcentrationCollections(payload) : null;
    const exposureClassifications = payload.schemaVersion === 9 ? { investmentExposureClassifications: validateInvestmentExposureClassifications(payload.investmentExposureClassifications, { instruments: investmentLedger.investmentInstruments }) } : null;
    return {
        records, goals, cashFlowEntries, budgets, historicalSnapshots, ...(investmentLedger ?? {}), ...(cashLedger ?? {}), ...(allocationPolicies ?? {}), ...(concentrationPolicies ?? {}), ...(exposureClassifications ?? {}),
        includesGoals: [2, 3, 4, 5, 6, 7, 8].includes(payload.schemaVersion), includesCashFlow, includesHistoricalSnapshots,
        ...(investmentLedger ? { includesInvestmentLedger: true } : {}),
        ...(payload.schemaVersion >= 6 ? { includesInvestmentCashLedger: true } : {}),
        ...([7, 8].includes(payload.schemaVersion) && payload.allocationPoliciesMigratedFromV6 !== true ? { includesInvestmentAllocationPolicies: true } : {}),
        ...([8, 9].includes(payload.schemaVersion) && payload.concentrationPoliciesMigratedFromV7 !== true ? { includesInvestmentConcentrationPolicies: true } : {})
    };
}

/** Summarizes an already validated backup for a user-facing import preview. */
export function summarizeValidatedBackup(backup) {
    if (!backup || !Array.isArray(backup.records) || !Array.isArray(backup.goals) || !Array.isArray(backup.cashFlowEntries)
        || !Array.isArray(backup.budgets) || !Array.isArray(backup.historicalSnapshots)
        || typeof backup.includesHistoricalSnapshots !== 'boolean' || typeof backup.includesGoals !== 'boolean'
        || typeof backup.includesCashFlow !== 'boolean') throw new TypeError('A validated backup payload is required for preview.');
    const totals = calculateFinancialTotals(backup.records);
    const cashFlow = summarizeCashFlow(backup.cashFlowEntries);
    return {
        recordCount: backup.records.length, ...totals, includesGoals: backup.includesGoals, goalCount: backup.includesGoals ? backup.goals.length : null,
        includesCashFlow: backup.includesCashFlow, cashFlowTransactionCount: backup.includesCashFlow ? cashFlow.transactionCount : null,
        cashFlowIncome: backup.includesCashFlow ? cashFlow.income : null, cashFlowExpenses: backup.includesCashFlow ? cashFlow.expenses : null,
        cashFlowNet: backup.includesCashFlow ? cashFlow.net : null, budgetCount: backup.includesCashFlow ? backup.budgets.length : null,
        includesHistoricalSnapshots: backup.includesHistoricalSnapshots,
        historicalSnapshotCount: backup.includesHistoricalSnapshots ? backup.historicalSnapshots.length : null,
        ...(backup.includesInvestmentCashLedger === true ? {
            includesInvestmentCashLedger: true, investmentCashAccountCount: backup.investmentCashAccounts.length,
            investmentCashMovementCount: backup.investmentCashMovements.length, investmentCashTransferCount: backup.investmentCashTransfers.length,
            investmentCashStatementCount: backup.investmentCashStatements.length
        } : {}),
        ...(backup.includesInvestmentAllocationPolicies === true ? { includesInvestmentAllocationPolicies: true,
            investmentAllocationPolicyCount: backup.investmentAllocationPolicies.length
        } : {}),
        ...(backup.includesInvestmentConcentrationPolicies === true ? { includesInvestmentConcentrationPolicies: true,
            investmentConcentrationPolicyCount: backup.investmentConcentrationPolicies.length
        } : {}),
        ...(backup.includesInvestmentExposureClassifications === true ? { includesInvestmentExposureClassifications: true,
            investmentExposureClassificationCount: backup.investmentExposureClassifications.length
        } : {}),
        ...(backup.includesInvestmentLedger === true ? {
            includesInvestmentLedger: true, investmentAccountCount: backup.investmentAccounts.length,
            investmentInstrumentCount: backup.investmentInstruments.length, investmentTransactionCount: backup.investmentTransactions.length,
            investmentValuationCount: backup.investmentValuations.length
        } : {})
    };
}
