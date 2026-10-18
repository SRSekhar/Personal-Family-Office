export interface GoalProgressInput {
    targetAmount: number;
    currentAmount: number;
    targetDate: string;
    asOfDate?: Date;
}

export interface GoalProgressResult {
    targetAmount: number;
    currentAmount: number;
    amountRemaining: number;
    progressPercent: number;
    daysRemaining: number;
    isComplete: boolean;
    isOverdue: boolean;
}

/** Calculates arithmetic progress toward a financial target without projecting returns. */
export function calculateGoalProgress(input: GoalProgressInput): GoalProgressResult {
    if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
        throw new RangeError('Target amount must be a finite number greater than zero.');
    }
    if (!Number.isFinite(input.currentAmount) || input.currentAmount < 0) {
        throw new RangeError('Current amount must be a finite non-negative number.');
    }
    if (typeof input.targetDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
        throw new RangeError('Target date must be a valid calendar date in YYYY-MM-DD format.');
    }

    const [year, month, day] = input.targetDate.split('-').map(Number);
    const targetTimestamp = Date.UTC(year, month - 1, day);
    const normalizedTarget = new Date(targetTimestamp);
    if (normalizedTarget.getUTCFullYear() !== year || normalizedTarget.getUTCMonth() !== month - 1 || normalizedTarget.getUTCDate() !== day) {
        throw new RangeError('Target date must be a valid calendar date in YYYY-MM-DD format.');
    }

    const asOfDate = input.asOfDate ?? new Date();
    if (!(asOfDate instanceof Date) || !Number.isFinite(asOfDate.getTime())) {
        throw new RangeError('As-of date must be a valid date.');
    }
    const asOfTimestamp = Date.UTC(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
    const amountRemaining = Math.max(0, input.targetAmount - input.currentAmount);
    const progressPercent = input.currentAmount / input.targetAmount * 100;
    const daysRemaining = Math.trunc((targetTimestamp - asOfTimestamp) / 86_400_000);
    if (![amountRemaining, progressPercent, daysRemaining].every(Number.isFinite)) {
        throw new RangeError('Goal progress is outside the supported numeric range.');
    }

    return {
        targetAmount: input.targetAmount,
        currentAmount: input.currentAmount,
        amountRemaining,
        progressPercent,
        daysRemaining,
        isComplete: input.currentAmount >= input.targetAmount,
        isOverdue: daysRemaining < 0 && input.currentAmount < input.targetAmount
    };
}
