import { describe, expect, it } from 'vitest';
import { calculateFireReadiness } from '../../calculators/src/FireReadiness.js';
import { createFireScenarioReport, renderFireScenarioReportHtml, type FireScenarioReportScenarioInput } from '../src/FireScenarioReport.js';

const assumptions = {
    currentPortfolio: 1_000_000, annualContribution: 120_000, yearsToRetirement: 10,
    expectedAnnualReturn: 0.07, annualInflationRate: 0.03,
    annualRetirementSpendingToday: 300_000, withdrawalRate: 0.04, contributionTiming: 'end' as const
};
const result = calculateFireReadiness(assumptions);
const scenario: FireScenarioReportScenarioInput = { id: 'base', name: 'Base case', assumptions, result };
function createReport(scenarios: readonly FireScenarioReportScenarioInput[] = [scenario]): ReturnType<typeof createFireScenarioReport> {
    return createFireScenarioReport({ currency: 'INR', generatedAt: new Date('2026-10-18T10:00:00.000Z'), scenarios });
}

describe('createFireScenarioReport', () => {
    it('creates a versioned report with scenario assumptions and results', () => {
        const report = createReport();
        expect(report.schemaVersion).toBe(1);
        expect(report.generatedAt).toBe('2026-10-18T10:00:00.000Z');
        expect(report.scenarios[0]?.assumptions).toEqual(assumptions);
        expect(report.scenarios[0]?.result).toEqual(result);
    });
    it('rejects invalid dates, currencies, duplicate IDs, and inconsistent results', () => {
        expect(() => createFireScenarioReport({ currency: 'INR', generatedAt: new Date(Number.NaN), scenarios: [scenario] })).toThrow(/valid Date/);
        expect(() => createReport([{...scenario, id: 'other'}, {...scenario, id: 'other'}])).toThrow(/unique/);
        expect(() => renderFireScenarioReportHtml({...createReport(), currency: '<script>'})).toThrow(/currency/);
        expect(() => renderFireScenarioReportHtml({...createReport(), scenarios: [{...scenario, result: {...result, isOnTrack: !result.isOnTrack}}]})).toThrow(/inconsistent/);
    });
    it('renders standalone accessible HTML without scripts, remote assets, or unescaped scenario names', () => {
        const unsafe = {...scenario, name: '<img src=x onerror=alert(1)> & Family'};
        const html = renderFireScenarioReportHtml(createReport([unsafe, {...scenario, id:'second',name:'Second case'}]));
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; Family');
        expect(html).toContain('Scenario comparison');
        expect(html).toContain('Target corpus');
        expect(html).toContain('2026-10-18T10:00:00.000Z');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('https://');
    });
    it('rejects malformed scenarios and unsupported ranges', () => {
        expect(() => renderFireScenarioReportHtml({...createReport(), scenarios: []})).toThrow(/at least one scenario/);
        expect(() => renderFireScenarioReportHtml({...createReport(), scenarios: [{...scenario, assumptions: {...assumptions, withdrawalRate: 0}}]})).toThrow(/rates/);
    });
});
