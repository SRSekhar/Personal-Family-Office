import {
    calculateAssetAllocation,
    calculateNetWorth,
    type AssetAllocationResult,
    type NetWorthResult
} from '@pfo/calculators';
import type { Currency, Portfolio } from '@pfo/models';

import {
    mapPortfolioPositions,
    type PortfolioPositionSelection
} from './PortfolioPositionMapper.js';

export interface PortfolioAnalysisInput {
    readonly portfolio: Portfolio;
    readonly currency: Currency;
    readonly selections: readonly PortfolioPositionSelection[];
}

export interface PortfolioAnalysis {
    readonly portfolioId: string;
    readonly portfolioName: string;
    readonly currency: Currency;
    readonly positionCount: number;
    readonly netWorth: NetWorthResult;
    readonly assetAllocation: AssetAllocationResult;
}

/**
 * Produces deterministic net-worth and asset-allocation results for an
 * explicitly selected set of portfolio records. No market data, FX rates,
 * persistence, or AI-generated interpretation is involved.
 */
export function analyzePortfolio({
    portfolio,
    currency,
    selections
}: PortfolioAnalysisInput): PortfolioAnalysis {
    const positions = mapPortfolioPositions(portfolio, selections);

    return {
        portfolioId: portfolio.id.toString(),
        portfolioName: portfolio.name,
        currency,
        positionCount: positions.length,
        netWorth: calculateNetWorth({ currency, positions }),
        assetAllocation: calculateAssetAllocation({ currency, positions })
    };
}
