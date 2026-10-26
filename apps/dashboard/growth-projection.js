import { projectCompoundGrowthSchedule } from './calculators-runtime/CompoundGrowth.js';
import { renderGrowthProjectionReportHtml } from './growth-projection-report.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export function initializeGrowthProjectionCalculator() {
    const form = $('#growth-projection-form');
    if (!form) return;
    let scheduleRows = [];
    let latestProjection = null;
    const htmlExport = $('#growth-export-html');
    const invalidateResults = () => {
        scheduleRows = [];
        latestProjection = null;
        $('#growth-export-csv').disabled = true;
        htmlExport.disabled = true;
        $('#growth-results').hidden = true;
        $('#growth-schedule-rows').replaceChildren();
        $('#growth-validation').hidden = true;
        $('#growth-validation').textContent = '';
    };
    form.addEventListener('input', invalidateResults);
    form.addEventListener('change', invalidateResults);
    form.addEventListener('submit', (event) => {
        event.preventDefault(); $('#growth-validation').hidden = true;
        try {
            const initialValue = Number($('#growth-initial-value').value);
            const annualContribution = Number($('#growth-annual-contribution').value);
            const annualRate = Number($('#growth-annual-rate').value) / 100;
            const periods = Number($('#growth-years').value);
            const contributionTiming = $('#growth-contribution-timing').value;
            const input = { initialValue, annualRate, periods, contributionPerPeriod: annualContribution, contributionTiming };
            scheduleRows = projectCompoundGrowthSchedule(input);
            latestProjection = { input, rows: scheduleRows };
            const finalRow = scheduleRows[scheduleRows.length - 1];
            $('#growth-projected-value').textContent = money(finalRow.projectedValue);
            $('#growth-total-contributions').textContent = money(finalRow.totalContributions);
            $('#growth-estimated-growth').textContent = money(finalRow.estimatedGrowth);
            const tbody = $('#growth-schedule-rows');
            tbody.replaceChildren(...scheduleRows.map((row) => {
                const tr = document.createElement('tr');
                [String(row.year), money(row.projectedValue), money(row.totalContributions), money(row.estimatedGrowth)]
                    .forEach((value) => {
                        const td = document.createElement('td');
                        td.textContent = value;
                        tr.append(td);
                    });
                return tr;
            }));
            $('#growth-export-csv').disabled = false;
            htmlExport.disabled = false;
            $('#growth-results').hidden = false;
        } catch (error) {
            scheduleRows = [];
            latestProjection = null;
            $('#growth-export-csv').disabled = true;
            htmlExport.disabled = true;
            $('#growth-schedule-rows').replaceChildren();
            $('#growth-results').hidden = true;
            $('#growth-validation').textContent = error instanceof Error ? error.message : 'Could not calculate the growth projection.';
            $('#growth-validation').hidden = false;
        }
    });
    $('#growth-export-csv').addEventListener('click', () => {
        if (scheduleRows.length === 0) return;
        const lines = [
            'Year,Projected value,Total contributed capital,Estimated growth',
            ...scheduleRows.map((row) => [
                row.year, row.projectedValue, row.totalContributions, row.estimatedGrowth
            ].join(','))
        ];
        const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-growth-projection.csv';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    htmlExport.addEventListener('click', () => {
        if (!latestProjection) return;
        const report = renderGrowthProjectionReportHtml(latestProjection);
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-growth-projection.html';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
    $('#growth-reset').addEventListener('click', () => {
        form.reset(); scheduleRows = [];
        $('#growth-schedule-rows').replaceChildren();
        $('#growth-export-csv').disabled = true;
        htmlExport.disabled = true;
        $('#growth-results').hidden = true; $('#growth-validation').hidden = true; $('#growth-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#growth-hosted-notice').hidden = false;
        form.querySelectorAll('input, button, select').forEach((control) => { control.disabled = true; });
    }
}