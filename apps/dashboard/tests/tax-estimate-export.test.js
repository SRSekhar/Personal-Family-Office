import { describe, expect, it } from 'vitest';
import { taxEstimateToCsv, taxEstimateToHtml } from '../tax-estimate-export.js';

const brackets = [
    { upperBound: 25000, marginalRatePercent: 0 },
    { upperBound: 50000, marginalRatePercent: 10 },
    { upperBound: null, marginalRatePercent: 20 }
];
const result = {
    estimatedTax: 12500,
    afterTaxIncome: 87500,
    effectiveTaxRate: 12.5,
    marginalRatePercent: 20
};

describe('taxEstimateToCsv', () => {
    it('exports the estimate summary and exact caller-defined bracket assumptions', () => {
        const csv = taxEstimateToCsv({ taxableIncome: 100000, brackets, result });
        expect(csv).toContain('Taxable income,100000\r\n');
        expect(csv).toContain('Estimated tax,12500\r\n');
        expect(csv).toContain('Income after estimated tax,87500\r\n');
        expect(csv).toContain('Effective tax rate (%),12.5\r\n');
        expect(csv).toContain('1,25000,0\r\n');
        expect(csv).toContain('2,50000,10\r\n');
        expect(csv).toContain('3,No upper limit,20\r\n');
        expect(csv.endsWith('\r\n')).toBe(true);
    });

    it('leaves the effective rate blank for zero income', () => {
        const csv = taxEstimateToCsv({
            taxableIncome: 0,
            brackets: [{ upperBound: null, marginalRatePercent: 0 }],
            result: { estimatedTax: 0, afterTaxIncome: 0, effectiveTaxRate: null, marginalRatePercent: 0 }
        });
        expect(csv).toContain('Effective tax rate (%),\r\n');
    });

    it.each([
        ['negative taxable income', { taxableIncome: -1, brackets, result }],
        ['missing brackets', { taxableIncome: 100, brackets: [], result }],
        ['invalid rate', { taxableIncome: 100, brackets: [{ upperBound: null, marginalRatePercent: 101 }], result }],
        ['non-final open bracket', { taxableIncome: 100, brackets: [{ upperBound: null, marginalRatePercent: 5 }, { upperBound: null, marginalRatePercent: 10 }], result }],
        ['missing result', { taxableIncome: 100, brackets, result: null }]
    ])('rejects invalid export data: %s', (_description, input) => {
        expect(() => taxEstimateToCsv(input)).toThrow();
    });
});


describe('taxEstimateToHtml', () => {
    it('renders a self-contained report with the exact supplied assumptions', () => {
        const html = taxEstimateToHtml({ taxableIncome: 100000, brackets, result });
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Progressive tax estimate');
        expect(html).toContain('₹1,00,000');
        expect(html).toContain('₹12,500');
        expect(html).toContain('12.5%');
        expect(html).toContain('₹25,000');
        expect(html).toContain('No upper limit');
        expect(html).toContain('not tax advice');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('https://');
        expect(html).not.toContain('http://');
    });

    it('renders a missing effective rate as unavailable for zero income', () => {
        const html = taxEstimateToHtml({
            taxableIncome: 0,
            brackets: [{ upperBound: null, marginalRatePercent: 0 }],
            result: { estimatedTax: 0, afterTaxIncome: 0, effectiveTaxRate: null, marginalRatePercent: 0 }
        });
        expect(html).toContain('Effective tax rate');
        expect(html).toContain('Unavailable');
    });

    it('rejects malformed estimates using the CSV validation contract', () => {
        expect(() => taxEstimateToHtml({ taxableIncome: -1, brackets, result })).toThrow(/taxable income/i);
        expect(() => taxEstimateToHtml({ taxableIncome: 100, brackets: [], result })).toThrow(/bracket/i);
        expect(() => taxEstimateToHtml({ taxableIncome: 100, brackets, result: null })).toThrow(/result/i);
    });
});
