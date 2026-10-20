import { Goal, Money } from '@pfo/models';

export interface GoalProgressInput {
    readonly goal: Goal;
    /** Amount already accumulated toward this goal. */
    readonly currentAmount: Money;
    /** Reference date for deadline calculations; only its UTC calendar date is used. */
    readonly asOf: Date;
}

export interface GoalProgressAnalysis {
    readonly goalId: string;
    readonly goalName: string;
    readonly currency: Money['currency'];
    readonly targetAmount: Money;
    readonly currentAmount: Money;
    /** Amount still needed to reach the target, clamped at zero after reaching it. */
    readonly remainingAmount: Money;
    /** Current amount divided by target amount; deliberately not capped at 100%. */
    readonly progressPercentage: number;
    /** Signed calendar-day difference: positive future deadline, zero today, negative past deadline. */
    readonly daysUntilTarget: number;
    readonly targetReached: boolean;
    /** True only when the deadline has passed and the target has not been reached. */
    readonly overdue: boolean;
}

const MILLISECONDS_PER_DAY = 86_400_000;

function isValidDate(value: Date): boolean {
    return value instanceof Date && Number.isFinite(value.getTime());
}

function utcCalendarDay(value: Date): number {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Analyzes progress toward a domain Goal using an explicitly supplied current
 * amount and reference date. This is a point-in-time description only: it does
 * not infer contribution schedules, forecast returns, or recommend actions.
 */
export function analyzeGoalProgress({
    goal,
    currentAmount,
    asOf
}: GoalProgressInput): GoalProgressAnalysis {
    if (!(goal instanceof Goal)) {
        throw new TypeError('A domain Goal is required.');
    }
    if (!(goal.targetAmount instanceof Money) || !Number.isFinite(goal.targetAmount.amount)
        || goal.targetAmount.amount <= 0) {
        throw new RangeError('Goal target amount must be a positive finite Money value.');
    }
    if (!(currentAmount instanceof Money) || !Number.isFinite(currentAmount.amount)
        || currentAmount.amount < 0) {
        throw new RangeError('Current goal amount must be a non-negative finite Money value.');
    }
    if (currentAmount.currency !== goal.targetAmount.currency) {
        throw new RangeError('Current amount and goal target must use the same currency.');
    }
    if (!isValidDate(goal.targetDate) || !isValidDate(asOf)) {
        throw new RangeError('Goal target date and reference date must be valid dates.');
    }

    const target = goal.targetAmount.amount;
    const current = currentAmount.amount;
    const progressPercentage = (current / target) * 100;
    if (!Number.isFinite(progressPercentage)) {
        throw new RangeError('Goal progress percentage exceeds the supported numeric range.');
    }
    const remaining = Math.max(0, target - current);
    if (!Number.isFinite(remaining)) {
        throw new RangeError('Remaining goal amount exceeds the supported numeric range.');
    }
    const daysUntilTarget = (utcCalendarDay(goal.targetDate) - utcCalendarDay(asOf)) / MILLISECONDS_PER_DAY;
    const targetReached = current >= target;

    return {
        goalId: goal.id.toString(),
        goalName: goal.name,
        currency: goal.targetAmount.currency,
        targetAmount: goal.targetAmount,
        currentAmount,
        remainingAmount: new Money(remaining, goal.targetAmount.currency),
        progressPercentage,
        daysUntilTarget,
        targetReached,
        overdue: daysUntilTarget < 0 && !targetReached
    };
}
