import { isValidSavedGoal } from './goals-storage.js';

export function validateBackupPayload(payload, expectedCurrency) {
    if (!payload || ![1, 2].includes(payload.schemaVersion) || !Array.isArray(payload.records)
        || (payload.schemaVersion === 2 && !Array.isArray(payload.goals))) {
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

    const goals = [];
    const seenGoalIds = new Set();
    if (payload.schemaVersion === 2) {
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

    return {
        records,
        goals,
        includesGoals: payload.schemaVersion === 2
    };
}
