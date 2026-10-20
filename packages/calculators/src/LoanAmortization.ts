import { Money, type Currency, Loan } from '@pfo/models';

import {
    calculateLoanAmortizationCore,
    type LoanAmortizationCoreInput
} from './LoanAmortizationCore.js';

export interface LoanAmortizationInput {
    readonly loan: Loan;
    /** First payment due date. Later due dates preserve this UTC day-of-month where possible. */
    readonly firstPaymentDate: Date;
    /** Maximum schedule length; defaults to 1,200 monthly payments (100 years). */
    readonly maximumPayments?: number;
}

export interface LoanAmortizationPayment {
    readonly period: number;
    readonly dueDate: string;
    readonly openingBalance: Money;
    readonly interest: Money;
    readonly payment: Money;
    readonly principalPaid: Money;
    readonly closingBalance: Money;
}

export interface LoanAmortizationResult {
    readonly currency: Currency;
    readonly schedule: readonly LoanAmortizationPayment[];
    readonly totalInterest: Money;
    readonly totalPayments: Money;
    readonly totalPrincipalPaid: Money;
    readonly remainingBalance: Money;
    readonly paidOff: boolean;
}

/** Domain adapter for the pure, browser-compatible numeric amortization engine. */
export function calculateLoanAmortization(input: LoanAmortizationInput): LoanAmortizationResult {
    if (!(input.loan instanceof Loan)) {
        throw new TypeError('A validated Loan is required.');
    }
    const currency = input.loan.outstandingAmount.currency;
    const coreInput: LoanAmortizationCoreInput = {
        outstandingPrincipal: input.loan.outstandingAmount.amount,
        annualInterestRatePercent: input.loan.annualInterestRate.value,
        monthlyPayment: input.loan.monthlyPayment.amount,
        currency,
        firstPaymentDate: input.firstPaymentDate,
        ...(input.maximumPayments === undefined ? {} : { maximumPayments: input.maximumPayments })
    };
    const result = calculateLoanAmortizationCore(coreInput);
    return {
        currency,
        schedule: result.schedule.map((item) => ({
            period: item.period,
            dueDate: item.dueDate,
            openingBalance: new Money(item.openingBalance, currency),
            interest: new Money(item.interest, currency),
            payment: new Money(item.payment, currency),
            principalPaid: new Money(item.principalPaid, currency),
            closingBalance: new Money(item.closingBalance, currency)
        })),
        totalInterest: new Money(result.totalInterest, currency),
        totalPayments: new Money(result.totalPayments, currency),
        totalPrincipalPaid: new Money(result.totalPrincipalPaid, currency),
        remainingBalance: new Money(result.remainingBalance, currency),
        paidOff: result.paidOff
    };
}
