const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function canonicalTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new RangeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function finite(value, label, { minimum = Number.NEGATIVE_INFINITY } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
        throw new RangeError(label + ' must be a finite number' + (Number.isFinite(minimum) ? ' not below ' + minimum : '') + '.');
    }
    return value;
}

function validatePosition(position, index) {
    const label = 'Portfolio position ' + (index + 1);
    if (!position || typeof position !== 'object'
        || typeof position.accountId !== 'string' || !position.accountId.trim()
        || typeof position.accountName !== 'string' || !position.accountName.trim()
        || typeof position.instrumentId !== 'string' || !position.instrumentId.trim()
        || typeof position.instrumentName !== 'string' || !position.instrumentName.trim()
        || typeof position.currency !== 'string' || !CURRENCIES.has(position.currency)) {
        throw new RangeError(label + ' has invalid identity, names or currency.');
    }
    finite(position.quantity, label + ' quantity', { minimum: 0 });
    finite(position.openLotCount, label + ' open lot count', { minimum: 0 });
    if (!Number.isInteger(position.openLotCount)) throw new RangeError(label + ' open lot count must be an integer.');
    finite(position.costBasis, label + ' cost basis', { minimum: 0 });
    finite(position.realizedGain, label + ' realized gain');
    finite(position.dividendIncome, label + ' dividend income', { minimum: 0 });
    finite(position.interestIncome, label + ' interest income', { minimum: 0 });
    finite(position.fees, label + ' fees', { minimum: 0 });
    finite(position.taxes, label + ' taxes', { minimum: 0 });
    for (const [key, value] of [['marketPrice', position.marketPrice], ['marketValue', position.marketValue]]) {
        if (value !== null) finite(value, label + ' ' + key, { minimum: 0 });
    }
    if (position.unrealizedGain !== null) finite(position.unrealizedGain, label + ' unrealized gain');
    if (position.quantity > 0 && (position.marketValue === null || position.unrealizedGain === null)) {
        // An open position may legitimately have unavailable valuation evidence.
    }
    if (position.valuationAsOf !== null) canonicalTimestamp(position.valuationAsOf, label + ' valuation timestamp');
    if (position.valuationSource !== null && typeof position.valuationSource !== 'string') {
        throw new RangeError(label + ' valuation source must be text or null.');
    }
    if (position.valuationSourceType !== null && !['manual', 'provider'].includes(position.valuationSourceType)) {
        throw new RangeError(label + ' valuation source type is unsupported.');
    }
}

function validatePerformance(result, index) {
    const label = 'Portfolio performance result ' + (index + 1);
    if (!result || typeof result !== 'object' || typeof result.currency !== 'string' || !CURRENCIES.has(result.currency)
        || !['available', 'unavailable'].includes(result.status)) {
        throw new RangeError(label + ' has an invalid currency or status.');
    }
    if (result.status === 'available') {
        finite(result.xirr, label + ' XIRR');
        finite(result.terminalValue, label + ' terminal value', { minimum: 0 });
        finite(result.cashBalance, label + ' cash balance');
        finite(result.holdingsValue, label + ' holdings value', { minimum: 0 });
        finite(result.cashFlowCount, label + ' cash-flow count', { minimum: 0 });
        if (!Number.isInteger(result.cashFlowCount)) throw new RangeError(label + ' cash-flow count must be an integer.');
    } else if (typeof result.reason !== 'string' || !result.reason.trim()) {
        throw new RangeError(label + ' must include an unavailable reason.');
    }
}

/**
 * Render a local-only investment portfolio review from the existing FIFO
 * position projection and ledger-backed XIRR results. This module adds no
 * financial formula, market data, FX conversion, or tax calculation.
 */
export function renderInvestmentPortfolioReportHtml(input) {
    const data = validateReportInput(input);
    const { positions, performance, performanceError, asOfAt, recordedAtCutoff, generatedAt } = data;
    const currencies = [...new Set([...positions.map((item) => item.currency), ...performance.map((item) => item.currency)])].sort();
    const sections = currencies.map((currency) => {
        const items = positions.filter((item) => item.currency === currency);
        const summary = summarizeCurrency(items);
        const xirr = performance.find((item) => item.currency === currency);
        const xirrText = performanceError
            ? 'Unavailable — ' + performanceError
            : !xirr ? 'Unavailable — no complete XIRR result was produced'
                : xirr.status === 'available' ? new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 2 }).format(xirr.xirr)
                    : 'Unavailable — ' + xirr.reason;
        const metrics = [
            ['Open cost basis', money(summary.costBasis, currency)],
            ['Market value', summary.marketValue === null ? 'Unavailable — open position valuation missing' : money(summary.marketValue, currency)],
            ['Realized P&L', money(summary.realizedGain, currency)],
            ['Unrealized P&L', summary.unrealizedGain === null ? 'Unavailable — open position valuation missing' : money(summary.unrealizedGain, currency)],
            ['Dividends', money(summary.dividends, currency)],
            ['Interest', money(summary.interest, currency)],
            ['Fees', money(summary.fees, currency)],
            ['Taxes recorded', money(summary.taxes, currency)],
            ['Net gain / loss', summary.netGain === null ? 'Unavailable — open position valuation missing' : money(summary.netGain, currency)],
            ['Annualized money-weighted return (XIRR)', xirrText]
        ];
        const cards = metrics.map(([label, value]) => '<article class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></article>').join('');
        const rows = items.map((item) => positionRow(item)).join('')
            || '<tr><td colspan="13">No investment positions are recorded in this currency at the selected as-of date.</td></tr>';
        const xirrDetail = !xirr ? 'No XIRR result was produced for this currency.'
            : xirr.status === 'available'
                ? xirr.cashFlowCount + ' dated investor cash flows · terminal value ' + money(xirr.terminalValue, currency)
                    + ' · cash ' + money(xirr.cashBalance, currency) + ' · holdings ' + money(xirr.holdingsValue, currency)
                : xirr.reason;
        return '<section><h2>Currency review — ' + escapeHtml(currency) + '</h2><div class="summary">' + cards + '</div>'
            + '<p class="muted">XIRR: ' + escapeHtml(xirrText) + '. ' + escapeHtml(xirrDetail) + '</p>'
            + '<div class="table-wrap"><table><thead><tr><th>Account</th><th>Instrument</th><th class="numeric">Quantity</th><th class="numeric">Open cost basis</th><th class="numeric">Market value</th><th class="numeric">Realized P&amp;L</th><th class="numeric">Unrealized P&amp;L</th><th class="numeric">Dividends</th><th class="numeric">Interest</th><th class="numeric">Fees</th><th class="numeric">Taxes</th><th class="numeric">Net gain</th><th>Valuation provenance</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
    }).join('');
    const empty = currencies.length === 0 ? '<section><h2>No investment performance data</h2><p>No positions or per-currency XIRR results were available at the selected as-of date.</p></section>' : '';
    const generatedLabel = timestampLabel(generatedAt);
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>PFO OS — Investment portfolio review</title><style>'
        + ':root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}'
        + 'body{margin:0;padding:clamp(1rem,4vw,2.5rem);line-height:1.5}main{max-width:1400px;margin:0 auto}'
        + 'header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}'
        + 'h1{font-size:clamp(1.5rem,4vw,2.25rem);margin:.2rem 0}h2{font-size:1.15rem;margin-top:0}.muted{color:#52645d;font-size:.9rem;overflow-wrap:anywhere}'
        + '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.7rem;margin:1rem 0}'
        + '.metric{background:#f5f8f6;border:1px solid #e0e8e2;border-radius:8px;padding:.85rem;min-width:0}.metric span{display:block;color:#52645d;font-size:.82rem}'
        + '.metric strong{display:block;margin-top:.35rem;font-size:1.08rem;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}'
        + 'table{width:100%;border-collapse:collapse;min-width:1180px}th,td{text-align:left;padding:.65rem .5rem;border-bottom:1px solid #dce5df;vertical-align:top;overflow-wrap:anywhere}'
        + 'th{background:#f5f8f6;font-size:.8rem}.numeric{text-align:right;font-variant-numeric:tabular-nums}footer{font-size:.88rem;color:#52645d}'
        + '@page{margin:12mm}@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid;border-radius:0}.table-wrap{overflow:visible}table{font-size:7pt;min-width:0}tr{break-inside:avoid}}'
        + '</style></head><body><main><header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Investment portfolio review</h1>'
        + '<p class="muted">As-of: ' + escapeHtml(timestampLabel(asOfAt)) + ' UTC · Recorded-at cutoff: ' + escapeHtml(timestampLabel(recordedAtCutoff))
        + '<br>Generated locally: ' + escapeHtml(generatedLabel) + ' IST · Currencies are presented separately; no FX conversion is performed.</p></header>'
        + (performanceError ? '<section><h2>Money-weighted performance status</h2><p>Portfolio XIRR unavailable: ' + escapeHtml(performanceError) + '</p></section>' : '')
        + (sections || empty)
        + '<footer><strong>Methodology and limitations</strong><p>Position quantities and cost basis use the existing FIFO ledger projection. Realized and unrealized P&amp;L, recorded dividends/interest, fees and taxes are descriptive ledger-derived amounts. Net gain is realized plus unrealized price gain plus recorded income less recorded fees and taxes; it is not XIRR, a tax calculation, or a forecast.</p>'
        + '<p>XIRR is the existing annualized money-weighted return based on explicit investor cash flows and a complete terminal value. An unavailable XIRR remains unavailable; no partial terminal value is substituted. Market values use recorded valuations only. Missing open-position valuations suppress market value, unrealized P&amp;L and net gain totals for the affected currency.</p>'
        + '<p>No currency conversion, inferred prices, external market-data lookup, corporate-action adjustment, in-kind flow treatment, tax advice, risk score, recommendation or trading instruction is included. This standalone report contains no scripts, remote assets or network dependencies. It may contain sensitive household financial information; keep it private.</p></footer>'
        + '</main></body></html>';
}

function positionRow(item) {
    const unrealized = item.quantity === 0 ? 'Not applicable — position closed'
        : item.unrealizedGain === null ? 'Unavailable' : money(item.unrealizedGain, item.currency);
    const marketValue = item.quantity === 0 ? money(0, item.currency)
        : item.marketValue === null ? 'Unavailable' : money(item.marketValue, item.currency);
    const netGain = item.quantity > 0 && item.unrealizedGain === null ? 'Unavailable'
        : money(item.realizedGain + (item.quantity === 0 ? 0 : item.unrealizedGain)
            + item.dividendIncome + item.interestIncome - item.fees - item.taxes, item.currency);
    const provenance = item.valuationAsOf
        ? timestampLabel(item.valuationAsOf) + ' · ' + (item.valuationSourceType ?? 'unknown') + ' · ' + (item.valuationSource ?? 'unnamed source')
        : item.quantity > 0 ? 'Missing valuation' : 'Closed position; no valuation required';
    const values = [
        item.accountName, item.instrumentName, number(item.quantity), money(item.costBasis, item.currency), marketValue,
        money(item.realizedGain, item.currency), unrealized, money(item.dividendIncome, item.currency),
        money(item.interestIncome, item.currency), money(item.fees, item.currency), money(item.taxes, item.currency),
        netGain, provenance
    ];
    return '<tr>' + values.map((value, index) => '<td' + ([2,3,4,5,6,7,8,9,10,11].includes(index) ? ' class="numeric"' : '') + '>' + escapeHtml(value) + '</td>').join('') + '</tr>';
}

function summarizeCurrency(items) {
    const openValuationMissing = items.some((item) => item.quantity > 0
        && (item.marketValue === null || item.unrealizedGain === null));
    const sum = (key) => items.reduce((total, item) => total + item[key], 0);
    const costBasis = sum('costBasis');
    const realizedGain = sum('realizedGain');
    const dividends = sum('dividendIncome');
    const interest = sum('interestIncome');
    const fees = sum('fees');
    const taxes = sum('taxes');
    const marketValue = openValuationMissing ? null
        : items.reduce((total, item) => total + (item.quantity === 0 ? 0 : item.marketValue), 0);
    const unrealizedGain = openValuationMissing ? null
        : items.reduce((total, item) => total + (item.quantity === 0 ? 0 : item.unrealizedGain), 0);
    return {
        costBasis, realizedGain, dividends, interest, fees, taxes, marketValue, unrealizedGain,
        netGain: openValuationMissing ? null : realizedGain + unrealizedGain + dividends + interest - fees - taxes
    };
}

function money(value, currency) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function number(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 8 }).format(value);
}

function timestampLabel(value) {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
}

function csvText(value) {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}

function csvNumber(value) {
    return value === null || value === undefined ? '' : String(finite(value, 'CSV numeric value'));
}

function validateReportInput(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.positions) || !Array.isArray(input.performance)) {
        throw new TypeError('Validated portfolio positions and performance results are required.');
    }
    const asOfAt = canonicalTimestamp(input.asOfAt, 'Portfolio as-of timestamp');
    const recordedAtCutoff = canonicalTimestamp(input.recordedAtCutoff, 'Portfolio recorded-at cutoff');
    const generatedAt = canonicalTimestamp(input.generatedAt, 'Report generation timestamp');
    if (asOfAt > recordedAtCutoff) throw new RangeError('Portfolio as-of timestamp cannot be after its recorded-at cutoff.');
    if (input.performanceError !== undefined && input.performanceError !== null
        && (typeof input.performanceError !== 'string' || !input.performanceError.trim())) {
        throw new RangeError('Portfolio performance error must be non-empty text when supplied.');
    }
    const seen = new Set();
    input.positions.forEach((position, index) => {
        validatePosition(position, index);
        const key = position.accountId + '\u0000' + position.instrumentId;
        if (seen.has(key)) throw new RangeError('Portfolio report contains duplicate account/instrument positions.');
        seen.add(key);
    });
    input.performance.forEach(validatePerformance);
    if (new Set(input.performance.map((item) => item.currency)).size !== input.performance.length) {
        throw new RangeError('Portfolio report contains duplicate currency performance results.');
    }
    return {
        positions: input.positions,
        performance: input.performance,
        performanceError: input.performanceError ?? null,
        asOfAt, recordedAtCutoff, generatedAt
    };
}

/** Spreadsheet-safe CSV export of currency summaries and the exact FIFO position rows. */
export function investmentPortfolioReportToCsv(input) {
    const data = validateReportInput(input);
    const { positions, performance, performanceError, asOfAt, recordedAtCutoff, generatedAt } = data;
    const header = [
        'RecordType', 'Status', 'Currency', 'AsOfAt', 'RecordedAtCutoff', 'GeneratedAt',
        'AccountName', 'AccountId', 'InstrumentName', 'InstrumentId', 'Quantity', 'OpenLotCount',
        'OpenCostBasis', 'MarketPrice', 'MarketValue', 'RealizedGain', 'UnrealizedGain',
        'DividendIncome', 'InterestIncome', 'Fees', 'Taxes', 'NetGain', 'ValuationAsOf',
        'ValuationSourceType', 'ValuationSource', 'Xirr', 'TerminalValue', 'CashBalance',
        'HoldingsValue', 'CashFlowCount', 'Reason'
    ];
    const rows = [];
    const currencies = [...new Set([...positions.map((item) => item.currency), ...performance.map((item) => item.currency)])].sort();
    for (const currency of currencies) {
        const items = positions.filter((item) => item.currency === currency);
        const summary = summarizeCurrency(items);
        const result = performance.find((item) => item.currency === currency);
        const status = summary.netGain === null ? 'incomplete' : 'available';
        const reason = summary.netGain === null ? 'One or more open positions has no eligible valuation.' : '';
        rows.push([
            csvText('Summary'), csvText(status), csvText(currency), csvText(asOfAt), csvText(recordedAtCutoff), csvText(generatedAt),
            '', '', '', '', '', '', csvNumber(summary.costBasis), '', csvNumber(summary.marketValue),
            csvNumber(summary.realizedGain), csvNumber(summary.unrealizedGain), csvNumber(summary.dividends),
            csvNumber(summary.interest), csvNumber(summary.fees), csvNumber(summary.taxes), csvNumber(summary.netGain),
            '', '', '', result?.status === 'available' ? csvNumber(result.xirr) : '',
            result?.status === 'available' ? csvNumber(result.terminalValue) : '',
            result?.status === 'available' ? csvNumber(result.cashBalance) : '',
            result?.status === 'available' ? csvNumber(result.holdingsValue) : '',
            result?.status === 'available' ? csvNumber(result.cashFlowCount) : '',
            csvText(performanceError ?? (result?.status === 'unavailable' ? result.reason : reason))
        ].join(','));
        for (const item of items) {
            const netGain = item.quantity > 0 && item.unrealizedGain === null ? null
                : item.realizedGain + (item.quantity === 0 ? 0 : item.unrealizedGain)
                    + item.dividendIncome + item.interestIncome - item.fees - item.taxes;
            rows.push([
                csvText('Position'), csvText(netGain === null ? 'incomplete' : 'available'), csvText(currency),
                csvText(asOfAt), csvText(recordedAtCutoff), csvText(generatedAt),
                csvText(item.accountName), csvText(item.accountId), csvText(item.instrumentName), csvText(item.instrumentId),
                csvNumber(item.quantity), csvNumber(item.openLotCount), csvNumber(item.costBasis),
                csvNumber(item.marketPrice), csvNumber(item.quantity === 0 ? 0 : item.marketValue),
                csvNumber(item.realizedGain), csvNumber(item.quantity === 0 ? 0 : item.unrealizedGain),
                csvNumber(item.dividendIncome), csvNumber(item.interestIncome), csvNumber(item.fees), csvNumber(item.taxes),
                csvNumber(netGain), csvText(item.valuationAsOf ?? ''), csvText(item.valuationSourceType ?? ''),
                csvText(item.valuationSource ?? ''), '', '', '', '', '',
                csvText(netGain === null ? 'Open position valuation is unavailable.' : '')
            ].join(','));
        }
        rows.push([
            csvText('XIRR'), csvText(result?.status ?? 'unavailable'), csvText(currency),
            csvText(asOfAt), csvText(recordedAtCutoff), csvText(generatedAt),
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            result?.status === 'available' ? csvNumber(result.xirr) : '',
            result?.status === 'available' ? csvNumber(result.terminalValue) : '',
            result?.status === 'available' ? csvNumber(result.cashBalance) : '',
            result?.status === 'available' ? csvNumber(result.holdingsValue) : '',
            result?.status === 'available' ? csvNumber(result.cashFlowCount) : '',
            csvText(performanceError ?? (result?.status === 'unavailable' ? result.reason : 'No complete XIRR result was produced.'))
        ].join(','));
    }
    if (performanceError) {
        rows.push([
            csvText('Error'), csvText('unavailable'), '', csvText(asOfAt), csvText(recordedAtCutoff), csvText(generatedAt),
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', csvText(performanceError)
        ].join(','));
    }
    return [header.join(','), ...rows].join('\r\n') + '\r\n';
}
