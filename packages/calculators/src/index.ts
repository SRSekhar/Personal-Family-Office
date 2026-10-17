/**
 * ============================================================================
 * PFO OS
 * Personal Family Office Operating System
 * ----------------------------------------------------------------------------
 * Package: @pfo/calculators
 * Description: Public entry point for deterministic financial calculators.
 * ============================================================================
 */

export { calculateCagr } from './Cagr.js';
export type { CagrInput } from './Cagr.js';

export { projectCompoundGrowth } from './CompoundGrowth.js';
export type { CompoundGrowthInput, ContributionTiming } from './CompoundGrowth.js';

export { calculateFireReadiness } from './FireReadiness.js';
export type { FireReadinessInput, FireReadinessResult } from './FireReadiness.js';

export { compareFireReadinessScenarios } from './FireScenarioComparison.js';
export type {
    FireReadinessScenario,
    FireReadinessScenarioResult
} from './FireScenarioComparison.js';

export { calculateXirr } from './Xirr.js';
export type { XirrCashFlow } from './Xirr.js';

export { calculateNetWorth } from './NetWorth.js';
export type { NetWorthInput, NetWorthResult } from './NetWorth.js';

export { calculateAssetAllocation } from './AssetAllocation.js';
export type {
    AssetAllocationCategory,
    AssetAllocationInput,
    AssetAllocationResult
} from './AssetAllocation.js';

export type {
    FinancialPosition,
    FinancialPositionContext
} from './FinancialPosition.js';
