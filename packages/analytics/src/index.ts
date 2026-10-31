/**
 * ============================================================================
 * PFO OS
 * Personal Family Office Operating System
 * ----------------------------------------------------------------------------
 * Package: @pfo/analytics
 * Description: Public entry point for the Financial Analytics package.
 * ============================================================================
 */

export {};
export { analyzeInvestmentLedger } from './InvestmentLedgerAnalysis.js';
export type {
    InvestmentLedgerAnalysisInput,
    InvestmentLedgerPosition,
    InvestmentValuationObservation,
    InvestmentValuationSourceType
} from './InvestmentLedgerAnalysis.js';
export { analyzePortfolio } from './PortfolioAnalysis.js';
export type { PortfolioAnalysis, PortfolioAnalysisInput } from './PortfolioAnalysis.js';

export { calculateFinancialRatios } from './FinancialRatios.js';
export type { FinancialRatiosResult } from './FinancialRatios.js';

export { analyzeDiversification } from './DiversificationAnalysis.js';
export type { DiversificationAnalysisResult } from './DiversificationAnalysis.js';

export { analyzeReturnSeries } from './RiskAnalysis.js';
export type { PeriodReturn, RiskAnalysisInput, RiskAnalysisResult } from './RiskAnalysis.js';

export { analyzeCashFlow } from './CashFlowAnalysis.js';
export type {
    CashFlowAnalysis,
    CashFlowAnalysisInput,
    CashFlowCategorySummary,
    CashFlowPeriodSummary,
    CashFlowTransaction,
    CashFlowTransactionType
} from './CashFlowAnalysis.js';

export { analyzeGoalProgress } from './GoalProgressAnalysis.js';
export type { GoalProgressAnalysis, GoalProgressInput } from './GoalProgressAnalysis.js';

export { analyzeInvestmentPerformance } from './InvestmentPerformanceAnalysis.js';
export type {
    InvestmentCashFlow,
    InvestmentPerformanceAnalysis,
    InvestmentPerformanceInput
} from './InvestmentPerformanceAnalysis.js';

export { mapPortfolioPositions } from './PortfolioPositionMapper.js';
export type {
    PortfolioPositionSelection,
    PortfolioPositionSource
} from './PortfolioPositionMapper.js';
