import { isValidSavedGoal } from './goals-storage.js';
import { summarizeCashFlow, validateCashFlowEntries, validateCashFlowBudgets } from './cashflow-ledger.js';
import { calculateFinancialTotals } from './financial-totals.js';
import { validateHistoricalSnapshots } from './historical-snapshots.js';

export function validateBackupPayload(payload, expectedCurrency) {
    if (!payload || ![1, 2, 3, 4].includes(payload.schemaVersion) || !Array.isArray(payload.records)
        || ([2, 3, 4].includes(payload.schemaVersion) && !Array.isArray(payload.goals))
        || ([3, 4].includes(payload.schemaVersion) && (!Array.isArray(payload.cashFlowEntries) || !Array.isArray(payload.budgets)))
        || (payload.schemaVersion === 4 && !Array.isArray(payload.historicalSnapshots))) {
        throw new Error('Unsupported backup format.');
    }
    if (payload.currency !== expectedCurrency) {
        throw new Error(`Backup currency must be ${expectedCurrency}; this file uses ${String(payload.currency ?? 'no currency')}. No records were imported.`);
    }

    const records = payload.records.map((item) => {
        if (!item || typeof item.name !== 'string' || item.name.trim() === ''
            || typeof item.category !== 'string' || item.category.trim() === ''
            || !['asset', 'liability'].includes(item.type)
            || !Number.isFinite(item.value) || item.value < 0) {
            throw new Error('The backup contains an invalid financial record.');
        }
        return {
            name: item.name.trim(),
            category: item.category.trim(),
            type: item.type,
            value: item.value
        };
    });
    // Validate aggregate totals here, not only individual values. Otherwise a
    // backup with individually finite values can overflow net-worth calculations
    // later in the import flow, after the payload has been labelled "validated".
    calculateFinancialTotals(records);

    const goals = [];
    const seenGoalIds = new Set();
    if ([2, 3, 4].includes(payload.schemaVersion)) {
        for (const goal of payload.goals) {
            if (!isValidSavedGoal(goal) || seenGoalIds.has(goal.id)) {
                throw new Error('The backup contains an invalid financial goal.');
            }
            seenGoalIds.add(goal.id);
            goals.push({
                id: goal.id,
                name: goal.name.trim(),
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                targetDate: goal.targetDate,
                createdAt: goal.createdAt,
                updatedAt: goal.updatedAt
            });
        }
    }

    const includesCashFlow = [3, 4].includes(payload.schemaVersion);
    const includesHistoricalSnapshots = payload.schemaVersion === 4;
    const cashFlowEntries = includesCashFlow ? validateCashFlowEntries(payload.cashFlowEntries) : [];
    const budgets = includesCashFlow ? validateCashFlowBudgets(payload.budgets) : [];
    const historicalSnapshots = includesHistoricalSnapshots ? validateHistoricalSnapshots(payload.historicalSnapshots, expectedCurrency) : [];

    return {
        records,
        goals,
        cashFlowEntries,
        budgets,
        historicalSnapshots,
        includesGoals: [2, 3, 4].includes(payload.schemaVersion),
        includesCashFlow,
        includesHistoricalSnapshots
    };
}


/**
 * Summarizes an already validated backup for a user-facing import preview.
 * This function performs no persistence and never reads the current workspace.
 */
export function summarizeValidatedBackup(backup) {
    if (!backup || !Array.isArray(backup.records)
        || !Array.isArray(backup.goals)
        || !Array.isArray(backup.cashFlowEntries)
        || !Array.isArray(backup.budgets)
        || !Array.isArray(backup.historicalSnapshots)
        || typeof backup.includesHistoricalSnapshots !== 'boolean'
        || typeof backup.includesGoals !== 'boolean'
        || typeof backup.includesCashFlow !== 'boolean') {
        throw new TypeError('A validated backup payload is required for preview.');
    }

    const totals = calculateFinancialTotals(backup.records);
    const cashFlow = summarizeCashFlow(backup.cashFlowEntries);
    return {
        recordCount: backup.records.length,
        ...totals,
        includesGoals: backup.includesGoals,
        goalCount: backup.includesGoals ? backup.goals.length : null,
        includesCashFlow: backup.includesCashFlow,
        cashFlowTransactionCount: backup.includesCashFlow ? cashFlow.transactionCount : null,
        cashFlowIncome: backup.includesCashFlow ? cashFlow.income : null,
        cashFlowExpenses: backup.includesCashFlow ? cashFlow.expenses : null,
        cashFlowNet: backup.includesCashFlow ? cashFlow.net : null,
        budgetCount: backup.includesCashFlow ? backup.budgets.length : null,
        includesHistoricalSnapshots: backup.includesHistoricalSnapshots,
        historicalSnapshotCount: backup.includesHistoricalSnapshots ? backup.historicalSnapshots.length : null
    };
}
