const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function finiteTotal(values, label) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total)) throw new Error(label + ' exceeds the supported numeric range.');
    return total;
}

export function calculateFinancialHealth({ records, cashFlowEntries, budgets, goals, month }) {
    if (!Array.isArray(records) || !Array.isArray(cashFlowEntries) || !Array.isArray(budgets) || !Array.isArray(goals)) {
        throw new Error('Financial health inputs must be validated lists.');
    }
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) throw new Error('A valid reporting month is required.');

    const assets = finiteTotal(records.filter((item) => item.type === 'asset').map((item) => item.value), 'Asset total');
    const liabilities = finiteTotal(records.filter((item) => item.type === 'liability').map((item) => item.value), 'Liability total');
    const netWorth = assets - liabilities;
    if (!Number.isFinite(netWorth)) throw new Error('Net worth exceeds the supported numeric range.');

    const periodEntries = cashFlowEntries.filter((entry) => entry.date.startsWith(month));
    const income = finiteTotal(periodEntries.filter((entry) => entry.type === 'income').map((entry) => entry.amount), 'Monthly income');
    const expenses = finiteTotal(periodEntries.filter((entry) => entry.type === 'expense').map((entry) => entry.amount), 'Monthly expenses');
    const netCashFlow = income - expenses;
    if (!Number.isFinite(netCashFlow)) throw new Error('Monthly net cash flow exceeds the supported numeric range.');
    const savingsRate = income > 0 ? netCashFlow / income * 100 : null;
    if (savingsRate !== null && !Number.isFinite(savingsRate)) throw new Error('Monthly savings rate is unavailable.');

    const monthBudgets = budgets.filter((item) => item.month === month);
    const actualsByCategory = new Map();
    for (const entry of periodEntries) {
        if (entry.type !== 'expense') continue;
        const key = entry.category.trim().toLocaleLowerCase('en-US');
        const next = (actualsByCategory.get(key) || 0) + entry.amount;
        if (!Number.isFinite(next)) throw new Error('Category expenses exceed the supported numeric range.');
        actualsByCategory.set(key, next);
    }
    const budgetTotal = finiteTotal(monthBudgets.map((item) => item.amount), 'Monthly budget total');
    const actualInBudgetedCategories = finiteTotal(monthBudgets.map((item) =>
        actualsByCategory.get(item.category.trim().toLocaleLowerCase('en-US')) || 0), 'Budgeted-category expenses');
    const overruns = monthBudgets.map((item) => Math.max(0,
        (actualsByCategory.get(item.category.trim().toLocaleLowerCase('en-US')) || 0) - item.amount));
    const totalPositiveOverrun = finiteTotal(overruns, 'Monthly budget overruns');
    const overBudgetCategoryCount = overruns.filter((amount) => amount > 0).length;
    const budgetedCategoryKeys = new Set(monthBudgets.map((item) => item.category.trim().toLocaleLowerCase('en-US')));
    const coveredExpenseCategoryCount = [...actualsByCategory.keys()].filter((key) => budgetedCategoryKeys.has(key)).length;
    const unbudgetedExpenses = Math.max(0, expenses - actualInBudgetedCategories);
    const expenseCoverageRate = expenses > 0 ? actualInBudgetedCategories / expenses * 100 : null;
    if (expenseCoverageRate !== null && !Number.isFinite(expenseCoverageRate)) throw new Error('Budget coverage is unavailable.');

    const goalTargetTotal = finiteTotal(goals.map((goal) => goal.targetAmount), 'Goal target total');
    const goalCurrentTotal = finiteTotal(goals.map((goal) => Math.min(goal.currentAmount, goal.targetAmount)), 'Goal progress total');
    const goalProgressPercent = goalTargetTotal > 0 ? goalCurrentTotal / goalTargetTotal * 100 : null;
    if (goalProgressPercent !== null && !Number.isFinite(goalProgressPercent)) throw new Error('Goal progress is unavailable.');
    const completedGoals = goals.filter((goal) => goal.currentAmount >= goal.targetAmount).length;

    return {
        month, assets, liabilities, netWorth, income, expenses, netCashFlow, savingsRate,
        transactionCount: periodEntries.length, budgetTotal, actualInBudgetedCategories,
        budgetedCategoryCount: monthBudgets.length, overBudgetCategoryCount, totalPositiveOverrun,\n        coveredExpenseCategoryCount, expenseCategoryCount: actualsByCategory.size, unbudgetedExpenses, expenseCoverageRate,
        goalCount: goals.length, completedGoals, goalTargetTotal, goalCurrentTotal, goalProgressPercent
    };
}
