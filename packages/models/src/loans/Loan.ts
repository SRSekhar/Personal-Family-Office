import type { Identifier } from '@pfo/core';

import { Money } from '../common/Money.js';
import { Percentage } from '../common/Percentage.js';
import { Liability } from '../liabilities/Liability.js';
import { LiabilityType } from '../liabilities/LiabilityType.js';
import { LoanType } from './LoanType.js';

export class Loan extends Liability {
    public readonly loanType: LoanType;
    public readonly originalPrincipal: Money;
    public readonly annualInterestRate: Percentage;
    public readonly monthlyPayment: Money;
    public readonly startDate: Date;
    public readonly maturityDate: Date;
    public readonly lender: string | undefined;

    public constructor(
        id: Identifier,
        name: string,
        loanType: LoanType,
        originalPrincipal: Money,
        outstandingPrincipal: Money,
        annualInterestRate: Percentage,
        monthlyPayment: Money,
        startDate: Date,
        maturityDate: Date,
        lender?: string,
        description?: string
    ) {
        super(id, name, toLiabilityType(loanType), outstandingPrincipal, description);

        if (!(originalPrincipal instanceof Money) || !Number.isFinite(originalPrincipal.amount)
            || originalPrincipal.amount <= 0) {
            throw new RangeError('Original loan principal must be a positive finite Money value.');
        }
        if (!(outstandingPrincipal instanceof Money) || !Number.isFinite(outstandingPrincipal.amount)
            || outstandingPrincipal.amount < 0 || outstandingPrincipal.amount > originalPrincipal.amount) {
            throw new RangeError('Outstanding loan principal must be non-negative and no greater than original principal.');
        }
        if (!(annualInterestRate instanceof Percentage)) {
            throw new TypeError('Annual interest rate must be a Percentage value.');
        }
        if (!(monthlyPayment instanceof Money) || !Number.isFinite(monthlyPayment.amount)
            || monthlyPayment.amount < 0) {
            throw new RangeError('Monthly loan payment must be a non-negative finite Money value.');
        }
        if (originalPrincipal.currency !== outstandingPrincipal.currency
            || originalPrincipal.currency !== monthlyPayment.currency) {
            throw new RangeError('Loan principal and payment values must use the same currency.');
        }
        if (!(startDate instanceof Date) || !Number.isFinite(startDate.getTime())
            || !(maturityDate instanceof Date) || !Number.isFinite(maturityDate.getTime())) {
            throw new RangeError('Loan start and maturity dates must be valid dates.');
        }
        if (maturityDate.getTime() < startDate.getTime()) {
            throw new RangeError('Loan maturity date must be on or after the start date.');
        }
        if (lender !== undefined && (typeof lender !== 'string' || lender.trim() === '')) {
            throw new RangeError('Loan lender must be a non-empty name when provided.');
        }

        this.loanType = loanType;
        this.originalPrincipal = originalPrincipal;
        this.annualInterestRate = annualInterestRate;
        this.monthlyPayment = monthlyPayment;
        this.startDate = new Date(startDate.getTime());
        this.maturityDate = new Date(maturityDate.getTime());
        this.lender = lender?.trim();
    }

    public override updateOutstandingAmount(amount: Money): Loan {
        return new Loan(
            this.id,
            this.name,
            this.loanType,
            this.originalPrincipal,
            amount,
            this.annualInterestRate,
            this.monthlyPayment,
            this.startDate,
            this.maturityDate,
            this.lender,
            this.description
        );
    }
}

function toLiabilityType(type: LoanType): LiabilityType {
    switch (type) {
        case LoanType.HomeLoan:
            return LiabilityType.HomeLoan;
        case LoanType.PersonalLoan:
            return LiabilityType.PersonalLoan;
        case LoanType.VehicleLoan:
            return LiabilityType.VehicleLoan;
        case LoanType.EducationLoan:
            return LiabilityType.EducationLoan;
        case LoanType.Mortgage:
            return LiabilityType.Mortgage;
        case LoanType.BusinessLoan:
            return LiabilityType.BusinessLoan;
        default:
            throw new RangeError('Unsupported loan type.');
    }
}
