function assertFiniteNonNegative(name, value) {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite non-negative number.`);
    }
}

function escapeCsvText(value) {
    const text = String(value ?? '');
    const safeText = /^[=+\-@]/u.test(text.trimStart()) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
}

function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Export validated saved-goal progress with spreadsheet-safe user-entered names. */
export function goalProgressToCsv(goals) {
    if (!Array.isArray(goals)) throw new TypeError('Goals must be an array.');
    const rows = goals.map((goal) => {
        if (!goal || typeof goal.name !== 'string' || !goal.name.trim() || goal.name.length > 80) {
            throw new TypeError('Every exported goal must have a valid name.');
        }
        assertFiniteNonNegative('Target amount', goal.targetAmount);
        if (goal.targetAmount === 0) throw new RangeError('Target amount must be greater than zero.');
        assertFiniteNonNegative('Current amount', goal.currentAmount);
        assertFiniteNonNegative('Amount remaining', goal.amountRemaining);
        assertFiniteNonNegative('Progress percentage', goal.progressPercent);
        if (goal.amountRemaining !== Math.max(0, goal.targetAmount - goal.currentAmount)
            || goal.progressPercent !== goal.currentAmount / goal.targetAmount * 100) {
            throw new RangeError('Goal progress values do not reconcile to the target and current amounts.');
        }
        if (!isCalendarDate(goal.targetDate)) throw new RangeError('Every exported goal must have a valid target date.');
        if (!Number.isInteger(goal.daysRemaining)) throw new RangeError('Days remaining must be an integer.');
        if (!['Goal reached', 'Past target date', 'In progress'].includes(goal.status)) {
            throw new RangeError('Every exported goal must have a valid status.');
        }
        if (goal.monthlyContributionNeeded !== null) {
            assertFiniteNonNegative('Monthly contribution needed', goal.monthlyContributionNeeded);
        }
        return [
            escapeCsvText(goal.name),
            String(goal.targetAmount),
            String(goal.currentAmount),
            String(goal.amountRemaining),
            String(goal.progressPercent),
            goal.targetDate,
            String(goal.daysRemaining),
            escapeCsvText(goal.status),
            goal.monthlyContributionNeeded === null ? '' : String(goal.monthlyContributionNeeded)
        ];
    });
    const header = [
        'Goal name', 'Target amount (INR)', 'Current amount (INR)', 'Amount remaining (INR)',
        'Progress (%)', 'Target date', 'Days remaining', 'Status',
        'Monthly pace needed (INR; no returns assumed)'
    ];
    return [header.join(','), ...rows.map((row) => row.join(','))].join('\r\n') + '\r\n';
}
