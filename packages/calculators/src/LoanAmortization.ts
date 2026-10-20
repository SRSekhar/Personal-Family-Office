import { Money, type Currency, Loan } from '@pfo/models';

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
    const originalBalance = loan.outstandingAmount.amount;
    const monthlyRate = loan.annualInterestRate.toDecimal() / 12;
    const scheduledPayment = loan.monthlyPayment.amount;
    if (originalBalance === 0) {
        return {
            currency,
            schedule: [],
            totalInterest: Money.zero(currency),
            totalPayments: Money.zero(currency),
            totalPrincipalPaid: Money.zero(currency),
            remainingBalance: Money.zero(currency),
            paidOff: true
        };
    }
    if (scheduledPayment <= 0) {
        throw new RangeError('Monthly payment must be positive to amortize a non-zero loan balance.');
    }

    const firstInterest = originalBalance * monthlyRate;
    if (!Number.isFinite(firstInterest)) {
        throw new RangeError('Loan interest exceeds the supported numeric range.');
    }
    if (scheduledPayment <= firstInterest) {
        throw new RangeError('Monthly payment must exceed the first period interest to amortize the loan.');
    }

    let balance = originalBalance;
    let totalInterest = 0;
    let totalPayments = 0;
    let totalPrincipalPaid = 0;
    const schedule: LoanAmortizationPayment[] = [];

    for (let period = 1; period <= maximumPayments && balance > 0; period++) {
        const interest = balance * monthlyRate;
        if (!Number.isFinite(interest)) {
            throw new RangeError('Loan interest exceeds the supported numeric range.');
        }
        const amountDue = balance + interest;
        if (!Number.isFinite(amountDue)) {
            throw new RangeError('Loan amount due exceeds the supported numeric range.');
        }
        const payment = Math.min(scheduledPayment, amountDue);
        const principalPaid = payment - interest;
        const closingBalance = Math.max(0, balance - principalPaid);
        if (![payment, principalPaid, closingBalance].every(Number.isFinite) || principalPaid <= 0) {
            throw new RangeError('Loan amortization exceeds the supported numeric range or fails to reduce principal.');
        }

        totalInterest = addFinite(totalInterest, interest, 'Total loan interest exceeds the supported numeric range.');
        totalPayments = addFinite(totalPayments, payment, 'Total loan payments exceed the supported numeric range.');
        totalPrincipalPaid = addFinite(totalPrincipalPaid, principalPaid, 'Total principal paid exceeds the supported numeric range.');

        schedule.push({
            period,
            dueDate: monthlyDueDate(firstPaymentDate, period - 1).toISOString(),
            openingBalance: new Money(balance, currency),
            interest: new Money(interest, currency),
            payment: new Money(payment, currency),
            principalPaid: new Money(principalPaid, currency),
            closingBalance: new Money(closingBalance, currency)
        });
        balance = closingBalance;
    }

    return {
        currency,
        schedule,
        totalInterest: new Money(totalInterest, currency),
        totalPayments: new Money(totalPayments, currency),
        totalPrincipalPaid: new Money(totalPrincipalPaid, currency),
        remainingBalance: new Money(balance, currency),
        paidOff: balance === 0
    };
}

function addFinite(current: number, amount: number, message: string): number {
    const result = current + amount;
    if (!Number.isFinite(result)) {
        throw new RangeError(message);
    }
    return result;
}

function monthlyDueDate(firstPaymentDate: Date, monthOffset: number): Date {
    const date = new Date(firstPaymentDate.getTime());
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + monthOffset);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
    return date;
}
