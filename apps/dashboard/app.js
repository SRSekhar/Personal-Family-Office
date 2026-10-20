import { validateBackupPayload } from './backup.js';
import { recordsToCsv } from './csv-export.js';
import { parseRecordsCsv } from './csv-import.js';
import { renderFinancialReportHtml } from './financial-report.js';
import { calculateFinancialTotals } from './financial-totals.js';
import { filterFinancialRecords } from './record-filter.js';
import { sortFinancialRecords } from './record-sort.js';
import { persistJson, readJsonArray } from './storage.js';
import { GOALS_STORAGE_KEY, readSavedGoals, saveSavedGoals } from './goals-storage.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';
import { calculateFireReadiness } from './calculators-runtime/FireReadiness.js';
import { compareFireReadinessScenarios } from './calculators-runtime/FireScenarioComparison.js';
import { createFireScenarioReport, renderFireScenarioReportHtml } from './reports-runtime/FireScenarioReport.js';
import { calculateRequiredFireContribution } from './calculators-runtime/RequiredFireContribution.js';
import { calculateGoalProgress } from './calculators-runtime/GoalProgress.js';
import { initializeCashFlowTracker } from './cashflow.js';
import { initializeTaxEstimator } from './tax-estimator.js';
import { initializeLoanAmortizationCalculator } from './loan-amortization.js';
import { initializeInvestmentPerformanceCalculator } from './investment-performance.js';
import { initializeGrowthProjectionCalculator } from './growth-projection.js';
import { initializeCagrCalculator } from './cagr.js';

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
let savedGoals = [];
let goalsStorageHealthy = true;
let editingGoalId = null;
let toastTimer;
let lastFireReportScenarios = [];
let lastComparisonReportScenarios = [];

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
    let assets = 0;
    let liabilities = 0;
    const result = readJsonArray(localStorage, STORAGE_KEY, (record) => {
        if (!record || typeof record.id !== 'string' || record.id.trim() === ''
            || seenIds.has(record.id)
            || typeof record.name !== 'string' || record.name.trim() === ''
            || typeof record.category !== 'string' || record.category.trim() === ''
            || !['asset', 'liability'].includes(record.type)
            || !Number.isFinite(record.value) || record.value < 0) {
            return false;
        }
        const nextTotal = record.type === 'asset' ? assets + record.value : liabilities + record.value;
        if (!Number.isFinite(nextTotal)) return false;
        if (record.type === 'asset') assets = nextTotal;
        else liabilities = nextTotal;
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
    try {
        calculateFinancialTotals(nextRecords);
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Financial totals are outside the supported numeric range.');
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


function fireInput() {
    const form = $('#fire-planner-form');
    const n = (name) => Number(form.elements[name].value);
    return {
        currentPortfolio: n('currentPortfolio'), annualContribution: n('annualContribution'),
        yearsToRetirement: n('yearsToRetirement'), expectedAnnualReturn: n('expectedAnnualReturn') / 100,
        annualInflationRate: n('annualInflationRate') / 100,
        annualRetirementSpendingToday: n('annualRetirementSpendingToday'),
        withdrawalRate: n('withdrawalRate') / 100, contributionTiming: form.elements.contributionTiming.value
    };
}
function fireError(message = '') {
    $('#fire-validation').textContent = message;
    $('#fire-validation').hidden = !message;
}
function showFireResult(result, required = null, input = fireInput()) {
    const reportInput = { ...input, annualContribution: required === null ? input.annualContribution : required };
    lastFireReportScenarios = [{ id: 'current', name: required === null ? 'Current scenario' : 'Required contribution scenario', input: reportInput, result }];
    $('#fire-results').hidden = false;
    $('#fire-status').textContent = result.isOnTrack ? 'On track under assumptions' : 'Shortfall under assumptions';
    $('#fire-status').className = 'fire-status ' + (result.isOnTrack ? 'on-track' : 'shortfall');
    $('#fire-projected-portfolio').textContent = money(result.projectedPortfolioAtRetirement);
    $('#fire-target-corpus').textContent = money(result.targetCorpusAtRetirement);
    $('#fire-projected-spending').textContent = money(result.projectedAnnualRetirementSpending);
    $('#fire-gap').textContent = (result.surplusOrShortfall < 0 ? '−' : '+') + money(Math.abs(result.surplusOrShortfall));
    const out = $('#fire-required-result');
    out.hidden = required === null;
    out.textContent = required === null ? '' : 'Required constant annual contribution: ' + money(required) + '. Mathematical scenario only; not a recommendation.';
}
function calculateFire(solve = false) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        fireError('Use the loopback-only dashboard before entering retirement assumptions.');
        return;
    }
    if (solve && !$('#fire-planner-form').reportValidity()) {
        fireError();
        $('#fire-results').hidden = true;
        $('#fire-required-result').hidden = true;
        lastFireReportScenarios = [];
        return;
    }
    fireError();
    try {
        const input = fireInput();
        if (solve) {
            const result = calculateRequiredFireContribution({
                currentPortfolio: input.currentPortfolio, yearsToRetirement: input.yearsToRetirement,
                expectedAnnualReturn: input.expectedAnnualReturn, annualInflationRate: input.annualInflationRate,
                annualRetirementSpendingToday: input.annualRetirementSpendingToday,
                withdrawalRate: input.withdrawalRate, contributionTiming: input.contributionTiming
            });
            showFireResult(result.readiness, result.requiredAnnualContribution, input);
        } else showFireResult(calculateFireReadiness(input), null, input);
    } catch (error) {
        $('#fire-results').hidden = true;
        lastFireReportScenarios = [];
        fireError(error instanceof Error ? error.message : 'Check all assumptions and try again.');
    }
}


function downloadFireReport(scenarios, filename) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!scenarios.length) {
        showToast('Calculate a scenario before downloading its report.');
        return;
    }
    try {
        const report = createFireScenarioReport({
            currency: CURRENCY,
            generatedAt: new Date(),
            scenarios: scenarios.map(({ id, name, input, result }) => ({
                id, name, assumptions: { ...input, contributionTiming: input.contributionTiming ?? 'end' }, result
            }))
        });
        const blob = new Blob([renderFireScenarioReportHtml(report)], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Downloaded an offline HTML report. Keep the file private; it contains your assumptions.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create the offline FIRE report.');
    }
}
function readCompareScenarios() {
    const base = fireInput();
    return ['a', 'b', 'c'].map((key) => {
        const read = (suffix) => $(`#fire-compare-${key}-${suffix}`);
        const name = read('name').value.trim();
        if (!name) throw new RangeError('Each scenario needs a name.');
        for (const field of ['contribution', 'return', 'inflation', 'withdrawal']) {
            if (read(field).value.trim() === '') throw new RangeError(`Enter a value for scenario ${name}: ${field}.`);
        }
        return { id: key, name, input: {
            ...base,
            annualContribution: Number(read('contribution').value),
            expectedAnnualReturn: Number(read('return').value) / 100,
            annualInflationRate: Number(read('inflation').value) / 100,
            withdrawalRate: Number(read('withdrawal').value) / 100,
            contributionTiming: read('timing').value
        }};
    });
}
function setCompareValidation(message = '') {
    $('#fire-compare-validation').textContent = message;
    $('#fire-compare-validation').hidden = message === '';
}
function compareFireScenarios() {
    if (!$('#fire-planner-form').reportValidity()) return;
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        setCompareValidation('Use the loopback-only dashboard before entering retirement assumptions.');
        return;
    }
    setCompareValidation();
    try {
        const results = compareFireReadinessScenarios(readCompareScenarios());
        lastComparisonReportScenarios = results;
        const body = $('#fire-compare-body'); body.replaceChildren();
        for (const scenario of results) {
            const row = document.createElement('tr');
            const assumptions = document.createElement('td');
            const name = document.createElement('strong'); name.textContent = scenario.name;
            const detail = document.createElement('p'); detail.className = 'fire-scenario-assumptions';
            detail.textContent = `Portfolio ${money(scenario.input.currentPortfolio)} · ${scenario.input.yearsToRetirement} years · Spending today ${money(scenario.input.annualRetirementSpendingToday)} / year · Contribution ${money(scenario.input.annualContribution)} / year · Return ${number(scenario.input.expectedAnnualReturn * 100)}% · Inflation ${number(scenario.input.annualInflationRate * 100)}% · Withdrawal ${number(scenario.input.withdrawalRate * 100)}% · Contributions at ${scenario.input.contributionTiming === 'beginning' ? 'year start' : 'year end'}`;
            assumptions.append(name, detail);
            const portfolio = document.createElement('td'); portfolio.textContent = money(scenario.result.projectedPortfolioAtRetirement);
            const target = document.createElement('td'); target.textContent = money(scenario.result.targetCorpusAtRetirement);
            const gap = document.createElement('td'); gap.textContent = `${scenario.result.surplusOrShortfall < 0 ? '−' : '+'}${money(Math.abs(scenario.result.surplusOrShortfall))}`;
            const status = document.createElement('td'); status.textContent = scenario.result.isOnTrack ? 'On track under assumptions' : 'Shortfall under assumptions';
            status.className = scenario.result.isOnTrack ? 'fire-status on-track' : 'fire-status shortfall';
            row.append(assumptions, portfolio, target, gap, status); body.append(row);
        }
        $('#fire-compare-results').hidden = false;
    } catch (error) {
        $('#fire-compare-results').hidden = true;
        lastComparisonReportScenarios = [];
        setCompareValidation(error instanceof Error ? error.message : 'Check all scenario assumptions and try again.');
    }
}
function copyFireAssumptionsToScenarios() {
    if (!$('#fire-planner-form').reportValidity()) return;
    const base = fireInput();
    for (const key of ['a', 'b', 'c']) {
        $(`#fire-compare-${key}-contribution`).value = String(base.annualContribution);
        $(`#fire-compare-${key}-return`).value = String(base.expectedAnnualReturn * 100);
        $(`#fire-compare-${key}-inflation`).value = String(base.annualInflationRate * 100);
        $(`#fire-compare-${key}-withdrawal`).value = String(base.withdrawalRate * 100);
        $(`#fire-compare-${key}-timing`).value = base.contributionTiming;
    }
    setCompareValidation(); $('#fire-compare-results').hidden = true; lastComparisonReportScenarios = [];
}
function resetFire() {
    const form = $('#fire-planner-form');
    const defaults = {currentPortfolio:0,annualContribution:0,yearsToRetirement:10,expectedAnnualReturn:7,annualInflationRate:3,annualRetirementSpendingToday:0,withdrawalRate:4,contributionTiming:'end'};
    for (const [name,value] of Object.entries(defaults)) form.elements[name].value = String(value);
    fireError(); $('#fire-results').hidden = true; $('#fire-required-result').hidden = true; $('#fire-compare-results').hidden = true; setCompareValidation(); lastFireReportScenarios = []; lastComparisonReportScenarios = [];
    for (const key of ['a', 'b', 'c']) {
        $(`#fire-compare-${key}-name`).value = `Scenario ${key.toUpperCase()}`;
        for (const field of ['contribution', 'return', 'inflation', 'withdrawal']) $(`#fire-compare-${key}-${field}`).value = '';
        $(`#fire-compare-${key}-timing`).value = 'end';
    }
}
function goalFormInput() {
    const form = $('#goal-tracker-form');
    const name = form.elements.goalName.value.trim();
    if (!name) throw new RangeError('Enter a name for this goal.');
    const input = {
        targetAmount: Number(form.elements.targetAmount.value),
        currentAmount: Number(form.elements.currentAmount.value),
        targetDate: form.elements.targetDate.value
    };
    const result = calculateGoalProgress(input);
    return { name, ...input, result };
}

function calculateGoal(event) {
    event?.preventDefault();
    $('#goal-validation').hidden = true;
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#goal-validation').textContent = 'Use the loopback-only dashboard before entering personal financial goals.';
        $('#goal-validation').hidden = false;
        return;
    }
    try {
        const goal = goalFormInput();
        $('#goal-results-heading').textContent = goal.name;
        $('#goal-status').textContent = goal.result.isComplete ? 'Goal reached' : goal.result.isOverdue ? 'Past target date' : 'In progress';
        $('#goal-status').className = 'fire-status ' + (goal.result.isComplete ? 'on-track' : goal.result.isOverdue ? 'shortfall' : 'on-track');
        $('#goal-progress-percent').textContent = number(goal.result.progressPercent) + '%';
        $('#goal-progress-detail').textContent = money(goal.result.currentAmount) + ' accumulated';
        $('#goal-progress-bar').value = Math.min(100, goal.result.progressPercent);
        $('#goal-progress-bar').setAttribute('aria-valuetext', number(goal.result.progressPercent) + ' percent of target');
        $('#goal-target-result').textContent = money(goal.result.targetAmount);
        $('#goal-remaining-result').textContent = money(goal.result.amountRemaining);
        $('#goal-date-result').textContent = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(goal.targetDate + 'T00:00:00Z'));
        $('#goal-time-result').textContent = goal.result.isComplete ? 'Target reached' : goal.result.daysRemaining < 0 ? Math.abs(goal.result.daysRemaining) + ' days overdue' : goal.result.daysRemaining + ' days remaining';
        $('#goal-monthly-pace-result').textContent = goal.result.isComplete
            ? 'Goal reached'
            : goal.result.monthlyContributionNeeded === null
                ? (goal.result.daysRemaining < 0 ? 'Target date passed' : 'Target date is today')
                : money(goal.result.monthlyContributionNeeded) + ' per month';
        $('#goal-results').hidden = false;
    } catch (error) {
        $('#goal-results').hidden = true;
        $('#goal-validation').textContent = error instanceof Error ? error.message : 'Check the goal details and try again.';
        $('#goal-validation').hidden = false;
    }
}

function showGoalMessage(message = '') {
    $('#saved-goals-message').textContent = message;
    $('#saved-goals-message').hidden = message === '';
}

function persistGoals(nextGoals) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname) || workspace !== 'private') {
        showGoalMessage('Saved goals can only be managed in the loopback-only private workspace.');
        return false;
    }
    if (!privateStorageHealthy || !goalsStorageHealthy) {
        showGoalMessage('Goal changes are paused because saved workspace data could not be read safely. Existing data was left untouched.');
        return false;
    }
    if (!saveSavedGoals(localStorage, nextGoals)) {
        showGoalMessage('Could not save goals in this browser. Check storage availability; your previous saved goals are unchanged.');
        return false;
    }
    savedGoals = nextGoals;
    renderSavedGoals();
    showGoalMessage();
    return true;
}

function saveGoal() {
    showGoalMessage();
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showGoalMessage('Use the loopback-only dashboard before saving personal financial goals.');
        return;
    }
    if (workspace !== 'private') {
        showGoalMessage('Switch to your private workspace before saving goals.');
        return;
    }
    if (!$('#goal-tracker-form').reportValidity()) return;
    try {
        const input = goalFormInput();
        const now = new Date().toISOString();
        const existing = editingGoalId ? savedGoals.find((goal) => goal.id === editingGoalId) : null;
        const goal = {
            id: existing?.id ?? crypto.randomUUID(),
            name: input.name,
            targetAmount: input.targetAmount,
            currentAmount: input.currentAmount,
            targetDate: input.targetDate,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
        };
        const nextGoals = existing
            ? savedGoals.map((item) => item.id === existing.id ? goal : item)
            : [...savedGoals, goal];
        if (persistGoals(nextGoals)) {
            showToast(existing ? 'Saved goal updated.' : 'Goal saved in this browser.');
            resetGoal();
        }
    } catch (error) {
        showGoalMessage(error instanceof Error ? error.message : 'Check the goal details and try again.');
    }
}

function editSavedGoal(id) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname) || workspace !== 'private') {
        showGoalMessage('Switch to your local private workspace to edit saved goals.');
        return;
    }
    const goal = savedGoals.find((item) => item.id === id);
    if (!goal) return;
    editingGoalId = goal.id;
    const form = $('#goal-tracker-form');
    form.elements.goalName.value = goal.name;
    form.elements.targetAmount.value = String(goal.targetAmount);
    form.elements.currentAmount.value = String(goal.currentAmount);
    form.elements.targetDate.value = goal.targetDate;
    $('#goal-save-button').textContent = 'Update saved goal';
    $('#goal-cancel-edit-button').hidden = false;
    $('#goal-validation').hidden = true;
    $('#goal-results').hidden = true;
    $('#goal-tracker-heading').scrollIntoView({ behavior: 'auto', block: 'start' });
    form.elements.goalName.focus();
}

function deleteSavedGoal(id) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname) || workspace !== 'private') {
        showGoalMessage('Switch to your local private workspace to delete saved goals.');
        return;
    }
    const goal = savedGoals.find((item) => item.id === id);
    if (!goal || !window.confirm('Delete saved goal "' + goal.name + '"? This cannot be undone.')) return;
    if (persistGoals(savedGoals.filter((item) => item.id !== id))) {
        if (editingGoalId === id) resetGoal();
        showToast('Saved goal deleted.');
    }
}

function renderSavedGoals() {
    const container = $('#saved-goals-list');
    $('#saved-goals-count').textContent = savedGoals.length + (savedGoals.length === 1 ? ' goal' : ' goals');
    $('#saved-goals-empty').hidden = savedGoals.length !== 0;
    container.replaceChildren();
    const formatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });
    for (const goal of savedGoals) {
        let result;
        try {
            result = calculateGoalProgress({ targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, targetDate: goal.targetDate });
        } catch {
            showGoalMessage('One or more saved goals are invalid. Existing saved data was left untouched.');
            continue;
        }
        const card = document.createElement('article');
        card.className = 'saved-goal-card';
        const statusText = result.isComplete ? 'Goal reached' : result.isOverdue ? 'Past target date' : 'In progress';
        const statusClass = result.isComplete ? 'complete' : result.isOverdue ? 'overdue' : 'progress';
        const monthlyPace = result.isComplete
            ? 'Goal reached; no additional monthly saving needed.'
            : result.monthlyContributionNeeded === null
                ? (result.isOverdue ? 'Target date passed; shortfall remains.' : 'Target date is today; shortfall remains.')
                : 'Approx. ' + money(result.monthlyContributionNeeded) + ' per month needed (no returns assumed).';
        card.innerHTML = `<div class="saved-goal-heading"><div><h4>${escapeHtml(goal.name)}</h4><p class="saved-goal-meta">Target ${escapeHtml(money(goal.targetAmount))} · Due ${escapeHtml(formatter.format(new Date(goal.targetDate + 'T00:00:00Z')))}</p></div><span class="saved-goal-status ${statusClass}">${statusText}</span></div><div class="saved-goal-progress"><span>${escapeHtml(money(goal.currentAmount))} saved</span><strong>${escapeHtml(number(result.progressPercent))}%</strong></div><progress max="100" value="${Math.min(100, result.progressPercent)}" aria-label="${escapeHtml(goal.name)} progress">${Math.min(100, result.progressPercent)}%</progress><p class="saved-goal-meta">${result.isComplete ? 'Target reached' : result.isOverdue ? Math.abs(result.daysRemaining) + ' days overdue · ' + escapeHtml(money(result.amountRemaining)) + ' remaining' : result.daysRemaining + ' days remaining · ' + escapeHtml(money(result.amountRemaining)) + ' remaining'}</p><p class="saved-goal-meta">${escapeHtml(monthlyPace)}</p><div class="saved-goal-actions"><button class="button button-secondary" type="button" data-goal-edit="${escapeHtml(goal.id)}">Edit / update progress</button><button class="button button-secondary" type="button" data-goal-delete="${escapeHtml(goal.id)}">Delete goal</button></div>`;
        container.append(card);
    }
    const canManage = workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname) && privateStorageHealthy && goalsStorageHealthy;
    container.querySelectorAll('[data-goal-edit], [data-goal-delete]').forEach((button) => { button.disabled = !canManage; });
}

function loadSavedGoals() {
    if (workspace !== 'private' || !isPrivateWorkspaceAllowed(window.location.hostname)) {
        savedGoals = [];
        goalsStorageHealthy = true;
        renderSavedGoals();
        return;
    }
    const result = readSavedGoals(localStorage);
    goalsStorageHealthy = result.ok;
    savedGoals = result.records;
    renderSavedGoals();
    if (!result.ok) showToast('Saved goals could not be safely read. They have been left untouched and goal edits are paused.');
}

function resetGoal() {
    const form = $('#goal-tracker-form');
    form.reset();
    form.elements.goalName.value = 'My financial goal';
    form.elements.targetAmount.value = '1000000';
    form.elements.currentAmount.value = '0';
    form.elements.targetDate.value = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    editingGoalId = null;
    $('#goal-save-button').textContent = 'Save goal';
    $('#goal-cancel-edit-button').hidden = true;
    $('#goal-validation').hidden = true;
    $('#goal-results').hidden = true;
}

function showHostedPrivacyWarning() {
    const isHosted = !isPrivateWorkspaceAllowed(window.location.hostname);
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
    loadSavedGoals();
    $('#workspace-label').textContent = workspace === 'demo' ? 'SAMPLE WORKSPACE' : 'PRIVATE WORKSPACE';
    $('#sample-notice').hidden = workspace !== 'demo';
    $('#switch-private-button').textContent = isPrivateWorkspaceAllowed(window.location.hostname) ? 'Use my data →' : 'Use locally →';
    render();
}

function totals() {
    return calculateFinancialTotals(records);
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
    const query = $('#record-search').value;
    const typeFilter = $('#records-type-filter').value;
    const categoryFilter = $('#records-category-filter');
    const selectedCategory = categoryFilter.value;
    const categories = [...new Set(records.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'en'));
    categoryFilter.innerHTML = `<option value="all">All categories</option>${categories.map((category) =>
        `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
    categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : 'all';
    const filtered = sortFinancialRecords(
        filterFinancialRecords(records, query, typeFilter, categoryFilter.value),
        $('#records-sort-order').value
    );
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
    $('#no-matching-records').hidden = records.length === 0 || filtered.length !== 0;
    $('.table-wrap').hidden = records.length === 0 || filtered.length === 0;
    const hasFilter = query.trim() !== '' || typeFilter !== 'all' || categoryFilter.value !== 'all';
    const hasActiveViewOptions = hasFilter || $('#records-sort-order').value !== 'default';
    const matchingTotals = calculateFinancialTotals(filtered);
    $('#filtered-record-totals').hidden = !hasFilter;
    $('#filtered-record-totals').textContent = hasFilter
        ? `Matching totals — Assets: ${money(matchingTotals.assets)} · Liabilities: ${money(matchingTotals.liabilities)} · Net worth: ${money(matchingTotals.netWorth)}`
        : '';
    $('#records-summary').textContent = hasFilter
        ? `Showing ${visible.length} of ${filtered.length} matching records`
        : `Showing ${visible.length} of ${records.length} records`;
    $('#reset-record-view-button').hidden = !hasActiveViewOptions;
    $('#export-view-csv-button').hidden = !hasActiveViewOptions;
    $('#view-all-button').hidden = filtered.length <= 5;
    $('#view-all-button').textContent = $('#view-all-button').dataset.all === 'true' ? 'Show less' : 'View all';
}

function updateCategoryOptions(selectedCategory) {
    const type = $('#record-type').value;
    const standardCategories = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
    const categories = selectedCategory && !standardCategories.includes(selectedCategory)
        ? [...standardCategories, selectedCategory]
        : standardCategories;
    $('#record-category').innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    if (categories.includes(selectedCategory)) $('#record-category').value = selectedCategory;
}

function openRecordDialog(type = 'asset', record = null) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
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
    const isPrivateExport = workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname);
    if (isPrivateExport && (!privateStorageHealthy || !goalsStorageHealthy)) {
        showToast('Export is paused because saved records or goals could not be read safely. Existing storage remains untouched; import a valid backup to recover.');
        return;
    }
    const payload = {
        schemaVersion: isPrivateExport ? 2 : 1,
        currency: CURRENCY,
        exportedAt: new Date().toISOString(),
        records
    };
    if (isPrivateExport) payload.goals = savedGoals;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pfo-os-financial-records.json';
    document.body.append(link);
    link.click();
    link.remove();
    // Keep the object URL alive briefly so the browser can begin consuming the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Workspace exported to this device.');
}

function importCsvData(file) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            const parsedRecords = parseRecordsCsv(String(reader.result), CURRENCY)
                .map((item) => ({ id: crypto.randomUUID(), ...item }));
            if (workspace === 'demo') switchWorkspace('private');
            const needsConfirmation = records.length > 0 || !privateStorageHealthy;
            const replacementConfirmed = !needsConfirmation || window.confirm(
                'Importing this CSV will replace all financial records in your private workspace. Saved goals are preserved. Continue?'
            );
            if (!replacementConfirmed) {
                showToast('CSV import cancelled. Your existing records and goals were not changed.');
                return;
            }
            if (savePrivateRecords(parsedRecords, true)) {
                records = parsedRecords;
                render();
                showToast(`Imported ${records.length} financial records from CSV. Saved goals were preserved.`);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not import this CSV.');
        } finally {
            $('#import-csv-file').value = '';
        }
    });
    reader.addEventListener('error', () => {
        showToast('Could not read the selected CSV file.');
        $('#import-csv-file').value = '';
    });
    reader.readAsText(file);
}

function exportFinancialReport() {
    if (workspace === 'private' && (!isPrivateWorkspaceAllowed(window.location.hostname) || !privateStorageHealthy)) {
        showToast('Financial report export is unavailable until the local private workspace can be read safely.');
        return;
    }
    try {
        const html = renderFinancialReportHtml({ records, currency: CURRENCY, generatedAt: new Date() });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-financial-summary.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Downloaded a self-contained financial summary. Keep the file private; it may contain sensitive information.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create the financial summary report.');
    }
}

function exportCsv() {
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Export is paused because saved data could not be read. Existing storage remains untouched; import a valid backup to recover.');
        return;
    }
    let csv;
    try {
        csv = recordsToCsv(records, CURRENCY);
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create CSV export.');
        return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pfo-os-financial-records.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('CSV exported to this device.');
}

function exportViewCsv() {
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Export is paused because saved data could not be read. Existing storage remains untouched; import a valid backup to recover.');
        return;
    }
    let csv;
    try {
        const filteredRecords = sortFinancialRecords(
            filterFinancialRecords(
                records,
                $('#record-search').value,
                $('#records-type-filter').value,
                $('#records-category-filter').value
            ),
            $('#records-sort-order').value
        );
        csv = recordsToCsv(filteredRecords, CURRENCY);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-financial-records-view.csv';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Exported ${filteredRecords.length} matching records to CSV.`);
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create CSV export.');
    }
}

function restoreStorageValue(key, serializedValue) {
    try {
        if (serializedValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, serializedValue);
        return true;
    } catch {
        return false;
    }
}

function importData(file) {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            const parsed = JSON.parse(String(reader.result));
            const backup = validateBackupPayload(parsed, CURRENCY);
            const validatedRecords = backup.records.map((item) => ({ id: crypto.randomUUID(), ...item }));
            if (workspace === 'demo') switchWorkspace('private');
            const needsConfirmation = records.length > 0 || (backup.includesGoals && savedGoals.length > 0);
            const replacementConfirmed = !needsConfirmation || window.confirm(
                backup.includesGoals
                    ? 'Importing this backup will replace all records and saved goals in your private workspace. Export a backup first if you want to keep them. Continue?'
                    : 'Importing this legacy backup will replace all financial records. Saved goals are not included and will be preserved. Continue?'
            );
            if (!replacementConfirmed) {
                showToast('Import cancelled. Your existing records and goals were not changed.');
                return;
            }

            let previousGoalsRaw = null;
            if (backup.includesGoals) {
                try {
                    previousGoalsRaw = localStorage.getItem(GOALS_STORAGE_KEY);
                } catch {
                    showToast('Could not safely inspect saved goals. Nothing was imported.');
                    return;
                }
                if (!saveSavedGoals(localStorage, backup.goals)) {
                    showToast('Could not restore saved goals. Existing records and goals were left unchanged.');
                    return;
                }
            }

            if (!savePrivateRecords(validatedRecords, true)) {
                if (backup.includesGoals && !restoreStorageValue(GOALS_STORAGE_KEY, previousGoalsRaw)) {
                    goalsStorageHealthy = false;
                    showGoalMessage('Restore could not complete and the previous goal storage could not be recovered. Stop editing goals and preserve this browser profile for recovery.');
                }
                return;
            }

            records = validatedRecords;
            if (backup.includesGoals) {
                savedGoals = backup.goals;
                goalsStorageHealthy = true;
                renderSavedGoals();
                showGoalMessage();
            }
            render();
            showToast(backup.includesGoals
                ? `Imported ${records.length} records and ${savedGoals.length} saved goals into your private workspace.`
                : `Imported ${records.length} records. This legacy backup did not contain goals; saved goals were preserved.`);
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not import this backup.');
        } finally {
            $('#import-file').value = '';
        }
    });
    reader.addEventListener('error', () => {
        showToast('Could not read the selected file.');
        $('#import-file').value = '';
    });
    reader.readAsText(file);
}


$('#fire-planner-form').addEventListener('submit', (event) => { event.preventDefault(); calculateFire(); });
$('#fire-required-button').addEventListener('click', () => calculateFire(true));
$('#fire-download-report').addEventListener('click', () => downloadFireReport(lastFireReportScenarios, 'pfo-fire-scenario-report.html'));
$('#fire-download-comparison-report').addEventListener('click', () => downloadFireReport(lastComparisonReportScenarios, 'pfo-fire-comparison-report.html'));
$('#fire-reset-button').addEventListener('click', resetFire);
$('#fire-compare-toggle').addEventListener('click', () => {
    const panel = $('#fire-comparison');
    panel.hidden = !panel.hidden;
    $('#fire-compare-toggle').setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        panel.scrollIntoView({ behavior, block: 'start' });
    }
});
$('#fire-copy-assumptions').addEventListener('click', copyFireAssumptionsToScenarios);
$('#fire-compare-run').addEventListener('click', compareFireScenarios);
$('#fire-comparison').addEventListener('input', () => { setCompareValidation(); $('#fire-compare-results').hidden = true; lastComparisonReportScenarios = []; });
$('#fire-planner-form').addEventListener('input', () => { fireError(); $('#fire-results').hidden = true; $('#fire-required-result').hidden = true; $('#fire-compare-results').hidden = true; lastFireReportScenarios = []; lastComparisonReportScenarios = []; });
$('#goal-tracker-form').addEventListener('submit', calculateGoal);
$('#goal-save-button').addEventListener('click', saveGoal);
$('#goal-cancel-edit-button').addEventListener('click', resetGoal);
$('#saved-goals-list').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.goalEdit) editSavedGoal(button.dataset.goalEdit);
    if (button.dataset.goalDelete) deleteSavedGoal(button.dataset.goalDelete);
});
$('#goal-reset-button').addEventListener('click', resetGoal);
$('#goal-tracker-form').addEventListener('input', () => { $('#goal-results').hidden = true; $('#goal-validation').hidden = true; });
$('#add-record-button').addEventListener('click', () => openRecordDialog());
$('#quick-add-asset').addEventListener('click', () => openRecordDialog('asset'));
$('#quick-add-liability').addEventListener('click', () => openRecordDialog('liability'));
$('#empty-add-button').addEventListener('click', () => openRecordDialog());
$('#switch-private-button').addEventListener('click', () => {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
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
$('#records-type-filter').addEventListener('change', renderRecords);
$('#records-category-filter').addEventListener('change', renderRecords);
$('#records-sort-order').addEventListener('change', renderRecords);
$('#reset-record-view-button').addEventListener('click', () => {
    $('#record-search').value = '';
    $('#records-type-filter').value = 'all';
    $('#records-category-filter').value = 'all';
    $('#records-sort-order').value = 'default';
    $('#view-all-button').dataset.all = 'false';
    renderRecords();
    $('#record-search').focus();
});
$('#view-all-button').addEventListener('click', () => {
    $('#view-all-button').dataset.all = $('#view-all-button').dataset.all !== 'true' ? 'true' : 'false';
    renderRecords();
});
$('#export-button').addEventListener('click', exportData);
$('#export-report-button').addEventListener('click', exportFinancialReport);
$('#export-csv-button').addEventListener('click', exportCsv);
$('#export-view-csv-button').addEventListener('click', exportViewCsv);
$('#import-button').addEventListener('click', () => {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'demo') {
        if (!window.confirm('Importing replaces the sample view with your private workspace. Continue?')) return;
    } else if (!privateStorageHealthy) {
        if (!window.confirm('Saved data could not be read. Importing a valid backup will replace the unreadable saved data. Continue?')) return;
    } else if (records.length > 0) {
        if (!window.confirm('Importing replaces all records in your private workspace. Export a backup first if you want to keep them. Continue?')) return;
    }
    $('#import-file').click();
});
$('#import-file').addEventListener('change', (event) => importData(event.target.files?.[0]));
$('#import-csv-button').addEventListener('click', () => {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'demo' && !window.confirm('Importing a CSV replaces the sample view with your private workspace. Continue?')) return;
    if (workspace === 'private' && !privateStorageHealthy
        && !window.confirm('Saved data could not be read. Importing a CSV will replace the unreadable financial records. Continue?')) return;
    if (workspace === 'private' && privateStorageHealthy && records.length > 0
        && !window.confirm('Importing a CSV replaces all financial records in your private workspace. Saved goals are preserved. Continue?')) return;
    $('#import-csv-file').click();
});
$('#import-csv-file').addEventListener('change', (event) => importCsvData(event.target.files?.[0]));
function syncActiveNavigation() {
    const navItems = [...document.querySelectorAll('.nav-item')];
    const currentHash = window.location.hash || '#overview';
    const activeItem = navItems.find((item) => item.getAttribute('href') === currentHash)
        || navItems.find((item) => item.getAttribute('href') === '#overview');

    navItems.forEach((item) => {
        const isActive = item === activeItem;
        item.classList.toggle('active', isActive);
        if (isActive) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });

    if (activeItem) {
        $('#page-breadcrumb').textContent = activeItem.textContent.trim().replace(/^[◫▤◷◎₹%↘↗∿↻]\s*/, '');
    }
}

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', syncActiveNavigation));
window.addEventListener('hashchange', syncActiveNavigation);
syncActiveNavigation();

resetGoal();
renderSavedGoals();
showHostedPrivacyWarning();
if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
    $('#fire-planner-hosted-notice').hidden = false;
    $('#fire-planner-form').querySelectorAll('input, select, button').forEach((control) => { control.disabled = true; });
    $('#fire-comparison').querySelectorAll('input, select, button').forEach((control) => { control.disabled = true; });
    $('#fire-results').querySelectorAll('button').forEach((control) => { control.disabled = true; });
    $('#goal-tracker-form').querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
}
initializeCashFlowTracker();
initializeTaxEstimator();
initializeLoanAmortizationCalculator();
initializeInvestmentPerformanceCalculator();
initializeGrowthProjectionCalculator();
initializeCagrCalculator();
switchWorkspace('demo');
