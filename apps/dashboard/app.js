import { summarizeValidatedBackup, validateBackupPayload } from './backup.js';
import { recordsToCsv } from './csv-export.js';
import { parseRecordsCsv } from './csv-import.js';
import { renderFinancialReportHtml } from './financial-report.js';
import { calculateFinancialTotals } from './financial-totals.js';
import { captureHistoricalSnapshot, removeHistoricalSnapshot, summarizeHistoricalSnapshots, validateHistoricalSnapshots } from './historical-snapshots.js';
import { renderHistoricalSnapshotsReportHtml } from './historical-snapshots-report.js';
import { filterFinancialRecords } from './record-filter.js';
import { sortFinancialRecords } from './record-sort.js';
import { persistJson, readJsonArray } from './storage.js';
import { GOALS_STORAGE_KEY, readSavedGoals, saveSavedGoals } from './goals-storage.js';
import { goalProgressToCsv } from './goal-progress-export.js';
import { renderGoalProgressReportHtml } from './goal-progress-report.js';
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
import { initializeReturnRiskCalculator } from './return-risk.js';
import { analyzeDiversification } from './analytics-runtime/DiversificationAnalysis.js';
import { renderAssetAllocationReportHtml } from './asset-allocation-report.js';
import { calculateFinancialRatios } from './analytics-runtime/FinancialRatios.js';
import { renderFinancialRatiosReportHtml } from './financial-ratios-report.js';
import { validateCashFlowEntries, validateCashFlowBudgets } from './cashflow-ledger.js';
import { calculateFinancialHealth } from './financial-health.js';
import { renderFinancialHealthReportHtml } from './financial-health-report.js';
import { buildMonthlyFinancialReview, renderMonthlyFinancialReviewHtml } from './monthly-financial-review.js';
import { buildAnnualFinancialReview, renderAnnualFinancialReviewHtml } from './annual-financial-review.js';

const STORAGE_KEY = 'pfo-os.dashboard.private.v1';
const HISTORICAL_STORAGE_KEY = 'pfo-os.historical-snapshots.v1';
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
const demoHistoricalSnapshots = [
    { date: '2022-12-31', currency: CURRENCY, records: [
        { id: 'demo-history-cash-2022', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 240000 },
        { id: 'demo-history-investments-2022', name: 'Investment portfolio', category: 'Investments', type: 'asset', value: 780000 },
        { id: 'demo-history-home-2022', name: 'Residential property', category: 'Property', type: 'asset', value: 3500000 },
        { id: 'demo-history-loan-2022', name: 'Home loan', category: 'Home loan', type: 'liability', value: 2100000 }
    ] },
    { date: '2024-12-31', currency: CURRENCY, records: [
        { id: 'demo-history-cash-2024', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 320000 },
        { id: 'demo-history-investments-2024', name: 'Investment portfolio', category: 'Investments', type: 'asset', value: 1250000 },
        { id: 'demo-history-home-2024', name: 'Residential property', category: 'Property', type: 'asset', value: 3900000 },
        { id: 'demo-history-loan-2024', name: 'Home loan', category: 'Home loan', type: 'liability', value: 1750000 }
    ] },
    { date: '2025-12-31', currency: CURRENCY, records: [
        { id: 'demo-history-cash-2025', name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 375000 },
        { id: 'demo-history-investments-2025', name: 'Investment portfolio', category: 'Investments', type: 'asset', value: 1580000 },
        { id: 'demo-history-home-2025', name: 'Residential property', category: 'Property', type: 'asset', value: 4100000 },
        { id: 'demo-history-loan-2025', name: 'Home loan', category: 'Home loan', type: 'liability', value: 1580000 }
    ] }
];
let records = [];
let workspace = 'demo';
let privateStorageHealthy = true;
let historicalStorageHealthy = true;
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
function renderFireGapAnalysis(result, input, requiredAnnualContribution = null) {
    const body = $('#fire-gap-analysis-metrics');
    body.replaceChildren();
    const target = result.targetCorpusAtRetirement;
    const projected = result.projectedPortfolioAtRetirement;
    const coverage = target > 0 ? projected / target * 100 : null;
    let required = requiredAnnualContribution;
    let requiredError = '';
    if (required === null) {
        try {
            required = calculateRequiredFireContribution({
                currentPortfolio: input.currentPortfolio,
                yearsToRetirement: input.yearsToRetirement,
                expectedAnnualReturn: input.expectedAnnualReturn,
                annualInflationRate: input.annualInflationRate,
                annualRetirementSpendingToday: input.annualRetirementSpendingToday,
                withdrawalRate: input.withdrawalRate,
                contributionTiming: input.contributionTiming
            }).requiredAnnualContribution;
        } catch (error) {
            requiredError = error instanceof Error ? error.message : 'Required contribution is unavailable under these assumptions.';
        }
    }
    const additionalAnnual = required === null ? null : Math.max(0, required - input.annualContribution);
    const percent = (value) => Number.isFinite(value) ? number(value) + '%' : 'Unavailable';
    const cards = [
        ['Target corpus funded', coverage === null ? 'Unavailable' : percent(coverage), target === 0 ? 'Enter annual retirement spending to calculate a corpus target.' : 'Projected portfolio ÷ target corpus'],
        [result.surplusOrShortfall < 0 ? 'Corpus shortfall' : 'Corpus surplus', money(Math.abs(result.surplusOrShortfall)), result.surplusOrShortfall < 0 ? 'Additional corpus needed at retirement' : 'Projected amount above the target'],
        ['Required annual contribution', required === null ? 'Unavailable' : money(required), required === null ? requiredError : 'Constant nominal contribution under the same assumptions'],
        ['Additional contribution equivalent', additionalAnnual === null ? 'Unavailable' : money(additionalAnnual / 12) + ' / month', additionalAnnual === null ? 'Cannot solve with the current assumptions.' : additionalAnnual === 0 ? 'No additional contribution required under these assumptions.' : money(additionalAnnual) + ' / year above the entered annual plan']
    ];
    for (const [label, value, detail] of cards) {
        const card = document.createElement('article');
        card.className = 'fire-gap-card';
        const heading = document.createElement('span');
        heading.textContent = label;
        const strong = document.createElement('strong');
        strong.textContent = value;
        const small = document.createElement('small');
        small.textContent = detail;
        card.append(heading, strong, small);
        body.append(card);
    }
    $('#fire-gap-analysis-note').textContent = 'Gap analysis uses the same deterministic assumptions as the scenario above. Monthly equivalent is annual contribution divided by 12, not a monthly cash-flow simulation. Contributions remain constant in nominal terms; results are not forecasts or recommendations.';
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
    renderFireGapAnalysis(result, input, required);
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
    fireError(); $('#fire-results').hidden = true; $('#fire-required-result').hidden = true; $('#fire-compare-results').hidden = true; $('#fire-gap-analysis-metrics').replaceChildren(); setCompareValidation(); lastFireReportScenarios = []; lastComparisonReportScenarios = [];
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
    renderFinancialHealth();
    const canManage = workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname) && privateStorageHealthy && goalsStorageHealthy;
    container.querySelectorAll('[data-goal-edit], [data-goal-delete]').forEach((button) => { button.disabled = !canManage; });
    $('#saved-goals-export-csv').disabled = !(workspace === 'private'
        && isPrivateWorkspaceAllowed(window.location.hostname)
        && goalsStorageHealthy
        && savedGoals.length > 0);
    $('#saved-goals-export-html').disabled = !(workspace === 'private'
        && isPrivateWorkspaceAllowed(window.location.hostname)
        && privateStorageHealthy && goalsStorageHealthy
        && savedGoals.length > 0);
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

function exportSavedGoalsCsv() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname) || workspace !== 'private'
        || !goalsStorageHealthy || savedGoals.length === 0) {
        showGoalMessage('Export requires saved goals in the loopback-only private workspace.');
        return;
    }
    try {
        const asOfDate = new Date();
        const rows = savedGoals.map((goal) => {
            const result = calculateGoalProgress({
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                targetDate: goal.targetDate,
                asOfDate
            });
            return {
                name: goal.name,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                amountRemaining: result.amountRemaining,
                progressPercent: result.progressPercent,
                targetDate: goal.targetDate,
                daysRemaining: result.daysRemaining,
                status: result.isComplete ? 'Goal reached' : result.isOverdue ? 'Past target date' : 'In progress',
                monthlyContributionNeeded: result.monthlyContributionNeeded
            };
        });
        const blob = new Blob([goalProgressToCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-saved-goal-progress.csv';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        showToast('Saved goal progress exported to this device.');
    } catch (error) {
        showGoalMessage(error instanceof Error ? error.message : 'Could not export saved goal progress.');
    }
}

function exportSavedGoalsHtml() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname) || workspace !== 'private'
        || !privateStorageHealthy || !goalsStorageHealthy || savedGoals.length === 0) {
        showGoalMessage('HTML report export requires validated saved goals in the loopback-only private workspace.');
        return;
    }
    try {
        const asOfDate = new Date();
        const asOfDateString = [asOfDate.getFullYear(), String(asOfDate.getMonth() + 1).padStart(2, '0'),
            String(asOfDate.getDate()).padStart(2, '0')].join('-');
        const rows = savedGoals.map((goal) => {
            const result = calculateGoalProgress({
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                targetDate: goal.targetDate,
                asOfDate
            });
            return {
                name: goal.name,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                amountRemaining: result.amountRemaining,
                progressPercent: result.progressPercent,
                targetDate: goal.targetDate,
                daysRemaining: result.daysRemaining,
                status: result.isComplete ? 'Goal reached' : result.isOverdue ? 'Past target date' : 'In progress',
                monthlyContributionNeeded: result.monthlyContributionNeeded
            };
        });
        const report = renderGoalProgressReportHtml({
            asOfDate: asOfDateString,
            generatedAt: asOfDate.toISOString(),
            goals: rows
        });
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-saved-goal-progress.html';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        showToast('Saved goal progress HTML report exported to this device.');
    } catch (error) {
        showGoalMessage(error instanceof Error ? error.message : 'Could not export saved goal progress report.');
    }
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
    $('#switch-demo-button').hidden = workspace !== 'private' || !isPrivateWorkspaceAllowed(window.location.hostname);
    $('#switch-private-button').textContent = isPrivateWorkspaceAllowed(window.location.hostname) ? 'Use my data →' : 'Use locally →';
    render();
}


function readHistoricalSnapshots() {
    try {
        const serialized = localStorage.getItem(HISTORICAL_STORAGE_KEY);
        const parsed = serialized === null ? [] : JSON.parse(serialized);
        historicalStorageHealthy = true;
        return validateHistoricalSnapshots(parsed, CURRENCY);
    } catch {
        historicalStorageHealthy = false;
        return null;
    }
}

function renderHistoricalSnapshots() {
    const body = $('#historical-snapshot-rows');
    const empty = $('#historical-snapshots-empty');
    const error = $('#historical-snapshots-error');
    const captureForm = $('#historical-snapshot-form');
    const canCapture = workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname)
        && privateStorageHealthy && historicalStorageHealthy;
    $('#historical-snapshot-date').disabled = !canCapture;
    $('#capture-historical-snapshot-button').disabled = !canCapture;
    const showDevelopmentFixture = workspace === 'demo' && isPrivateWorkspaceAllowed(window.location.hostname);
    $('#historical-demo-note').hidden = !showDevelopmentFixture;
    $('#historical-snapshots-source').textContent = showDevelopmentFixture
        ? 'Fictional development fixture · not saved'
        : workspace === 'demo' ? 'Sample history disabled outside local development' : 'Saved locally in this browser';
    body.replaceChildren();
    error.hidden = true;
    let snapshots = [];
    if (showDevelopmentFixture) {
        snapshots = validateHistoricalSnapshots(demoHistoricalSnapshots, CURRENCY);
    } else if (workspace === 'demo') {
        snapshots = [];
    } else if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        error.textContent = 'Private history is disabled outside the loopback-only dashboard.';
        error.hidden = false;
    } else {
        snapshots = readHistoricalSnapshots() ?? [];
        if (!historicalStorageHealthy) {
            error.textContent = 'Saved history could not be validated. Existing data was left untouched; capture is paused until valid history is restored.';
            error.hidden = false;
        }
    }
    const summary = summarizeHistoricalSnapshots(snapshots, CURRENCY);
    const trend = $('#historical-net-worth-chart');
    const trendEmpty = $('#historical-trend-empty');
    trend.replaceChildren();
    trendEmpty.hidden = summary.length > 0;
    const maxAbsoluteNetWorth = Math.max(1, ...summary.map((point) => Math.abs(point.netWorth)));
    const trendDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })
        .format(new Date(value + 'T00:00:00Z'));
    for (const point of summary) {
        const item = document.createElement('li');
        item.className = 'historical-trend-point';
        const heading = document.createElement('div');
        heading.className = 'historical-trend-point-heading';
        const date = document.createElement('span');
        date.textContent = trendDate(point.date);
        const value = document.createElement('strong');
        value.textContent = money(point.netWorth);
        heading.append(date, value);
        const track = document.createElement('div');
        track.className = 'historical-trend-track';
        track.setAttribute('aria-hidden', 'true');
        const bar = document.createElement('span');
        bar.className = point.netWorth < 0 ? 'historical-trend-bar negative' : 'historical-trend-bar';
        bar.style.width = Math.max(2, Math.abs(point.netWorth) / maxAbsoluteNetWorth * 100) + '%';
        track.append(bar);
        item.append(heading, track);
        trend.append(item);
    }
    empty.hidden = summary.length > 0;
    empty.textContent = workspace === 'demo'
        ? (showDevelopmentFixture ? 'The development fixture has no dated snapshots.' : 'Historical development fixtures are available only in the local development workspace.')
        : 'No historical snapshots yet. Choose a valuation date and capture your current balance sheet.';
    const fmtDate = (value) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })
        .format(new Date(value + 'T00:00:00Z'));
    for (const point of [...summary].reverse()) {
        const row = document.createElement('tr');
        const values = [fmtDate(point.date), String(point.recordCount), money(point.assets), money(point.liabilities),
            money(point.netWorth), point.netWorthChange === null ? '—' : (point.netWorthChange >= 0 ? '+' : '−') + money(Math.abs(point.netWorthChange)),
            point.netWorthChangePercent === null ? '—' : number(point.netWorthChangePercent) + '%'];
        values.forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            if (index > 0) cell.className = 'align-right';
            row.append(cell);
        });
        const detailsCell = document.createElement('td');
        const detailsButton = document.createElement('button');
        detailsButton.className = 'button button-secondary button-small';
        detailsButton.type = 'button';
        detailsButton.textContent = 'View details';
        detailsButton.setAttribute('aria-label', 'View details for ' + fmtDate(point.date));
        detailsButton.dataset.historyDetails = point.date;
        detailsButton.addEventListener('click', () => renderHistoricalSnapshotDetails(
            snapshots.find((snapshot) => snapshot.date === point.date), detailsButton
        ));
        detailsCell.append(detailsButton);
        if (workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname)) {
            const removeButton = document.createElement('button');
            removeButton.className = 'button button-secondary button-small historical-snapshot-remove';
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.setAttribute('aria-label', 'Remove snapshot for ' + fmtDate(point.date));
            removeButton.dataset.historyRemove = point.date;
            removeButton.addEventListener('click', () => removeHistoricalSnapshotFromHistory(point.date));
            detailsCell.append(removeButton);
        }
        row.append(detailsCell);
        body.append(row);
    }
    const captureAllowedAfterValidation = workspace === 'private' && isPrivateWorkspaceAllowed(window.location.hostname)
        && privateStorageHealthy && historicalStorageHealthy;
    $('#historical-snapshot-date').disabled = !captureAllowedAfterValidation;
    $('#capture-historical-snapshot-button').disabled = !captureAllowedAfterValidation;
    captureForm.hidden = workspace !== 'private' || !isPrivateWorkspaceAllowed(window.location.hostname);
}

let lastHistoricalDetailsTrigger = null;

function renderHistoricalSnapshotDetails(snapshot, trigger) {
    if (!snapshot) return;
    lastHistoricalDetailsTrigger = trigger;
    const panel = $('#historical-snapshot-detail');
    const heading = $('#historical-snapshot-detail-heading');
    const totals = $('#historical-snapshot-detail-totals');
    const categoryRows = $('#historical-snapshot-category-rows');
    const recordRows = $('#historical-snapshot-record-rows');
    const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' })
        .format(new Date(snapshot.date + 'T00:00:00Z'));
    heading.textContent = 'Valuation date · ' + dateLabel;
    totals.replaceChildren();
    for (const [label, value] of [
        ['Assets', snapshot.totals.assets],
        ['Liabilities', snapshot.totals.liabilities],
        ['Net worth', snapshot.totals.netWorth]
    ]) {
        const card = document.createElement('article');
        const name = document.createElement('span');
        name.textContent = label;
        const amount = document.createElement('strong');
        amount.textContent = money(value);
        card.append(name, amount);
        totals.append(card);
    }
    const categories = new Map();
    for (const record of snapshot.records) {
        const key = JSON.stringify([record.type, record.category]);
        categories.set(key, (categories.get(key) || 0) + record.value);
    }
    categoryRows.replaceChildren();
    const sortedCategories = [...categories.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
    for (const [key, amount] of sortedCategories) {
        const [type, category] = JSON.parse(key);
        const row = document.createElement('tr');
        for (const value of [type === 'asset' ? 'Asset' : 'Liability', category, money(amount)]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        }
        row.lastElementChild.className = 'align-right';
        categoryRows.append(row);
    }
    if (sortedCategories.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.textContent = 'No records were captured in this snapshot.';
        row.append(cell);
        categoryRows.append(row);
    }
    recordRows.replaceChildren();
    for (const record of snapshot.records) {
        const row = document.createElement('tr');
        for (const value of [record.name, record.category, record.type === 'asset' ? 'Asset' : 'Liability', money(record.value)]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        }
        row.lastElementChild.className = 'align-right';
        recordRows.append(row);
    }
    if (snapshot.records.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No financial records were present on this valuation date.';
        row.append(cell);
        recordRows.append(row);
    }
    panel.hidden = false;
    heading.focus();
    panel.scrollIntoView({ behavior: 'auto', block: 'nearest' });
}

function closeHistoricalSnapshotDetails() {
    $('#historical-snapshot-detail').hidden = true;
    if (lastHistoricalDetailsTrigger?.isConnected) lastHistoricalDetailsTrigger.focus();
    lastHistoricalDetailsTrigger = null;
}

function removeHistoricalSnapshotFromHistory(date) {
    if (workspace !== 'private' || !isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!historicalStorageHealthy) {
        showToast('Snapshot removal is paused because saved history could not be validated. Existing data was left untouched.');
        return;
    }
    const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' })
        .format(new Date(date + 'T00:00:00Z'));
    const confirmed = window.confirm(
        'Remove the historical snapshot for ' + dateLabel + ' from this browser? This does not change current financial records. ' +
        'The removal cannot be undone here; export a full workspace backup first if you may need this snapshot later.'
    );
    if (!confirmed) {
        showToast('Historical snapshot removal cancelled.');
        return;
    }
    try {
        const existing = readHistoricalSnapshots();
        if (existing === null) throw new Error('Saved history could not be validated; nothing was changed.');
        const next = removeHistoricalSnapshot({ snapshots: existing, date, currency: CURRENCY });
        if (!persistJson(localStorage, HISTORICAL_STORAGE_KEY, next)) {
            throw new Error('Could not save the removal. Your previous saved history was left unchanged.');
        }
        historicalStorageHealthy = true;
        $('#historical-snapshot-detail').hidden = true;
        lastHistoricalDetailsTrigger = null;
        renderHistoricalSnapshots();
        $('#historical-snapshots-heading').focus();
        showToast('Historical snapshot removed for ' + date + '. Current financial records were not changed.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not remove the historical snapshot.');
    }
}

function captureCurrentHistoricalSnapshot(event) {
    event.preventDefault();
    if (workspace !== 'private' || !isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (!privateStorageHealthy || !historicalStorageHealthy) {
        showToast('Snapshot capture is paused because current records or saved history could not be validated.');
        return;
    }
    try {
        const existing = readHistoricalSnapshots();
        if (existing === null) throw new Error('Saved history could not be validated; nothing was changed.');
        const date = $('#historical-snapshot-date').value;
        const next = captureHistoricalSnapshot({ records, date, currency: CURRENCY, existingSnapshots: existing });
        if (!persistJson(localStorage, HISTORICAL_STORAGE_KEY, next)) {
            throw new Error('Could not save the snapshot locally. Existing history was not intentionally replaced; check browser storage availability.');
        }
        historicalStorageHealthy = true;
        renderHistoricalSnapshots();
        showToast('Historical snapshot saved for ' + date + '.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not capture the historical snapshot.');
    }
}

function exportHistoricalSnapshotsHtml() {
    let snapshots;
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'demo') {
        snapshots = validateHistoricalSnapshots(demoHistoricalSnapshots, CURRENCY);
    } else {
        snapshots = readHistoricalSnapshots();
        if (snapshots === null) {
            showToast('Saved history could not be validated. Nothing was exported.');
            return;
        }
    }
    try {
        const report = renderHistoricalSnapshotsReportHtml({
            snapshots, currency: CURRENCY, generatedAt: new Date().toISOString()
        });
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = workspace === 'demo'
            ? 'pfo-os-sample-historical-net-worth.html' : 'pfo-os-historical-net-worth.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(workspace === 'demo'
            ? 'Exported fictional development history report.' : 'Exported saved historical net worth report.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create historical net worth report.');
    }
}

function exportHistoricalSnapshotsCsv() {
    let snapshots;
    if (workspace === 'demo') {
        if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
            showLocalWorkspaceRequired();
            return;
        }
        snapshots = validateHistoricalSnapshots(demoHistoricalSnapshots, CURRENCY);
    }
    else {
        if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
            showLocalWorkspaceRequired();
            return;
        }
        snapshots = readHistoricalSnapshots();
        if (snapshots === null) {
            showToast('Saved history could not be validated. Nothing was exported.');
            return;
        }
    }
    const points = summarizeHistoricalSnapshots(snapshots, CURRENCY);
    const rows = [
        ['valuation_date', 'currency', 'record_count', 'assets', 'liabilities', 'net_worth', 'net_worth_change', 'net_worth_change_percent'],
        ...points.map((point) => [point.date, point.currency, point.recordCount, point.assets, point.liabilities,
            point.netWorth, point.netWorthChange ?? '', point.netWorthChangePercent ?? ''])
    ];
    const csv = rows.map((row) => row.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = workspace === 'demo' ? 'pfo-os-sample-historical-snapshots.csv' : 'pfo-os-historical-snapshots.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(workspace === 'demo' ? 'Exported fictional development history.' : 'Exported saved historical snapshots.');
}

function totals() {
    return calculateFinancialTotals(records);
}

function renderFinancialHealth() {
    const status = $('#financial-health-status');
    const body = $('#financial-health-metrics');
    const note = $('#financial-health-note');
    body.replaceChildren();
    const showUnavailable = (message) => {
        status.textContent = 'Unavailable';
        note.textContent = message;
        body.innerHTML = '<p class="financial-health-empty">No combined summary is shown until the required local data can be validated.</p>';
    };
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showUnavailable('This summary is disabled outside a trusted local dashboard.');
        return;
    }
    if (workspace !== 'private') {
        status.textContent = 'Sample workspace';
        note.textContent = 'Switch to your private workspace to summarize your saved financial records.';
        body.innerHTML = '<p class="financial-health-empty">Your saved financial data is not read while the sample workspace is active.</p>';
        return;
    }
    if (!privateStorageHealthy || !goalsStorageHealthy) {
        showUnavailable('Financial records or saved goals could not be validated. Existing data has been left untouched.');
        return;
    }
    try {
        const entriesRaw = localStorage.getItem('pfo-os.cash-flow.v1');
        const entries = entriesRaw === null ? [] : validateCashFlowEntries(JSON.parse(entriesRaw));
        const budgetsRaw = localStorage.getItem('pfo-os.cash-flow-budgets.v1');
        const budgets = budgetsRaw === null ? [] : JSON.parse(budgetsRaw);
        if (!Array.isArray(budgets)) throw new Error('Saved budget data is not a valid list.');
        const budgetKeys = new Set();
        for (const budget of budgets) {
            if (!budget || typeof budget.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.month)
                || typeof budget.category !== 'string' || !budget.category.trim()
                || typeof budget.amount !== 'number' || !Number.isFinite(budget.amount) || budget.amount <= 0) {
                throw new Error('Saved budget data failed validation.');
            }
            const key = budget.month + '|' + budget.category.trim().toLocaleLowerCase('en-US');
            if (budgetKeys.has(key)) throw new Error('Saved budget data contains duplicate month/category entries.');
            budgetKeys.add(key);
        }
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const monthInput = $('#financial-health-month');
        if (monthInput && !monthInput.value) monthInput.value = currentMonth;
        const month = monthInput?.value || currentMonth;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new Error('Choose a valid financial health reporting month.');
        }
        const result = calculateFinancialHealth({ records, cashFlowEntries: entries, budgets, goals: savedGoals, month });
        const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
            .format(new Date(month + '-01T12:00:00'));
        const percent = (value) => value === null ? 'Unavailable' : number(value) + '%';
        const cards = [
            ['Net worth', money(result.netWorth), 'Assets ' + money(result.assets) + ' · Liabilities ' + money(result.liabilities)],
            ['Recorded cash flow · ' + monthLabel, money(result.netCashFlow), 'Income ' + money(result.income) + ' · Expenses ' + money(result.expenses)],
            ['Savings rate · ' + monthLabel, percent(result.savingsRate), result.savingsRate === null ? 'No recorded income for this month' : 'Recorded net cash flow ÷ recorded income'],
            ['Monthly budget control', result.budgetedCategoryCount === 0 ? 'No budgets set' : result.overBudgetCategoryCount + ' over budget', result.budgetedCategoryCount === 0 ? 'Save monthly category budgets to compare' : money(result.totalPositiveOverrun) + ' positive overruns · ' + money(result.actualInBudgetedCategories) + ' spent in budgeted categories'],
            ['Budget coverage · ' + monthLabel, result.expenseCoverageRate === null ? 'No expenses recorded' : percent(result.expenseCoverageRate), result.coveredExpenseCategoryCount + ' of ' + result.expenseCategoryCount + ' expense categories covered · ' + money(result.unbudgetedExpenses) + ' recorded expenses without a budget'],
            ['Saved goal progress', result.goalProgressPercent === null ? 'No goals saved' : percent(result.goalProgressPercent), result.goalCount === 0 ? 'Save a goal to track progress' : result.completedGoals + ' of ' + result.goalCount + ' goals reached · ' + money(result.goalCurrentTotal) + ' of ' + money(result.goalTargetTotal)]
        ];
        for (const [label, value, detail] of cards) {
            const card = document.createElement('article');
            card.className = 'financial-health-card';
            const heading = document.createElement('span');
            heading.textContent = label;
            const strong = document.createElement('strong');
            strong.textContent = value;
            const small = document.createElement('small');
            small.textContent = detail;
            card.append(heading, strong, small);
            body.append(card);
        }
        status.textContent = 'Local data · ' + monthLabel;
        note.textContent = 'Historical and descriptive only. Uses recorded balances, transactions, explicit budgets, and saved goals; no forecasts, external feeds, financial score, or recommendations.';
    } catch {
        showUnavailable('Cash-flow or budget data could not be validated. The dashboard has not changed or overwritten your saved data.');
    }
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
    renderFinancialRatios(result);
    renderFinancialHealth();
    renderHistoricalSnapshots();
    renderAllocation(result.assets);
    renderRecords();
}

function exportFinancialRatiosCsv() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Ratio export is paused because saved financial data could not be read safely. Existing storage remains untouched.');
        return;
    }
    try {
        const result = totals();
        const ratios = calculateFinancialRatios({
            currency: CURRENCY,
            totalAssets: { amount: result.assets, currency: CURRENCY },
            totalLiabilities: { amount: result.liabilities, currency: CURRENCY },
            netWorth: { amount: result.netWorth, currency: CURRENCY }
        });
        const rows = [
            ['metric', 'ratio_value', 'numerator_inr', 'denominator_inr', 'status'],
            ['liabilities_to_assets', ratios.liabilitiesToAssets ?? '', result.liabilities, result.assets, ratios.liabilitiesToAssets === null ? 'Unavailable: zero assets' : 'Available'],
            ['net_worth_to_assets', ratios.netWorthToAssets ?? '', result.netWorth, result.assets, ratios.netWorthToAssets === null ? 'Unavailable: zero assets' : 'Available'],
            ['assets_to_liabilities', ratios.assetsToLiabilities ?? '', result.assets, result.liabilities, ratios.assetsToLiabilities === null ? 'Unavailable: zero liabilities' : 'Available']
        ];
        const cell = (value) => {
            let text = String(value ?? '');
            if (typeof value !== 'number' && /^[=+@\t\r-]/u.test(text.trimStart())) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
        };
        const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-balance-sheet-ratios.csv';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Balance-sheet ratios exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create ratio CSV export.');
    }
}
function exportFinancialRatiosHtml() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Ratio report is paused because saved financial data could not be read safely. Existing storage remains untouched.');
        return;
    }
    try {
        const result = totals();
        const ratios = calculateFinancialRatios({
            currency: CURRENCY,
            totalAssets: { amount: result.assets, currency: CURRENCY },
            totalLiabilities: { amount: result.liabilities, currency: CURRENCY },
            netWorth: { amount: result.netWorth, currency: CURRENCY }
        });
        const report = renderFinancialRatiosReportHtml({
            assets: result.assets, liabilities: result.liabilities, netWorth: result.netWorth,
            ratios, generatedAt: new Date().toISOString()
        });
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-balance-sheet-ratios.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Standalone balance-sheet ratios report exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create balance-sheet ratios report.');
    }
}

function exportFinancialHealthCsv() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace !== 'private' || !privateStorageHealthy || !goalsStorageHealthy) {
        showToast('Health export is available only after the private workspace data has been validated.');
        return;
    }
    const status = $('#financial-health-status').textContent;
    const cards = [...$('#financial-health-metrics').querySelectorAll('.financial-health-card')];
    if (!status.startsWith('Local data · ') || cards.length === 0) {
        showToast('Health export is unavailable because no validated local summary is displayed.');
        return;
    }
    try {
        const reportingPeriod = status.slice('Local data · '.length);
        const cell = (value) => {
            let text = String(value ?? '');
            if (/^[=+@\t\r-]/u.test(text.trimStart())) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
        };
        const rows = [['metric', 'value', 'details', 'reporting_period', 'scope']];
        for (const card of cards) {
            const parts = [...card.children];
            if (parts.length < 3) throw new Error('The displayed health summary is incomplete.');
            rows.push([parts[0].textContent, parts[1].textContent, parts[2].textContent, reportingPeriod, 'Private local workspace']);
        }
        const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-financial-health.csv';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Financial health summary exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create financial health CSV export.');
    }
}

function exportFinancialHealthHtml() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace !== 'private' || !privateStorageHealthy || !goalsStorageHealthy) {
        showToast('Health report is available only after the private workspace data has been validated.');
        return;
    }
    const status = $('#financial-health-status').textContent;
    const cards = [...$('#financial-health-metrics').querySelectorAll('.financial-health-card')];
    if (!status.startsWith('Local data · ') || cards.length === 0) {
        showToast('Health report is unavailable because no validated local summary is displayed.');
        return;
    }
    try {
        const metrics = cards.map((card) => {
            const parts = [...card.children];
            if (parts.length < 3) throw new Error('The displayed health summary is incomplete.');
            return { label: parts[0].textContent, value: parts[1].textContent, detail: parts[2].textContent };
        });
        const report = renderFinancialHealthReportHtml({
            reportingPeriod: status.slice('Local data · '.length),
            generatedAt: new Date().toISOString(),
            metrics
        });
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-financial-health.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Standalone financial health report exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create financial health report.');
    }
}

function renderFinancialRatios(result) {
    const ratios = calculateFinancialRatios({
        currency: CURRENCY,
        totalAssets: { amount: result.assets, currency: CURRENCY },
        totalLiabilities: { amount: result.liabilities, currency: CURRENCY },
        netWorth: { amount: result.netWorth, currency: CURRENCY }
    });
    const percentage = (value) => value === null ? '—' : (value * 100).toFixed(1) + '%';
    const multiple = (value) => value === null ? '—' : value.toFixed(2) + '×';
    $('#financial-ratios').innerHTML = `<div class="financial-ratio-metrics">
            <article><span>Liabilities / assets</span><strong id="ratio-liabilities-to-assets">${percentage(ratios.liabilitiesToAssets)}</strong><small>Recorded liabilities as a share of recorded assets.</small></article>
            <article><span>Net worth / assets</span><strong id="ratio-net-worth-to-assets">${percentage(ratios.netWorthToAssets)}</strong><small>Recorded net worth as a share of recorded assets.</small></article>
            <article><span>Assets / liabilities</span><strong id="ratio-assets-to-liabilities">${multiple(ratios.assetsToLiabilities)}</strong><small>Recorded assets per unit of recorded liabilities.</small></article>
        </div>
        <p class="financial-ratio-note">Descriptive ratios only; no benchmarks, forecasts, or recommendations are implied. A dash means the denominator is zero.</p>`;
}

function renderAllocation(totalAssets) {
    const container = $('#allocation-content');
    $('#allocation-concentration').hidden = true;
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
    const concentration = analyzeDiversification({
        currency: CURRENCY,
        totalValue: { amount: totalAssets, currency: CURRENCY },
        allocations: entries.map(([category, value]) => ({
            category,
            value: { amount: value, currency: CURRENCY },
            weight: value / totalAssets
        }))
    });
    $('#allocation-concentration').hidden = false;
    $('#allocation-concentration').innerHTML = `<p class="eyebrow">CATEGORY CONCENTRATION</p>
        <div class="concentration-metrics">
            <article><span>Concentration index (HHI)</span><strong>${concentration.concentrationIndex.toFixed(3)}</strong><small>Sum of squared category shares; higher means more concentrated.</small></article>
            <article><span>Effective category count</span><strong>${concentration.effectiveCategoryCount.toFixed(2)}</strong><small>Equivalent number of equally sized categories.</small></article>
            <article><span>Largest category</span><strong>${(concentration.largestCategoryShare * 100).toFixed(1)}%</strong><small>Share held by the largest asset category.</small></article>
        </div>
        <p class="concentration-note">Category concentration only. This does not measure holding-level diversification, correlations, liquidity, or overall portfolio risk.</p>`;
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
    if (isPrivateExport && (!privateStorageHealthy || !goalsStorageHealthy || !historicalStorageHealthy)) {
        showToast('Export is paused because saved records or goals could not be read safely. Existing storage remains untouched; import a valid backup to recover.');
        return;
    }
    const payload = {
        schemaVersion: isPrivateExport ? 4 : 1,
        currency: CURRENCY,
        exportedAt: new Date().toISOString(),
        records
    };
    if (isPrivateExport) {
        try {
            const entriesRaw = localStorage.getItem('pfo-os.cash-flow.v1');
            const budgetsRaw = localStorage.getItem('pfo-os.cash-flow-budgets.v1');
            payload.goals = savedGoals;
            payload.cashFlowEntries = entriesRaw === null ? [] : validateCashFlowEntries(JSON.parse(entriesRaw));
            payload.budgets = validateCashFlowBudgets(budgetsRaw === null ? [] : JSON.parse(budgetsRaw));
            const historicalSnapshots = readHistoricalSnapshots();
            if (historicalSnapshots === null) throw new Error('Historical snapshots could not be validated.');
            payload.historicalSnapshots = historicalSnapshots;
        } catch (error) {
            showToast(error instanceof Error ? 'Full workspace export paused: ' + error.message : 'Full workspace data could not be validated; nothing was exported.');
            return;
        }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pfo-os-full-workspace-backup.json';
    document.body.append(link);
    link.click();
    link.remove();
    // Keep the object URL alive briefly so the browser can begin consuming the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(isPrivateExport
        ? 'Full workspace backup exported to this device, including records, goals, cash flow, budgets, and ' + payload.historicalSnapshots.length + ' historical snapshots.'
        : 'Sample financial records exported to this device.');
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
            const needsConfirmation = records.length > 0 || !privateStorageHealthy;
            const replacementConfirmed = !needsConfirmation || window.confirm(
                'Importing this CSV will replace all financial records in your private workspace. Saved goals, cash-flow transactions, budgets, and historical snapshots are preserved. Continue?'
            );
            if (!replacementConfirmed) {
                showToast('CSV import cancelled. Your existing records and goals were not changed.');
                return;
            }
            if (savePrivateRecords(parsedRecords, true)) {
                if (workspace === 'demo') switchWorkspace('private');
                records = parsedRecords;
                render();
                showToast(`Imported ${records.length} financial records from CSV. Saved goals, cash flow, budgets, and historical snapshots were preserved.`);
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

function exportMonthlyFinancialReview() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace !== 'private') {
        showToast('Switch to your local private workspace before generating a monthly financial review.');
        return;
    }
    if (!privateStorageHealthy || !goalsStorageHealthy) {
        showToast('Monthly review is unavailable until saved financial records and goals can be validated safely.');
        return;
    }
    const month = $('#monthly-review-month').value;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        showToast('Choose a valid reporting month.');
        return;
    }
    try {
        const entriesRaw = localStorage.getItem('pfo-os.cash-flow.v1');
        const entries = entriesRaw === null ? [] : validateCashFlowEntries(JSON.parse(entriesRaw));
        const budgetsRaw = localStorage.getItem('pfo-os.cash-flow-budgets.v1');
        const budgets = budgetsRaw === null ? [] : JSON.parse(budgetsRaw);
        const review = buildMonthlyFinancialReview({ entries, budgets, goals: savedGoals, month, generatedAt: new Date() });
        const blob = new Blob([renderMonthlyFinancialReviewHtml(review)], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-monthly-financial-review-' + month + '.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Downloaded the offline monthly financial review. Keep the report private; it contains financial details.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not safely create the monthly financial review.');
    }
}

function exportAnnualFinancialReview() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace !== 'private') {
        showToast('Switch to your local private workspace before generating an annual financial review.');
        return;
    }
    if (!privateStorageHealthy || !goalsStorageHealthy) {
        showToast('Annual review is unavailable until saved financial records and goals can be validated safely.');
        return;
    }
    const year = $('#annual-review-year').value;
    if (!/^\d{4}$/.test(year)) {
        showToast('Choose a valid reporting year.');
        return;
    }
    try {
        const entriesRaw = localStorage.getItem('pfo-os.cash-flow.v1');
        const entries = entriesRaw === null ? [] : validateCashFlowEntries(JSON.parse(entriesRaw));
        const budgetsRaw = localStorage.getItem('pfo-os.cash-flow-budgets.v1');
        const budgets = budgetsRaw === null ? [] : JSON.parse(budgetsRaw);
        const review = buildAnnualFinancialReview({ entries, budgets, goals: savedGoals, year, generatedAt: new Date() });
        const blob = new Blob([renderAnnualFinancialReviewHtml(review)], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-annual-financial-review-' + year + '.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Downloaded the offline annual financial review. Keep the report private; it contains financial details.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not safely create the annual financial review.');
    }
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

function printFinancialReport() {
    if (workspace === 'private' && (!isPrivateWorkspaceAllowed(window.location.hostname) || !privateStorageHealthy)) {
        showToast('Financial report printing is unavailable until the local private workspace can be read safely.');
        return;
    }
    let printWindow;
    try {
        const html = renderFinancialReportHtml({ records, currency: CURRENCY, generatedAt: new Date() });
        printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('Allow pop-ups for this local dashboard to print or save the financial report as PDF.');
            return;
        }
        printWindow.opener = null;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.setTimeout(() => {
            if (!printWindow.closed) {
                printWindow.focus();
                printWindow.print();
            }
        }, 100);
        showToast('Print-ready report opened. Choose Save as PDF in the browser print dialog.');
    } catch (error) {
        if (printWindow && !printWindow.closed) printWindow.close();
        showToast(error instanceof Error ? error.message : 'Could not open the financial report for printing.');
    }
}

function exportAllocationCsv() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Allocation export is paused because saved financial data could not be read safely. Existing storage remains untouched.');
        return;
    }
    try {
        const grouped = new Map();
        records.filter((item) => item.type === 'asset').forEach((item) => {
            grouped.set(item.category, (grouped.get(item.category) || 0) + item.value);
        });
        const entries = [...grouped.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));
        const totalAssets = entries.reduce((sum, [, value]) => sum + value, 0);
        if (entries.length === 0 || !Number.isFinite(totalAssets) || totalAssets <= 0) {
            showToast('Add a positive-value asset before exporting allocation.');
            return;
        }
        const concentration = analyzeDiversification({
            currency: CURRENCY,
            totalValue: { amount: totalAssets, currency: CURRENCY },
            allocations: entries.map(([category, value]) => ({
                category, value: { amount: value, currency: CURRENCY }, weight: value / totalAssets
            }))
        });
        const cell = (value) => {
            let text = String(value ?? '');
            if (typeof value !== 'number' && /^[=+@\t\r-]/u.test(text.trimStart())) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
        };
        const header = ['record_type', 'category', 'value_inr', 'share_percent', 'concentration_index_hhi', 'effective_category_count', 'largest_category_share_percent', 'total_assets_inr'];
        const rows = [[
            'summary', '', '', '', concentration.concentrationIndex, concentration.effectiveCategoryCount,
            concentration.largestCategoryShare * 100, totalAssets
        ]];
        for (const [category, value] of entries) {
            rows.push(['category', category, value, value / totalAssets * 100, '', '', '', totalAssets]);
        }
        const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-asset-allocation.csv';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Asset allocation and category concentration exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create allocation CSV export.');
    }
}
function exportAllocationHtml() {
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        showLocalWorkspaceRequired();
        return;
    }
    if (workspace === 'private' && !privateStorageHealthy) {
        showToast('Allocation report is paused because saved financial data could not be read safely. Existing storage remains untouched.');
        return;
    }
    try {
        const grouped = new Map();
        records.filter((item) => item.type === 'asset').forEach((item) => {
            grouped.set(item.category, (grouped.get(item.category) || 0) + item.value);
        });
        const report = renderAssetAllocationReportHtml({
            entries: [...grouped.entries()].map(([category, value]) => ({ category, value })),
            generatedAt: new Date().toISOString()
        });
        const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-os-asset-allocation.html';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Standalone asset allocation report exported to this device.');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not create asset allocation report.');
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

            const preview = summarizeValidatedBackup(backup);
            const previewLines = [
                'Backup import preview',
                '',
                'Financial records: ' + preview.recordCount,
                'Assets: ' + money(preview.assets),
                'Liabilities: ' + money(preview.liabilities),
                'Net worth: ' + money(preview.netWorth)
            ];
            if (preview.includesGoals) previewLines.push('Saved goals: ' + preview.goalCount);
            else previewLines.push('Saved goals: not included (existing goals will be preserved)');
            if (preview.includesHistoricalSnapshots) previewLines.push('Historical snapshots: ' + preview.historicalSnapshotCount);
            else previewLines.push('Historical snapshots: not included (existing history will be preserved)');
            if (preview.includesCashFlow) {
                previewLines.push(
                    'Cash-flow transactions: ' + preview.cashFlowTransactionCount,
                    'Recorded income: ' + money(preview.cashFlowIncome),
                    'Recorded expenses: ' + money(preview.cashFlowExpenses),
                    'Net cash flow: ' + money(preview.cashFlowNet),
                    'Category budgets: ' + preview.budgetCount
                );
            } else {
                previewLines.push('Cash flow and budgets: not included (existing data will be preserved)');
            }
            previewLines.push(
                '',
                backup.includesHistoricalSnapshots
                    ? 'Importing replaces records, goals, cash-flow transactions, budgets, and historical snapshots in this browser.'
                    : backup.includesCashFlow
                        ? 'Importing replaces records, goals, cash-flow transactions, and budgets in this browser; existing history is preserved.'
                    : backup.includesGoals
                        ? 'Importing replaces financial records and saved goals in this browser.'
                        : 'Importing replaces financial records in this browser; saved goals, cash flow, and budgets are preserved.',
                'Export a backup first if you want to keep the current data.',
                '',
                'Import this backup now?'
            );
            const replacementConfirmed = window.confirm(previewLines.join('\n'));
            if (!replacementConfirmed) {
                showToast('Import cancelled. Your existing data was not changed.');
                return;
            }

            if (backup.includesCashFlow) {
                const storageKeys = [STORAGE_KEY, GOALS_STORAGE_KEY, 'pfo-os.cash-flow.v1', 'pfo-os.cash-flow-budgets.v1', HISTORICAL_STORAGE_KEY];
                let previousValues;
                try {
                    previousValues = storageKeys.map((key) => [key, localStorage.getItem(key)]);
                    calculateFinancialTotals(validatedRecords);
                } catch (error) {
                    showToast(error instanceof Error ? 'Could not safely prepare workspace restore: ' + error.message : 'Could not inspect current storage. Nothing was imported.');
                    return;
                }
                try {
                    if (!persistJson(localStorage, STORAGE_KEY, validatedRecords)) throw new Error('Could not save financial records.');
                    if (!saveSavedGoals(localStorage, backup.goals)) throw new Error('Could not save financial goals.');
                    if (!persistJson(localStorage, 'pfo-os.cash-flow.v1', backup.cashFlowEntries)) throw new Error('Could not save cash-flow transactions.');
                    if (!persistJson(localStorage, 'pfo-os.cash-flow-budgets.v1', backup.budgets)) throw new Error('Could not save category budgets.');
                    if (backup.includesHistoricalSnapshots && !persistJson(localStorage, HISTORICAL_STORAGE_KEY, backup.historicalSnapshots)) throw new Error('Could not save historical snapshots.');
                } catch (error) {
                    const restored = previousValues.map(([key, value]) => restoreStorageValue(key, value)).every(Boolean);
                    if (!restored) {
                        privateStorageHealthy = false;
                        goalsStorageHealthy = false;
                        historicalStorageHealthy = false;
                        showToast('Workspace restore failed and rollback was incomplete. Stop editing and preserve this browser profile for recovery.');
                    } else {
                        showToast(error instanceof Error ? error.message + ' The previous workspace data was restored.' : 'Workspace restore failed; the previous data was restored.');
                    }
                    return;
                }
                if (workspace === 'demo') switchWorkspace('private');
                records = validatedRecords;
                savedGoals = backup.goals;
                privateStorageHealthy = true;
                goalsStorageHealthy = true;
                if (backup.includesHistoricalSnapshots) historicalStorageHealthy = true;
                renderSavedGoals();
                showGoalMessage();
                render();
                window.dispatchEvent(new Event('pfo:cashflow-restored'));
                window.dispatchEvent(new Event('pfo:cashflow-updated'));
                renderHistoricalSnapshots();
                showToast('Restored full workspace: ' + records.length + ' records, ' + savedGoals.length
                    + ' goals, ' + backup.cashFlowEntries.length + ' cash-flow transactions, ' + backup.budgets.length + ' budgets'
                    + (backup.includesHistoricalSnapshots ? ', and ' + backup.historicalSnapshots.length + ' historical snapshots.' : '. Historical snapshots were preserved because this older backup did not include them.'));
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

            if (workspace === 'demo') switchWorkspace('private');
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
$('#saved-goals-export-csv').addEventListener('click', exportSavedGoalsCsv);
$('#saved-goals-export-html').addEventListener('click', exportSavedGoalsHtml);
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
$('#switch-demo-button').addEventListener('click', () => switchWorkspace('demo'));
$('#historical-snapshot-form').addEventListener('submit', captureCurrentHistoricalSnapshot);
$('#export-historical-snapshots-csv').addEventListener('click', exportHistoricalSnapshotsCsv);
$('#export-historical-snapshots-html').addEventListener('click', exportHistoricalSnapshotsHtml);
$('#close-historical-snapshot-detail').addEventListener('click', closeHistoricalSnapshotDetails);
$('#export-report-button').addEventListener('click', exportFinancialReport);
$('#monthly-review-export-button').addEventListener('click', exportMonthlyFinancialReview);
$('#annual-review-export-button').addEventListener('click', exportAnnualFinancialReview);
$('#print-report-button').addEventListener('click', printFinancialReport);
$('#export-csv-button').addEventListener('click', exportCsv);
$('#export-financial-ratios-csv').addEventListener('click', exportFinancialRatiosCsv);
$('#export-financial-ratios-html').addEventListener('click', exportFinancialRatiosHtml);
$('#financial-health-month').addEventListener('change', () => renderFinancialHealth());
$('#export-financial-health-csv').addEventListener('click', exportFinancialHealthCsv);
$('#export-financial-health-html').addEventListener('click', exportFinancialHealthHtml);
$('#export-allocation-csv').addEventListener('click', exportAllocationCsv);
$('#export-allocation-html').addEventListener('click', exportAllocationHtml);
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
        $('#page-breadcrumb').textContent = activeItem.textContent.trim().replace(/^[◫▤◷◎₹%↘↗∿↻△]\s*/, '');
    }
}

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', syncActiveNavigation));
window.addEventListener('hashchange', syncActiveNavigation);
window.addEventListener('pfo:cashflow-updated', renderFinancialHealth);
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
const reviewNow = new Date();
$('#historical-snapshot-date').value = reviewNow.getFullYear() + '-' + String(reviewNow.getMonth() + 1).padStart(2, '0') + '-' + String(reviewNow.getDate()).padStart(2, '0');
$('#monthly-review-month').value = reviewNow.getFullYear() + '-' + String(reviewNow.getMonth() + 1).padStart(2, '0');
$('#annual-review-year').value = String(reviewNow.getFullYear());
initializeCashFlowTracker();
initializeTaxEstimator();
initializeLoanAmortizationCalculator();
initializeInvestmentPerformanceCalculator();
initializeGrowthProjectionCalculator();
initializeCagrCalculator();
initializeReturnRiskCalculator();
switchWorkspace('demo');
