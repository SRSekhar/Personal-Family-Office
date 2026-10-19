import { persistJson, readJsonArray } from './storage.js';

export const GOALS_STORAGE_KEY = 'pfo-os.dashboard.goals.v1';

function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidSavedGoal(goal) {
    return Boolean(goal
        && typeof goal.id === 'string' && goal.id.trim()
        && typeof goal.name === 'string' && goal.name.trim() && goal.name.length <= 80
        && Number.isFinite(goal.targetAmount) && goal.targetAmount > 0
        && Number.isFinite(goal.currentAmount) && goal.currentAmount >= 0
        && Number.isFinite(goal.targetAmount - Math.min(goal.currentAmount, goal.targetAmount))
        && isCalendarDate(goal.targetDate)
        && typeof goal.createdAt === 'string' && Number.isFinite(Date.parse(goal.createdAt))
        && typeof goal.updatedAt === 'string' && Number.isFinite(Date.parse(goal.updatedAt)));
}

export function readSavedGoals(storage) {
    const seenIds = new Set();
    const result = readJsonArray(storage, GOALS_STORAGE_KEY, (goal) => {
        if (!isValidSavedGoal(goal) || seenIds.has(goal.id)) return false;
        seenIds.add(goal.id);
        return true;
    });
    return result;
}

export function saveSavedGoals(storage, goals) {
    if (!Array.isArray(goals)) return false;
    const seenIds = new Set();
    for (const goal of goals) {
        if (!isValidSavedGoal(goal) || seenIds.has(goal.id)) return false;
        seenIds.add(goal.id);
    }
    return persistJson(storage, GOALS_STORAGE_KEY, goals);
}
