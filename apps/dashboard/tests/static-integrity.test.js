import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const dashboardRoot = new URL('../', import.meta.url);

async function readDashboardFile(name) {
    return readFile(new URL(name, dashboardRoot), 'utf8');
}

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
        expect(html).toContain('expenses in categories without a budget');
        expect(cashFlow).toContain("const budgetedRows = [...combined.values()].filter((item) => item.budget !== null);");
        expect(cashFlow).toContain("Number.isFinite(remainingAgainstBudget)");
        expect(cashFlow).toContain("const overallUtilization = totalBudget > 0");
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
