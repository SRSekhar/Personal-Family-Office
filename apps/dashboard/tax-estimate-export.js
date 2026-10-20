function assertFiniteNonNegative(name, value) {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite, non-negative amount.`);
    }
}

function assertRate(name, value) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError(`${name} must be between 0 and 100 percent.`);
    }
}

/**
 * Serialize a validated caller-defined tax estimate and its supplied brackets.
 * The output deliberately contains numeric values and fixed headings only.
 */
export function taxEstimateToCsv({ taxableIncome, brackets, result }) {
    assertFiniteNonNegative('Taxable income', taxableIncome);
    if (!Array.isArray(brackets) || brackets.length === 0) {
        throw new RangeError('At least one tax bracket is required for export.');
    }

    let previousUpperBound = 0;
    brackets.forEach((bracket, index) => {
        if (!bracket || typeof bracket !== 'object') {
            throw new TypeError('Every exported tax bracket must be an object.');
        }
        assertRate('Marginal tax rate', bracket.marginalRatePercent);
        const final = index === brackets.length - 1;
        if (final ? bracket.upperBound !== null : !Number.isFinite(bracket.upperBound)) {
            throw new RangeError('Only the final tax bracket may have no upper limit.');
        }
        if (!final) {
            if (bracket.upperBound <= previousUpperBound) {
                throw new RangeError('Tax bracket upper bounds must be strictly increasing.');
            }
            previousUpperBound = bracket.upperBound;
        }
    });

    if (!result || typeof result !== 'object') throw new TypeError('A tax estimate result is required for export.');
    assertFiniteNonNegative('Estimated tax', result.estimatedTax);
    assertFiniteNonNegative('After-tax income', result.afterTaxIncome);
    if (result.effectiveTaxRate !== null) assertRate('Effective tax rate', result.effectiveTaxRate);
    assertRate('Marginal tax rate', result.marginalRatePercent);

    const lines = [
        'Metric,Value',
        'Currency,INR',
        `Taxable income,${taxableIncome}`,
        `Estimated tax,${result.estimatedTax}`,
        `Income after estimated tax,${result.afterTaxIncome}`,
        `Effective tax rate (%),${result.effectiveTaxRate === null ? '' : result.effectiveTaxRate}`,
        `Marginal rate at income (%),${result.marginalRatePercent}`,
        '',
        'Bracket,Upper income bound,Marginal rate (%)',
        ...brackets.map((bracket, index) =>
            `${index + 1},${bracket.upperBound === null ? 'No upper limit' : bracket.upperBound},${bracket.marginalRatePercent}`)
    ];
    return lines.join('\r\n') + '\r\n';
}
