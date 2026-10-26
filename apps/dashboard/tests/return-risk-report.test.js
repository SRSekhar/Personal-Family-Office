import { describe, expect, it } from 'vitest';
import { analyzeReturnSeries } from '../analytics-runtime/RiskAnalysis.js';
import { renderReturnRiskReportHtml } from '../return-risk-report.js';

const input = {
    periodsPerYear: 12,
    riskFreeRatePerPeriod: 0.01,
    minimumAcceptableReturnPerPeriod: 0,
    observations: [
        { date: '2026-01-31', returnRate: 0.1 },
        { date: '2026-02-28', returnRate: -0.2 },
        { date: '2026-03-31', returnRate: 0.05 }
    ]
};
const result = analyzeReturnSeries(input);

describe('return-risk standalone HTML report', () => {
    it('renders validated metrics, assumptions, and exact dated observations', () => {
        const report = renderReturnRiskReportHtml({ input, result });
        expect(report).toContain('<!doctype html>');
        expect(report).toContain('Return risk analysis');
        expect(report).toContain('Cumulative return');
        expect(report).toContain('Annualized volatility');
        expect(report).toContain('Maximum drawdown');
        expect(report).toContain('Annualized Sharpe ratio');
        expect(report).toContain('Periods per year: 12');
        expect(report).toContain('2026-01-31');
        expect(report).toContain('2026-02-28');
        expect(report).toContain('2026-03-31');
        expect(report).toContain('not a forecast');
        expect(report).not.toContain('<script');
        expect(report).not.toContain('<img');
        expect(report).not.toContain('https://');
        expect(report).not.toContain('http://');
    });

    it('marks ratios unavailable when assumptions are not supplied', () => {
        const inputWithoutAssumptions = {
            periodsPerYear: 12,
            observations: [{ date: '2026-01-31', returnRate: 0.05 }]
        };
        const report = renderReturnRiskReportHtml({
            input: inputWithoutAssumptions,
            result: analyzeReturnSeries(inputWithoutAssumptions)
        });
        expect(report).toContain('Risk-free return per period: Not supplied');
        expect(report).toContain('Minimum acceptable return per period: Not supplied');
        expect(report).toContain('Annualized Sharpe ratio');
        expect(report).toContain('Unavailable');
    });

    it('rejects results that do not match the supplied observations', () => {
        expect(() => renderReturnRiskReportHtml({
            input,
            result: { ...result, cumulativeReturn: 0 }
        })).toThrow(/does not match/i);
    });

    it('rejects invalid return series', () => {
        expect(() => renderReturnRiskReportHtml({
            input: { periodsPerYear: 0, observations: [] },
            result: {}
        })).toThrow(/periods per year/i);
    });
});
