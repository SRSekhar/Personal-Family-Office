/**
 * ============================================================================
 * PFO OS
 * Personal Family Office Operating System
 * ----------------------------------------------------------------------------
 * Package: @pfo/reports
 * Description: Deterministic financial report models and renderers.
 * ============================================================================
 */

export {
    createPortfolioReport,
    renderPortfolioReportHtml
} from './PortfolioReport.js';

export type {
    PortfolioReportAllocation,
    PortfolioReportData,
    PortfolioReportInput
} from './PortfolioReport.js';
