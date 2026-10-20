import { describe, expect, it } from 'vitest';
import { calculateLoanAmortizationMath } from '../src/LoanAmortizationMath.js';

describe('calculateLoanAmortizationMath', () => {
    it('caps the final payment and reconciles totals for a zero-interest loan', () => {
        const result = calculateLoanAmortizationMath({ outstandingPrincipal: 1200, annualInterestRatePercent: 0, monthlyPayment: 500, firstPaymentDate: new Date('2026-01-31T09:30:00.000Z') });
        expect(result.schedule.map((item) => item.payment)).toEqual([500, 500, 200]);
        expect(result.schedule.map((item) => item.principalPaid)).toEqual([500, 500, 200]);
        expect(result.totalInterest).toBe(0);
        expect(result.totalPayments).toBe(1200);
        expect(result.totalPrincipalPaid).toBe(1200);
        expect(result.remainingBalance).toBe(0);
        expect(result.paidOff).toBe(true);
    });
    it('calculates opening-balance interest and anchored UTC month-end dates', () => {
        const result = calculateLoanAmortizationMath({ outstandingPrincipal: 1000, annualInterestRatePercent: 12, monthlyPayment: 200, firstPaymentDate: new Date('2026-01-31T09:30:00.000Z'), maximumPayments: 3 });
        expect(result.schedule[0]?.interest).toBeCloseTo(10);
        expect(result.schedule[0]?.principalPaid).toBeCloseTo(190);
        expect(result.schedule.map((item) => item.dueDate)).toEqual(['2026-01-31T09:30:00.000Z', '2026-02-28T09:30:00.000Z', '2026-03-31T09:30:00.000Z']);
        expect(result.paidOff).toBe(false);
    });
    it('returns an empty paid-off schedule for a zero balance', () => {
        expect(calculateLoanAmortizationMath({ outstandingPrincipal: 0, annualInterestRatePercent: 12, monthlyPayment: 0, firstPaymentDate: new Date('2026-01-01T00:00:00.000Z') })).toMatchObject({ schedule: [], remainingBalance: 0, paidOff: true });
    });
    it('rejects invalid inputs and non-amortizing payments', () => {
        const date = new Date('2026-01-01T00:00:00.000Z');
        expect(() => calculateLoanAmortizationMath({ outstandingPrincipal: -1, annualInterestRatePercent: 0, monthlyPayment: 1, firstPaymentDate: date })).toThrow('non-negative finite');
        expect(() => calculateLoanAmortizationMath({ outstandingPrincipal: 1000, annualInterestRatePercent: 101, monthlyPayment: 200, firstPaymentDate: date })).toThrow('between 0 and 100');
        expect(() => calculateLoanAmortizationMath({ outstandingPrincipal: 1000, annualInterestRatePercent: 12, monthlyPayment: 10, firstPaymentDate: date })).toThrow('must exceed the first period interest');
        expect(() => calculateLoanAmortizationMath({ outstandingPrincipal: 1000, annualInterestRatePercent: 0, monthlyPayment: 100, firstPaymentDate: date, maximumPayments: 1201 })).toThrow('from 1 through 1200');
        expect(() => calculateLoanAmortizationMath({ outstandingPrincipal: 1000, annualInterestRatePercent: 0, monthlyPayment: 100, firstPaymentDate: new Date(Number.NaN) })).toThrow('First payment date must be valid');
    });
});