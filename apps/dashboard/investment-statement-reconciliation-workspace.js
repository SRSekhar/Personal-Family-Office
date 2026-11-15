import {
    reconcileInvestmentStatementEvidence, validateInvestmentStatementEvidence
} from './investment-statement-reconciliation.js';
import { validateInvestmentLedgerCollections } from './investment-ledger.js';

const EVIDENCE_KEY = 'pfo-os.investment-statement-evidence.v1';
const LEDGER_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1'
};
const $ = (selector) => document.querySelector(selector);
let latestReport = null;
let latestReportSignature = null;

function privateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function readLedger() {
    const collections = {};
    for (const [name, key] of Object.entries(LEDGER_KEYS)) {
        const raw = localStorage.getItem(key);
        const parsed = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Saved ' + name + ' data is not a collection.');
        collections[name] = parsed;
    }
    return validateInvestmentLedgerCollections(collections);
}
function readEvidence(ledger) {
    const raw = localStorage.getItem(EVIDENCE_KEY);
    const evidence = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(evidence)) throw new Error('Saved investment statement evidence is not a collection.');
    return validateInvestmentStatementEvidence({ ...ledger, investmentStatementEvidence: evidence });
}
function sourceSignature(ledger, evidence, cutoff) {
    return JSON.stringify({ ledger, evidence, cutoff });
}
function downloadCsv(report) {
    const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    const rows = [['statementId', 'kind', 'accountId', 'currency', 'statementAsOf', 'status', 'sourceRowId', 'transactionId', 'instrumentId', 'statementQuantity', 'ledgerQuantity', 'difference', 'rowStatus', 'reason']];
    for (const item of report.reports) {
        for (const row of item.rows) rows.push([
            item.statementId, item.kind, item.accountId, item.currency, item.statementAsOf, item.status,
            row.sourceRowId, row.transactionId, row.instrumentId, row.statementQuantity, row.ledgerQuantity,
            row.difference, row.status, row.reason
        ]);
    }
    const csv = rows.map((row) => row.map((value) => {
        const text = String(value ?? '');
        const safe = /^[\s]*[=+\-@]/u.test(text) ? "'" + text : text;
        return quote(safe);
    }).join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pfo-investment-statement-reconciliation.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderEvidence(evidence) {
    const body = $('#investment-statement-evidence-rows');
    body.replaceChildren();
    for (const item of evidence.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))) {
        const row = document.createElement('tr');
        for (const value of [item.kind, item.sourceName, item.statementReference ?? '—', item.accountId,
            item.statementAsOf, String(item.rows.length), item.recordedAt]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        }
        body.append(row);
    }
    if (!evidence.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = 'No transaction or holdings statement evidence has been imported.';
        row.append(cell);
        body.append(row);
    }
}
function renderReport(report) {
    const body = $('#investment-statement-result-rows');
    body.replaceChildren();
    $('#investment-statement-result-summary').textContent =
        report.summary.statementCount + ' statements · ' + report.summary.reconciled + ' reconciled · '
        + report.summary.differences + ' with differences · ' + report.summary.incomplete + ' incomplete';
    for (const item of report.reports) {
        for (const rowData of item.rows) {
            const row = document.createElement('tr');
            const values = [item.kind, item.statementId, rowData.sourceRowId ?? rowData.transactionId ?? '—',
                rowData.instrumentId ?? '—', rowData.statementQuantity ?? '—', rowData.ledgerQuantity ?? '—',
                rowData.status, rowData.reason ?? '—'];
            for (const value of values) {
                const cell = document.createElement('td');
                cell.textContent = String(value);
                row.append(cell);
            }
            body.append(row);
        }
    }
    $('#investment-statement-result-panel').hidden = false;
    $('#investment-statement-export-csv').disabled = report.reports.length === 0;
}
function render() {
    const panel = $('#investment-statement-reconciliation');
    if (!panel) return;
    const enabled = privateWorkspace();
    $('#investment-statement-demo-note').hidden = enabled;
    panel.querySelectorAll('input, textarea, button').forEach((control) => { control.disabled = !enabled; });
    if (!enabled) {
        $('#investment-statement-error').hidden = true;
        $('#investment-statement-evidence-rows').replaceChildren();
        $('#investment-statement-result-panel').hidden = true;
        latestReport = null;
        latestReportSignature = null;
        return;
    }
    try {
        const ledger = readLedger();
        const evidence = readEvidence(ledger).investmentStatementEvidence;
        renderEvidence(evidence);
        $('#investment-statement-error').hidden = true;
    } catch (error) {
        $('#investment-statement-error').textContent = error instanceof Error ? error.message : 'Statement evidence could not be validated.';
        $('#investment-statement-error').hidden = false;
        $('#investment-statement-evidence-rows').replaceChildren();
    }
}
function initialize() {
    const panel = $('#investment-statement-reconciliation');
    if (!panel) return;
    const cutoff = $('#investment-statement-cutoff');
    cutoff.value = new Date().toISOString();
    $('#investment-statement-file').addEventListener('change', async (event) => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            $('#investment-statement-error').textContent = 'Statement JSON exceeds the 10 MiB import limit.';
            $('#investment-statement-error').hidden = false;
            return;
        }
        try { $('#investment-statement-json').value = await file.text(); }
        catch { $('#investment-statement-error').textContent = 'The selected statement file could not be read.'; $('#investment-statement-error').hidden = false; }
    });
    $('#investment-statement-evidence-form').addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            if (!privateWorkspace()) throw new Error('Statement evidence is available only in the local private workspace.');
            const ledger = readLedger();
            const current = readEvidence(ledger).investmentStatementEvidence;
            const parsed = JSON.parse($('#investment-statement-json').value);
            const incoming = Array.isArray(parsed) ? parsed : [parsed];
            const validated = validateInvestmentStatementEvidence({
                ...ledger, investmentStatementEvidence: [...current, ...incoming]
            }).investmentStatementEvidence;
            const previous = localStorage.getItem(EVIDENCE_KEY);
            try { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(validated)); }
            catch (error) {
                try { if (previous === null) localStorage.removeItem(EVIDENCE_KEY); else localStorage.setItem(EVIDENCE_KEY, previous); }
                catch { throw new Error('Statement evidence save failed and browser-storage rollback was incomplete. Stop editing and recover the workspace.', { cause: error }); }
                throw error;
            }
            $('#investment-statement-json').value = '';
            $('#investment-statement-file').value = '';
            latestReport = null;
            latestReportSignature = null;
            $('#investment-statement-result-panel').hidden = true;
            window.dispatchEvent(new Event('pfo:workspace-updated'));
            render();
            $('#investment-statement-status').textContent = incoming.length + ' statement evidence document(s) saved. Ledger transactions and positions were not changed.';
        } catch (error) {
            $('#investment-statement-error').textContent = error instanceof Error ? error.message : 'Statement evidence import failed.';
            $('#investment-statement-error').hidden = false;
        }
    });
    $('#investment-statement-run').addEventListener('click', () => {
        try {
            if (!privateWorkspace()) throw new Error('Reconciliation is available only in the local private workspace.');
            const ledger = readLedger();
            const evidence = readEvidence(ledger).investmentStatementEvidence;
            const report = reconcileInvestmentStatementEvidence({
                ...ledger, investmentStatementEvidence: evidence, recordedAtCutoff: cutoff.value
            });
            latestReport = report;
            latestReportSignature = sourceSignature(ledger, evidence, cutoff.value);
            renderReport(report);
            $('#investment-statement-error').hidden = true;
        } catch (error) {
            latestReport = null;
            $('#investment-statement-error').textContent = error instanceof Error ? error.message : 'Statement reconciliation failed.';
            $('#investment-statement-error').hidden = false;
            $('#investment-statement-result-panel').hidden = true;
        }
    });
    $('#investment-statement-export-csv').addEventListener('click', () => {
        if (!privateWorkspace() || !latestReport) return;
        try {
            const ledger = readLedger();
            const evidence = readEvidence(ledger).investmentStatementEvidence;
            if (sourceSignature(ledger, evidence, cutoff.value) !== latestReportSignature) throw new Error('Statement or ledger data changed after analysis. Run reconciliation again before exporting.');
            downloadCsv(latestReport);
        } catch (error) {
            $('#investment-statement-error').textContent = error instanceof Error ? error.message : 'The reconciliation export is stale.';
            $('#investment-statement-error').hidden = false;
        }
    });
    window.addEventListener('pfo:workspace-updated', () => {
        latestReport = null;
        latestReportSignature = null;
        $('#investment-statement-result-panel').hidden = true;
        render();
    });
    render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
