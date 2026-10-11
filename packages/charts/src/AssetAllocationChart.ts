export interface AssetAllocationChartCategory {
    readonly category: string;
    readonly value: number;
    /** Fraction of total assets, from 0 through 1. */
    readonly weight: number;
}

export interface AssetAllocationChartInput {
    readonly currency: string;
    readonly totalValue: number;
    readonly allocations: readonly AssetAllocationChartCategory[];
    readonly title?: string;
}

const SEGMENT_COLORS = [
    '#2457a7',
    '#16806a',
    '#b46a16',
    '#7a52a1',
    '#b44358',
    '#3e788c',
    '#6c7b35',
    '#6c6470'
] as const;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const WEIGHT_TOLERANCE = 0.01;

/**
 * Renders a self-contained, accessible asset-allocation chart.
 *
 * This is a presentation-only renderer: it does not calculate financial
 * values, fetch data, persist records, or load remote assets.
 */
export function renderAssetAllocationChart({
    currency,
    totalValue,
    allocations,
    title = 'Asset allocation'
}: AssetAllocationChartInput): string {
    validateInput({ currency, totalValue, allocations, title });

    const escapedTitle = escapeHtml(title);
    const currencyFormatter = (amount: number): string =>
        `${currency} ${amount.toFixed(2)}`;

    if (allocations.length === 0) {
        return `<section class="pfo-allocation-chart" aria-label="${escapedTitle}">
    <h2>${escapedTitle}</h2>
    <p>No asset allocation data is available.</p>
    <p>Total assets: <strong>${currencyFormatter(totalValue)}</strong></p>
</section>`;
    }

    let offset = 0;
    const segments = allocations.map((allocation, index) => {
        const width = allocation.weight * 100;
        const segment = `<rect class="pfo-allocation-segment" data-category="${escapeHtml(allocation.category)}" x="${offset.toFixed(4)}" y="0" width="${width.toFixed(4)}" height="16" fill="${segmentColor(index)}" />`;
        offset += width;
        return segment;
    }).join('');

    const rows = allocations.map((allocation, index) => `<tr>
    <th scope="row"><span class="pfo-allocation-swatch" aria-hidden="true" style="background-color:${segmentColor(index)}"></span>${escapeHtml(allocation.category)}</th>
    <td>${currencyFormatter(allocation.value)}</td>
    <td>${(allocation.weight * 100).toFixed(2)}%</td>
</tr>`).join('');

    return `<section class="pfo-allocation-chart" aria-label="${escapedTitle}">
    <h2>${escapedTitle}</h2>
    <p>Total assets: <strong>${currencyFormatter(totalValue)}</strong></p>
    <svg class="pfo-allocation-chart__bar" viewBox="0 0 100 16" role="img" aria-label="${escapeHtml(allocations.map((item) => `${item.category}: ${(item.weight * 100).toFixed(2)} percent`).join('; '))}" preserveAspectRatio="none">
        <title>${escapedTitle}</title>
        ${segments}
    </svg>
    <table>
        <caption>${escapedTitle} breakdown</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Value</th><th scope="col">Allocation</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
</section>`;
}

function segmentColor(index: number): string {
    return SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? SEGMENT_COLORS[0];
}

function validateInput(input: AssetAllocationChartInput): void {
    if (!CURRENCY_CODE_PATTERN.test(input.currency)) {
        throw new RangeError('currency must be a three-letter uppercase currency code.');
    }

    if (!Number.isFinite(input.totalValue) || input.totalValue < 0) {
        throw new RangeError('totalValue must be a finite, non-negative number.');
    }

    if ((input.title ?? 'Asset allocation').trim().length === 0) {
        throw new RangeError('title must not be empty.');
    }

    let totalWeight = 0;
    const categories = new Set<string>();

    for (const allocation of input.allocations) {
        if (allocation.category.trim().length === 0) {
            throw new RangeError('Allocation category must not be empty.');
        }

        if (categories.has(allocation.category)) {
            throw new RangeError(`Duplicate allocation category: ${allocation.category}.`);
        }
        categories.add(allocation.category);

        if (!Number.isFinite(allocation.value) || allocation.value < 0) {
            throw new RangeError('Allocation values must be finite, non-negative numbers.');
        }

        if (!Number.isFinite(allocation.weight) || allocation.weight < 0 || allocation.weight > 1) {
            throw new RangeError('Allocation weights must be finite fractions from 0 through 1.');
        }

        totalWeight += allocation.weight;
    }

    if (input.allocations.length > 0 && Math.abs(totalWeight - 1) > WEIGHT_TOLERANCE) {
        throw new RangeError('Allocation weights must sum to 1 within 1 percentage point.');
    }

    if (input.allocations.reduce((sum, allocation) => sum + allocation.value, 0) > input.totalValue + 0.01) {
        throw new RangeError('Allocation values must not exceed totalValue.');
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
