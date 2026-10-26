import { describe, expect, it } from 'vitest';
import { calculateLoanAmortizationMath } from '../calculators-runtime/LoanAmortizationMath.js';
import { renderLoanAmortizationReportHtml } from '../loan-amortization-report.js';

const input = { outstandingPrincipal: 1200, annualInterestRatePercent: 0, monthlyPayment: 500, firstPaymentDate: '2026-01-31' };
const calculate = (value) => calculateLoanAmortizationMath({
  ...value, firstPaymentDate: new Date(value.firstPaymentDate + 'T00:00:00.000Z'), maximumPayments: 1200
});

describe('loan amortization HTML report', () => {
  it('renders assumptions, totals, and the full schedule without remote assets', () => {
    const result = calculate(input);
    const html = renderLoanAmortizationReportHtml({ input, result });
    expect(html).toContain('Loan amortization report');
    expect(html).toContain('2026-01-31');
    expect(html).toContain('2026-03-31');
    expect(html).toContain('Paid off under these assumptions');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('http://');
  });
  it('renders a zero-balance schedule', () => {
    const zero = { ...input, outstandingPrincipal: 0, monthlyPayment: 0 };
    expect(renderLoanAmortizationReportHtml({ input: zero, result: calculate(zero) })).toContain('Scheduled payments</th><td>0</td>');
  });
  it('rejects a result that does not match the canonical calculation', () => {
    const result = calculate(input);
    expect(() => renderLoanAmortizationReportHtml({ input, result: { ...result, totalInterest: 99 } })).toThrow(/does not match/i);
    expect(() => renderLoanAmortizationReportHtml({ input, result: { ...result, schedule: [] } })).toThrow(/does not match/i);
  });
  it('rejects missing inputs and invalid dates', () => {
    expect(() => renderLoanAmortizationReportHtml({ input: null, result: {} })).toThrow(/required/i);
    expect(() => renderLoanAmortizationReportHtml({ input: { ...input, firstPaymentDate: '2026-02-30' }, result: calculate(input) })).toThrow(/real calendar date/i);
  });
});
