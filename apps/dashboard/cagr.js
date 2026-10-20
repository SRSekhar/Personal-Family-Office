import { calculateCagr } from './calculators-runtime/Cagr.js';
import { cagrToCsv } from './cagr-export.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const percent = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value) + '%';

export function initializeCagrCalculator() {
    const form = $('#cagr-form');
    if (!form) return;
    let latestCagr = null;
    const invalidateCagr = () => {
        latestCagr = null;
        $('#cagr-export-csv').disabled = true;
        $('#cagr-results').hidden = true;
    };
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        latestCagr = null;
        $('#cagr-export-csv').disabled = true;
        $('#cagr-validation').hidden = true;
        try {
            const beginningValue = Number($('#cagr-beginning-value').value);
            const endingValue = Number($('#cagr-ending-value').value);
            const periods = Number($('#cagr-periods').value);
            const rate = calculateCagr({ beginningValue, endingValue, periods });
            latestCagr = { beginningValue, endingValue, periods, annualizedRate: rate };
            $('#cagr-beginning-result').textContent = money(beginningValue);
            $('#cagr-ending-result').textContent = money(endingValue);
            $('#cagr-rate-result').textContent = percent(rate * 100);
            $('#cagr-export-csv').disabled = false;
            $('#cagr-results').hidden = false;
        } catch (error) {
            latestCagr = null;
            $('#cagr-export-csv').disabled = true;
            $('#cagr-results').hidden = true;
            $('#cagr-validation').textContent = error instanceof Error ? error.message : 'Could not calculate CAGR.';
            $('#cagr-validation').hidden = false;
        }
    });
    $('#cagr-reset').addEventListener('click', () => {
        form.reset(); invalidateCagr();
        $('#cagr-validation').hidden = true; $('#cagr-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#cagr-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
        return;
    }
    form.addEventListener('input', invalidateCagr);
    form.addEventListener('change', invalidateCagr);
    $('#cagr-export-csv').addEventListener('click', () => {
        if (!latestCagr) return;
        const blob = new Blob([cagrToCsv(latestCagr)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'pfo-cagr-result.csv';
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    });
}