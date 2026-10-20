export interface ProgressiveTaxMathBracket {
    /** Inclusive upper bound of this bracket; null means no upper limit and is required on the final bracket. */
    readonly upperBound: number | null;
    /** Marginal rate expressed as a percentage from 0 through 100. */
    readonly marginalRatePercent: number;
}

export interface ProgressiveTaxMathResult {
    readonly estimatedTax: number;
    readonly afterTaxIncome: number;
    readonly effectiveTaxRate: number | null;
    readonly marginalRatePercent: number;
}

/** Pure numeric progressive-tax calculation shared by domain and browser adapters. */
export function estimateProgressiveTaxMath(
    taxableIncome: number,
    brackets: readonly ProgressiveTaxMathBracket[]
): ProgressiveTaxMathResult {
    if (!Number.isFinite(taxableIncome) || taxableIncome < 0) {
        throw new RangeError('Taxable income must be a non-negative finite amount.');
    }
    if (!isProgressiveTaxMathBracketArray(brackets) || brackets.length === 0) {
        throw new RangeError('At least one tax bracket is required.');
    }

    let previousUpperBound = 0;
    let previousRate = -1;
    for (let index = 0; index < brackets.length; index += 1) {
        const bracket = brackets[index];
        if (!bracket || typeof bracket !== 'object') {
            throw new TypeError('Every tax bracket must be an object.');
        }
        if (!Number.isFinite(bracket.marginalRatePercent)
            || bracket.marginalRatePercent < 0 || bracket.marginalRatePercent > 100) {
            throw new RangeError('Each marginal rate must be finite and between 0 and 100 percent.');
        }
        if (index === brackets.length - 1) {
            if (bracket.upperBound !== null) {
                throw new RangeError('The final tax bracket must have no upper bound.');
            }
        } else {
            if (bracket.upperBound === null) {
                throw new RangeError('Only the final tax bracket may have no upper bound.');
            }
            if (!Number.isFinite(bracket.upperBound) || bracket.upperBound <= previousUpperBound) {
                throw new RangeError('Tax bracket upper bounds must be positive and strictly increasing.');
            }
            previousUpperBound = bracket.upperBound;
        }
        if (bracket.marginalRatePercent < previousRate) {
            throw new RangeError('Progressive tax marginal rates must be non-decreasing.');
        }
        previousRate = bracket.marginalRatePercent;
    }

    let estimatedTax = 0;
    let lowerBound = 0;
    let marginalRatePercent = brackets[0]?.marginalRatePercent;
    for (const bracket of brackets) {
        const upperBound = bracket.upperBound === null
            ? taxableIncome
            : Math.min(taxableIncome, bracket.upperBound);
        estimatedTax += Math.max(0, upperBound - lowerBound) * bracket.marginalRatePercent / 100;
        if (!Number.isFinite(estimatedTax)) {
            throw new RangeError('Estimated tax exceeds the supported numeric range.');
        }
        marginalRatePercent = bracket.marginalRatePercent;
        if (bracket.upperBound === null || taxableIncome <= bracket.upperBound) {
            break;
        }
        lowerBound = bracket.upperBound;
    }

    const afterTaxIncome = taxableIncome - estimatedTax;
    const effectiveTaxRate = taxableIncome === 0 ? null : estimatedTax / taxableIncome * 100;
    if (!Number.isFinite(afterTaxIncome) || afterTaxIncome < 0
        || (effectiveTaxRate !== null && !Number.isFinite(effectiveTaxRate))
        || marginalRatePercent === undefined) {
        throw new RangeError('Tax estimate exceeds the supported numeric range.');
    }
    return { estimatedTax, afterTaxIncome, effectiveTaxRate, marginalRatePercent };
}

function isProgressiveTaxMathBracketArray(value: unknown): value is readonly ProgressiveTaxMathBracket[] {
    return Array.isArray(value);
}
