import { isValidSavedGoal } from './goals-storage.js';
import { summarizeCashFlow, validateCashFlowEntries, validateCashFlowBudgets } from './cashflow-ledger.js';
import { calculateFinancialTotals } from './financial-totals.js';
import { validateHistoricalSnapshots } from './historical-snapshots.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';

export function validateBackupPayload(payload, expectedCurrency) {
    if (!payload || ![1, 2, 3, 4, 5].includes(payload.schemaVersion) || !Array.isArray(payload.records)
        || ([2, 3, 4, 5].includes(payload.schemaVersion) && !Array.isArray(payload.goals))
        || ([3, 4, 5].includes(payload.schemaVersion) && (!Array.isArray(payload.cashFlowEntries) || !Array.isArray(payload.budgets)))
        || ([4, 5].includes(payload.schemaVersion) && !Array.isArray(payload.historicalSnapshots))
        || (payload.schemaVersion === 5 && !['investmentAccounts', 'investmentInstruments', 'investmentTransactions', 'investmentValuations'].every((key) => Array.isArray(payload[key])))) {
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
    if ([2, 3, 4, 5].includes(payload.schemaVersion)) for (const goal of payload.goals) {
        if (!isValidSavedGoal(goal) || seenGoalIds.has(goal.id)) throw new Error('The backup contains an invalid financial goal.');
        seenGoalIds.add(goal.id);
        goals.push({ id: goal.id, name: goal.name.trim(), targetAmount: goal.targetAmount, currentAmount: goal.currentAmount,
            targetDate: goal.targetDate, createdAt: goal.createdAt, updatedAt: goal.updatedAt });
    }
    const includesCashFlow = [3, 4, 5].includes(payload.schemaVersion);
    const includesHistoricalSnapshots = [4, 5].includes(payload.schemaVersion);
    const cashFlowEntries = includesCashFlow ? validateCashFlowEntries(payload.cashFlowEntries) : [];
    const budgets = includesCashFlow ? validateCashFlowBudgets(payload.budgets) : [];
    const historicalSnapshots = includesHistoricalSnapshots ? validateHistoricalSnapshots(payload.historicalSnapshots, expectedCurrency) : [];
    const investmentLedger = payload.schemaVersion === 5 ? validateInvestmentLedgerCollections(payload) : null;
    return {
        records, goals, cashFlowEntries, budgets, historicalSnapshots, ...(investmentLedger ?? {}),
        includesGoals: [2, 3, 4, 5].includes(payload.schemaVersion), includesCashFlow, includesHistoricalSnapshots,
        ...(investmentLedger ? { includesInvestmentLedger: true } : {})
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
        ...(backup.includesInvestmentLedger === true ? {
            includesInvestmentLedger: true, investmentAccountCount: backup.investmentAccounts.length,
            investmentInstrumentCount: backup.investmentInstruments.length, investmentTransactionCount: backup.investmentTransactions.length,
            investmentValuationCount: backup.investmentValuations.length
        } : {})
    };
}
