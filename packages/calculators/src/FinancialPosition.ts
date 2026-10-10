import type { Currency } from '@pfo/models';
import type { Money } from '@pfo/models';

/**
 * A canonical economic position included in a financial calculation.
 *
 * Use one stable ID per economic holding, even when source records are imported
 * from multiple providers. The calculator rejects duplicate IDs, but callers
 * must still avoid representing the same holding under different IDs.
 */
export interface FinancialPosition {
    readonly id: string;
    readonly category: string;
    readonly kind: 'asset' | 'liability';
    readonly value: Money;
}

export interface FinancialPositionContext {
    readonly currency: Currency;
    readonly positions: readonly FinancialPosition[];
}

/**
 * Validates common position invariants before any aggregation is performed.
 */
export function validateFinancialPositions({
    currency,
    positions
}: FinancialPositionContext): void {
    const seenIds = new Set<string>();

    const supportedKinds: ReadonlySet<string> = new Set(['asset', 'liability']);

    for (const position of positions) {
        const id = position.id.trim();
        const category = position.category.trim();

        if (id.length === 0) {
            throw new RangeError('Every financial position must have a non-empty ID.');
        }

        if (category.length === 0) {
            throw new RangeError(`Financial position "${id}" must have a non-empty category.`);
        }

        if (seenIds.has(id)) {
            throw new RangeError(`Duplicate financial position ID: "${id}".`);
        }

        seenIds.add(id);

        if (!Number.isFinite(position.value.amount) || position.value.amount < 0) {
            throw new RangeError(`Financial position "${id}" must have a finite, non-negative value.`);
        }

        if (position.value.currency !== currency) {
            throw new RangeError(
                `Financial position "${id}" uses ${position.value.currency}; expected ${currency}. Convert currencies explicitly before calculation.`
            );
        }

        if (!supportedKinds.has(position.kind)) {
            throw new RangeError(`Financial position "${id}" has an unsupported kind.`);
        }
    }
}
