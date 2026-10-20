import { estimateProgressiveTaxMath } from './calculators-runtime/ProgressiveTaxMath.js';
import { isPrivateWorkspaceAllowed } from './workspace-security.js';

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

function createBracketRow({ upperBound = '', rate = '', final = false } = {}) {
    const row = document.createElement('div'); row.className = 'tax-bracket-row'; row.dataset.final = String(final);
    const boundLabel = document.createElement('label'); boundLabel.className = 'field-label'; boundLabel.textContent = final ? 'Upper bound' : 'Income through (₹)';
    const bound = document.createElement('input'); bound.className = 'tax-bracket-bound'; bound.setAttribute('aria-label', final ? 'Final bracket upper bound' : 'Bracket upper bound in rupees');
    if (final) { bound.type = 'text'; bound.value = 'No upper limit'; bound.readOnly = true; bound.setAttribute('aria-describedby', 'tax-bracket-note'); }
    else { bound.type = 'number'; bound.min = '0.01'; bound.step = 'any'; bound.required = true; bound.value = String(upperBound); }
    boundLabel.append(bound);
    const rateLabel = document.createElement('label'); rateLabel.className = 'field-label'; rateLabel.textContent = 'Marginal rate (%)';
    const rateInput = document.createElement('input'); rateInput.className = 'tax-bracket-rate'; rateInput.type = 'number'; rateInput.min = '0'; rateInput.max = '100'; rateInput.step = 'any'; rateInput.required = true; rateInput.value = String(rate); rateInput.setAttribute('aria-label', 'Marginal tax rate percent'); rateLabel.append(rateInput);
    row.append(boundLabel, rateLabel);
    if (!final) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-secondary button-small tax-remove-bracket'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove tax bracket'); remove.addEventListener('click', () => row.remove()); row.append(remove); }
    else { const note = document.createElement('span'); note.id = 'tax-bracket-note'; note.className = 'tax-final-bracket-note'; note.textContent = 'Final bracket'; row.append(note); }
    return row;
}

function renderTaxResult(result) {
    $('#tax-estimate-results').hidden = false;
    $('#tax-estimated-tax').textContent = money(result.estimatedTax);
    $('#tax-after-income').textContent = money(result.afterTaxIncome);
    $('#tax-effective-rate').textContent = result.effectiveTaxRate === null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(result.effectiveTaxRate) + '%';
    $('#tax-marginal-rate').textContent = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(result.marginalRatePercent) + '%';
}

export function initializeTaxEstimator() {
    const form = $('#tax-estimator-form'); if (!form) return;
    const rows = $('#tax-brackets'); rows.append(createBracketRow({ final: true }));
    $('#tax-add-bracket').addEventListener('click', () => { const row = createBracketRow(); rows.insertBefore(row, rows.lastElementChild); row.querySelector('.tax-bracket-bound').focus(); });
    $('#tax-reset').addEventListener('click', () => { form.reset(); rows.replaceChildren(createBracketRow({ final: true })); $('#tax-estimate-results').hidden = true; $('#tax-validation').hidden = true; $('#tax-validation').textContent = ''; });
    if (!isPrivateWorkspaceAllowed(window.location.hostname)) {
        $('#tax-hosted-notice').hidden = false;
        form.querySelectorAll('input, button').forEach((control) => { control.disabled = true; });
        $('#tax-add-bracket').disabled = true;
        return;
    }
    form.addEventListener('submit', (event) => {
        event.preventDefault(); $('#tax-validation').hidden = true;
        try {
            const taxableIncome = Number($('#taxable-income').value);
            const bracketRows = [...rows.querySelectorAll('.tax-bracket-row')];
            if (bracketRows.length === 0) throw new RangeError('Add at least one tax bracket.');
            const brackets = bracketRows.map((row, index) => {
                const rateValue = row.querySelector('.tax-bracket-rate').value;
                if (rateValue.trim() === '') throw new RangeError('Enter a marginal rate for every bracket.');
                const final = index === bracketRows.length - 1;
                if (final !== (row.dataset.final === 'true')) throw new RangeError('Only the last tax bracket can have no upper limit.');
                if (final) return { upperBound: null, marginalRatePercent: Number(rateValue) };
                const boundValue = row.querySelector('.tax-bracket-bound').value;
                if (boundValue.trim() === '') throw new RangeError('Enter an upper bound for every non-final bracket.');
                return { upperBound: Number(boundValue), marginalRatePercent: Number(rateValue) };
            });
            renderTaxResult(estimateProgressiveTaxMath(taxableIncome, brackets));
        } catch (error) {
            $('#tax-estimate-results').hidden = true;
            $('#tax-validation').textContent = error instanceof Error ? error.message : 'Could not calculate the tax estimate.';
            $('#tax-validation').hidden = false;
        }
    });
}