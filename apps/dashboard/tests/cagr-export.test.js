import { describe, expect, it } from 'vitest';
import { cagrToCsv } from '../cagr-export.js';

describe('cagrToCsv', () => {
    it('exports the exact inputs and annualized result with stable headings', () => {
        const csv = cagrToCsv({
            beginningValue: 1000,
            endingValue: 1331,
            periods: 3,
            annualizedRate: 0.1
        });
        expect(csv).toContain('Beginning value,1000\r\n');
        expect(csv).toContain('Ending value,1331\r\n');
        expect(csv).toContain('Elapsed years,3\r\n');
        expect(csv).toContain('Compound annual growth rate (%),10\r\n');
        expect(csv.endsWith('\r\n')).toBe(true);
    });

    it.each([
        ['zero beginning value', { beginningValue: 0, endingValue: 1, periods: 1, annualizedRate: 0 }],
        ['negative ending value', { beginningValue: 1, endingValue: -1, periods: 1, annualizedRate: 0 }],
        ['zero elapsed years', { beginningValue: 1, endingValue: 2, periods: 0, annualizedRate: 0 }],
        ['invalid annualized rate', { beginningValue: 1, endingValue: 2, periods: 1, annualizedRate: -1 }]
    ])('rejects invalid export data: %s', (_description, input) => {
        expect(() => cagrToCsv(input)).toThrow();
    });
});
