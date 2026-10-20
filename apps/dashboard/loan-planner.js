import { isPrivateWorkspaceAllowed } from './workspace-security.js';
import { calculateLoanAmortizationCore } from './calculators-runtime/LoanAmortizationCore.js';

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
}).format(value);

export function initializeLoanPlanner() {
    const form = $('#loan-planner-form');
    if (!form) return;

    const result = $('#loan-planner-results');
    const error = $('#loan-planner-error');
    const scheduleBody = $('#loan-planner-schedule');
    const hostedNotice = $('#loan-planner-hosted-notice');

    function clearResults() {
        result.hidden = true;
        error.hidden = true;
        error.textContent = '';
        scheduleBody.replaceChildren();
        $('#loan-planner-summary').textContent = '';
    }

    function renderSchedule(schedule) {
        const rows = document.createDocumentFragment();
        for (const item of schedule) {
            const row = document.createElement('tr');
            const values = [
                String(item.period),
                item.dueDate.slice(0, 10),
                money(item.openingBalance),
                money(item.interest),
                money(item.payment),
                money(item.principalPaid),
                money(item.closingBalance)
            ];
            for (const value of values) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            rows.append(row);
        }
        scheduleBody.replaceChildren(rows);
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearResults();
        if (!form.reportValidity()) return;

        try {
            const principal = Number($('#loan-principal').value);
            const rate = Number($('#loan-interest-rate').value);
            const payment = Number($('#loan-monthly-payment').value);
            const firstPaymentDate = new Date(`${$('#loan-first-payment-date').value}T00:00:00.000Z`);
            const maximumPayments = Number($('#loan-maximum-payments').value);
            const estimate = calculateLoanAmortizationCore({
                outstandingPrincipal: principal,
                annualInterestRatePercent: rate,
                monthlyPayment: payment,
                currency: 'INR',
                firstPaymentDate,
                maximumPayments
            });

            $('#loan-total-interest').textContent = money(estimate.totalInterest);
            $('#loan-total-payments').textContent = money(estimate.totalPayments);
            $('#loan-total-principal').textContent = money(estimate.totalPrincipalPaid);
            $('#loan-remaining-balance').textContent = money(estimate.remainingBalance);
            $('#loan-planner-summary').textContent = estimate.paidOff
                ? `Paid off within ${estimate.schedule.length} monthly payments.`
                : `Not paid off within ${estimate.schedule.length} monthly payments; remaining balance is shown above.`;
            renderSchedule(estimate.schedule);
            result.hidden = false;
        } catch (caught) {
            error.textContent = caught instanceof Error
                ? caught.message
                : 'Could not calculate the loan amortization schedule.';
            error.hidden = false;
        }
    });

    $('#loan-planner-reset').addEventListener('click', () => {
        form.reset();
        clearResults();
    });
    form.addEventListener('input', clearResults);

    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        hostedNotice.hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
    }
}
