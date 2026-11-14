import { analyzeInvestmentDrawdownMath } from './calculators-runtime/InvestmentDrawdownMath.js';
import { analyzeInvestmentDrawdownSeries } from './investment-drawdown-series.js';
import { compareInvestmentPerformancePeriods } from './investment-period-comparison.js';
import {
    investmentPeriodComparisonToCsv,
    renderInvestmentPeriodComparisonHtml
} from './investment-period-comparison-report.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

function canonicalTimestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString() !== value) {
        throw new TypeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function download(content, contentType, filename) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parsePeriods(value) {
    const lines = value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new RangeError('Enter at least two explicit periods.');
    return lines.map((line, index) => {
        const fields = line.split('|').map((field) => field.trim());
        if (fields.length !== 3 || fields.some((field) => !field)) {
            throw new TypeError('Period line ' + (index + 1) + ' must contain label | startAt | endAt.');
        }
        const [label, startAt, endAt] = fields;
        canonicalTimestamp(startAt, 'Period ' + (index + 1) + ' start');
        canonicalTimestamp(endAt, 'Period ' + (index + 1) + ' end');
        if (startAt >= endAt) throw new RangeError('Period ' + (index + 1) + ' start must be before its end.');
        return { label, startAt, endAt };
    });
}

function fingerprint(dependencies) {
    return JSON.stringify([
        dependencies.readLedger(), dependencies.readCash(),
        dependencies.readSnapshots(), dependencies.readCalendars()
    ]);
}

/** Private-only historical comparison. Every period is analyzed independently using its persisted calendar. */
export function initializeInvestmentPeriodComparisonWorkspace(dependencies) {
    const form = document.querySelector('#investment-period-comparison-form');
    if (!form) return { render() {}, invalidate() {} };

    const demoNote = document.querySelector('#investment-period-comparison-demo-note');
    const error = document.querySelector('#investment-period-comparison-error');
    const status = document.querySelector('#investment-period-comparison-status');
    const accountRow = document.querySelector('#investment-period-comparison-account-row');
    const account = form.elements.accountId;
    const scope = form.elements.scope;
    const currency = form.elements.currency;
    const cutoff = form.elements.recordedAtCutoff;
    const periodInput = form.elements.periods;
    const preview = document.querySelector('#investment-period-comparison-preview');
    const htmlButton = document.querySelector('#investment-period-comparison-download-html');
    const csvButton = document.querySelector('#investment-period-comparison-download-csv');
    let accounts = [];
    let latestReport = null;

    if (!cutoff.value) cutoff.value = new Date().toISOString();

    function show(target, message) {
        target.textContent = message;
        target.hidden = !message;
    }

    function clearReport() {
        latestReport = null;
        preview.srcdoc = '';
        preview.hidden = true;
        htmlButton.disabled = true;
        csvButton.disabled = true;
    }

    function renderAccounts(selected = '') {
        account.innerHTML = '<option value="">Select investment account</option>' + accounts
            .map((item) => '<option value="' + String(item.id).replaceAll('&', '&amp;').replaceAll('"', '&quot;')
                .replaceAll('<', '&lt;').replaceAll('>', '&gt;') + '">' +
                String(item.name).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') +
                ' (' + item.currency + ')</option>').join('');
        account.value = selected;
    }

    function render() {
        const privateWorkspace = dependencies.isPrivateWorkspace();
        const healthy = dependencies.isLedgerHealthy() && dependencies.isSnapshotStorageHealthy()
            && dependencies.isCalendarStorageHealthy();
        const enabled = privateWorkspace && healthy;
        demoNote.hidden = privateWorkspace;
        for (const control of form.querySelectorAll('input, select, textarea, button')) control.disabled = !enabled;
        if (!privateWorkspace) {
            clearReport();
            show(error, '');
            show(status, '');
            return;
        }
        if (!healthy) {
            clearReport();
            show(error, 'Investment ledgers, snapshots or calendars could not be validated. Comparison is paused; saved data was left untouched.');
            show(status, '');
            return;
        }
        try {
            accounts = dependencies.readLedger().investmentAccounts;
            renderAccounts(account.value);
            currency.innerHTML = CURRENCIES.map((item) => '<option value="' + item + '">' + item + '</option>').join('');
            currency.value = CURRENCIES.includes(currency.value) ? currency.value : 'INR';
            accountRow.hidden = scope.value !== 'account';
            show(error, '');
            show(status, '');
        } catch (cause) {
            clearReport();
            show(error, cause instanceof Error ? cause.message : 'Comparison inputs could not be loaded.');
        }
    }

    function invalidate() {
        clearReport();
        show(status, 'Investment data changed. Run the comparison again before exporting.');
    }

    scope.addEventListener('change', () => { accountRow.hidden = scope.value !== 'account'; });
    account.addEventListener('change', () => {
        const selected = accounts.find((item) => item.id === account.value);
        if (selected && CURRENCIES.includes(selected.currency)) currency.value = selected.currency;
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            if (!dependencies.isPrivateWorkspace() || !dependencies.isLedgerHealthy()
                || !dependencies.isSnapshotStorageHealthy() || !dependencies.isCalendarStorageHealthy()) {
                throw new Error('A healthy local private workspace, investment ledger, snapshot collection and calendar collection are required.');
            }
            const ledger = dependencies.readLedger();
            const cash = dependencies.readCash();
            const snapshots = dependencies.readSnapshots();
            const calendars = dependencies.readCalendars();
            if (!dependencies.isLedgerHealthy() || !dependencies.isSnapshotStorageHealthy()
                || !dependencies.isCalendarStorageHealthy()) {
                throw new Error('Investment ledger, snapshots or calendars failed validation. No comparison was generated.');
            }
            const selectedScope = scope.value;
            const selectedAccount = selectedScope === 'account' ? account.value : undefined;
            const selectedCurrency = currency.value;
            const recordedAtCutoff = canonicalTimestamp(cutoff.value, 'Recorded-at cutoff');
            if (selectedScope === 'account' && !selectedAccount) throw new Error('Select an investment account for account-scoped comparison.');
            if (!CURRENCIES.includes(selectedCurrency)) throw new Error('Select a supported currency.');
            const periods = parsePeriods(periodInput.value);
            const analyses = periods.map((period) => ({
                label: period.label,
                analysis: analyzeInvestmentDrawdownSeries({
                    ...ledger, ...cash,
                    investmentDrawdownSnapshots: snapshots.investmentDrawdownSnapshots,
                    investmentDrawdownCalendars: calendars.investmentDrawdownCalendars,
                    scope: selectedScope,
                    ...(selectedAccount ? { accountId: selectedAccount } : {}),
                    currency: selectedCurrency,
                    startAt: period.startAt,
                    endAt: period.endAt,
                    recordedAtCutoff,
                    analyzeInvestmentDrawdownMath
                })
            }));
            const comparison = compareInvestmentPerformancePeriods({ periods: analyses });
            const generatedAt = new Date().toISOString();
            const reportInput = { comparison, generatedAt };
            const html = renderInvestmentPeriodComparisonHtml(reportInput);
            const csv = investmentPeriodComparisonToCsv(reportInput);
            const signature = fingerprint(dependencies);
            latestReport = {
                html, csv, signature,
                filename: 'pfo-investment-period-comparison-' + selectedScope + '-' + selectedCurrency
            };
            preview.srcdoc = html;
            preview.hidden = false;
            htmlButton.disabled = false;
            csvButton.disabled = false;
            show(error, '');
            show(status, comparison.status === 'available'
                ? 'Historical comparison completed. Returns and drawdowns are descriptive, not recommendations.'
                : 'Comparison completed with unavailable periods. Their reasons are shown; no partial statistics were produced.');
        } catch (cause) {
            clearReport();
            show(error, cause instanceof Error ? cause.message : 'Historical comparison could not be completed.');
            show(status, '');
        }
    });

    function exportReport(format) {
        if (!latestReport || !dependencies.isPrivateWorkspace()) return;
        try {
            if (!dependencies.isLedgerHealthy() || !dependencies.isSnapshotStorageHealthy()
                || !dependencies.isCalendarStorageHealthy()) {
                invalidate();
                show(error, 'Source ledgers, snapshots or calendars are no longer valid. Export was blocked.');
                return;
            }
            if (latestReport.signature !== fingerprint(dependencies)) {
                invalidate();
                show(status, 'Source data changed after analysis. Run the comparison again before exporting.');
                return;
            }
            download(latestReport[format], format === 'html' ? 'text/html;charset=utf-8' : 'text/csv;charset=utf-8',
                latestReport.filename + '.' + format);
        } catch (cause) {
            invalidate();
            show(error, cause instanceof Error ? cause.message : 'Source data could not be revalidated; export was blocked.');
        }
    }
    htmlButton.addEventListener('click', () => exportReport('html'));
    csvButton.addEventListener('click', () => exportReport('csv'));

    render();
    return { render, invalidate };
}
