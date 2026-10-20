import { Money, type Currency, Percentage } from '@pfo/models';

export interface ProgressiveTaxBracket {
    /** Inclusive upper bound of this bracket; null means no upper limit and is required on the final bracket. */
    readonly upperBound: Money | null;
    /** Marginal percentage applied only to income within this bracket. */
    readonly marginalRate: Percentage;
}

export interface ProgressiveTaxEstimateInput {
    readonly taxableIncome: Money;
    /** Caller-supplied brackets in ascending upper-bound order; no jurisdiction is assumed. */
    readonly brackets: readonly ProgressiveTaxBracket[];
}

export interface ProgressiveTaxEstimate {
    readonly currency: Currency;
    readonly taxableIncome: Money;
    readonly estimatedTax: Money;
    readonly afterTaxIncome: Money;
    /** Estimated tax divided by taxable income, as a percentage; null when taxable income is zero. */
    readonly effectiveTaxRate: number | null;
    /** Rate applied to the final occupied bracket. */
    readonly marginalRate: Percentage;
}

/**
 * Estimates tax using a caller-supplied progressive marginal-rate schedule.
 * This function does not embed jurisdiction rules or calculate deductions,
 * credits, surcharges, cess, exemptions, or filing status.
 */
export function estimateProgressiveTax({
    taxableIncome,
    brackets
}: ProgressiveTaxEstimateInput): ProgressiveTaxEstimate {
    if (!(taxableIncome instanceof Money) || !Number.isFinite(taxableIncome.amount)
        || taxableIncome.amount < 0) {
        throw new RangeError('Taxable income must be a non-negative finite Money value.');
    }
    if (!isBracketArray(brackets) || brackets.length === 0) {
        throw new RangeError('At least one tax bracket is required.');
    }

    const currency = taxableIncome.currency;
    let previousUpperBound = 0;
    let previousRate = -1;
    for (let index = 0; index < brackets.length; index++) {
        const bracket = brackets[index];
        if (bracket === undefined || typeof bracket !== 'object'
            || !(bracket.marginalRate instanceof Percentage)) {
            throw new TypeError('Every tax bracket must include a valid Percentage rate.');
        }
        if (index === brackets.length - 1) {
            if (bracket.upperBound !== null) {
                throw new RangeError('The final tax bracket must have no upper bound.');
            }
        } else {
            if (bracket.upperBound === null) {
                throw new RangeError('Only the final tax bracket may have no upper bound.');
            }
            if (!(bracket.upperBound instanceof Money) || !Number.isFinite(bracket.upperBound.amount)
                || bracket.upperBound.amount <= previousUpperBound) {
                throw new RangeError('Tax bracket upper bounds must be positive and strictly increasing.');
            }
            if (bracket.upperBound.currency !== currency) {
                throw new RangeError('Taxable income and bracket bounds must use the same currency.');
            }
            previousUpperBound = bracket.upperBound.amount;
        }
        if (bracket.marginalRate.value < previousRate) {
            throw new RangeError('Progressive tax marginal rates must be non-decreasing.');
        }
        previousRate = bracket.marginalRate.value;
    }

    let estimatedTax = 0;
    let lowerBound = 0;
    let marginalRate = brackets[0]?.marginalRate;
    for (const bracket of brackets) {
        const upperBound = bracket.upperBound === null
            ? taxableIncome.amount
            : Math.min(taxableIncome.amount, bracket.upperBound.amount);
        const incomeInBracket = Math.max(0, upperBound - lowerBound);
        estimatedTax += incomeInBracket * bracket.marginalRate.toDecimal();
        if (!Number.isFinite(estimatedTax)) {
            throw new RangeError('Estimated tax exceeds the supported numeric range.');
        }
        marginalRate = bracket.marginalRate;
        if (bracket.upperBound === null || taxableIncome.amount <= bracket.upperBound.amount) {
            break;
        }
        lowerBound = bracket.upperBound.amount;
    }

    const afterTaxIncome = taxableIncome.amount - estimatedTax;
    const effectiveTaxRate = taxableIncome.amount === 0
        ? null
        : (estimatedTax / taxableIncome.amount) * 100;
    if (!Number.isFinite(afterTaxIncome) || afterTaxIncome < 0
        || (effectiveTaxRate !== null && !Number.isFinite(effectiveTaxRate))) {
        throw new RangeError('Tax estimate exceeds the supported numeric range.');
    }

    if (marginalRate === undefined) {
        throw new RangeError('At least one valid tax bracket is required.');
    }
    return {
        currency,
        taxableIncome,
        estimatedTax: new Money(estimatedTax, currency),
        afterTaxIncome: new Money(afterTaxIncome, currency),
        effectiveTaxRate,
        marginalRate
    };
}

function isBracketArray(value: unknown): value is readonly ProgressiveTaxBracket[] {
    return Array.isArray(value);
}
