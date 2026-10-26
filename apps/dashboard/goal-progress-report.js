function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/u.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function assertNonNegative(name, value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new RangeError(name + ' must be a finite non-negative number.');
    }
}

const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(value);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';

export function renderGoalProgressReportHtml({ asOfDate, generatedAt, goals }) {
    if (!isCalendarDate(asOfDate)) throw new RangeError('A valid report as-of date is required.');
    if (typeof generatedAt !== 'string' || !Number.isFinite(Date.parse(generatedAt))) {
        throw new RangeError('A valid report generation timestamp is required.');
    }
    if (!Array.isArray(goals) || goals.length === 0) throw new TypeError('At least one saved goal is required.');
    for (const goal of goals) {
        if (!goal || typeof goal.name !== 'string' || !goal.name.trim() || goal.name.length > 80) {
            throw new TypeError('Every goal must have a valid name.');
        }
        assertNonNegative('Target amount', goal.targetAmount);
        if (goal.targetAmount === 0) throw new RangeError('Target amount must be greater than zero.');
        assertNonNegative('Current amount', goal.currentAmount);
        assertNonNegative('Amount remaining', goal.amountRemaining);
        assertNonNegative('Progress percentage', goal.progressPercent);
        if (goal.amountRemaining !== Math.max(0, goal.targetAmount - goal.currentAmount)
            || goal.progressPercent !== goal.currentAmount / goal.targetAmount * 100) {
            throw new RangeError('Goal progress values do not reconcile to the target and current amounts.');
        }
        if (!isCalendarDate(goal.targetDate)) throw new RangeError('Every goal must have a valid target date.');
        if (!Number.isInteger(goal.daysRemaining)) throw new RangeError('Days remaining must be an integer.');
        if (!['Goal reached', 'Past target date', 'In progress'].includes(goal.status)) {
            throw new RangeError('Every goal must have a valid status.');
        }
        if (goal.monthlyContributionNeeded !== null) assertNonNegative('Monthly contribution needed', goal.monthlyContributionNeeded);
    }
    const cards = goals.map((goal) => {
        const boundedProgress = Math.max(0, Math.min(100, goal.progressPercent));
        const monthlyPace = goal.monthlyContributionNeeded === null
            ? 'No monthly pace available for this target date.'
            : money(goal.monthlyContributionNeeded) + ' per month (no returns assumed).';
        const timeRemaining = goal.daysRemaining < 0
            ? Math.abs(goal.daysRemaining) + ' days overdue'
            : goal.daysRemaining + ' days remaining';
        return `<article class="goal"><div class="goal-heading"><h2>${escapeHtml(goal.name)}</h2><span class="status">${escapeHtml(goal.status)}</span></div>
<p class="value">${percent(goal.progressPercent)} complete</p><div class="track" role="img" aria-label="${escapeHtml(percent(goal.progressPercent))} complete"><span style="width:${boundedProgress}%"></span></div>
<dl><div><dt>Target</dt><dd>${escapeHtml(money(goal.targetAmount))}</dd></div><div><dt>Accumulated</dt><dd>${escapeHtml(money(goal.currentAmount))}</dd></div><div><dt>Remaining</dt><dd>${escapeHtml(money(goal.amountRemaining))}</dd></div><div><dt>Target date</dt><dd>${escapeHtml(goal.targetDate)}</dd></div><div><dt>Time</dt><dd>${escapeHtml(timeRemaining)}</dd></div></dl>
<p class="pace">Suggested arithmetic pace: ${escapeHtml(monthlyPace)}</p></article>`;
    }).join('\\n');
    const generatedLabel = new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    }).format(new Date(generatedAt));
    const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    if (!Number.isFinite(totalTarget) || !Number.isFinite(totalCurrent)) throw new RangeError('Goal totals exceed the supported numeric range.');
    const totalProgress = totalTarget === 0 ? null : totalCurrent / totalTarget * 100;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Saved goal progress report</title><style>
:root{color-scheme:light;--ink:#182b25;--muted:#52645d;--line:#d6e0da;--surface:#f5f8f6;--accent:#176b4d}
*{box-sizing:border-box}body{margin:0;padding:2rem;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}
main{max-width:1000px;margin:0 auto}header{border-bottom:2px solid var(--accent);padding-bottom:1rem;margin-bottom:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:var(--accent)}
h1{font-size:2rem;margin:.25rem 0}p{margin:.5rem 0;color:var(--muted)}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.8rem;margin:1.5rem 0}
.summary article,.goal{border:1px solid var(--line);border-radius:12px;padding:1.1rem;background:var(--surface);break-inside:avoid}.summary span,dt{font-size:.9rem;color:var(--muted)}.summary strong{display:block;font-size:1.35rem;margin-top:.3rem}
.goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.goal-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:.6rem}.goal h2{font-size:1.1rem;margin:0}.status{font-size:.8rem;border:1px solid var(--line);border-radius:999px;padding:.2rem .5rem;white-space:nowrap}.value{font-size:1.25rem;font-weight:750;color:var(--ink)}
.track{height:.6rem;border-radius:999px;background:#e3eae5;overflow:hidden}.track span{display:block;height:100%;background:var(--accent)}dl{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin:1rem 0}dl div{min-width:0}dt{margin-bottom:.1rem}dd{margin:0;font-weight:650;overflow-wrap:anywhere}.pace{border-top:1px solid var(--line);padding-top:.7rem}
footer{margin-top:2rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.9rem}@media print{body{padding:0}.summary article,.goal{background:#fff}}@media(max-width:600px){body{padding:1rem}h1{font-size:1.5rem}}
</style></head><body><main><header><p class="eyebrow">Personal Family Office · Goals</p><h1>Saved goal progress</h1><p>As of <strong>${escapeHtml(asOfDate)}</strong> · Generated locally ${escapeHtml(generatedLabel)}</p></header>
<section class="summary" aria-label="Combined goal summary"><article><span>Saved goals</span><strong>${goals.length}</strong></article><article><span>Combined target</span><strong>${escapeHtml(money(totalTarget))}</strong></article><article><span>Combined accumulated</span><strong>${escapeHtml(money(totalCurrent))}</strong></article><article><span>Combined progress</span><strong>${escapeHtml(percent(totalProgress))}</strong></article></section>
<div class="goals">${cards}</div><footer><p><strong>Scope and limitations</strong></p><p>This report reflects saved goal data in the private local workspace at export time. It does not predict investment returns, adjust for inflation, or connect to accounts or external services. Monthly pace is arithmetic only and assumes no returns. Progress above 100% is shown as recorded in the percentage; the visual bar is capped at 100%.</p><p>Keep this file private: it may contain sensitive household financial information.</p></footer></main></body></html>`;
}
