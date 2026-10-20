import { calculateCagr } from './calculators-runtime/Cagr.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';

export function initializeCagrCalculator() {
    const form = $('#cagr-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
        event.preventDefault(); $('#cagr-validation').hidden = true;
        try {
            const beginningValue = Number($('#cagr-beginning-value').value);
            const endingValue = Number($('#cagr-ending-value').value);
            const periods = Number($('#cagr-periods').value);
            const rate = calculateCagr({ beginningValue, endingValue, periods });
            $('#cagr-beginning-result').textContent = money(beginningValue);
            $('#cagr-ending-result').textContent = money(endingValue);
            $('#cagr-rate-result').textContent = percent(rate * 100);
            $('#cagr-results').hidden = false;
        } catch (error) {
            $('#cagr-results').hidden = true;
            $('#cagr-validation').textContent = error instanceof Error ? error.message : 'Could not calculate CAGR.';
            $('#cagr-validation').hidden = false;
        }
    });
    $('#cagr-reset').addEventListener('click', () => {
        form.reset(); $('#cagr-results').hidden = true; $('#cagr-validation').hidden = true; $('#cagr-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#cagr-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
    }
}