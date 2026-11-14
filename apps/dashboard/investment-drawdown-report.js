const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);

function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeCsvText(value) {
    const text = String(value ?? '');
    const safe = /^\s*[=+@-]/u.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
}

function canonicalTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function formatTimestamp(value) {
    if (!value) return 'Unavailable';
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
    }).format(new Date(value)) + ' UTC';
}

function formatMoney(value, currency) {
    if (!Number.isFinite(value)) return 'Unavailable';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency, maximumFractionDigits: 2
    }).format(value);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return 'Unavailable';
    return new Intl.NumberFormat('en-IN', {
        style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);
}

function validateReportInput(input) {
    const { analysis, scope, accountId, currency, startAt, endAt, recordedAtCutoff, generatedAt } = input ?? {};
    if (!analysis || !['available', 'unavailable'].includes(analysis.status)) {
        throw new TypeError('A validated available or unavailable drawdown analysis is required.');
    }
    if (!['portfolio', 'account'].includes(scope)) throw new TypeError('Report scope must be portfolio or account.');
    if (scope === 'account' && (typeof accountId !== 'string' || !accountId.trim())) {
        throw new TypeError('Account-scoped reports require an account ID.');
    }
    if (scope === 'portfolio' && accountId !== undefined) throw new TypeError('Portfolio reports cannot specify an account ID.');
    if (!CURRENCIES.has(currency)) throw new TypeError('Report currency is unsupported.');
    canonicalTimestamp(startAt, 'Report start');
    canonicalTimestamp(endAt, 'Report end');
    canonicalTimestamp(recordedAtCutoff, 'Recorded-at cutoff');
    canonicalTimestamp(generatedAt, 'Report generatedAt');
    if (startAt > endAt) throw new RangeError('Report start must not be after report end.');
    if (analysis.currency !== currency || analysis.startAt !== startAt || analysis.endAt !== endAt
        || analysis.recordedAtCutoff !== recordedAtCutoff || analysis.scope !== scope
        || (scope === 'account' && analysis.accountId !== accountId)) {
        throw new RangeError('Drawdown analysis provenance does not match the report scope, currency and time window.');
    }
    if (!Array.isArray(analysis.points) || !Array.isArray(analysis.completeness)) {
        throw new TypeError('Drawdown analysis points and completeness evidence must be arrays.');
    }
    if (analysis.status === 'available') {
        if (!Number.isFinite(analysis.maximumDrawdown) || !Array.isArray(analysis.points) || analysis.points.length < 2) {
            throw new RangeError('An available drawdown result requires a finite maximum drawdown and a complete point series.');
        }
    } else if (analysis.maximumDrawdown !== null || analysis.points.length !== 0) {
        throw new RangeError('Unavailable drawdown analyses cannot contain partial statistics or points.');
    }
    return { analysis, scope, accountId, currency, startAt, endAt, recordedAtCutoff, generatedAt };
}

/** Render a self-contained descriptive drawdown report. No recommendations or risk thresholds are inferred. */
export function renderInvestmentDrawdownReportHtml(input) {
    const data = validateReportInput(input);
    const { analysis, scope, accountId, currency, startAt, endAt, recordedAtCutoff, generatedAt } = data;
    const generatedLabel = formatTimestamp(generatedAt);
    const scopeLabel = scope === 'account' ? 'Investment account ' + accountId : 'Whole portfolio';
    const available = analysis.status === 'available';
    const metrics = [
        ['Maximum drawdown', available ? formatPercent(analysis.maximumDrawdown) : 'Unavailable'],
        ['Peak', available ? (analysis.maximumDrawdown < 0 ? formatTimestamp(analysis.peakAt) : 'Not applicable') : 'Unavailable'],
        ['Trough', available ? (analysis.maximumDrawdown < 0 ? formatTimestamp(analysis.troughAt) : 'Not applicable') : 'Unavailable'],
        ['Recovery', available ? (analysis.maximumDrawdown === 0 ? 'Not applicable' : (analysis.recovered ? formatTimestamp(analysis.recoveryAt) : 'Not recovered')) : 'Unavailable'],
        ['Observations', String(analysis.observationCount)],
        ['Paired external flows', String(analysis.flowBoundaryCount)]
    ].map(([label, value]) => '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>').join('');

    const pointRows = available ? analysis.points.map((point) =>
        '<tr><td>' + escapeHtml(formatTimestamp(point.effectiveAt)) + '</td><td>' + escapeHtml(point.kind) +
        '</td><td>' + escapeHtml(point.observationId) + '</td><td class="numeric">' +
        escapeHtml(formatMoney(point.portfolioValue, currency)) + '</td><td class="numeric">' +
        escapeHtml(point.wealthIndex.toFixed(8)) + '</td><td class="numeric">' +
        escapeHtml(formatPercent(point.drawdown)) + '</td></tr>'
    ).join('') : '';

    const completenessRows = analysis.completeness.map((item) => {
        const reasons = [...(item.reasons ?? [])];
        if (item.missingComponents?.length) reasons.push(item.missingComponents.length + ' missing component(s)');
        if (item.unexpectedComponents?.length) reasons.push(item.unexpectedComponents.length + ' unexpected component(s)');
        if (item.mismatchedComponents?.length) reasons.push(item.mismatchedComponents.length + ' mismatched component(s)');
        return '<tr><td>' + escapeHtml(item.snapshotId) + '</td><td>' + escapeHtml(item.status) +
            '</td><td class="numeric">' + item.expectedComponentCount + '</td><td class="numeric">' +
            item.actualComponentCount + '</td><td>' + escapeHtml(reasons.join(' ') || 'Ledger reconciliation passed.') + '</td></tr>';
    }).join('');

    const limitationRows = (analysis.limitations ?? []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
    const statusSection = available
        ? '<p class="status available">Calculation available — all selected observations passed the required ledger and calendar gates.</p>'
        : '<p class="status unavailable">Calculation unavailable — no partial drawdown statistic has been emitted.</p><p class="reason">' +
            escapeHtml(analysis.reason || 'The selected data did not satisfy the drawdown calculation contract.') + '</p>';

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PFO OS — Investment drawdown report</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#182b25;background:#f5f8f6}*{box-sizing:border-box}
body{margin:0;padding:clamp(1rem,4vw,2.5rem);line-height:1.5}main{max-width:1200px;margin:0 auto}
header,section,footer{background:#fff;border:1px solid #d6e0da;border-radius:12px;padding:clamp(1rem,3vw,1.5rem);margin-bottom:1rem}
h1{font-size:clamp(1.5rem,4vw,2.25rem);margin:.2rem 0}h2{font-size:1.15rem;margin-top:0}
.muted{color:#52645d;font-size:.9rem}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem}
.metric{background:#f5f8f6;border:1px solid #e0e8e2;border-radius:8px;padding:1rem;min-width:0}
.metric span{display:block;color:#52645d;font-size:.85rem}.metric strong{display:block;margin-top:.4rem;font-size:1.2rem;overflow-wrap:anywhere}
.status{padding:.8rem 1rem;border-radius:8px;font-weight:650}.available{background:#eaf5ed;color:#1c5a36}.unavailable{background:#fff2e6;color:#7b3f12}
.reason{border-left:3px solid #c47b31;padding:.5rem .8rem;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:.7rem .55rem;border-bottom:1px solid #dce5df;vertical-align:top;overflow-wrap:anywhere}
th{background:#f5f8f6;font-size:.82rem}.numeric{text-align:right;font-variant-numeric:tabular-nums}
footer{font-size:.88rem;color:#52645d}
@page{margin:14mm}@media print{body{padding:0;background:#fff}header,section,footer{break-inside:avoid;border-radius:0}.table-wrap{overflow:visible}table{font-size:8pt;min-width:0}tr{break-inside:avoid}}
</style></head><body><main>
<header><p class="muted">PFO OS · PRIVATE LOCAL REPORT</p><h1>Investment drawdown</h1>
<p class="muted">Scope: ${escapeHtml(scopeLabel)} · Currency: ${escapeHtml(currency)} · Generated: ${escapeHtml(generatedLabel)}</p>
<p class="muted">Analysis window: ${escapeHtml(formatTimestamp(startAt))} to ${escapeHtml(formatTimestamp(endAt))}<br>
Observed coverage: ${escapeHtml(formatTimestamp(analysis.coverageStartAt))} to ${escapeHtml(formatTimestamp(analysis.coverageEndAt))}<br>
Recorded-at cutoff: ${escapeHtml(formatTimestamp(recordedAtCutoff))}<br>
Methodology: ${escapeHtml(analysis.methodology || 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1')} · Calendar: ${escapeHtml(analysis.calendarId || 'Unavailable')} · Version: ${analysis.calendarVersion ?? 'Unavailable'}</p>
</header>
<section><h2>Calculation status</h2>${statusSection}<div class="summary">${metrics}</div></section>
<section><h2>Drawdown observation series</h2><p class="muted">Values are the explicitly recorded portfolio observations. Wealth index and drawdown are chain-linked and adjusted for authoritative external cash flows.</p>
<div class="table-wrap"><table><thead><tr><th>Effective at (UTC)</th><th>Kind</th><th>Observation ID</th><th class="numeric">Portfolio value</th><th class="numeric">Wealth index</th><th class="numeric">Drawdown</th></tr></thead>
<tbody>${pointRows || '<tr><td colspan="6">No usable point series. Review the unavailable reason and completeness evidence.</td></tr>'}</tbody></table></div></section>
<section><h2>Snapshot completeness evidence</h2><div class="table-wrap"><table><thead><tr><th>Snapshot ID</th><th>Status</th><th class="numeric">Expected components</th><th class="numeric">Actual components</th><th>Reconciliation detail</th></tr></thead>
<tbody>${completenessRows || '<tr><td colspan="5">No snapshot completeness evidence was available.</td></tr>'}</tbody></table></div></section>
<section><h2>Limitations</h2><ul>${limitationRows || '<li>No additional ledger-classification limitations were reported for this analysis.</li>'}</ul>
<p class="muted">In-kind flows and corporate actions are unsupported and are not inferred. Missing or ambiguous evidence makes the calculation unavailable.</p></section>
<footer><strong>Interpretation and safeguards</strong><p>This is a descriptive historical calculation using the selected scope, currency, exact observation calendar and recorded-at cutoff. It is not a forecast, risk score, alert, threshold assessment, investment recommendation, rebalancing instruction or trading signal. The report does not imply liquidity or suitability.</p>
<p>Generated locally as a self-contained document with no scripts, remote assets or network dependencies. It may contain sensitive household financial information; keep it private.</p></footer>
</main></body></html>`;
}

/** Spreadsheet-safe CSV export of the summary, points and per-snapshot completeness evidence. */
export function investmentDrawdownReportToCsv(input) {
    const data = validateReportInput(input);
    const { analysis, scope, accountId, currency, startAt, endAt, recordedAtCutoff, generatedAt } = data;
    const header = [
        'RecordType', 'Status', 'Scope', 'AccountId', 'Currency', 'Methodology', 'StartAt', 'EndAt', 'CoverageStartAt', 'CoverageEndAt',
        'RecordedAtCutoff', 'GeneratedAt', 'Reason', 'CalendarId', 'CalendarVersion',
        'ObservationCount', 'FlowBoundaryCount', 'MaximumDrawdown', 'PeakAt', 'TroughAt',
        'RecoveryAt', 'Recovered', 'EffectiveAt', 'ObservationId', 'ObservationKind',
        'PortfolioValue', 'WealthIndex', 'Drawdown', 'ExpectedComponents', 'ActualComponents',
        'CompletenessReasons'
    ];
    const text = (value) => escapeCsvText(value);
    const rows = [];
    rows.push([
        text('Summary'), text(analysis.status), text(scope), text(accountId ?? ''), text(currency),
        text(analysis.methodology ?? 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1'), text(startAt), text(endAt),
        text(analysis.coverageStartAt ?? ''), text(analysis.coverageEndAt ?? ''), text(recordedAtCutoff), text(generatedAt), text(analysis.reason ?? ''), text(analysis.calendarId ?? ''),
        analysis.calendarVersion ?? '', analysis.observationCount ?? 0, analysis.flowBoundaryCount ?? 0,
        Number.isFinite(analysis.maximumDrawdown) ? analysis.maximumDrawdown : '',
        text(analysis.peakAt ?? ''), text(analysis.troughAt ?? ''), text(analysis.recoveryAt ?? ''),
        analysis.recovered === null || analysis.recovered === undefined ? '' : String(analysis.recovered),
        '', '', '', '', '', '', '', '', ''
    ].join(','));
    for (const point of analysis.points) {
        rows.push([
            text('Point'), text(analysis.status), text(scope), text(accountId ?? ''), text(currency),
            text(analysis.methodology ?? 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1'), text(startAt), text(endAt),
            text(analysis.coverageStartAt ?? ''), text(analysis.coverageEndAt ?? ''), text(recordedAtCutoff), text(generatedAt), '', text(analysis.calendarId ?? ''),
            analysis.calendarVersion ?? '', analysis.observationCount ?? 0, analysis.flowBoundaryCount ?? 0,
            Number.isFinite(analysis.maximumDrawdown) ? analysis.maximumDrawdown : '',
            text(analysis.peakAt ?? ''), text(analysis.troughAt ?? ''), text(analysis.recoveryAt ?? ''),
            analysis.recovered === null || analysis.recovered === undefined ? '' : String(analysis.recovered),
            text(point.effectiveAt), text(point.observationId), text(point.kind),
            point.portfolioValue, point.wealthIndex, point.drawdown, '', '', ''
        ].join(','));
    }
    for (const item of analysis.completeness) {
        const reasons = [
            ...(item.reasons ?? []),
            ...(item.missingComponents ?? []).map(() => 'Missing component'),
            ...(item.unexpectedComponents ?? []).map(() => 'Unexpected component'),
            ...(item.mismatchedComponents ?? []).map((component) => component.reason)
        ].join(' ');
        rows.push([
            text('Completeness'), text(item.status), text(scope), text(accountId ?? ''), text(currency),
            text(analysis.methodology ?? 'TWR_CHAIN_LINKED_FLOW_ADJUSTED_V1'), text(startAt), text(endAt),
            text(recordedAtCutoff), text(generatedAt), '', text(analysis.calendarId ?? ''),
            analysis.calendarVersion ?? '', analysis.observationCount ?? 0, analysis.flowBoundaryCount ?? 0,
            '', '', '', '', '', '', text(item.snapshotId), '', '', '', '',
            item.expectedComponentCount ?? '', item.actualComponentCount ?? '', text(reasons)
        ].join(','));
    }
    return [header.join(','), ...rows].join('\r\n') + '\r\n';
}
