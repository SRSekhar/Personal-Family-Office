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
                ).toMatch(new RegExp('<label\\b[^>]*\\bfor=["\\']' + id + '["\\']'));
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
        expect(app).toContain("number(result.progressPercent) + ' percent of target'");
        expect(html).toMatch(/<section\b[^>]*id=["']goal-tracker["'][^>]*aria-labelledby=["']goal-tracker-heading["']/);
    });
});
