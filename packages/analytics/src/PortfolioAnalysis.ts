import {
    calculateAssetAllocation,
    calculateNetWorth,
    type AssetAllocationResult,
    type NetWorthResult
} from '@pfo/calculators';
import type { Currency, Portfolio } from '@pfo/models';

import {
    calculateFinancialRatios,
    type FinancialRatiosResult
} from './FinancialRatios.js';
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
    readonly financialRatios: FinancialRatiosResult;
}

/**
 * Produces deterministic net-worth, asset-allocation, and balance-sheet ratio
 * results for an explicitly selected set of portfolio records. No market data,
 * FX rates, persistence, or AI-generated interpretation is involved.
 */
export function analyzePortfolio({
    portfolio,
    currency,
    selections
}: PortfolioAnalysisInput): PortfolioAnalysis {
    const positions = mapPortfolioPositions(portfolio, selections);
    const netWorth = calculateNetWorth({ currency, positions });

    return {
        portfolioId: portfolio.id.toString(),
        portfolioName: portfolio.name,
        currency,
        positionCount: positions.length,
        netWorth,
        assetAllocation: calculateAssetAllocation({ currency, positions }),
        financialRatios: calculateFinancialRatios(netWorth)
    };
}
