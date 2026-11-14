import { analyzeInvestmentDrawdownMath } from './calculators-runtime/InvestmentDrawdownMath.js';
import { analyzeInvestmentDrawdownSeries } from './investment-drawdown-series.js';
import {
    investmentDrawdownReportToCsv,
    renderInvestmentDrawdownReportHtml
} from './investment-drawdown-report.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical UTC ISO-8601 timestamp.');
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

/** Private-only drawdown analysis, descriptive report preview and safe HTML/CSV export. */
export function initializeInvestmentDrawdownReportWorkspace(dependencies) {
    const form = document.querySelector('#investment-drawdown-report-form');
    if (!form) return { render() {}, invalidate() {} };

    const demoNote = document.querySelector('#investment-drawdown-report-demo-note');
    const error = document.querySelector('#investment-drawdown-report-error');
    const status = document.querySelector('#investment-drawdown-report-status');
    const accountRow = document.querySelector('#investment-drawdown-report-account-row');
    const account = form.elements.accountId;
    const scope = form.elements.scope;
    const currency = form.elements.currency;
    const startAt = form.elements.startAt;
    const endAt = form.elements.endAt;
    const recordedAtCutoff = form.elements.recordedAtCutoff;
    const preview = document.querySelector('#investment-drawdown-report-preview');
    const htmlButton = document.querySelector('#investment-drawdown-report-download-html');
    const csvButton = document.querySelector('#investment-drawdown-report-download-csv');
    let accounts = [];
    let latestReport = null;

    if (!recordedAtCutoff.value) recordedAtCutoff.value = new Date().toISOString();

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
            .map((item) => '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) +
                ' (' + escapeHtml(item.currency) + ')</option>').join('');
        account.value = selected;
    }

    function render() {
        const isPrivate = dependencies.isPrivateWorkspace();
        const healthy = dependencies.isLedgerHealthy() && dependencies.isSnapshotStorageHealthy()
            && dependencies.isCalendarStorageHealthy();
        const enabled = isPrivate && healthy;
        demoNote.hidden = isPrivate;
        for (const control of form.querySelectorAll('input, select, button')) control.disabled = !enabled;
        if (!isPrivate) {
            clearReport();
            show(error, '');
            show(status, '');
            preview.hidden = true;
            return;
        }
        if (!healthy) {
            clearReport();
            show(error, 'Investment ledgers, drawdown snapshots or calendars could not be validated. Reporting is paused; existing data was left untouched.');
            return;
        }
        try {
            accounts = dependencies.readLedger().investmentAccounts;
            renderAccounts(account.value);
            currency.innerHTML = CURRENCIES.map((item) => '<option value="' + item + '">' + item + '</option>').join('');
            currency.value = CURRENCIES.includes(currency.value) ? currency.value : 'INR';
            accountRow.hidden = scope.value !== 'account';
            show(error, '');
        } catch (cause) {
            clearReport();
            show(error, cause instanceof Error ? cause.message : 'Drawdown report inputs could not be loaded.');
        }
    }

    function invalidate() {
        clearReport();
        show(status, 'Investment data changed. Run the analysis again before exporting a report.');
    }

    scope.addEventListener('change', () => {
        accountRow.hidden = scope.value !== 'account';
    });
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
            const selectedScope = scope.value;
            const selectedAccount = selectedScope === 'account' ? account.value : undefined;
            const selectedCurrency = currency.value;
            const start = timestamp(startAt.value, 'Analysis start');
            const end = timestamp(endAt.value, 'Analysis end');
            const cutoff = timestamp(recordedAtCutoff.value, 'Recorded-at cutoff');
            if (start > end) throw new Error('Analysis start must not be after analysis end.');
            if (cutoff < end) throw new Error('Recorded-at cutoff cannot precede the analysis window end.');
            if (selectedScope === 'account' && !selectedAccount) throw new Error('Select an investment account for account-scoped analysis.');
            if (!CURRENCIES.includes(selectedCurrency)) throw new Error('Select a supported analysis currency.');

            const analysis = analyzeInvestmentDrawdownSeries({
                ...ledger,
                ...cash,
                investmentDrawdownSnapshots: snapshots.investmentDrawdownSnapshots,
                investmentDrawdownCalendars: calendars.investmentDrawdownCalendars,
                scope: selectedScope,
                ...(selectedAccount ? { accountId: selectedAccount } : {}),
                currency: selectedCurrency,
                startAt: start,
                endAt: end,
                recordedAtCutoff: cutoff,
                analyzeInvestmentDrawdownMath
            });
            const input = {
                analysis,
                scope: selectedScope,
                ...(selectedAccount ? { accountId: selectedAccount } : {}),
                currency: selectedCurrency,
                startAt: start,
                endAt: end,
                recordedAtCutoff: cutoff,
                generatedAt: new Date().toISOString()
            };
            const html = renderInvestmentDrawdownReportHtml(input);
            const csv = investmentDrawdownReportToCsv(input);
            latestReport = {
                html,
                csv,
                filename: 'pfo-investment-drawdown-' + selectedScope + '-' + start.slice(0, 10) + '-to-' + end.slice(0, 10)
            };
            preview.srcdoc = html;
            preview.hidden = false;
            htmlButton.disabled = false;
            csvButton.disabled = false;
            show(error, '');
            show(status, analysis.status === 'available'
                ? 'Drawdown analysis completed. The report contains descriptive historical metrics only.'
                : 'Analysis unavailable. No partial drawdown statistics were produced; review the reasons and completeness evidence in the report.');
        } catch (cause) {
            clearReport();
            show(error, cause instanceof Error ? cause.message : 'Drawdown analysis could not be completed.');
            show(status, '');
        }
    });

    htmlButton.addEventListener('click', () => {
        if (!latestReport || !dependencies.isPrivateWorkspace()) return;
        download(latestReport.html, 'text/html;charset=utf-8', latestReport.filename + '.html');
    });
    csvButton.addEventListener('click', () => {
        if (!latestReport || !dependencies.isPrivateWorkspace()) return;
        download(latestReport.csv, 'text/csv;charset=utf-8', latestReport.filename + '.csv');
    });

    render();
    return { render, invalidate };
}
