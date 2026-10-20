import { calculateLoanAmortizationMath } from './calculators-runtime/LoanAmortizationMath.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function renderSchedule(schedule) {
    const body = $('#loan-schedule-rows');
    body.replaceChildren();
    for (const item of schedule.slice(0, 12)) {
        const row = document.createElement('tr');
        const values = [String(item.period), new Date(item.dueDate).toLocaleDateString('en-IN', { timeZone: 'UTC' }), money(item.openingBalance), money(item.interest), money(item.payment), money(item.principalPaid), money(item.closingBalance)];
        for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
        body.append(row);
    }
    $('#loan-schedule-caption').textContent = schedule.length > 12
        ? 'Showing the first 12 of ' + schedule.length + ' payments. Export CSV for the full schedule.'
        : 'Showing all ' + schedule.length + ' scheduled payments.';
    $('#loan-schedule-empty').hidden = schedule.length !== 0;
}

function exportSchedule(schedule) {
    const rows = [['Period', 'Due date (UTC)', 'Opening balance INR', 'Interest INR', 'Payment INR', 'Principal paid INR', 'Closing balance INR']];
    for (const item of schedule) rows.push([item.period, item.dueDate, item.openingBalance, item.interest, item.payment, item.principalPaid, item.closingBalance]);
    const csv = rows.map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pfo-loan-amortization.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initializeLoanAmortizationCalculator() {
    const form = $('#loan-amortization-form');
    if (!form) return;
    let lastSchedule = [];
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        $('#loan-validation').hidden = true;
        try {
            const dateValue = $('#loan-first-payment-date').value;
            if (!dateValue) throw new RangeError('Enter the first payment date.');
            const result = calculateLoanAmortizationMath({
                outstandingPrincipal: Number($('#loan-outstanding-principal').value),
                annualInterestRatePercent: Number($('#loan-annual-rate').value),
                monthlyPayment: Number($('#loan-monthly-payment').value),
                firstPaymentDate: new Date(dateValue + 'T00:00:00.000Z'),
                maximumPayments: 1200
            });
            lastSchedule = result.schedule;
            $('#loan-total-interest').textContent = money(result.totalInterest);
            $('#loan-total-payments').textContent = money(result.totalPayments);
            $('#loan-principal-paid').textContent = money(result.totalPrincipalPaid);
            $('#loan-remaining-balance').textContent = money(result.remainingBalance);
            $('#loan-payoff-status').textContent = result.paidOff ? 'Paid off under these assumptions' : 'Balance remains at the schedule limit';
            $('#loan-payment-count').textContent = String(result.schedule.length);
            $('#loan-estimate-results').hidden = false;
            $('#loan-export-schedule').hidden = result.schedule.length === 0;
            renderSchedule(result.schedule);
        } catch (error) {
            $('#loan-estimate-results').hidden = true;
            $('#loan-validation').textContent = error instanceof Error ? error.message : 'Could not calculate the loan schedule.';
            $('#loan-validation').hidden = false;
        }
    });
    $('#loan-export-schedule').addEventListener('click', () => exportSchedule(lastSchedule));
    $('#loan-reset').addEventListener('click', () => {
        form.reset(); lastSchedule = []; $('#loan-estimate-results').hidden = true; $('#loan-validation').hidden = true; $('#loan-validation').textContent = '';
        $('#loan-schedule-rows').replaceChildren(); $('#loan-schedule-empty').hidden = false;
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#loan-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
    }
}