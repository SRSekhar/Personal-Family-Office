const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function showMessage(element, message) {
    element.textContent = message;
    element.hidden = !message;
}

/**
 * Private-workspace UI for explicitly authoring immutable drawdown calendars.
 * Persistence and validation remain injected from the dashboard workspace boundary.
 */
export function initializeInvestmentDrawdownCalendarWorkspace(dependencies) {
    const form = document.querySelector('#investment-drawdown-calendar-form');
    if (!form) return { render() {} };

    const demoNote = document.querySelector('#investment-drawdown-calendar-demo-note');
    const error = document.querySelector('#investment-drawdown-calendar-error');
    const message = document.querySelector('#investment-drawdown-calendar-message');
    const history = document.querySelector('#investment-drawdown-calendar-history');
    const accountRow = document.querySelector('#investment-drawdown-calendar-account-row');
    const accountSelect = form.elements.accountId;
    const scopeSelect = form.elements.scope;
    const supersedesSelect = form.elements.supersedesCalendarId;
    const calendarSetInput = form.elements.calendarSetId;
    const currencySelect = form.elements.currency;
    const startInput = form.elements.startAt;
    const endInput = form.elements.endAt;
    const closesInput = form.elements.expectedDailyCloseAt;
    let calendars = [];
    let accounts = [];

    function lockCorrectionFields(locked) {
        for (const control of [calendarSetInput, scopeSelect, accountSelect, currencySelect, startInput, endInput]) {
            control.disabled = !dependencies.isPrivateWorkspace() || (locked && control !== accountSelect);
        }
        accountSelect.disabled = !dependencies.isPrivateWorkspace() || locked;
    }

    function renderAccountOptions(selected = '') {
        accountSelect.innerHTML = '<option value="">Select investment account</option>' + accounts
            .map((account) => '<option value="' + escapeHtml(account.id) + '">' + escapeHtml(account.name) + ' (' + escapeHtml(account.currency) + ')</option>')
            .join('');
        accountSelect.value = selected;
    }

    function renderCalendarHistory() {
        const supersededIds = new Set(calendars.map((item) => item.supersedesCalendarId).filter(Boolean));
        const rows = [...calendars].sort((a, b) =>
            a.recordedAt.localeCompare(b.recordedAt) || a.version - b.version);
        history.innerHTML = rows.length ? rows.map((item) => {
            const superseded = supersededIds.has(item.id);
            const scope = item.scope === 'account' ? 'Account: ' + (accounts.find((account) => account.id === item.accountId)?.name ?? item.accountId) : 'Portfolio';
            return '<tr><td>' + escapeHtml(item.calendarSetId) + '</td><td>' + item.version + '</td><td>' + escapeHtml(scope)
                + '</td><td>' + escapeHtml(item.currency) + '</td><td>' + escapeHtml(item.startAt) + ' → ' + escapeHtml(item.endAt)
                + '</td><td class="align-right">' + item.expectedDailyCloseAt.length + '</td><td>' + escapeHtml(item.recordedAt)
                + '</td><td>' + (superseded ? 'Superseded' : 'Current') + '</td></tr>';
        }).join('') : '<tr><td colspan="8">No daily-close calendars have been authored.</td></tr>';
    }

    function render() {
        const isPrivate = dependencies.isPrivateWorkspace();
        demoNote.hidden = isPrivate;
        for (const control of form.querySelectorAll('input, select, textarea, button')) control.disabled = !isPrivate;
        if (!isPrivate) {
            history.innerHTML = '<tr><td colspan="8">Switch to the local private workspace to manage calendars.</td></tr>';
            showMessage(error, '');
            return;
        }

        const selectedCurrency = currencySelect.value;
        const selectedSupersedes = supersedesSelect.value;
        const ledger = dependencies.readAccounts();
        if (!dependencies.isLedgerHealthy()) {
            showMessage(error, 'Investment accounts could not be validated. Calendar editing is paused; existing data was left untouched.');
            history.innerHTML = '<tr><td colspan="8">Calendar history is unavailable until the investment ledger is recovered.</td></tr>';
            return;
        }
        accounts = ledger.investmentAccounts;
        const stored = dependencies.readCalendars();
        if (!dependencies.isCalendarStorageHealthy()) {
            showMessage(error, 'Saved calendars could not be validated. Existing data was left untouched; restore a valid backup before editing.');
            history.innerHTML = '<tr><td colspan="8">Calendar history is unavailable until recovery.</td></tr>';
            return;
        }
        calendars = stored.investmentDrawdownCalendars;
        renderAccountOptions(accountSelect.value);
        currencySelect.innerHTML = CURRENCIES.map((currency) => '<option value="' + currency + '">' + currency + '</option>').join('');
        currencySelect.value = CURRENCIES.includes(selectedCurrency) ? selectedCurrency : 'INR';
        const supersededIds = new Set(calendars.map((item) => item.supersedesCalendarId).filter(Boolean));
        const active = calendars.filter((item) => !supersededIds.has(item.id));
        supersedesSelect.innerHTML = '<option value="">Create a new calendar</option>' + active
            .map((item) => '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.calendarSetId) + ' · v' + item.version + ' · ' + escapeHtml(item.scope) + ' · ' + escapeHtml(item.currency) + '</option>')
            .join('');
        supersedesSelect.value = active.some((item) => item.id === selectedSupersedes) ? selectedSupersedes : '';
        renderCalendarHistory();
        accountRow.hidden = scopeSelect.value !== 'account';
        lockCorrectionFields(Boolean(supersedesSelect.value));
        showMessage(error, '');
    }

    supersedesSelect.addEventListener('change', () => {
        const previous = calendars.find((item) => item.id === supersedesSelect.value);
        if (!previous) {
            lockCorrectionFields(false);
            return;
        }
        calendarSetInput.value = previous.calendarSetId;
        scopeSelect.value = previous.scope;
        renderAccountOptions(previous.accountId ?? '');
        currencySelect.value = previous.currency;
        startInput.value = previous.startAt;
        endInput.value = previous.endAt;
        closesInput.value = previous.expectedDailyCloseAt.join('\n');
        accountRow.hidden = previous.scope !== 'account';
        lockCorrectionFields(true);
    });
    scopeSelect.addEventListener('change', () => {
        accountRow.hidden = scopeSelect.value !== 'account';
    });
    accountSelect.addEventListener('change', () => {
        const account = accounts.find((item) => item.id === accountSelect.value);
        if (account && CURRENCIES.includes(account.currency)) currencySelect.value = account.currency;
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!dependencies.isPrivateWorkspace()) {
            showMessage(error, 'Switch to the local private workspace before authoring a drawdown calendar.');
            return;
        }
        try {
            const current = dependencies.readCalendars().investmentDrawdownCalendars;
            const previous = current.find((item) => item.id === supersedesSelect.value);
            const expectedDailyCloseAt = closesInput.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
            const calendar = {
                id: crypto.randomUUID(),
                calendarSetId: previous?.calendarSetId ?? calendarSetInput.value.trim(),
                version: previous ? previous.version + 1 : 1,
                scope: scopeSelect.value,
                ...(scopeSelect.value === 'account' ? { accountId: accountSelect.value } : {}),
                currency: currencySelect.value,
                startAt: startInput.value.trim(),
                endAt: endInput.value.trim(),
                recordedAt: new Date().toISOString(),
                expectedDailyCloseAt,
                ...(previous ? { supersedesCalendarId: previous.id } : {})
            };
            dependencies.persistCalendars([...current, calendar]);
            form.reset();
            render();
            showMessage(message, previous ? 'Calendar correction saved as a new immutable version.' : 'Daily-close calendar saved. No dates were generated or inferred.');
            dependencies.notify(previous ? 'Drawdown calendar correction saved.' : 'Drawdown calendar saved.');
        } catch (cause) {
            showMessage(error, cause instanceof Error ? cause.message : 'The calendar could not be saved.');
        }
    });

    render();
    return { render };
}
