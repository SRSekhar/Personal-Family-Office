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

export { calculateRequiredFireContribution } from './RequiredFireContribution.js';
export type {
    RequiredFireContributionInput,
    RequiredFireContributionResult
} from './RequiredFireContribution.js';

export { calculateXirr } from './Xirr.js';
export { analyzeInvestmentPerformanceMath } from './InvestmentPerformanceMath.js';
export type { InvestmentPerformanceMathInput, InvestmentPerformanceMathResult } from './InvestmentPerformanceMath.js';
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

export { calculateGoalProgress } from './GoalProgress.js';
export type { GoalProgressInput, GoalProgressResult } from './GoalProgress.js';

export { calculateLoanAmortization } from './LoanAmortization.js';
export { calculateLoanAmortizationMath } from './LoanAmortizationMath.js';
export type { LoanAmortizationMathInput, LoanAmortizationMathPayment, LoanAmortizationMathResult } from './LoanAmortizationMath.js';
export type {
    LoanAmortizationInput,
    LoanAmortizationPayment,
    LoanAmortizationResult
} from './LoanAmortization.js';

export { estimateProgressiveTax } from './ProgressiveTax.js';
export { estimateProgressiveTaxMath } from './ProgressiveTaxMath.js';
export type { ProgressiveTaxMathBracket, ProgressiveTaxMathResult } from './ProgressiveTaxMath.js';
export type {
    ProgressiveTaxBracket,
    ProgressiveTaxEstimate,
    ProgressiveTaxEstimateInput
} from './ProgressiveTax.js';
