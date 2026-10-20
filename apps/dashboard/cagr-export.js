function assertPositiveFinite(name, value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number.`);
    }
}

/** Serialize the exact inputs and annualized rate from a completed CAGR calculation. */
export function cagrToCsv({ beginningValue, endingValue, periods, annualizedRate }) {
    assertPositiveFinite('Beginning value', beginningValue);
    assertPositiveFinite('Ending value', endingValue);
    assertPositiveFinite('Elapsed years', periods);
    if (!Number.isFinite(annualizedRate) || annualizedRate <= -1) {
        throw new RangeError('Annualized rate must be finite and greater than -100 percent.');
    }
    const annualizedPercentage = annualizedRate * 100;
    if (!Number.isFinite(annualizedPercentage)) {
        throw new RangeError('Annualized rate exceeds the supported numeric range.');
    }
    return [
        'Metric,Value',
        'Currency,INR',
        `Beginning value,${beginningValue}`,
        `Ending value,${endingValue}`,
        `Elapsed years,${periods}`,
        `Compound annual growth rate (%),${annualizedPercentage}`
    ].join('\r\n') + '\r\n';
}
