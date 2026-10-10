import type {
    Asset,
    Investment,
    Liability,
    Portfolio,
    Property
} from '@pfo/models';

import type { FinancialPosition } from '@pfo/calculators';

export type PortfolioPositionSource = 'asset' | 'investment' | 'property' | 'liability';

/**
 * Explicitly selects one domain record as one canonical economic position.
 *
 * canonicalId must be stable across imports and must be shared by records that
 * describe the same real-world holding. If an asset and an investment record
 * represent the same holding, select only one or assign the same canonical ID
 * so the mapper rejects the duplicate.
 */
export interface PortfolioPositionSelection {
    readonly source: PortfolioPositionSource;
    readonly sourceId: string;
    readonly canonicalId: string;
    readonly category: string;
}

const sourceName = (source: PortfolioPositionSource): string => source;

export function mapPortfolioPositions(
    portfolio: Portfolio,
    selections: readonly PortfolioPositionSelection[]
): FinancialPosition[] {
    const assetById = new Map<string, Asset>(
        portfolio.assets.map((item) => [item.id.toString(), item])
    );
    const investmentById = new Map<string, Investment>(
        portfolio.investments.map((item) => [item.id.toString(), item])
    );
    const propertyById = new Map<string, Property>(
        portfolio.properties.map((item) => [item.id.toString(), item])
    );
    const liabilityById = new Map<string, Liability>(
        portfolio.liabilities.map((item) => [item.id.toString(), item])
    );

    const selectedSources = new Set<string>();
    const canonicalIds = new Set<string>();
    const positions: FinancialPosition[] = [];

    for (const selection of selections) {
        const sourceId = selection.sourceId.trim();
        const canonicalId = selection.canonicalId.trim();
        const category = selection.category.trim();

        if (sourceId.length === 0) {
            throw new RangeError('Every portfolio position selection requires a source ID.');
        }

        if (canonicalId.length === 0) {
            throw new RangeError('Every portfolio position selection requires a canonical ID.');
        }

        if (category.length === 0) {
            throw new RangeError(`Portfolio position "${canonicalId}" requires a category.`);
        }

        const sourceKey = `${sourceName(selection.source)}:${sourceId}`;
        if (selectedSources.has(sourceKey)) {
            throw new RangeError(`Portfolio source record selected more than once: "${sourceKey}".`);
        }
        selectedSources.add(sourceKey);

        if (canonicalIds.has(canonicalId)) {
            throw new RangeError(
                `Duplicate canonical position ID "${canonicalId}"; a holding must be represented once.`
            );
        }
        canonicalIds.add(canonicalId);

        switch (selection.source) {
            case 'asset': {
                const item = assetById.get(sourceId);
                if (item === undefined) {
                    throw missingSource('asset', sourceId);
                }
                positions.push({ id: canonicalId, category, kind: 'asset', value: item.value });
                break;
            }
            case 'investment': {
                const item = investmentById.get(sourceId);
                if (item === undefined) {
                    throw missingSource('investment', sourceId);
                }
                positions.push({ id: canonicalId, category, kind: 'asset', value: item.currentValue });
                break;
            }
            case 'property': {
                const item = propertyById.get(sourceId);
                if (item === undefined) {
                    throw missingSource('property', sourceId);
                }
                positions.push({ id: canonicalId, category, kind: 'asset', value: item.marketValue });
                break;
            }
            case 'liability': {
                const item = liabilityById.get(sourceId);
                if (item === undefined) {
                    throw missingSource('liability', sourceId);
                }
                positions.push({
                    id: canonicalId,
                    category,
                    kind: 'liability',
                    value: item.outstandingAmount
                });
                break;
            }
            default: {
                const exhaustiveSource: never = selection.source;
                throw new RangeError(`Unsupported portfolio source: ${String(exhaustiveSource)}`);
            }
        }
    }

    return positions;
}

function missingSource(source: PortfolioPositionSource, sourceId: string): RangeError {
    return new RangeError(`Portfolio ${source} record not found: "${sourceId}".`);
}
