import {
    INVESTMENT_CSV_COLLECTIONS, exportInvestmentCollectionCsv, parseInvestmentCollectionCsv, previewInvestmentCsvImport
} from './investment-csv.js';

const STORAGE_KEYS = {
    investmentAccounts: 'pfo-os.investment-accounts.v1',
    investmentInstruments: 'pfo-os.investment-instruments.v1',
    investmentTransactions: 'pfo-os.investment-transactions.v1',
    investmentValuations: 'pfo-os.investment-valuations.v1',
    investmentCashAccounts: 'pfo-os.investment-cash-accounts.v1',
    investmentCashMovements: 'pfo-os.investment-cash-movements.v1',
    investmentCashTransfers: 'pfo-os.investment-cash-transfers.v1',
    investmentCashStatements: 'pfo-os.investment-cash-statements.v1'
};
const $ = (selector) => document.querySelector(selector);
let pendingPreview = null;

function isPrivateWorkspace() {
    return $('#workspace-label')?.textContent.includes('PRIVATE') === true;
}
function readWorkspace() {
    const workspace = Object.fromEntries(Object.entries(STORAGE_KEYS).map(([name, key]) => {
        const raw = localStorage.getItem(key);
        const value = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(value)) throw new Error('Saved ' + name + ' data is not an array.');
        return [name, value];
    }));
    previewInvestmentCsvImport(workspace, {}, 'replace');
    return workspace;
}
function downloadCsv(collection) {
    const csv = exportInvestmentCollectionCsv(collection, readWorkspace()[collection]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = collection + '.pfo.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderPreview(preview) {
    const summary = $('#investment-csv-preview');
    summary.replaceChildren();
    for (const [collection, counts] of Object.entries(preview.counts)) {
        const row = document.createElement('p');
        row.textContent = collection + ': ' + counts.imported + ' rows; resulting collection: ' + counts.resulting + ' (' + counts.mode + ')';
        summary.append(row);
    }
    $('#investment-csv-confirm').disabled = false;
    $('#investment-csv-status').textContent = 'Preview validated. No data has been changed. Confirm to persist the complete import.';
}
function clearPreview(message = '') {
    pendingPreview = null;
    $('#investment-csv-confirm').disabled = true;
    $('#investment-csv-preview').replaceChildren();
    $('#investment-csv-status').textContent = message;
}
function commitPreview() {
    if (!pendingPreview || !isPrivateWorkspace()) throw new Error('A validated import preview in the private workspace is required.');
    const candidate = pendingPreview.candidate;
    const previous = Object.values(STORAGE_KEYS).map((key) => [key, localStorage.getItem(key)]);
    try {
        for (const collection of INVESTMENT_CSV_COLLECTIONS) {
            if (Object.hasOwn(pendingPreview.imported, collection)) {
                localStorage.setItem(STORAGE_KEYS[collection], JSON.stringify(candidate[collection]));
            }
        }
    } catch (error) {
        const restored = previous.map(([key, value]) => {
            try {
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, value);
                return true;
            } catch { return false; }
        }).every(Boolean);
        if (!restored) throw new Error('CSV import failed and browser-storage rollback was incomplete. Stop editing and export/recover the workspace.', { cause: error });
        throw new Error(error instanceof Error ? error.message : 'CSV import failed; prior values were restored.', { cause: error });
    }
    window.dispatchEvent(new Event('pfo:investment-updated'));
    window.dispatchEvent(new Event('pfo:workspace-updated'));
    clearPreview('Import committed. All selected collections passed validation and were saved.');
}
async function previewFiles(files) {
    if (!isPrivateWorkspace()) throw new Error('Investment CSV import is available only in the private workspace.');
    if (!files.length) throw new Error('Select one or more PFO investment CSV files.');
    const imported = {};
    for (const file of files) {
        const source = await file.text();
        const manifest = source.replace(/^\uFEFF/u, '').split(/\r?\n/u, 1)[0].split(',');
        if (manifest.length !== 3 || manifest[0] !== '#PFO-INVESTMENT-CSV' || manifest[1] !== '1') {
            throw new Error(file.name + ' is not a supported PFO investment CSV file. External broker formats require explicit mapping and are not accepted by this importer.');
        }
        const collection = manifest[2];
        if (!INVESTMENT_CSV_COLLECTIONS.includes(collection)) throw new Error(file.name + ' identifies an unsupported collection.');
        if (Object.hasOwn(imported, collection)) throw new Error('Only one file per collection may be imported in a single batch: ' + collection + '.');
        imported[collection] = parseInvestmentCollectionCsv(source, collection);
    }
    const mode = document.querySelector('input[name="investment-csv-mode"]:checked')?.value ?? 'replace';
    const preview = previewInvestmentCsvImport(readWorkspace(), imported, mode);
    pendingPreview = { ...preview, imported };
    renderPreview(preview);
}

function initialize() {
    const panel = $('#investment-csv-interchange');
    if (!panel) return;
    panel.querySelectorAll('button, input').forEach((control) => { control.disabled = !isPrivateWorkspace(); });
    $('#investment-csv-confirm').disabled = true;
    $('#investment-csv-demo-note').hidden = isPrivateWorkspace();
    panel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-investment-csv-export]');
        if (!button) return;
        try {
            if (!isPrivateWorkspace()) throw new Error('CSV export is available only in the private workspace.');
            downloadCsv(button.dataset.investmentCsvExport);
            $('#investment-csv-status').textContent = 'Exported ' + button.dataset.investmentCsvExport + '.';
        } catch (error) { $('#investment-csv-status').textContent = error.message; }
    });
    const refreshPreview = async () => {
        clearPreview();
        try { await previewFiles([...$('#investment-csv-files').files]); }
        catch (error) { clearPreview(error instanceof Error ? error.message : 'CSV import preview failed.'); }
    };
    $('#investment-csv-files').addEventListener('change', refreshPreview);
    panel.querySelectorAll('input[name="investment-csv-mode"]').forEach((control) => {
        control.addEventListener('change', () => {
            if ($('#investment-csv-files').files.length) refreshPreview();
        });
    });
    $('#investment-csv-confirm').addEventListener('click', () => {
        try { commitPreview(); }
        catch (error) { $('#investment-csv-status').textContent = error.message; }
    });
    $('#investment-csv-cancel').addEventListener('click', () => clearPreview('Import preview cancelled. No data was changed.'));
    window.addEventListener('pfo:workspace-updated', () => {
        const enabled = isPrivateWorkspace();
        $('#investment-csv-demo-note').hidden = enabled;
        panel.querySelectorAll('button, input').forEach((control) => { control.disabled = !enabled; });
        $('#investment-csv-confirm').disabled = !pendingPreview || !enabled;
        if (!enabled) clearPreview('Switch to the private workspace to access investment CSV files.');
    });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
