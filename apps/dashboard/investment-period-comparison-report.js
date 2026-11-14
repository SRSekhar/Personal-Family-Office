function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function csvText(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return String(value);
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}

function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function percent(value) {
    return Number.isFinite(value) ? new Intl.NumberFormat('en-IN', {
        style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value) : 'Unavailable';
}

function validate(input) {
    const { comparison, generatedAt } = input ?? {};
    if (!comparison || !['available', 'partially-unavailable'].includes(comparison.status)
        || !Array.isArray(comparison.periods) || comparison.periods.length < 2) {
        throw new TypeError('A validated comparison containing at least two periods is required.');
    }
    timestamp(comparison.recordedAtCutoff, 'Recorded-at cutoff');
    timestamp(generatedAt, 'Report generatedAt');
    if (!['portfolio', 'account'].includes(comparison.scope)
        || typeof comparison.currency !== 'string' || !/^[A-Z]{3}$/u.test(comparison.currency)
        || comparison.methodology !== 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1') {
        throw new TypeError('Comparison scope, currency or methodology is invalid.');
    }
    if (comparison.scope === 'account' && (typeof comparison.accountId !== 'string' || !comparison.accountId.trim())) {
        throw new TypeError('Account-scoped comparison requires an account ID.');
    }
    let availableCount = 0;
    const labels = new Set();
    const periods = comparison.periods.map((period, index) => {
        if (!period || typeof period.label !== 'string' || !period.label.trim()
            || labels.has(period.label) || !['available', 'unavailable'].includes(period.status)) {
            throw new TypeError('Comparison period ' + (index + 1) + ' has an invalid label or status.');
        }
        labels.add(period.label);
        timestamp(period.startAt, 'Period start');
        timestamp(period.endAt, 'Period end');
        if (period.startAt >= period.endAt) throw new RangeError('Comparison period must cover a positive interval.');
        if (typeof period.calendarId !== 'string' || !period.calendarId.trim()
            || !Number.isInteger(period.calendarVersion) || period.calendarVersion < 1) {
            throw new TypeError('Every comparison period requires persisted calendar provenance.');
        }
        if (!Number.isInteger(period.observationCount) || period.observationCount < 0
            || !Number.isInteger(period.flowBoundaryCount) || period.flowBoundaryCount < 0) {
            throw new TypeError('Comparison observation counts are invalid.');
        }
        if (period.status === 'available') {
            availableCount += 1;
            if (!Number.isFinite(period.periodReturn) || !Number.isFinite(period.maximumDrawdown)
                || period.maximumDrawdown > 0 || typeof period.recovered !== 'boolean') {
                throw new TypeError('Available comparison periods require complete return and drawdown metrics.');
            }
            timestamp(period.coverageStartAt, 'Coverage start');
            timestamp(period.coverageEndAt, 'Coverage end');
        } else if (typeof period.reason !== 'string' || !period.reason.trim()
            || period.periodReturn !== null || period.maximumDrawdown !== null
            || period.coverageStartAt !== null || period.coverageEndAt !== null) {
            throw new TypeError('Unavailable comparison periods must contain a reason and no partial metrics.');
        }
        return period;
    });
    const status = availableCount === periods.length ? 'available' : 'partially-unavailable';
    if (comparison.status !== status) throw new RangeError('Comparison status does not match its period results.');
    return { comparison, periods, generatedAt };
}

/** Self-contained, script-free private comparison report. */
export function renderInvestmentPeriodComparisonHtml(input) {
    const { comparison, periods, generatedAt } = validate(input);
    const rows = periods.map((period) => {
        const available = period.status === 'available';
        const recovery = !available ? 'Unavailable' : period.maximumDrawdown === 0
            ? 'Not applicable' : period.recovered ? 'Recovered' : 'Not recovered';
        return '<tr><td>' + escapeHtml(period.label) + '</td><td>' + escapeHtml(period.startAt) + ' – ' +
            escapeHtml(period.endAt) + '</td><td>' + escapeHtml(period.status) + '</td><td class="numeric">' +
            escapeHtml(available ? percent(period.periodReturn) : 'Unavailable') + '</td><td class="numeric">' +
            escapeHtml(available ? percent(period.maximumDrawdown) : 'Unavailable') + '</td><td>' +
            escapeHtml(available ? recovery : 'Unavailable') + '</td><td>' +
            escapeHtml(period.coverageStartAt ?? 'Unavailable') + ' – ' +
            escapeHtml(period.coverageEndAt ?? 'Unavailable') + '</td><td class="numeric">' +
            period.observationCount + '</td><td class="numeric">' + period.flowBoundaryCount +
            '</td><td>' + escapeHtml(period.calendarId) + ' · v' + period.calendarVersion + '</td><td>' +
            (period.overlapsPrevious ? 'Overlaps previous period' : 'No overlap with previous period') +
            (available ? '' : '<br><span class="reason">' + escapeHtml(period.reason) + '</span>') + '</td></tr>';
    }).join('');
    const scope = comparison.scope === 'account' ? 'Account ' + comparison.accountId : 'Whole portfolio';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Historical performance comparison</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}
body{margin:0;padding:clamp(1rem,4vw,2.5rem);line-height:1.5}main{max-width:1400px;margin:auto}
header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}
h1{font-size:clamp(1.5rem,4vw,2.2rem);margin:.2rem 0}.muted{color:#52645d;font-size:.9rem}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:1100px}
th,td{text-align:left;padding:.7rem .55rem;border-bottom:1px solid #dce5df;vertical-align:top;overflow-wrap:anywhere}
th{background:#f5f8f6;font-size:.82rem}.numeric{text-align:right;font-variant-numeric:tabular-nums}
.reason{display:inline-block;margin-top:.35rem;color:#7b3f12}.status{padding:.8rem 1rem;border-radius:8px;background:#eaf5ed}
footer{font-size:.88rem;color:#52645d}@page{margin:14mm}
@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid;border-radius:0}.table-wrap{overflow:visible}table{font-size:8pt;min-width:0}tr{break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Historical investment performance comparison</h1>
<p class="muted">Scope: ${escapeHtml(scope)} · Currency: ${escapeHtml(comparison.currency)} · Methodology: ${escapeHtml(comparison.methodology)}</p>
<p class="muted">Recorded-at cutoff: ${escapeHtml(comparison.recordedAtCutoff)}<br>Generated: ${escapeHtml(generatedAt)}<br>
Period windows are explicit and may overlap. Returns are derived only from each existing flow-adjusted wealth-index start/end point.</p></header>
<section><h2>Comparison status</h2><p class="status">${comparison.status === 'available' ? 'All selected periods are available.' : 'One or more periods are unavailable. No partial statistics are shown for those periods.'}</p>
<div class="table-wrap"><table><thead><tr><th>Period</th><th>Window (UTC)</th><th>Status</th><th class="numeric">Period return</th><th class="numeric">Maximum drawdown</th><th>Recovery</th><th>Observed coverage</th><th class="numeric">Observations</th><th class="numeric">Flow boundaries</th><th>Calendar</th><th>Completeness / overlap</th></tr></thead><tbody>${rows}</tbody></table></div></section>
<footer><strong>Interpretation and safeguards</strong><p>Period return is the ratio of the last to first existing chain-linked wealth-index values, less one. Maximum drawdown and recovery are reused unchanged from the existing drawdown calculation. No annualization, benchmark, FX conversion, interpolation, missing-date generation, forecast, risk score, threshold, recommendation or trading signal is produced. Overlapping periods are not disjoint and must not be added together.</p>
<p>This standalone report contains sensitive household financial information. It is generated locally with no scripts, remote assets or network dependencies; keep it private.</p></footer>
</main></body></html>`;
}

/** Spreadsheet-safe CSV export with one row per explicit comparison period. */
export function investmentPeriodComparisonToCsv(input) {
    const { comparison, periods, generatedAt } = validate(input);
    const header = ['RecordType','Status','Label','Scope','AccountId','Currency','Methodology','StartAt','EndAt',
        'CoverageStartAt','CoverageEndAt','RecordedAtCutoff','GeneratedAt','PeriodReturn','MaximumDrawdown',
        'PeakAt','TroughAt','RecoveryAt','Recovered','ObservationCount','FlowBoundaryCount','CalendarId',
        'CalendarVersion','OverlapsPrevious','Reason'];
    const rows = periods.map((period) => [
        'Period', period.status, period.label, comparison.scope, comparison.accountId ?? '', comparison.currency,
        comparison.methodology, period.startAt, period.endAt, period.coverageStartAt ?? '',
        period.coverageEndAt ?? '', comparison.recordedAtCutoff, generatedAt,
        period.periodReturn ?? '', period.maximumDrawdown ?? '', period.peakAt ?? '', period.troughAt ?? '',
        period.recoveryAt ?? '', period.recovered ?? '', period.observationCount, period.flowBoundaryCount,
        period.calendarId, period.calendarVersion, period.overlapsPrevious, period.reason ?? ''
    ]);
    return [header, ...rows].map((row) => row.map(csvText).join(',')).join('\r\n') + '\r\n';
}
