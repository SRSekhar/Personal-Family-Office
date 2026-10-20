import { Money, type Currency, Loan } from '@pfo/models';

import { calculateLoanAmortizationMath } from './LoanAmortizationMath.js';

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

/**
 * Builds a fixed-payment monthly amortization estimate for a validated Loan.
 *
 * Assumptions: nominal annual rate divided by 12, interest calculated on each
 * period's opening balance, payment at period end, no fees/taxes/rate changes,
 * and no currency-specific rounding. The first payment date is explicit.
 * A non-amortizing payment is rejected. If maximumPayments is reached first,
 * the remaining balance is returned with paidOff=false rather than implying payoff.
 */
export function calculateLoanAmortization({
    loan,
    firstPaymentDate,
    maximumPayments = 1200
}: LoanAmortizationInput): LoanAmortizationResult {
    if (!(loan instanceof Loan)) {
        throw new TypeError('A validated Loan is required.');
    }
    if (!(firstPaymentDate instanceof Date) || !Number.isFinite(firstPaymentDate.getTime())) {
        throw new RangeError('First payment date must be valid.');
    }
    if (!Number.isInteger(maximumPayments) || maximumPayments < 1 || maximumPayments > 1200) {
        throw new RangeError('Maximum payments must be an integer from 1 through 1200.');
    }

    const currency = loan.outstandingAmount.currency;
    const result = calculateLoanAmortizationMath({
        outstandingPrincipal: loan.outstandingAmount.amount,
        annualInterestRatePercent: loan.annualInterestRate.value,
        monthlyPayment: loan.monthlyPayment.amount,
        firstPaymentDate,
        maximumPayments
    });
    return {
        currency,
        schedule: result.schedule.map((payment) => ({
            period: payment.period,
            dueDate: payment.dueDate,
            openingBalance: new Money(payment.openingBalance, currency),
            interest: new Money(payment.interest, currency),
            payment: new Money(payment.payment, currency),
            principalPaid: new Money(payment.principalPaid, currency),
            closingBalance: new Money(payment.closingBalance, currency)
        })),
        totalInterest: new Money(result.totalInterest, currency),
        totalPayments: new Money(result.totalPayments, currency),
        totalPrincipalPaid: new Money(result.totalPrincipalPaid, currency),
        remainingBalance: new Money(result.remainingBalance, currency),
        paidOff: result.paidOff
    };
}

