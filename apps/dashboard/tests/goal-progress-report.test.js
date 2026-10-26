import { describe, expect, it } from 'vitest';
import { renderGoalProgressReportHtml } from '../goal-progress-report.js';

const goals = [
    {
        name: 'Emergency fund', targetAmount: 100000, currentAmount: 25000,
        amountRemaining: 75000, progressPercent: 25, targetDate: '2027-12-31',
        daysRemaining: 431, status: 'In progress', monthlyContributionNeeded: 6000
    },
    {
        name: 'Debt payoff', targetAmount: 50000, currentAmount: 50000,
        amountRemaining: 0, progressPercent: 100, targetDate: '2026-10-01',
        daysRemaining: -25, status: 'Goal reached', monthlyContributionNeeded: 0
    }
];
const report = { asOfDate: '2026-10-26', generatedAt: '2026-10-26T03:00:00.000Z', goals };

describe('saved goal progress HTML report', () => {
    it('renders goal-level progress and combined totals in a standalone report', () => {
        const html = renderGoalProgressReportHtml(report);
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Emergency fund');
        expect(html).toContain('Debt payoff');
        expect(html).toContain('Combined target');
        expect(html).toContain('Goals reached');
        expect(html).toContain('Past target date');
        expect(html).toContain('₹1,50,000');
        expect(html).toContain('₹75,000');
        expect(html).toContain('no returns assumed');
        expect(html).not.toContain('25 days overdue');
        expect(html).toContain('Keep this file private');
        expect(html).not.toMatch(/<script\b/i);
        expect(html).not.toMatch(/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i);
    });

    it('escapes user-controlled goal names and dates', () => {
        const html = renderGoalProgressReportHtml({
            ...report,
            goals: [{ ...goals[0], name: '<img src=x onerror=alert(1)> & goal' }]
        });
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; goal');
        expect(html).not.toContain('<img');
    });

    it('rejects missing goals and invalid or unreconciled values', () => {
        expect(() => renderGoalProgressReportHtml({ ...report, goals: [] })).toThrow(/at least one/i);
        expect(() => renderGoalProgressReportHtml({ ...report, asOfDate: '2026-02-30' })).toThrow(/as-of date/i);
        expect(() => renderGoalProgressReportHtml({ ...report, goals: [{ ...goals[0], amountRemaining: 1 }] })).toThrow(/do not reconcile/);
        expect(() => renderGoalProgressReportHtml({ ...report, goals: [{ ...goals[0], status: 'maybe' }] })).toThrow(/valid status/);
    });
});
