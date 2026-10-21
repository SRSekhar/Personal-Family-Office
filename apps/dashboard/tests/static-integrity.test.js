import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const dashboardRoot = new URL('../', import.meta.url);

async function readDashboardFile(name) {
    return readFile(new URL(name, dashboardRoot), 'utf8');
}

describe('asset allocation CSV export contract', () => {
    it('exports category weights and concentration metrics through a local-only action', async () => {
        const [html, app] = await Promise.all([readDashboardFile('index.html'), readDashboardFile('app.js')]);
        expect(html).toContain('id="export-allocation-csv"');
        expect(app).toContain("$('#export-allocation-csv').addEventListener('click', exportAllocationCsv)");
        expect(app).toContain('function exportAllocationCsv()');
        expect(app).toContain('isPrivateWorkspaceAllowed(window.location.hostname)');
        expect(app).toContain("'pfo-os-asset-allocation.csv'");
        expect(app).toContain("'concentration_index_hhi'");
        expect(app).toContain("'effective_category_count'");
        expect(app).toContain("'largest_category_share_percent'");
        expect(app).toContain("text.trimStart()" );
    });
});
describe('balance-sheet ratio CSV export contract', () => {
    it('exports the three shared ratios with explicit numerator, denominator, and unavailable states', async () => {
        const [html, app] = await Promise.all([readDashboardFile('index.html'), readDashboardFile('app.js')]);
        expect(html).toContain('id="export-financial-ratios-csv"');
        expect(app).toContain("addEventListener('click', exportFinancialRatiosCsv)");
        expect(app).toContain("'pfo-os-balance-sheet-ratios.csv'");
        expect(app).toContain("'liabilities_to_assets'");
        expect(app).toContain("'net_worth_to_assets'");
        expect(app).toContain("'assets_to_liabilities'");
        expect(app).toContain("'Unavailable: zero assets'");
        expect(app).toContain("'Unavailable: zero liabilities'");
        expect(app).toContain('isPrivateWorkspaceAllowed(window.location.hostname)');
    });
});
describe('dashboard static integrity', () => {
    it('provides every HTML id referenced by the dashboard controller', async () => {
        const [html, app] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('app.js')
        ]);
        const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
        const idSet = new Set(ids);
        const referencedIds = [...new Set(
            [...app.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map((match) => match[1])
        )];

        expect(ids.length, 'HTML must not contain duplicate ids').toBe(idSet.size);
        expect(referencedIds.filter((id) => !idSet.has(id)), 'controller selectors must exist in HTML').toEqual([]);
    });

    it('loads its local stylesheet and module entry point', async () => {
        const html = await readDashboardFile('index.html');
        expect(html).toMatch(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']\.\/styles\.css["']/i);
        expect(html).toMatch(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\.\/app\.js["']/i);
        await expect(readDashboardFile('styles.css')).resolves.toBeTruthy();
        await expect(readDashboardFile('app.js')).resolves.toBeTruthy();
    });

    it('resolves every relative module import from the controller', async () => {
        const [app, html] = await Promise.all([readDashboardFile('app.js'), readDashboardFile('index.html')]);
        const imports = [...app.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)]
            .map((match) => match[1])
            .filter((specifier) => specifier.startsWith('.') && !specifier.startsWith('./calculators-runtime/') && !specifier.startsWith('./reports-runtime/'));

        expect(imports.length).toBeGreaterThan(0);
        expect(app).toContain("'./calculators-runtime/FireReadiness.js'");
        expect(app).toContain("'./calculators-runtime/RequiredFireContribution.js'");
        expect(app).toContain("'./calculators-runtime/FireScenarioComparison.js'");
        expect(app).toContain("'./reports-runtime/FireScenarioReport.js'");
        expect(app).toContain("'./calculators-runtime/GoalProgress.js'");
        expect(html).toContain('id="goal-tracker"');
        expect(html).toContain('id="goal-progress-bar"');
        const preparation = await readFile(new URL('../../../scripts/dashboard/prepare-calculators.mjs', import.meta.url), 'utf8');
        expect(preparation).toContain('FireReadiness.js');
        expect(preparation).toContain('RequiredFireContribution.js');
        expect(preparation).toContain('FireScenarioComparison.js');
        expect(preparation).toContain('FireScenarioReport.js');
        expect(preparation).toContain('GoalProgress.js');
        await Promise.all(imports.map((specifier) =>
            readFile(new URL(specifier, new URL('app.js', dashboardRoot)), 'utf8')
        ));
    });

    it('provides a keyboard-visible skip link targeting the main content landmark', async () => {
        const [html, css] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('styles.css')
        ]);

        expect(html).toMatch(/<a\b[^>]*class=["']skip-link["'][^>]*href=["']#main-content["'][^>]*>\s*Skip to main content\s*<\/a>/i);
        expect(html).toMatch(/<main\b[^>]*id=["']main-content["'][^>]*tabindex=["']-1["']/i);
        expect(css).toMatch(/\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/);
    });

});


describe('FIRE planner interaction contracts', () => {
    it('validates required form fields before solving for an annual contribution', async () => {
        const app = await readDashboardFile('app.js');
        const calculateFire = app.slice(
            app.indexOf('function calculateFire('),
            app.indexOf('function downloadFireReport(')
        );

        expect(calculateFire).toContain("if (solve && !$('#fire-planner-form').reportValidity()) {");
        expect(calculateFire).toContain("$('#fire-results').hidden = true;");
        expect(calculateFire).toContain("lastFireReportScenarios = [];");
        expect(app).toContain("$('#fire-required-button').addEventListener('click', () => calculateFire(true));");
    });

    it('respects reduced-motion preferences when revealing the scenario comparison', async () => {
        const app = await readDashboardFile('app.js');
        expect(app).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
        expect(app).toContain("panel.scrollIntoView({ behavior, block: 'start' });");
    });

});

describe('recurring-tagged cash-flow export contract', () => {
    it('exports only recurring-tagged entries in the selected reporting period using the standard safe CSV schema', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-export-recurring-csv"');
        expect(cashFlow).toContain("$('#cash-flow-export-recurring-csv').addEventListener('click'");
        expect(cashFlow).toContain('const recurringEntries = entries.filter((entry) => entry.recurring');
        expect(cashFlow).toContain("cashFlowToCsv(recurringEntries)");
        expect(cashFlow).toContain("const periodLabel = period === 'all' ? 'all-periods' : period;");
        expect(cashFlow).toContain('No recurring-tagged transactions exist in the selected reporting period.');
    });
});

describe('recurring-tagged cash-flow summary contract', () => {
    it('summarizes explicitly recurring-tagged recorded transactions without forecasting', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-recurring-summary-heading"');
        expect(html).toContain('id="cash-flow-recurring-income"');
        expect(html).toContain('id="cash-flow-recurring-expenses"');
        expect(html).toContain('id="cash-flow-recurring-net"');
        expect(html).toContain('id="cash-flow-recurring-count"');
        expect(html).toContain('do not estimate future payments, timing, or expected income');
        expect(cashFlow).toContain('const recurringEntries = entries.filter((entry) => entry.recurring');
        expect(cashFlow).toContain("(period === 'all' || entry.date.startsWith(period))");
    });
});

describe('monthly budget export contract', () => {
    it('provides a budget export action and builds a formula-safe selected-month comparison CSV', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-budget-export-csv"');
        expect(cashFlow).toContain("$('#cash-flow-budget-export-csv').addEventListener('click'");
        expect(cashFlow).toContain("budgetSummaryToCsv(month)");
        expect(cashFlow).toContain("'actual_expenses'");
        expect(cashFlow).toContain(String.raw`if (textField && /^[=+\-@\t\r]/u.test(field)) field = "'" + field;`);
        expect(cashFlow).toContain("pfo-monthly-category-budgets-' + month + '.csv'");
        expect(cashFlow).toContain("if (!isLoopback(windowRef.location.hostname))");
    });
});

describe('all-period budget history export contract', () => {
    it('exports recorded budgets and expense-only categories in deterministic order with formula-safe category text', async () => {
        const [html, cashFlow] = await Promise.all([readDashboardFile('index.html'), readDashboardFile('cashflow.js')]);
        expect(html).toContain('id="cash-flow-budget-export-history-csv"');
        expect(html).toContain('id="cash-flow-budget-history-toggle"');
        expect(html).toContain('id="cash-flow-budget-history-panel"');
        expect(html).toContain('id="cash-flow-budget-history-rows"');
        expect(html).toContain('id="cash-flow-budget-history-year-filter"');
        expect(html).toContain('id="cash-flow-budget-history-category-filter"');
        expect(html).toContain('id="cash-flow-budget-history-reset-filters"');
        expect(html).toContain('id="cash-flow-budget-history-count"');
        expect(cashFlow).toContain("$('#cash-flow-budget-export-history-csv').addEventListener('click'");
        expect(cashFlow).toContain("$('#cash-flow-budget-history-toggle').addEventListener('click'");
        expect(cashFlow).toContain('function budgetHistoryRows()');
        expect(cashFlow).toContain('function renderBudgetHistory()');
        expect(cashFlow).toContain("const years = [...new Set(rows.map((item) => item.month.slice(0, 4)))]");
        expect(cashFlow).toContain("const visibleRows = rows.filter((item) =>");
        expect(cashFlow).toContain("Showing ' + visibleRows.length + ' of ' + rows.length + ' rows");
        expect(cashFlow).toContain("$('#cash-flow-budget-history-reset-filters').addEventListener('click'");
        expect(cashFlow).toContain('function budgetHistoryToCsv()');
        expect(cashFlow).toContain("entry.type !== 'expense'");
        expect(cashFlow).toContain('a.month.localeCompare(b.month)');
        expect(cashFlow).toContain('pfo-category-budget-history.csv');
        expect(cashFlow.toLowerCase()).toContain('budget history is unavailable');
        expect(cashFlow).toContain('textField && /^[=+');
    });
});

describe('return risk cumulative return contract', () => {
    it('shows the compounded return metric and includes it in the metrics CSV', async () => {
        const [html, risk] = await Promise.all([readDashboardFile('index.html'), readDashboardFile('return-risk.js')]);
        expect(html).toContain('id="return-risk-cumulative-return"');
        expect(html).toContain('Compounded return across supplied observations');
        expect(risk).toContain("$('#return-risk-cumulative-return').textContent = percent(result.cumulativeReturn)");
        expect(risk).toContain("['cumulative_return', result.cumulativeReturn ?? '']");
    });
});
describe('return risk observation CSV export contract', () => {
    it('exports the validated dated return observations in a re-importable CSV and invalidates stale exports', async () => {
        const [html, risk] = await Promise.all([readDashboardFile('index.html'), readDashboardFile('return-risk.js')]);
        expect(html).toContain('id="return-risk-export-observations-csv"');
        expect(html).toContain('date,return_percent');
        expect(risk).toContain("const observationsExportButton = $('#return-risk-export-observations-csv')");
        expect(risk).toContain("observationsExportButton.disabled = true");
        expect(risk).toContain("observationsExportButton.disabled = false");
        expect(risk).toContain("downloadCsv('pfo-return-risk-observations.csv'");
        expect(risk).toContain("['date', 'return_percent']");
        expect(risk).toContain("rawLines[0]?.toLocaleLowerCase('en-US') === 'date,return_percent'");
    });
});
describe('copy previous-month budgets contract', () => {
    it('offers an explicit copy action and preserves existing target-month limits', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-budget-copy-previous"');
        expect(cashFlow).toContain("$('#cash-flow-budget-copy-previous').addEventListener('click'");
        expect(cashFlow).toContain("const previousMonth = previousDate.getUTCFullYear()");
        expect(cashFlow).toContain("const toCopy = sourceBudgets.filter((budget) => !existingCategories.has");
        expect(cashFlow).toContain("if (toCopy.length === 0)");
        expect(cashFlow).toContain("if (!windowRef.confirm(preview))");
        expect(cashFlow).toContain("saveBudgets([...budgets, ...copied])");
        expect(cashFlow).toContain("Transactions will not be changed.");
        expect(cashFlow).toContain("if (!budgetStorageHealthy)");
    });
});

describe('monthly budget backup contract', () => {
    it('provides a separate local JSON budget backup with validated, confirmed restore', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-budget-export-json"');
        expect(html).toContain('id="cash-flow-budget-import-json"');
        expect(cashFlow).toContain("schemaVersion: 1, currency: CURRENCY, exportedAt: new Date().toISOString(), budgets");
        expect(cashFlow).toContain("payload.schemaVersion !== 1");
        expect(cashFlow).toContain("const imported = validateBudgets(payload.budgets);");
        expect(cashFlow).toContain("if (!windowRef.confirm(preview))");
        expect(cashFlow).toContain("Cash-flow transactions will not be changed.");
        expect(cashFlow).toContain("if (!isLoopback(windowRef.location.hostname))");
    });
});

describe('monthly budget overview contract', () => {
    it('summarizes only explicitly budgeted categories and explains the aggregation boundary', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-budget-total"');
        expect(html).toContain('id="cash-flow-budget-actual"');
        expect(html).toContain('id="cash-flow-budget-remaining"');
        expect(html).toContain('id="cash-flow-budget-utilization"');
        expect(html).toContain('id="cash-flow-budget-overrun-count"');
        expect(html).toContain('id="cash-flow-budget-overrun-total"');
        expect(html).toContain('Positive category overruns only');
        expect(cashFlow).toContain('const overBudgetRows = budgetedRows.filter((item) => item.actual > item.budget)');
        expect(cashFlow).toContain('const totalOverrun = overBudgetRows.reduce((total, item) => total + (item.actual - item.budget), 0)');
        expect(cashFlow).toContain('overrunIsFinite ? money(totalOverrun) :');

        expect(html).toContain('expenses in categories without a budget');
        expect(cashFlow).toContain("const budgetedRows = [...combined.values()].filter((item) => item.budget !== null);");
        expect(cashFlow).toContain("Number.isFinite(remainingAgainstBudget)");
        expect(cashFlow).toContain("const overallUtilization = totalBudget > 0");
    });
});

describe('annual cash-flow category breakdown contract', () => {
    it('renders selected-year category totals and provides a guarded CSV export', async () => {
        const [html, app] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-annual-category-heading"');
        expect(html).toContain('id="cash-flow-annual-category-year"');
        expect(html).toContain('id="cash-flow-annual-category-rows"');
        expect(html).toContain('id="cash-flow-annual-category-empty"');
        expect(html).toContain('id="cash-flow-export-annual-categories-csv"');
        expect(app).toContain("const annualCategoryEntries = entries.filter((entry) => entry.date.startsWith(annualCategoryYearFilter.value))");
        expect(app).toContain('const annualCategories = summarizeCashFlowByCategory(annualCategoryEntries, \'all\')');
        expect(app).toContain("$('#cash-flow-export-annual-categories-csv').addEventListener('click'");
        expect(app).toContain('isLoopback(windowRef.location.hostname)');
        expect(app).toContain('cashFlowCategorySummaryToCsv(yearEntries, \'all\')');
        expect(app).toContain('!Number.isFinite(annualCategoryExpenses) || annualCategoryExpenses === 0');
        expect(app).toContain('if (!Number.isFinite(annualExpenses))');
        expect(app).toContain('Annual expense totals exceed the supported numeric range; export is unavailable.');
    });
});

describe('monthly cash-flow category breakdown contract', () => {
    it('renders a selected recorded month independently of transaction filters and guards the local CSV export', async () => {
        const [html, app, ledger] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js'),
            readDashboardFile('cashflow-ledger.js')
        ]);
        expect(html).toContain('id="cash-flow-monthly-category-heading"');
        expect(html).toContain('id="cash-flow-monthly-category-month"');
        expect(html).toContain('id="cash-flow-monthly-category-rows"');
        expect(html).toContain('id="cash-flow-monthly-category-empty"');
        expect(html).toContain('id="cash-flow-export-monthly-categories-csv"');
        expect(app).toContain("const categoryMonths = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a))");
        expect(app).toContain("const monthlyCategoryEntries = entries.filter((entry) => entry.date.startsWith(monthlyCategoryMonthFilter.value))");
        expect(app).toContain("summarizeCashFlowByCategory(monthlyCategoryEntries, 'all')");
        expect(app).toContain("$('#cash-flow-monthly-category-month').addEventListener('change', render)");
        expect(app).toContain("$('#cash-flow-export-monthly-categories-csv').addEventListener('click'");
        expect(app).toContain('Monthly category export is unavailable because saved cash-flow data could not be validated.');
        expect(app).toContain("cashFlowCategorySummaryToCsv(monthEntries, 'all')");
        expect(app).toContain('if (!Number.isFinite(monthExpenses))');
        expect(app).toContain('Monthly expense totals exceed the supported numeric range; export is unavailable.');
        expect(ledger).toContain("['category', 'income', 'expenses', 'expense_share_percent', 'net', 'transaction_count']");
    });
});

describe('recurring cash-flow category breakdown contract', () => {
    it('groups explicitly recurring transactions by category and exports a guarded selected-period CSV', async () => {
        const [html, app, ledger] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js'),
            readDashboardFile('cashflow-ledger.js')
        ]);
        expect(html).toContain('id="cash-flow-recurring-category-heading"');
        expect(html).toContain('id="cash-flow-recurring-category-rows"');
        expect(html).toContain('id="cash-flow-recurring-category-empty"');
        expect(html).toContain('id="cash-flow-export-recurring-category-csv"');
        expect(app).toContain("const recurringCategories = summarizeCashFlowByCategory(recurringEntries, 'all')");
        expect(app).toContain("$('#cash-flow-export-recurring-category-csv').addEventListener('click'");
        expect(app).toContain('Recurring category export is unavailable because saved cash-flow data could not be validated.');
        expect(app).toContain("cashFlowCategorySummaryToCsv(recurringEntries, 'all')");
        expect(app).toContain('if (!Number.isFinite(recurringExpenses))');
        expect(app).toContain('Recurring expense totals exceed the supported numeric range; export is unavailable.');
        expect(ledger).toContain("['category', 'income', 'expenses', 'expense_share_percent', 'net', 'transaction_count']");
    });
});

describe('monthly cash-flow comparison contract', () => {
    it('compares two explicitly selected recorded months and guards a local-only CSV export', async () => {
        const [html, app] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-monthly-comparison-heading"');
        expect(html).toContain('id="cash-flow-comparison-current-month"');
        expect(html).toContain('id="cash-flow-comparison-base-month"');
        expect(html).toContain('id="cash-flow-monthly-comparison-rows"');
        expect(html).toContain('Difference means selected month minus comparison month.');
        expect(html).toContain('id="cash-flow-export-monthly-comparison-csv"');
        expect(app).toContain('const comparisonMonths = monthlySummaries.map((item) => item.month)');
        expect(app).toContain("calculateCashFlowSavingsRate(currentComparison.income, currentComparison.expenses)");
        expect(app).toContain("$('#cash-flow-comparison-current-month').addEventListener('change', render)");
        expect(app).toContain("$('#cash-flow-comparison-base-month').addEventListener('change', render)");
        expect(app).toContain("$('#cash-flow-export-monthly-comparison-csv').addEventListener('click'");
        expect(app).toContain('Monthly comparison export is unavailable because saved cash-flow data could not be validated.');
        expect(app).toContain("['metric', 'selected_month', 'selected_value', 'comparison_month', 'comparison_value', 'difference']");
        expect(app).toContain('Monthly comparison contains a numeric difference outside the supported range; export is unavailable.');
    });
});

describe('annual cash-flow category comparison contract', () => {
    it('compares category income and expenses across selected years and includes category rows in local CSV export', async () => {
        const [html, app] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('Category drivers');
        expect(html).toContain('id="cash-flow-annual-category-comparison-rows"');
        expect(html).toContain('id="cash-flow-annual-category-comparison-empty"');
        expect(html).toContain('Expense difference is selected year minus comparison year');
        expect(app).toContain("summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(currentYearComparison.year)), 'all')");
        expect(app).toContain("summarizeCashFlowByCategory(entries.filter((entry) => entry.date.startsWith(baseYearComparison.year)), 'all')");
        expect(app).toContain("['record_type', 'metric', 'category', 'selected_year', 'selected_value', 'comparison_year', 'comparison_value', 'difference']");
        expect(app).toContain("csvRows.push(['category', 'expenses', item.category");
        expect(app).toContain("'pfo-cash-flow-annual-comparison.csv'");
    });
});

describe('annual cash-flow comparison contract', () => {
    it('compares recorded years, shows percentage-point savings-rate changes, and restricts CSV export to the local workspace', async () => {
        const [html, app] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-annual-comparison-heading"');
        expect(html).toContain('id="cash-flow-comparison-current-year"');
        expect(html).toContain('id="cash-flow-comparison-base-year"');
        expect(html).toContain('id="cash-flow-annual-comparison-rows"');
        expect(html).toContain('Difference means selected year minus comparison year.');
        expect(html).toContain('id="cash-flow-export-annual-comparison-csv"');
        expect(app).toContain('const comparisonYears = annualSummaries.map((item) => item.year)');
        expect(app).toContain("calculateCashFlowSavingsRate(currentYearComparison.income, currentYearComparison.expenses)");
        expect(app).toContain("differenceLabel = label === 'Savings rate'");
        expect(app).toContain("$('#cash-flow-export-annual-comparison-csv').addEventListener('click'");
        expect(app).toContain('Annual comparison export is unavailable because saved cash-flow data could not be validated.');
        expect(app).toContain("['metric', 'selected_year', 'selected_value', 'comparison_year', 'comparison_value', 'difference']");
        expect(app).toContain('Annual comparison contains a numeric difference outside the supported range; export is unavailable.');
        expect(app).toContain("'pfo-cash-flow-annual-comparison.csv'");
    });
});

describe('annual cash-flow summary export contract', () => {
    it('exposes an annual summary export backed by validated recorded transactions and local-only controls', async () => {
        const [html, app, ledger] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js'),
            readDashboardFile('cashflow-ledger.js')
        ]);
        expect(html).toContain('id="cash-flow-export-annual-csv"');
        expect(app).toContain("$('#cash-flow-export-annual-csv').addEventListener('click'");
        expect(app).toContain("cashFlowAnnualSummaryToCsv(entries)");
        expect(app).toContain("isLoopback(windowRef.location.hostname)");
        expect(app).toContain("'pfo-cash-flow-annual-summary.csv'");
        expect(ledger).toContain("['year', 'income', 'expenses', 'net', 'savings_rate_percent', 'transaction_count']");
        expect(ledger).toContain('Annual cash flow totals exceed the supported numeric range.');
    });
});

describe('annual cash-flow trend table contract', () => {
    it('renders annual totals from the shared annual aggregator with explicit empty state and historical-only wording', async () => {
        const [html, app, ledger] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js'),
            readDashboardFile('cashflow-ledger.js')
        ]);
        expect(html).toContain('id="cash-flow-annual-heading"');
        expect(html).toContain('id="cash-flow-annual-rows"');
        expect(html).toContain('id="cash-flow-annual-empty"');
        expect(html).toContain('This is a historical summary, not a forecast.');
        expect(app).toContain("const annualSummaries = summarizeCashFlowByYear(entries)");
        expect(app).toContain("$('#cash-flow-annual-empty').hidden = annualSummaries.length !== 0");
        expect(ledger).toContain('export function summarizeCashFlowByYear(entries)');
    });
});

describe('monthly budget utilization contract', () => {
    it('shows budget-used percentage and exports the same metric without inventing a budget', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('<th scope="col">Budget used</th>');
        expect(cashFlow).toContain('function budgetUtilizationPercent(budget, actual)');
        expect(cashFlow).toContain("utilization === null ? '—' : utilization.toFixed(1) + '%'");
        expect(cashFlow).toContain("'budget_used_percent'");
        expect(cashFlow).toContain('budgetUtilizationPercent(item.budget, item.actual) ??');
        expect(cashFlow).toContain('if (budget === null) return null;');
        expect(cashFlow).toContain('Number.isFinite(percentage)');
    });
});

describe('dashboard export reliability', () => {
    it('keeps the JSON backup object URL alive briefly after initiating download', async () => {
        const app = await readDashboardFile('app.js');
        const exportData = app.slice(app.indexOf('function exportData()'), app.indexOf('function exportCsv()'));

        expect(exportData).toContain("link.download = 'pfo-os-financial-records.json';");
        expect(exportData).toContain('document.body.append(link);');
        expect(exportData).toContain('link.remove();');
        expect(exportData).toMatch(/setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1000\)/);
        expect(exportData).not.toMatch(/link\.click\(\);\s*URL\.revokeObjectURL\(url\)/);
    });
});



describe('dashboard accessibility contracts', () => {
    it('associates labels with FIRE and goal tracker form controls', async () => {
        const html = await readDashboardFile('index.html');
        const fireSection = html.slice(html.indexOf('id="fire-planner"'), html.indexOf('id="goal-tracker"'));
        const goalSection = html.slice(html.indexOf('id="goal-tracker"'), html.indexOf('id="records"'));

        for (const [sectionName, section] of [['FIRE planner', fireSection], ['Goal tracker', goalSection]]) {
            const controlIds = [...section.matchAll(/<(?:input|select|textarea)\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)]
                .map((match) => match[1])
                .filter((id) => !['import-file'].includes(id));

            expect(
                controlIds,
                sectionName + ' section must expose controls for label validation'
            ).not.toHaveLength(0);

            for (const id of controlIds) {
                expect(
                    section,
                    sectionName + ' control #' + id + ' must have an explicitly associated label'
                ).toMatch(new RegExp("<label\\b[^>]*\\bfor=[\"']" + id + "[\"']"));
            }
        }
    });

    it('exposes result announcements, validation alerts, and a named native progress indicator', async () => {
        const html = await readDashboardFile('index.html');
        const fireSection = html.slice(html.indexOf('id="fire-planner"'), html.indexOf('id="goal-tracker"'));
        const goalSection = html.slice(html.indexOf('id="goal-tracker"'), html.indexOf('id="records"'));

        expect(fireSection).toMatch(/id=["']fire-validation["'][^>]*role=["']alert["']/);
        expect(fireSection).toMatch(/id=["']fire-results["'][^>]*aria-live=["']polite["']/);
        expect(fireSection).toMatch(/id=["']fire-comparison["'][^>]*aria-labelledby=["']fire-comparison-heading["']/);
        expect(goalSection).toMatch(/id=["']goal-validation["'][^>]*role=["']alert["']/);
        expect(goalSection).toMatch(/id=["']goal-results["'][^>]*aria-live=["']polite["']/);
        expect(goalSection).toMatch(/<progress\b[^>]*id=["']goal-progress-bar["'][^>]*aria-label=["']Goal completion percentage["']/);
        const app = await readDashboardFile('app.js');
        expect(app).toContain("number(goal.result.progressPercent) + ' percent of target'");
        expect(html).toMatch(/<section\b[^>]*id=["']goal-tracker["'][^>]*aria-labelledby=["']goal-tracker-heading["']/);
    });
});

describe('budget history status filter contract', () => {
    it('filters historical budget comparisons by the recorded budget status and resets all filters', async () => {
        const [html, cashFlow] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js')
        ]);
        expect(html).toContain('id="cash-flow-budget-history-status-filter"');
        expect(html).toContain('<option value="Over budget">Over budget</option>');
        expect(html).toContain('<option value="Within budget">Within budget</option>');
        expect(html).toContain('<option value="Not spent">Not spent</option>');
        expect(html).toContain('<option value="No budget set">No budget set</option>');
        expect(cashFlow).toContain("&& (!statusFilter.value || item.status === statusFilter.value)");
        expect(cashFlow).toContain("'cash-flow-budget-history-status-filter'])");
        expect(cashFlow).toContain("$('#cash-flow-budget-history-status-filter').value = '';");
        expect(cashFlow).toContain("'No budget set'");
    });
});

describe('cash-flow CSV import duplicate preview', () => {
    it('warns about exact duplicate rows within the selected CSV before replacement or append', async () => {
        const cashFlow = await readDashboardFile('cashflow.js');
        expect(cashFlow).toContain('const seenImported = [];');
        expect(cashFlow).toContain('let duplicateInFileCount = 0;');
        expect(cashFlow).toContain('findPotentialDuplicateCashFlowEntry(seenImported, candidate)');
        expect(cashFlow).toContain("'Potential exact duplicates within the selected CSV: ' + duplicateInFileCount");
        expect(cashFlow).toContain("'Potential exact duplicates against the existing ledger: ' + duplicateCount");
        expect(cashFlow).toContain('They will be retained if you continue.');
    });
});

describe('cash-flow CSV import preview detail', () => {
    it('shows imported income and expense counts and the imported date range before confirmation', async () => {
        const cashFlow = await readDashboardFile('cashflow.js');
        expect(cashFlow).toContain("const importedIncomeCount = imported.filter((item) => item.type === 'income').length;");
        expect(cashFlow).toContain('const importedExpenseCount = imported.length - importedIncomeCount;');
        expect(cashFlow).toContain("const importedDates = imported.map((item) => item.date).sort();");
        expect(cashFlow).toContain("'Imported income transactions: ' + importedIncomeCount");
        expect(cashFlow).toContain("'Imported expense transactions: ' + importedExpenseCount");
        expect(cashFlow).toContain("'Imported transaction date range: ' + importedDateRange");
        expect(cashFlow).toContain("'Total transactions after import: ' + next.length");
    });
});

describe('cash-flow amount range filter contract', () => {
    it('exposes minimum and maximum amount filters and applies them to visible transactions and exports', async () => {
        const [html, cashFlow, ledger] = await Promise.all([
            readDashboardFile('index.html'),
            readDashboardFile('cashflow.js'),
            readDashboardFile('cashflow-ledger.js')
        ]);
        expect(html).toContain('id="cash-flow-amount-min"');
        expect(html).toContain('id="cash-flow-amount-max"');
        expect(cashFlow).toContain("minAmount: $('#cash-flow-amount-min').value === '' ? null : Number($('#cash-flow-amount-min').value)");
        expect(cashFlow).toContain("maxAmount: $('#cash-flow-amount-max').value === '' ? null : Number($('#cash-flow-amount-max').value)");
        expect(cashFlow).toContain('const invalidAmountRange =');
        expect(cashFlow).toContain("$('#cash-flow-export-filtered-csv').disabled = invalidFilterRange;");
        expect(cashFlow).toContain("$('#cash-flow-amount-min').value = '';");
        expect(ledger).toContain('(minAmount === null || entry.amount >= minAmount)');
        expect(ledger).toContain('(maxAmount === null || entry.amount <= maxAmount)');
    });
});
