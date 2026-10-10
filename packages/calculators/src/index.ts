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

export { calculateXirr } from './Xirr.js';
export type { XirrCashFlow } from './Xirr.js';
