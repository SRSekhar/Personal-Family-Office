import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Currency,
    LiabilityType,
    Loan,
    LoanType,
    Money,
    Percentage
} from '../src/index.js';

function createLoan(overrides: Partial<{
    originalPrincipal: Money;
    outstandingPrincipal: Money;
    annualInterestRate: Percentage;
    monthlyPayment: Money;
    startDate: Date;
    maturityDate: Date;
    lender: string;
}> = {}): Loan {
    return new Loan(
        Identifier.create('loan-1'),
        'Home loan',
        LoanType.HomeLoan,
        overrides.originalPrincipal ?? new Money(5_000_000, Currency.INR),
        overrides.outstandingPrincipal ?? new Money(4_000_000, Currency.INR),
        overrides.annualInterestRate ?? new Percentage(8.5),
        overrides.monthlyPayment ?? new Money(42_000, Currency.INR),
        overrides.startDate ?? new Date('2020-01-01T00:00:00.000Z'),
        overrides.maturityDate ?? new Date('2040-01-01T00:00:00.000Z'),
        overrides.lender ?? 'Example Bank'
    );
}

describe('Loan', () => {
    it('models loan terms while remaining usable as a Liability', () => {
        const loan = createLoan();
        expect(loan).toBeInstanceOf(Loan);
        expect(loan.type).toBe(LiabilityType.HomeLoan);
        expect(loan.loanType).toBe(LoanType.HomeLoan);
        expect(loan.originalPrincipal.amount).toBe(5_000_000);
        expect(loan.outstandingAmount.amount).toBe(4_000_000);
        expect(loan.annualInterestRate.value).toBe(8.5);
        expect(loan.monthlyPayment.amount).toBe(42_000);
        expect(loan.lender).toBe('Example Bank');
    });

    it('updates outstanding principal immutably and preserves loan terms', () => {
        const loan = createLoan();
        const updated = loan.updateOutstandingAmount(new Money(3_900_000, Currency.INR));
        expect(updated).toBeInstanceOf(Loan);
        expect(updated.id.equals(loan.id)).toBe(true);
        expect(updated.outstandingAmount.amount).toBe(3_900_000);
        expect(updated.originalPrincipal.amount).toBe(loan.originalPrincipal.amount);
        expect(updated.monthlyPayment.amount).toBe(loan.monthlyPayment.amount);
        expect(loan.outstandingAmount.amount).toBe(4_000_000);
    });

    it('rejects invalid principal values and currency mismatches', () => {
        expect(() => createLoan({ originalPrincipal: new Money(0, Currency.INR) }))
            .toThrow('positive finite');
        expect(() => createLoan({ outstandingPrincipal: new Money(-1, Currency.INR) }))
            .toThrow('non-negative');
        expect(() => createLoan({ outstandingPrincipal: new Money(5_100_000, Currency.INR) }))
            .toThrow('no greater than original');
        expect(() => createLoan({ monthlyPayment: new Money(-1, Currency.INR) }))
            .toThrow('non-negative finite');
        expect(() => createLoan({ monthlyPayment: new Money(1, Currency.USD) }))
            .toThrow('same currency');
    });

    it('rejects invalid dates and maturity before start', () => {
        expect(() => createLoan({ startDate: new Date(Number.NaN) })).toThrow('valid dates');
        expect(() => createLoan({
            startDate: new Date('2040-01-02T00:00:00.000Z'),
            maturityDate: new Date('2040-01-01T00:00:00.000Z')
        })).toThrow('on or after the start date');
    });

    it('rejects empty lender names when provided', () => {
        expect(() => createLoan({ lender: '   ' })).toThrow('non-empty name');
    });
});
