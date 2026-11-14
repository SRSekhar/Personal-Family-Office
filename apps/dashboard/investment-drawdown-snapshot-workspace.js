import {
    buildInvestmentDrawdownExternalFlows,
    buildInvestmentDrawdownSnapshotRequirements
} from './investment-drawdown-acquisition.js';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

function timestamp(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
    return value;
}

function componentKey(component) {
    return component.type === 'position'
        ? JSON.stringify(['position', component.accountId, component.instrumentId])
        : JSON.stringify(['cash', component.cashAccountId]);
}

function normalizeComponents(rows, effectiveAt, currency, sourceName) {
    if (!Array.isArray(rows)) throw new Error('Component input must be a JSON array.');
    return rows.map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Every component must be a JSON object.');
        const common = {
            id: crypto.randomUUID(),
            valuedAt: effectiveAt,
            sourceType: 'manual',
            sourceName: typeof row.sourceName === 'string' && row.sourceName.trim() ? row.sourceName.trim() : sourceName
        };
        if (row.type === 'position') {
            if (!Number.isFinite(row.quantity) || row.quantity <= 0
                || !row.unitPrice || !Number.isFinite(row.unitPrice.amount) || row.unitPrice.amount <= 0) {
                throw new Error('Each position needs a positive quantity and positive unitPrice.amount.');
            }
            const priceCurrency = row.unitPrice.currency ?? currency;
            if (priceCurrency !== currency) throw new Error('Position unit-price currency must match the selected snapshot currency.');
            return {
                ...common,
                type: 'position',
                accountId: row.accountId,
                instrumentId: row.instrumentId,
                quantity: row.quantity,
                unitPrice: { amount: row.unitPrice.amount, currency },
                value: { amount: row.quantity * row.unitPrice.amount, currency }
            };
        }
        if (row.type === 'cash') {
            if (!row.cashAccountId || !row.value || !Number.isFinite(row.value.amount)) {
                throw new Error('Each cash component needs cashAccountId and a finite value.amount.');
            }
            const valueCurrency = row.value.currency ?? currency;
            if (valueCurrency !== currency) throw new Error('Cash value currency must match the selected snapshot currency.');
            return {
                ...common,
                type: 'cash',
                cashAccountId: row.cashAccountId,
                value: { amount: row.value.amount, currency }
            };
        }
        throw new Error('Component type must be position or cash.');
    });
}

function matchesRequirements(requirements, components, currency) {
    if (requirements.status !== 'available' || requirements.expectedComponents.length !== components.length) return false;
    const expected = new Map(requirements.expectedComponents.map((item) => [componentKey(item), item]));
    for (const component of components) {
        const requirement = expected.get(componentKey(component));
        if (!requirement) return false;
        if (component.type === 'position' && Math.abs(component.quantity - requirement.quantity) > 1e-10) return false;
        if (component.type === 'cash') {
            const tolerance = currency === 'JPY' ? 1 : 0.01;
            if (Math.abs(component.value.amount - requirement.balance) > tolerance) return false;
        }
    }
    return true;
}

function parseRows(value, label) {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(label + ' must contain valid JSON.');
    }
}

/**
 * Private-only manual capture/import for immutable daily-close and paired
 * external-flow observations. User-entered prices and balances are never inferred.
 */
export function initializeInvestmentDrawdownSnapshotWorkspace(dependencies) {
    const form = document.querySelector('#investment-drawdown-snapshot-form');
    if (!form) return { render() {} };

    const error = document.querySelector('#investment-drawdown-snapshot-error');
    const message = document.querySelector('#investment-drawdown-snapshot-message');
    const demoNote = document.querySelector('#investment-drawdown-snapshot-demo-note');
    const accountRow = document.querySelector('#investment-drawdown-snapshot-account-row');
    const flowRow = document.querySelector('#investment-drawdown-snapshot-flow-row');
    const dailyRows = document.querySelector('#investment-drawdown-snapshot-daily-rows');
    const preRows = document.querySelector('#investment-drawdown-snapshot-pre-rows');
    const postRows = document.querySelector('#investment-drawdown-snapshot-post-rows');
    const history = document.querySelector('#investment-drawdown-snapshot-history');
    const scope = form.elements.scope;
    const account = form.elements.accountId;
    const currency = form.elements.currency;
    const kind = form.elements.kind;
    const effectiveAt = form.elements.effectiveAt;
    const cutoff = form.elements.recordedAtCutoff;
    const flowId = form.elements.flowId;
    const sourceName = form.elements.sourceName;
    const dailyComponents = form.elements.dailyComponents;
    const preComponents = form.elements.preComponents;
    const postComponents = form.elements.postComponents;
    let accounts = [];
    let snapshots = [];

    function show(target, text) {
        target.textContent = text;
        target.hidden = !text;
    }

    function readInputs() {
        const ledger = dependencies.readLedger();
        const cash = dependencies.readCash();
        return { ...ledger, ...cash };
    }

    function renderAccounts(selected = '') {
        account.innerHTML = '<option value="">Select investment account</option>' + accounts
            .map((item) => '<option value="' + item.id.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '">' +
                item.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') +
                ' (' + item.currency + ')</option>').join('');
        account.value = selected;
    }

    function renderHistory() {
        const superseded = new Set(snapshots.map((item) => item.supersedesSnapshotId).filter(Boolean));
        const current = snapshots.filter((item) => !superseded.has(item.id))
            .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
        history.innerHTML = current.length ? current.map((item) =>
            '<tr><td>' + item.effectiveAt + '</td><td>' + item.kind + '</td><td>' +
            (item.scope === 'account' ? 'Account' : 'Portfolio') + '</td><td>' + item.currency +
            '</td><td class="align-right">' + item.components.length + '</td><td class="align-right">' +
            new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(item.totalValue.amount) +
            '</td><td>' + (item.complete ? 'Complete' : 'Incomplete') + '</td></tr>'
        ).join('') : '<tr><td colspan="7">No manual drawdown observations have been captured.</td></tr>';
    }

    function refreshFlows() {
        flowId.innerHTML = '<option value="">Select authoritative external flow</option>';
        if (kind.value !== 'ExternalFlowPair' || !effectiveAt.value || !cutoff.value) return;
        try {
            const ledger = readInputs();
            const flows = buildInvestmentDrawdownExternalFlows({
                ...ledger,
                scope: scope.value,
                ...(scope.value === 'account' ? { accountId: account.value } : {}),
                currency: currency.value,
                startAt: timestamp(effectiveAt.value, 'Effective timestamp'),
                endAt: timestamp(effectiveAt.value, 'Effective timestamp'),
                recordedAtCutoff: timestamp(cutoff.value, 'Recorded-at cutoff')
            });
            if (flows.status === 'unavailable') throw new Error(flows.reason);
            const matching = flows.flows.filter((item) => item.effectiveAt === effectiveAt.value);
            flowId.innerHTML += matching.map((item) => '<option value="' + item.id + '">' +
                item.classification + ' · ' + item.id + ' · ' + item.amount.amount + ' ' + item.amount.currency +
                '</option>').join('');
            if (!matching.length) show(error, 'No authoritative external flow exists at this exact timestamp and recorded-at cutoff.');
            else show(error, '');
        } catch (cause) {
            show(error, cause instanceof Error ? cause.message : 'External flows could not be loaded.');
        }
    }

    function render() {
        const enabled = dependencies.isPrivateWorkspace() && dependencies.isLedgerHealthy()
            && dependencies.isSnapshotStorageHealthy();
        demoNote.hidden = dependencies.isPrivateWorkspace();
        for (const control of form.querySelectorAll('input, select, textarea, button')) control.disabled = !enabled;
        if (!dependencies.isPrivateWorkspace()) {
            history.innerHTML = '<tr><td colspan="7">Switch to the local private workspace to manage drawdown observations.</td></tr>';
            show(error, '');
            return;
        }
        if (!enabled) {
            history.innerHTML = '<tr><td colspan="7">Snapshot editing is paused until the investment ledgers and saved observations validate.</td></tr>';
            show(error, 'Investment ledger or drawdown snapshot storage is unavailable. Existing data was left untouched.');
            return;
        }
        try {
            const ledger = dependencies.readLedger();
            accounts = ledger.investmentAccounts;
            snapshots = dependencies.readSnapshots().investmentDrawdownSnapshots;
            renderAccounts(account.value);
            currency.innerHTML = CURRENCIES.map((item) => '<option value="' + item + '">' + item + '</option>').join('');
            currency.value = CURRENCIES.includes(currency.value) ? currency.value : 'INR';
            accountRow.hidden = scope.value !== 'account';
            const paired = kind.value === 'ExternalFlowPair';
            dailyRows.hidden = paired;
            preRows.hidden = !paired;
            postRows.hidden = !paired;
            flowRow.hidden = !paired;
            renderHistory();
            show(error, '');
        } catch (cause) {
            show(error, cause instanceof Error ? cause.message : 'Drawdown observations could not be loaded.');
        }
    }

    scope.addEventListener('change', () => {
        accountRow.hidden = scope.value !== 'account';
        refreshFlows();
    });
    kind.addEventListener('change', render);
    effectiveAt.addEventListener('change', refreshFlows);
    cutoff.addEventListener('change', refreshFlows);
    currency.addEventListener('change', refreshFlows);
    account.addEventListener('change', refreshFlows);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            if (!dependencies.isPrivateWorkspace() || !dependencies.isLedgerHealthy()
                || !dependencies.isSnapshotStorageHealthy()) {
                throw new Error('Private workspace and healthy investment data are required.');
            }
            const ledger = dependencies.readLedger();
            const cash = dependencies.readCash();
            const collections = { ...ledger, ...cash };
            const selectedScope = scope.value;
            const selectedAccount = selectedScope === 'account' ? account.value : undefined;
            const selectedCurrency = currency.value;
            const at = timestamp(effectiveAt.value, 'Effective timestamp');
            const asKnownAt = timestamp(cutoff.value, 'Recorded-at cutoff');
            if (asKnownAt < at) throw new Error('Recorded-at cutoff cannot precede the effective timestamp.');
            const provenance = sourceName.value.trim();
            if (!provenance) throw new Error('A source name or valuation reference is required.');
            const paired = kind.value === 'ExternalFlowPair';
            const selectedFlowId = paired ? flowId.value : undefined;
            if (paired && !selectedFlowId) throw new Error('Select an authoritative external flow before capturing its paired boundaries.');
            const observationKinds = paired ? ['ExternalFlowPre', 'ExternalFlowPost'] : ['DailyClose'];
            const rawRows = paired
                ? [parseRows(preComponents.value, 'Pre-flow components'), parseRows(postComponents.value, 'Post-flow components')]
                : [parseRows(dailyComponents.value, 'Daily-close components')];
            const created = observationKinds.map((observationKind, index) => {
                const requirements = buildInvestmentDrawdownSnapshotRequirements({
                    ...collections,
                    scope: selectedScope,
                    ...(selectedAccount ? { accountId: selectedAccount } : {}),
                    currency: selectedCurrency,
                    effectiveAt: at,
                    recordedAtCutoff: asKnownAt,
                    kind: observationKind,
                    ...(selectedFlowId ? { flowId: selectedFlowId } : {})
                });
                const components = normalizeComponents(rawRows[index], at, selectedCurrency, provenance);
                const sum = components.reduce((total, item) => total + item.value.amount, 0);
                if (!Number.isFinite(sum) || sum < 0) throw new Error('The total portfolio value must be finite and non-negative.');
                const complete = matchesRequirements(requirements, components, selectedCurrency);
                const reasons = [...requirements.reasons];
                if (!complete && requirements.status === 'available') {
                    reasons.push('Entered components do not exactly match the ledger-derived component universe, quantities and cash balances.');
                }
                return {
                    id: crypto.randomUUID(),
                    scope: selectedScope,
                    ...(selectedAccount ? { accountId: selectedAccount } : {}),
                    currency: selectedCurrency,
                    kind: observationKind,
                    effectiveAt: at,
                    recordedAt: new Date().toISOString(),
                    sourceType: 'manual',
                    sourceName: provenance,
                    ...(selectedFlowId ? { flowId: selectedFlowId } : {}),
                    complete,
                    ...(!complete ? { unavailableReason: [...new Set(reasons)].join(' ') || 'The observation could not be independently reconciled to the current investment ledgers.' } : {}),
                    components,
                    totalValue: { amount: sum, currency: selectedCurrency }
                };
            });
            const current = dependencies.readSnapshots().investmentDrawdownSnapshots;
            const validated = dependencies.persistSnapshots([...current, ...created], collections);
            window.dispatchEvent(new Event('pfo:workspace-updated'));
            render();
            form.reset();
            render();
            show(message, paired
                ? 'Both immutable flow-boundary observations were saved. Completeness is independently checked again during analysis.'
                : 'Immutable daily-close observation saved. Completeness is independently checked again during analysis.');
            dependencies.notify('Investment drawdown observation saved.');
            return validated;
        } catch (cause) {
            show(error, cause instanceof Error ? cause.message : 'The drawdown observation could not be saved.');
        }
    });

    render();
    return { render, refreshFlows };
}
