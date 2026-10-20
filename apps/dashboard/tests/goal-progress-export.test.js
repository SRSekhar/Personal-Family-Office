import { describe, expect, it } from 'vitest';
import { goalProgressToCsv } from '../goal-progress-export.js';

const validGoal = {
    name: 'Emergency fund',
    targetAmount: 500000,
    currentAmount: 125000,
    amountRemaining: 375000,
    progressPercent: 25,
    targetDate: '2027-12-31',
    daysRemaining: 437,
    status: 'In progress',
    monthlyContributionNeeded: 25000
};

describe('goalProgressToCsv', () => {
    it('exports goal amounts, progress, deadline, and no-returns monthly pace', () => {
        const csv = goalProgressToCsv([validGoal]);
        expect(csv).toContain('"Emergency fund",500000,125000,375000,25,2027-12-31,437,"In progress",25000');
        expect(csv).toContain('Monthly pace needed (INR; no returns assumed)');
        expect(csv.endsWith('\r\n')).toBe(true);
    });

    it('neutralizes spreadsheet formulas in user-entered goal names', () => {
        const csv = goalProgressToCsv([{ ...validGoal, name: '=HYPERLINK("https://example.invalid","open")' }]);
        expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"",""open"")"');
    });

    it('allows a blank monthly pace when a shortfall has no future months', () => {
        const csv = goalProgressToCsv([{ ...validGoal, daysRemaining: -1, status: 'Past target date', monthlyContributionNeeded: null }]);
        expect(csv).toContain('2027-12-31,-1,"Past target date",');
    });

    it.each([
        ['non-array input', null],
        ['non-reconciling progress', [{ ...validGoal, amountRemaining: 1 }]],
        ['invalid target date', [{ ...validGoal, targetDate: '2027-02-29' }]],
        ['unsupported status', [{ ...validGoal, status: 'Maybe' }]]
    ])('rejects invalid export data: %s', (_label, input) => {
        expect(() => goalProgressToCsv(input)).toThrow();
    });
});
