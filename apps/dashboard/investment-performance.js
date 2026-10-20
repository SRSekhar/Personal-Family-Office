import { analyzeInvestmentPerformanceMath } from './calculators-runtime/InvestmentPerformanceMath.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';

function createCashFlowRow({ amount = '', date = '' } = {}) {
    const row = document.createElement('div'); row.className = 'investment-flow-row';
    const dateLabel = document.createElement('label'); dateLabel.className = 'field-label'; dateLabel.textContent = 'Cash-flow date';
    const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.className = 'investment-flow-date'; dateInput.required = true; dateInput.value = date; dateInput.setAttribute('aria-label', 'Investment cash-flow date'); dateLabel.append(dateInput);
    const amountLabel = document.createElement('label'); amountLabel.className = 'field-label'; amountLabel.textContent = 'Amount (₹)';
    const amountInput = document.createElement('input'); amountInput.type = 'number'; amountInput.step = 'any'; amountInput.required = true; amountInput.className = 'investment-flow-amount'; amountInput.value = String(amount); amountInput.setAttribute('aria-label', 'Investment cash-flow amount in rupees'); amountLabel.append(amountInput);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-secondary button-small'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove investment cash flow'); remove.addEventListener('click', () => row.remove());
    row.append(dateLabel, amountLabel, remove);
    return row;
}

function renderPerformance(result) {
    $('#investment-performance-results').hidden = false;
    $('#investment-gross-contributions').textContent = money(result.grossContributions);
    $('#investment-gross-proceeds').textContent = money(result.grossProceeds);
    $('#investment-net-gain').textContent = money(result.netGain);
    $('#investment-simple-return').textContent = percent(result.netReturnOnContributionsPercentage);
    $('#investment-xirr').textContent = percent(result.annualizedMoneyWeightedReturn * 100);
    $('#investment-cash-flow-count').textContent = String(result.cashFlowCount);
    $('#investment-date-range').textContent = new Date(result.startDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }) + ' – ' + new Date(result.endDate).toLocaleDateString('en-IN', { timeZone: 'UTC' });
}

export function initializeInvestmentPerformanceCalculator() {
    const form = $('#investment-performance-form'); if (!form) return;
    const rows = $('#investment-cash-flows');
    rows.append(createCashFlowRow());
    $('#investment-add-flow').addEventListener('click', () => { const row = createCashFlowRow(); rows.append(row); row.querySelector('.investment-flow-date').focus(); });
    form.addEventListener('submit', (event) => {
        event.preventDefault(); $('#investment-performance-validation').hidden = true;
        try {
            const cashFlows = [...rows.querySelectorAll('.investment-flow-row')].map((row) => {
                const date = row.querySelector('.investment-flow-date').value;
                const amount = row.querySelector('.investment-flow-amount').value;
                if (!date) throw new RangeError('Enter a date for every cash flow.');
                if (amount.trim() === '') throw new RangeError('Enter an amount for every cash flow.');
                return { date: new Date(date + 'T00:00:00.000Z'), amount: Number(amount) };
            });
            renderPerformance(analyzeInvestmentPerformanceMath({ cashFlows }));
        } catch (error) {
            $('#investment-performance-results').hidden = true;
            $('#investment-performance-validation').textContent = error instanceof Error ? error.message : 'Could not calculate investment performance.';
            $('#investment-performance-validation').hidden = false;
        }
    });
    $('#investment-performance-reset').addEventListener('click', () => {
        form.reset(); rows.replaceChildren(createCashFlowRow()); $('#investment-performance-results').hidden = true;
        $('#investment-performance-validation').hidden = true; $('#investment-performance-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#investment-performance-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
        $('#investment-add-flow').disabled = true;
    }
}