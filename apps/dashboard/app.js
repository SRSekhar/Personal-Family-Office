import { validateBackupPayload } from './backup.js';
import { persistJson, readJsonArray } from './storage.js';

const STORAGE_KEY = 'pfo-os.dashboard.private.v1';
const CURRENCY = 'INR';
const COLORS = ['#176b4d', '#4d8b70', '#9dbb9f', '#c4a15d', '#7898b6', '#a18cb5', '#d18b70', '#7c8a82'];
const ASSET_CATEGORIES = ['Cash & deposits', 'Investments', 'Property', 'Retirement', 'Insurance', 'Other assets'];
const LIABILITY_CATEGORIES = ['Home loan', 'Personal loan', 'Credit card', 'Other liabilities'];
const demoRecords = [
    { id: 'demo-1', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 425000 },
    { id: 'demo-2', name: 'Mutual fund portfolio', category: 'Investments', type: 'asset', value: 1850000 },
    { id: 'demo-3', name: 'Retirement savings', category: 'Retirement', type: 'asset', value: 920000 },
    { id: 'demo-4', name: 'Residential property', category: 'Property', type: 'asset', value: 4200000 },
    { id: 'demo-5', name: 'Other investments', category: 'Investments', type: 'asset', value: 385000 },
    { id: 'demo-6', name: 'Home loan', category: 'Home loan', type: 'liability', value: 1450000 }
];
let records = [];
let workspace = 'demo';
let privateStorageHealthy = true;
let editingId = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: CURRENCY, maximumFractionDigits: 0
}).format(value);
const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function readPrivateRecords() {
    const seenIds = new Set();
    const result = readJsonArray(localStorage, STORAGE_KEY, (record) => {
        if (!record || typeof record.id !== 'string' || record.id.trim() === ''
            || seenIds.has(record.id)
            || typeof record.name !== 'string' || record.name.trim() === ''
            || typeof record.category !== 'string' || record.category.trim() === ''
            || !['asset', 'liability'].includes(record.type)
            || !Number.isFinite(record.value) || record.value < 0) {
            return false;
        }
        seenIds.add(record.id);
        return true;
    });
    privateStorageHealthy = result.ok;
    if (!result.ok) {
        showToast('Saved data could not be safely read. It has been left untouched. Import a valid backup to recover this workspace before editing.');
        return [];
    }
    return result.records;
}

function savePrivateRecords(nextRecords, allowRecovery = false) {
    if (!privateStorageHealthy && !allowRecovery) {
        showToast('Editing is paused because saved data could not be read. Import a valid backup to recover safely; existing storage will not be overwritten.');
        return false;
    }
    const saved = persistJson(localStorage, STORAGE_KEY, nextRecords);
    if (!saved) {
        showToast('Could not save locally. Check browser storage availability. Your previous saved records are unchanged.');
        return false;
    }
    privateStorageHealthy = true;
    return true;
}

function isHostedPublicDemo() {
    const hostname = window.location.hostname;
    return hostname === 'github.io' || hostname.endsWith('.github.io');
}

function showHostedPrivacyWarning() {
    const isHosted = isHostedPublicDemo();
    $('#hosted-privacy-notice').hidden = !isHosted;
    if (isHosted) {
        $('.privacy-card strong').textContent = 'Public demo only';
        $('.privacy-card p').textContent = 'Use the local preview for private records.';
    }
}

function showLocalWorkspaceRequired() {
    showToast('The public hosted demo is sample-only. Run pnpm dashboard:serve locally to enter or import personal financial records.');
}

function switchWorkspace(nextWorkspace) {
    workspace = nextWorkspace;
    records = workspace === 'demo' ? structuredClone(demoRecords) : readPrivateRecords();
    $('#workspace-label').textContent = workspace === 'demo' ? 'SAMPLE WORKSPACE' : 'PRIVATE WORKSPACE';
    $('#sample-notice').hidden = workspace !== 'demo';
    $('#switch-private-button').textContent = isHostedPublicDemo() ? 'Use locally →' : 'Use my data →';
    render();
}

function totals() {
    const assets = records.filter((item) => item.type === 'asset').reduce((sum, item) => sum + item.value, 0);
    const liabilities = records.filter((item) => item.type === 'liability').reduce((sum, item) => sum + item.value, 0);
    return { assets, liabilities, netWorth: assets - liabilities };
}

function render() {
    const result = totals();
    $('#net-worth').textContent = money(result.netWorth);
    $('#total-assets').textContent = money(result.assets);
    $('#total-liabilities').textContent = money(result.liabilities);
    $('#record-count').textContent = number(records.length);
    $('#asset-count').textContent = `${records.filter((item) => item.type === 'asset').length} records`;
    $('#liability-count').textContent = `${records.filter((item) => item.type === 'liability').length} records`;
    $('#net-worth-caption').textContent = result.netWorth < 0 ? 'Liabilities exceed assets' : 'Assets minus liabilities';
    renderAllocation(result.assets);
    renderRecords();
}

function renderAllocation(totalAssets) {
    const container = $('#allocation-content');
    const grouped = new Map();
    records.filter((item) => item.type === 'asset').forEach((item) => {
        grouped.set(item.category, (grouped.get(item.category) || 0) + item.value);
    });
    const entries = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length === 0 || totalAssets <= 0) {
        container.innerHTML = '<div class="empty-chart"><strong>No assets to allocate yet</strong><span>Add an asset to see the breakdown.</span></div>';
        return;
    }
    const segments = entries.map(([category, value], index) =>
        `<span class="allocation-segment" title="${escapeHtml(category)}: ${money(value)}" style="width:${(value / totalAssets * 100).toFixed(4)}%;background:${COLORS[index % COLORS.length]}"></span>`).join('');
    const legend = entries.map(([category, value], index) => `<div class="legend-item"><span class="legend-dot" style="background:${COLORS[index % COLORS.length]}"></span><span class="legend-name" title="${escapeHtml(category)}">${escapeHtml(category)}</span><span class="legend-value">${(value / totalAssets * 100).toFixed(1)}%</span></div>`).join('');
    container.innerHTML = `<div class="allocation-total"><strong>${money(totalAssets)}</strong><span>${entries.length} categories</span></div><div class="allocation-bar" role="img" aria-label="Asset allocation: ${escapeHtml(entries.map(([category, value]) => `${category} ${(value / totalAssets * 100).toFixed(1)} percent`).join(', '))}">${segments}</div><div class="allocation-legend">${legend}</div>`;
}

function renderRecords() {
    const query = $('#record-search').value.trim().toLowerCase();
    const filtered = records.filter((item) => `${item.name} ${item.category} ${item.type}`.toLowerCase().includes(query));
    const visible = $('#view-all-button').dataset.all === 'true' ? filtered : filtered.slice(0, 5);
    $('#records-body').innerHTML = visible.map((item) => {
        const asset = item.type === 'asset';
        return `<tr>
<td><div class="record-name"><span class="record-icon ${asset ? '' : 'liability'}">${asset ? '↗' : '↙'}</span><span class="record-title">${escapeHtml(item.name)}<small>${asset ? 'Owned asset' : 'Outstanding liability'}</small></span></div></td>
<td>${escapeHtml(item.category)}</td>
<td><span class="type-pill ${item.type}">${asset ? 'Asset' : 'Liability'}</span></td>
<td class="record-value">${money(item.value)}</td>
<td><div class="row-actions"><button class="row-action" data-edit="${escapeHtml(item.id)}" type="button" aria-label="Edit ${escapeHtml(item.name)}">Edit</button><button class="row-action" data-delete="${escapeHtml(item.id)}" type="button" aria-label="Delete ${escapeHtml(item.name)}">×</button></div></td>
</tr>`;
    }).join('');
    $('#empty-records').hidden = records.length !== 0;
    $('.table-wrap').hidden = records.length === 0;
    $('#records-summary').textContent = query ? `Showing ${visible.length} of ${filtered.length} matching records` : `Showing ${visible.length} of ${records.length} records`;
    $('#view-all-button').hidden = filtered.length <= 5;
    $('#view-all-button').textContent = $('#view-all-button').dataset.all === 'true' ? 'Show less' : 'View all';
}

function updateCategoryOptions(selectedCategory) {
    const type = $('#record-type').value;
    const categories = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
    $('#record-category').innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (categories.includes(selectedCategory)) $('#record-category').value = selectedCategory;
}

function openRecordDialog(type = 'asset', record = null) {
    if (isHostedPublicDemo()) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'demo') {
        if (record) {
            showToast('Sample records are read-only. Switch to your private workspace to manage your own records.');
            return;
        }
        switchWorkspace('private');
    }
    editingId = record ? record.id : null;
    $('#record-form').reset();
    $('#dialog-title').textContent = record ? 'Edit record' : 'Add a record';
    $('#record-type').value = record ? record.type : type;
    updateCategoryOptions(record?.category);
    $('#record-name').value = record?.name || '';
    $('#record-value').value = record ? String(record.value) : '';
    $('#record-dialog').showModal();
    $('#record-name').focus();
}

function closeRecordDialog() {
    $('#record-dialog').close();
    editingId = null;
}

function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function exportData() {
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Export is paused because saved data could not be read. Existing storage remains untouched; import a valid backup to recover.');
        return;
    }
    const payload = { schemaVersion: 1, currency: CURRENCY, exportedAt: new Date().toISOString(), records };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pfo-os-financial-records.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Workspace exported to this device.');
}

function importData(file) {
    if (isHostedPublicDemo()) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            const parsed = JSON.parse(String(reader.result));
            const validated = validateBackupPayload(parsed, CURRENCY)
                .map((item) => ({ id: crypto.randomUUID(), ...item }));
            if (workspace === 'demo') switchWorkspace('private');
            if (savePrivateRecords(validated, true)) {
                records = validated;
                render();
                showToast(`Imported ${records.length} records into your private workspace.`);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not import this backup.');
        }
        $('#import-file').value = '';
    });
    reader.addEventListener('error', () => showToast('Could not read the selected file.'));
    reader.readAsText(file);
}

$('#add-record-button').addEventListener('click', () => openRecordDialog());
$('#quick-add-asset').addEventListener('click', () => openRecordDialog('asset'));
$('#quick-add-liability').addEventListener('click', () => openRecordDialog('liability'));
$('#empty-add-button').addEventListener('click', () => openRecordDialog());
$('#switch-private-button').addEventListener('click', () => {
    if (isHostedPublicDemo()) {
        showLocalWorkspaceRequired();
        return;
    }
    switchWorkspace('private');
    showToast('Private workspace ready. Your entries stay in this browser.');
});
$('#record-type').addEventListener('change', () => updateCategoryOptions());
$('#close-dialog-button').addEventListener('click', closeRecordDialog);
$('#cancel-dialog-button').addEventListener('click', closeRecordDialog);
$('#record-dialog').addEventListener('click', (event) => {
    if (event.target === $('#record-dialog')) closeRecordDialog();
});
$('#record-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#record-name').value.trim();
    const category = $('#record-category').value;
    const type = $('#record-type').value;
    const value = Number($('#record-value').value);
    if (!name || !category || !Number.isFinite(value) || value < 0) {
        showToast('Enter a name, category and valid non-negative value.');
        return;
    }
    const wasEditing = Boolean(editingId);
    const nextRecords = wasEditing
        ? records.map((item) => item.id === editingId ? { ...item, name, category, type, value } : item)
        : [...records, { id: crypto.randomUUID(), name, category, type, value }];
    if (savePrivateRecords(nextRecords)) {
        records = nextRecords;
        render();
        closeRecordDialog();
        showToast(wasEditing ? 'Record updated.' : 'Record saved in this browser.');
    }
});
$('#records-body').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const editId = button.dataset.edit;
    const deleteId = button.dataset.delete;
    if (editId) {
        const record = records.find((item) => item.id === editId);
        if (record) openRecordDialog(record.type, record);
    }
    if (deleteId) {
        if (workspace === 'demo') {
            showToast('Sample records are read-only. Switch to your private workspace to manage your own records.');
            return;
        }
        const record = records.find((item) => item.id === deleteId);
        if (!record) return;
        if (window.confirm(`Delete "${record.name}" from this workspace?`)) {
            const nextRecords = records.filter((item) => item.id !== deleteId);
            if (workspace === 'private' && savePrivateRecords(nextRecords)) {
                records = nextRecords;
                render();
                showToast('Record deleted.');
            }
        }
    }
});
$('#record-search').addEventListener('input', renderRecords);
$('#view-all-button').addEventListener('click', () => {
    $('#view-all-button').dataset.all = $('#view-all-button').dataset.all !== 'true' ? 'true' : 'false';
    renderRecords();
});
$('#export-button').addEventListener('click', exportData);
$('#import-button').addEventListener('click', () => {
    if (isHostedPublicDemo()) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'demo' && !window.confirm('Importing replaces the current view with your private workspace. Continue?')) return;
    $('#import-file').click();
});
$('#import-file').addEventListener('change', (event) => importData(event.target.files?.[0]));
document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((nav) => { nav.classList.remove('active'); nav.removeAttribute('aria-current'); });
    item.classList.add('active');
    item.setAttribute('aria-current', 'page');
    $('#page-breadcrumb').textContent = item.textContent.trim().replace(/^[◫▤]\s*/, '');
}));

showHostedPrivacyWarning();
switchWorkspace('demo');
