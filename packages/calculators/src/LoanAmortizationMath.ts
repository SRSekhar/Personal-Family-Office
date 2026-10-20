export interface LoanAmortizationMathInput {
    readonly outstandingPrincipal: number;
    /** Nominal annual percentage, from 0 through 100. */
    readonly annualInterestRatePercent: number;
    readonly monthlyPayment: number;
    readonly firstPaymentDate: Date;
    readonly maximumPayments?: number;
}

export interface LoanAmortizationMathPayment {
    readonly period: number;
    readonly dueDate: string;
    readonly openingBalance: number;
    readonly interest: number;
    readonly payment: number;
    readonly principalPaid: number;
    readonly closingBalance: number;
}

export interface LoanAmortizationMathResult {
    readonly schedule: readonly LoanAmortizationMathPayment[];
    readonly totalInterest: number;
    readonly totalPayments: number;
    readonly totalPrincipalPaid: number;
    readonly remainingBalance: number;
    readonly paidOff: boolean;
}

/** Pure numeric monthly amortization shared by domain and local-browser adapters. */
export function calculateLoanAmortizationMath({
    outstandingPrincipal,
    annualInterestRatePercent,
    monthlyPayment,
    firstPaymentDate,
    maximumPayments = 1200
}: LoanAmortizationMathInput): LoanAmortizationMathResult {
    if (!Number.isFinite(outstandingPrincipal) || outstandingPrincipal < 0) {
        throw new RangeError('Outstanding principal must be a non-negative finite amount.');
    }
    if (!Number.isFinite(annualInterestRatePercent) || annualInterestRatePercent < 0 || annualInterestRatePercent > 100) {
        throw new RangeError('Annual interest rate must be between 0 and 100 percent.');
    }
    if (!Number.isFinite(monthlyPayment) || monthlyPayment < 0) {
        throw new RangeError('Monthly payment must be a non-negative finite amount.');
    }
    if (!(firstPaymentDate instanceof Date) || !Number.isFinite(firstPaymentDate.getTime())) {
        throw new RangeError('First payment date must be valid.');
    }
    if (!Number.isInteger(maximumPayments) || maximumPayments < 1 || maximumPayments > 1200) {
        throw new RangeError('Maximum payments must be an integer from 1 through 1200.');
    }
    const monthlyRate = annualInterestRatePercent / 100 / 12;
    if (outstandingPrincipal === 0) {
        return { schedule: [], totalInterest: 0, totalPayments: 0, totalPrincipalPaid: 0, remainingBalance: 0, paidOff: true };
    }
    if (monthlyPayment <= 0) {
        throw new RangeError('Monthly payment must be positive to amortize a non-zero loan balance.');
    }
    const firstInterest = outstandingPrincipal * monthlyRate;
    if (!Number.isFinite(firstInterest)) {
        throw new RangeError('Loan interest exceeds the supported numeric range.');
    }
    if (monthlyPayment <= firstInterest) {
        throw new RangeError('Monthly payment must exceed the first period interest to amortize the loan.');
    }
    let balance = outstandingPrincipal;
    let totalInterest = 0;
    let totalPayments = 0;
    let totalPrincipalPaid = 0;
    const schedule: LoanAmortizationMathPayment[] = [];
    for (let period = 1; period <= maximumPayments && balance > 0; period += 1) {
        const interest = balance * monthlyRate;
        if (!Number.isFinite(interest)) {
            throw new RangeError('Loan interest exceeds the supported numeric range.');
        }
        const amountDue = balance + interest;
        if (!Number.isFinite(amountDue)) {
            throw new RangeError('Loan amount due exceeds the supported numeric range.');
        }
        const payment = Math.min(monthlyPayment, amountDue);
        const principalPaid = payment - interest;
        const closingBalance = Math.max(0, balance - principalPaid);
        if (![payment, principalPaid, closingBalance].every(Number.isFinite) || principalPaid <= 0) {
            throw new RangeError('Loan amortization exceeds the supported numeric range or fails to reduce principal.');
        }
        totalInterest = addFinite(totalInterest, interest, 'Total loan interest exceeds the supported numeric range.');
        totalPayments = addFinite(totalPayments, payment, 'Total loan payments exceed the supported numeric range.');
        totalPrincipalPaid = addFinite(totalPrincipalPaid, principalPaid, 'Total principal paid exceeds the supported numeric range.');
        schedule.push({
            period, dueDate: monthlyDueDate(firstPaymentDate, period - 1).toISOString(),
            openingBalance: balance, interest, payment, principalPaid, closingBalance
        });
        balance = closingBalance;
    }
    return { schedule, totalInterest, totalPayments, totalPrincipalPaid, remainingBalance: balance, paidOff: balance === 0 };
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