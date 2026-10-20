function assertFinite(name, value) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

/**
 * Serialize an investment-performance summary and the exact dated cash flows
 * used for its calculation. The export contains no user-entered free text.
 */
export function investmentPerformanceToCsv({ cashFlows, result }) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
        throw new RangeError('At least two cash flows are required for export.');
    }
    let contributions = 0;
    let proceeds = 0;
    const normalizedFlows = cashFlows.map((flow) => {
        if (!flow || !(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every exported cash flow must have a valid date.');
        }
        if (!Number.isFinite(flow.amount) || flow.amount === 0) {
            throw new RangeError('Every exported cash-flow amount must be non-zero and finite.');
        }
        if (flow.amount < 0) contributions += Math.abs(flow.amount);
        else proceeds += flow.amount;
        return { date: flow.date.toISOString().slice(0, 10), amount: flow.amount };
    });
    if (!Number.isFinite(contributions) || !Number.isFinite(proceeds)) {
        throw new RangeError('Investment cash-flow totals exceed the supported numeric range.');
    }
    if (!result || typeof result !== 'object') throw new TypeError('An investment-performance result is required for export.');
    for (const [name, value] of [
        ['Gross contributions', result.grossContributions],
        ['Gross proceeds', result.grossProceeds],
        ['Net gain', result.netGain],
        ['Simple net return', result.netReturnOnContributionsPercentage],
        ['Annualized money-weighted return', result.annualizedMoneyWeightedReturn]
    ]) assertFinite(name, value);
    if (result.cashFlowCount !== cashFlows.length
        || result.grossContributions !== contributions
        || result.grossProceeds !== proceeds) {
        throw new RangeError('Investment-performance summary does not match the supplied cash flows.');
    }

    const annualizedPercentage = result.annualizedMoneyWeightedReturn * 100;
    assertFinite('Annualized money-weighted return percentage', annualizedPercentage);
    const dates = normalizedFlows.map((flow) => flow.date).sort();
    const lines = [
        'Metric,Value',
        'Currency,INR',
        `Gross contributions,${result.grossContributions}`,
        `Gross proceeds,${result.grossProceeds}`,
        `Net gain/loss,${result.netGain}`,
        `Simple net return (%),${result.netReturnOnContributionsPercentage}`,
        `Annualized money-weighted return (XIRR %),${annualizedPercentage}`,
        `Cash-flow count,${result.cashFlowCount}`,
        `Start date,${dates[0]}`,
        `End date,${dates[dates.length - 1]}`,
        '',
        'Cash-flow date,Amount (INR)',
        ...normalizedFlows.map((flow) => `${flow.date},${flow.amount}`)
    ];
    return lines.join('\r\n') + '\r\n';
}

/**
 * Serialize only dated signed cash flows in the importer's strict date,amount
 * schema so exported inputs can be re-imported without the summary section.
 */
export function investmentCashFlowsToCsv(cashFlows) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
        throw new RangeError('At least two cash flows are required for export.');
    }
    const rows = cashFlows.map((flow) => {
        if (!flow || !(flow.date instanceof Date) || !Number.isFinite(flow.date.getTime())) {
            throw new RangeError('Every exported cash flow must have a valid date.');
        }
        if (!Number.isFinite(flow.amount) || flow.amount === 0) {
            throw new RangeError('Every exported cash-flow amount must be non-zero and finite.');
        }
        return [flow.date.toISOString().slice(0, 10), flow.amount];
    });
    return [
        ['date', 'amount'],
        ...rows
    ].map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
}
