import { analyzeReturnSeries } from './analytics-runtime/RiskAnalysis.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const number = (value, maximumFractionDigits = 2) => new Intl.NumberFormat('en-IN', { maximumFractionDigits }).format(value);
const percent = (value) => value === null ? '—' : number(value * 100) + '%';
const ratio = (value) => value === null ? '—' : number(value);

function downloadCsv(filename, rows) {
    const csvCell = (value) => {
        let text = String(value);
        if (typeof value !== 'number' && /^[=+@-]/.test(text.trimStart())) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
    };
    const content = rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function initializeReturnRiskCalculator() {
    const form = $('#return-risk-form');
    if (!form) return;
    const results = $('#return-risk-results');
    const validation = $('#return-risk-validation');
    const exportButton = $('#return-risk-export-csv');
    const observationsExportButton = $('#return-risk-export-observations-csv');
    let latest = null;

    const invalidate = () => {
        latest = null;
        results.hidden = true;
        exportButton.disabled = true;
        observationsExportButton.disabled = true;
        validation.hidden = true;
        validation.textContent = '';
    };
    form.addEventListener('input', invalidate);
    form.addEventListener('change', invalidate);

    $('#return-risk-reset').addEventListener('click', () => {
        form.reset();
        invalidate();
        $('#return-risk-observations').value = '';
        $('#return-risk-periods-year').value = '12';
    });

    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#return-risk-hosted-notice').hidden = false;
        form.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = true; });
        return;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        invalidate();
        try {
            const periodsPerYearText = $('#return-risk-periods-year').value.trim();
            const periodsPerYear = Number(periodsPerYearText);
            if (!periodsPerYearText || !Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
                throw new RangeError('Periods per year must be a positive whole number.');
            }
            const rawLines = $('#return-risk-observations').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
            const lines = rawLines[0]?.toLocaleLowerCase('en-US') === 'date,return_percent' ? rawLines.slice(1) : rawLines;
            if (lines.length === 0) throw new RangeError('Enter at least one dated return observation.');
            const observations = lines.map((line, index) => {
                const parts = line.split(',');
                if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
                    throw new RangeError('Line ' + (index + 1) + ' must use YYYY-MM-DD,return-percent format.');
                }
                const ratePercent = Number(parts[1].trim());
                if (!Number.isFinite(ratePercent)) {
                    throw new RangeError('Line ' + (index + 1) + ' must contain a finite return percentage.');
                }
                return { date: parts[0].trim(), returnRate: ratePercent / 100, returnPercent: ratePercent };
            });
            const riskFreeText = $('#return-risk-risk-free').value.trim();
            const targetText = $('#return-risk-target').value.trim();
            const input = {
                periodsPerYear,
                observations,
                ...(riskFreeText ? { riskFreeRatePerPeriod: Number(riskFreeText) / 100 } : {}),
                ...(targetText ? { minimumAcceptableReturnPerPeriod: Number(targetText) / 100 } : {})
            };
            if (riskFreeText && !Number.isFinite(input.riskFreeRatePerPeriod)) {
                throw new RangeError('Risk-free return must be a finite percentage.');
            }
            if (targetText && !Number.isFinite(input.minimumAcceptableReturnPerPeriod)) {
                throw new RangeError('Minimum acceptable return must be a finite percentage.');
            }
            const analysisInput = { ...input, observations: observations.map(({ date, returnRate }) => ({ date, returnRate })) };
            latest = {
                input: analysisInput,
                result: analyzeReturnSeries(analysisInput),
                observationRows: observations.map(({ date, returnPercent }) => [date, returnPercent])
            };
            const result = latest.result;
            $('#return-risk-observation-count').textContent = String(result.observationCount);
            $('#return-risk-cumulative-return').textContent = percent(result.cumulativeReturn);
            $('#return-risk-volatility').textContent = percent(result.annualizedVolatility);
            $('#return-risk-drawdown').textContent = percent(result.maximumDrawdown);
            $('#return-risk-worst-period').textContent = percent(result.worstPeriodReturn);
            $('#return-risk-negative-count').textContent = String(result.negativePeriodCount);
            $('#return-risk-sharpe').textContent = ratio(result.annualizedSharpeRatio);
            $('#return-risk-sortino').textContent = ratio(result.annualizedSortinoRatio);
            results.hidden = false;
            exportButton.disabled = false;
            observationsExportButton.disabled = false;
        } catch (error) {
            latest = null;
            validation.textContent = error instanceof Error ? error.message : 'Check the return observations and assumptions.';
            validation.hidden = false;
        }
    });

    observationsExportButton.addEventListener('click', () => {
        if (!latest) return;
        downloadCsv('pfo-return-risk-observations.csv', [
            ['date', 'return_percent'],
            ...latest.observationRows
        ]);
    });

    exportButton.addEventListener('click', () => {
        if (!latest) return;
        const { input, result } = latest;
        downloadCsv('pfo-return-risk-analysis.csv', [
            ['metric', 'value'],
            ['observation_count', result.observationCount],
            ['cumulative_return', result.cumulativeReturn ?? ''],
            ['periods_per_year', input.periodsPerYear],
            ['annualized_volatility', result.annualizedVolatility ?? ''],
            ['maximum_drawdown', result.maximumDrawdown ?? ''],
            ['worst_period_return', result.worstPeriodReturn ?? ''],
            ['negative_period_count', result.negativePeriodCount],
            ['annualized_sharpe_ratio', result.annualizedSharpeRatio ?? ''],
            ['annualized_sortino_ratio', result.annualizedSortinoRatio ?? ''],
            ['risk_free_rate_per_period', input.riskFreeRatePerPeriod ?? ''],
            ['minimum_acceptable_return_per_period', input.minimumAcceptableReturnPerPeriod ?? '']
        ]);
    });
}
