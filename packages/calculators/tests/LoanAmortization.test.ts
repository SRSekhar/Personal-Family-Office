import { Identifier } from '@pfo/core';
import { Currency, Loan, LoanType, Money, Percentage } from '@pfo/models';
import { describe, expect, it } from 'vitest';

import { calculateLoanAmortization } from '../src/LoanAmortization.js';

function createLoan({
    principal = 1200,
    outstanding = principal,
    rate = 0,
    payment = 500
}: {
    principal?: number;
    outstanding?: number;
    rate?: number;
    payment?: number;
} = {}): Loan {
    return new Loan(
        Identifier.create('amortization-loan'),
        'Test loan',
        LoanType.HomeLoan,
        new Money(principal, Currency.INR),
        new Money(outstanding, Currency.INR),
        new Percentage(rate),
        new Money(payment, Currency.INR),
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2040-01-01T00:00:00.000Z')
    );
}

describe('calculateLoanAmortization', () => {
    it('pays off a zero-interest loan with a smaller final payment', () => {
        const result = calculateLoanAmortization({
            loan: createLoan(),
            firstPaymentDate: new Date('2026-01-31T09:30:00.000Z')
        });

        expect(result.paidOff).toBe(true);
        expect(result.schedule.map((item) => item.payment.amount)).toEqual([500, 500, 200]);
        expect(result.schedule.map((item) => item.principalPaid.amount)).toEqual([500, 500, 200]);
        expect(result.totalInterest.amount).toBe(0);
        expect(result.totalPayments.amount).toBe(1200);
        expect(result.totalPrincipalPaid.amount).toBe(1200);
        expect(result.remainingBalance.amount).toBe(0);
    });

    it('calculates monthly interest and principal reduction using the opening balance', () => {
        const result = calculateLoanAmortization({
            loan: createLoan({ principal: 1000, rate: 12, payment: 200 }),
            firstPaymentDate: new Date('2026-01-15T00:00:00.000Z'),
            maximumPayments: 1
        });

        expect(result.schedule).toHaveLength(1);
        expect(result.schedule[0]?.interest.amount).toBeCloseTo(10);
        expect(result.schedule[0]?.principalPaid.amount).toBeCloseTo(190);
        expect(result.schedule[0]?.closingBalance.amount).toBeCloseTo(810);
        expect(result.paidOff).toBe(false);
        expect(result.remainingBalance.amount).toBeCloseTo(810);
    });

    it('preserves the anchored UTC payment day across short months', () => {
        const result = calculateLoanAmortization({
            loan: createLoan(),
            firstPaymentDate: new Date('2026-01-31T09:30:00.000Z'),
            maximumPayments: 3
        });
        expect(result.schedule.map((item) => item.dueDate)).toEqual([
            '2026-01-31T09:30:00.000Z',
            '2026-02-28T09:30:00.000Z',
            '2026-03-31T09:30:00.000Z'
        ]);
    });

    it('returns an empty paid-off schedule for a zero outstanding balance', () => {
        const result = calculateLoanAmortization({
            loan: createLoan({ outstanding: 0 }),
            firstPaymentDate: new Date('2026-01-01T00:00:00.000Z')
        });
        expect(result.schedule).toEqual([]);
        expect(result.paidOff).toBe(true);
        expect(result.remainingBalance.amount).toBe(0);
    });

    it('rejects a payment that cannot reduce principal', () => {
        expect(() => calculateLoanAmortization({
            loan: createLoan({ principal: 1000, rate: 12, payment: 10 }),
            firstPaymentDate: new Date('2026-01-01T00:00:00.000Z')
        })).toThrow('must exceed the first period interest');
        expect(() => calculateLoanAmortization({
            loan: createLoan({ principal: 1000, rate: 0, payment: 0 }),
            firstPaymentDate: new Date('2026-01-01T00:00:00.000Z')
        })).toThrow('Monthly payment must be positive');
    });

    it('validates the loan, date, and schedule limit', () => {
        expect(() => calculateLoanAmortization({
            loan: {} as Loan,
            firstPaymentDate: new Date('2026-01-01T00:00:00.000Z')
        })).toThrow('validated Loan');
        expect(() => calculateLoanAmortization({
            loan: createLoan(),
            firstPaymentDate: new Date(Number.NaN)
        })).toThrow('First payment date must be valid');
        expect(() => calculateLoanAmortization({
            loan: createLoan(),
            firstPaymentDate: new Date('2026-01-01T00:00:00.000Z'),
            maximumPayments: 1201
        })).toThrow('from 1 through 1200');
    });
});
