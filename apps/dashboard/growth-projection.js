import { projectCompoundGrowth } from './calculators-runtime/CompoundGrowth.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export function initializeGrowthProjectionCalculator() {
    const form = $('#growth-projection-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
        event.preventDefault(); $('#growth-validation').hidden = true;
        try {
            const initialValue = Number($('#growth-initial-value').value);
            const annualContribution = Number($('#growth-annual-contribution').value);
            const annualRate = Number($('#growth-annual-rate').value) / 100;
            const periods = Number($('#growth-years').value);
            const contributionTiming = $('#growth-contribution-timing').value;
            const projectedValue = projectCompoundGrowth({
                initialValue, annualRate, periods, contributionPerPeriod: annualContribution, contributionTiming
            });
            const totalContributions = initialValue + annualContribution * periods;
            const estimatedGrowth = projectedValue - totalContributions;
            if (![totalContributions, estimatedGrowth].every(Number.isFinite)) {
                throw new RangeError('Growth projection totals exceed the supported numeric range.');
            }
            $('#growth-projected-value').textContent = money(projectedValue);
            $('#growth-total-contributions').textContent = money(totalContributions);
            $('#growth-estimated-growth').textContent = money(estimatedGrowth);
            $('#growth-results').hidden = false;
        } catch (error) {
            $('#growth-results').hidden = true;
            $('#growth-validation').textContent = error instanceof Error ? error.message : 'Could not calculate the growth projection.';
            $('#growth-validation').hidden = false;
        }
    });
    $('#growth-reset').addEventListener('click', () => {
        form.reset(); $('#growth-results').hidden = true; $('#growth-validation').hidden = true; $('#growth-validation').textContent = '';
    });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#growth-hosted-notice').hidden = false;
        form.querySelectorAll('input, button, select').forEach((control) => { control.disabled = true; });
    }
}