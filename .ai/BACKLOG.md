# Product Backlog

## Overview

This document represents the long-term product backlog for PFO OS.

Work is organized into Epics and implemented through Sprint milestones.

---

# Product Vision

Build an enterprise-grade Personal Family Office Operating System that provides financial planning, analytics, reporting and AI-assisted decision support.

---

# Epic 1 — Platform Foundation

Status

In Progress

Features

- Repository Foundation
- AI Onboarding
- Documentation
- Bootstrap Script
- Configuration
- Governance

---

# Epic 2 — Domain Model

Status

In Progress

Features

- Financial Entities
- Investment Model
- Asset Model
- Property Model
- Insurance Model
- Loan Model
- Goal Model
- Financial snapshot invariants: valid capture date, same-currency non-negative asset/liability totals, and reconciled net worth (PR #223; no history/persistence changes)
- Loan domain model as a specialized Liability, with principal, interest rate, monthly payment, origination/maturity dates, optional lender, and validated terms (PR #224)

---

# Epic 3 — Analytics Engine

Status

In Progress

Implemented

- Return-series analysis now reports the compounded cumulative return across supplied observations, with null for empty series and a dedicated UI/CSV metric.
- CAGR calculation with input validation and edge-case tests
- Annual compound-growth projection with explicit contribution timing and tests
- XIRR calculation for dated cash flows using ACT/365 and bisection; ambiguous multi-sign-change streams are rejected
- Net worth calculation with canonical IDs, same-currency validation, and explicit no-FX behavior
- Asset allocation by caller-supplied category with deterministic ordering and validated weights
- Investment performance analysis using explicit investor-perspective dated cash flows, XIRR, gross contributions/proceeds, net gain, and simple net return on contributions (PR #222); no inferred terminal valuation
- Loan amortization calculator using explicit monthly-rate/payment timing, final-payment cap, UTC month-end handling, and remaining-balance reporting (PR #225)
- Caller-defined progressive tax estimator using ordered marginal brackets and explicit currency; no hard-coded jurisdiction rates, deductions, or credits (PR #226).
- Local dashboard tax estimator UI using caller-defined brackets and shared progressive tax math; no jurisdiction defaults (PR #227).
- Local dashboard loan amortization calculator using shared calculation math, a monthly schedule preview, and full CSV export; no saved loan data or inferred terms (PR #228).
- Local dashboard investment performance calculator using explicit dated investor-perspective cash flows and shared XIRR/performance math; no inferred terminal valuation (PR #229).
- Local investment-performance calculator supports validated date-and-amount CSV import, a preview of contributions and proceeds, and confirmation before replacing entered cash flows.
- Investment-performance calculator offers a separate re-importable `date,amount` cash-flow CSV export alongside the human-readable performance summary export.
- Local compound-growth projection calculator using explicit annual return, contribution amount, contribution timing, and period assumptions; no forecasts or guarantees (PR #230).
- Year-by-year compound-growth schedule with explicit annual contribution timing and full CSV export, limited to 100 annual periods (PR #232).
- Local CSV export of caller-defined tax estimates and exact supplied bracket assumptions, with stale-result invalidation (PR #233).
- Local CSV export of investment-performance summary and exact dated cash-flow inputs, with stale-result invalidation (PR #234).
- Local CSV export of CAGR inputs and calculated annualized rate, with stale-result invalidation (PR #235).
- Local CSV export of saved-goal progress in the private workspace, with formula-safe goal names and no new persistence (PR #236).
- Print-ready financial summary with a browser Print / Save as PDF action; retain the self-contained offline HTML report as the source artifact (PR #237).
- Chromium regression stubs the popup's print method and asserts the print workflow actually invokes it (PR #238).
- Monthly cash-flow trend table grouped from existing dated transactions; no separate snapshot persistence or forecasts (PR #239).
- Monthly cash-flow trend shows each month's savings rate as net divided by income, with an unavailable marker for months with zero income; the monthly CSV export includes the same metric.
- Local CSV export of monthly cash-flow trend totals and transaction counts (PR #240).
- Annual cash-flow trend table grouped from saved transaction dates, with income, expenses, net, savings rate, transaction count, and an explicit empty state; historical only, no forecasts (delivered in PR #271).
- Annual category breakdown for a selected recorded year, including income, expenses, expense share, net, transaction count, and local-only CSV export.
- Monthly category breakdown for an explicitly selected recorded month, independent of transaction-list filters, with expense share, historical-only wording, and guarded local CSV export (implemented in this change).
- Compare two explicitly selected months of recorded cash flow by income, expenses, net, savings rate, and transaction count, with difference calculations, zero-income handling, and local-only CSV export (implemented in PR for monthly comparison).
- Annual cash-flow comparison includes category-level income and expense totals for both selected years, expense differences, and category rows in the local-only CSV export (implemented in this change).
- Local CSV export of the selected-period cash-flow category breakdown, including income, expenses, net, and transaction counts; formula-like category text is neutralized.
- Selected-period cash-flow category table shows each category's share of total recorded expenses, with an explicit unavailable state when the period has no expenses.
- Selected-period cash-flow category CSV export includes the same expense-share metric as the dashboard table, using an empty field when total expenses are zero.
- Local cash-flow CSV import using the exact exported transaction schema, strict row/date/type/amount validation, a replacement preview, and explicit confirmation; quoted commas and escaped quotes are supported.
- Local CAGR calculator using explicit beginning/ending values and period, distinct from dated cash-flow XIRR (PR #231)
- Deterministic cash-flow analysis from explicit dated transactions, including totals, savings rate, monthly trends, and category breakdown (PR #220); no forecasts or inferred recurring schedules
- Goal progress analysis using explicit current amount and reference date, with target percentage, remaining amount, UTC calendar-day deadline status, and no contribution or return assumptions (PR #221)
- Balance-sheet ratios (liabilities/assets, net worth/assets, assets/liabilities), with explicit zero-denominator handling and net-worth reconciliation (PR #214).
- Dashboard overview surfaces those three balance-sheet ratios using shared analytics, explicit ratio denominators, and unavailable states for zero denominators; no benchmarks or recommendations.
- Local CSV export for liabilities/assets, net worth/assets, and assets/liabilities, including numerator, denominator, and explicit zero-denominator status; local-only and formula-safe.
- Local asset-allocation CSV export with category values and shares plus HHI, effective category count, largest-category share, and total assets; local-workspace only, with formula-safe category text.
In Progress

- Category concentration metrics using HHI, effective category count, and largest-category share, without inferring correlations or risk (PR #215); dashboard summary implemented in PR #243.

Planned
In Progress

- Return-series risk analysis with explicit annualization frequency, sample volatility, maximum drawdown, worst-period return, negative-period count, and input validation (PR #216).
- Optional annualized Sharpe ratio using a caller-supplied risk-free return per period; no implicit risk-free-rate assumption (PR #217).
- Optional annualized Sortino ratio using a caller-supplied minimum acceptable return per period; no implicit target assumption (PR #218).
- Local return-series risk analysis UI using explicit dated period returns and annualization frequency; optional Sharpe/Sortino inputs, stale-result invalidation, metrics CSV export, and a separate re-importable observations CSV export; no market-data fetching or recommendation. Compounded cumulative return is included in the results and metrics CSV.

Planned
- Portfolio Health — define required metrics and intended interpretation before implementation; do not invent a composite score or thresholds.

---

# Epic 4 — Recommendation Engine

Status

Planned

Features

- Portfolio Review
- Investment Suggestions
- Risk Alerts
- Rebalancing
- Opportunity Analysis

---

# Epic 5 — FIRE Engine

Status

In Progress

Implemented

- Deterministic FIRE readiness scenario with explicit nominal return, inflation, retirement-spending, withdrawal-rate, and contribution-timing assumptions (PR #110)
- Deterministic scenario comparison that preserves each scenario's assumptions and caller-supplied order without ranking/recommendations (PR #113)
- Required annual contribution solver with validated zero-year and zero/negative-return edge cases (PR #114)
- Local-only dashboard FIRE planner with ephemeral assumptions/results and hosted-origin controls disabled (PR #139)
- Three-scenario comparison UI with explicit assumption copying, per-scenario inputs, ordered results, and no ranking/recommendation (PR #141)
- Validated, self-contained offline HTML report export for a single scenario or comparison, with XSS escaping and no network submission (PR #142)
- Persistent multi-goal tracker with edit/delete confirmation, goal-aware version 2 backups, legacy version 1 compatibility, and an approximate no-returns monthly savings pace (PRs #169, #173, #175)
- Local income/expense ledger with month summaries, recurring flags, edit/delete, dedicated JSON backup/restore, and formula-safe CSV export (PR #200).
- Cash-flow category breakdown for the selected period with income, expenses, and net by category (PR #201).
- Separate summary of explicitly recurring-tagged transactions for the selected period, with income, expenses, net, and count; descriptive only, not a forecast, with a dedicated formula-safe CSV export of the recorded entries.
- Recurring-tagged cash-flow breakdown by category for the selected period, with income, expenses, share of recurring expenses, net, count, and guarded local CSV export (implemented in this change).
- Cash-flow transaction search, type filtering, visible-result counts, and reset controls (PR #202).
- Cash-flow filtered CSV and full-ledger CSV export actions (PR #205).
- Deterministic transaction sorting by date, amount, and category; filtered CSV follows the selected sort (PR #206).
- Dynamic category filtering combined with period, type, frequency, search, and sort controls (PR #207).
- Duplicate a cash-flow transaction into a new unsaved form, requiring explicit confirmation via the normal Save action (PR #208).
- Category breakdown shows transaction counts alongside income, expenses, and net (PR #209).
- Selected-period savings-rate KPI calculated as net cash flow divided by income; unavailable when income is zero (PR #203).
- Transaction frequency filter for recurring vs one-time cash-flow entries (PR #204).
- Cash-flow backup import preview with transaction count and totals before replacement, including cancel-safe restore (PR #210).
- Inclusive from/to date filters for cash-flow transactions; filtered CSV follows the date range (PR #211).
- Filter-aware cash-flow totals for the exact visible transaction set, including income, expenses, net, and savings rate; sorting does not change totals.
- Cash-flow delete confirmation includes description, date, type, and amount (implementation commit a7a821a); PR #213 adds a browser regression proving cancellation preserves the transaction and totals.
- Filtered CSV and full-ledger CSV exports are separate and have browser regression coverage (PR #205).
- Saved-goal deletion cancellation preserves the goal and persisted progress, covered by a real Chromium reload regression (PR #189)

Implemented

- Keyboard-only FIRE workflow regression for readiness calculation, scenario comparison, and single/comparison report downloads, including focus continuity checks (PR #192). This covers the tested actions only; actual 400% browser zoom and broader assistive-technology validation remain open.

Planned

- Manual assistive-technology and actual 400% browser-zoom verification of the planner and comparison UI (automated keyboard workflows, narrow comparison keyboard operation, and 320 CSS-pixel reflow regressions now exist; they do not replace manual validation)
- End-to-end offline report workflow validation with prospective users
- Safe-withdrawal research and explicit assumption handling; the current withdrawal-rate input is not a guarantee of safety
- FIRE probability / Monte Carlo analysis, only after a separate requirements and validation plan

---

# Epic 6 — Report Generator

Status

In Progress

Implemented and merged (PR #33), with follow-up hardening in PRs #36, #38–#40, #43, #47, #50, #51, and #52. PR #142 also adds a validated offline HTML report for FIRE scenarios:
- Versioned portfolio report model
- Self-contained HTML financial summary with XSS-safe rendering
- Canonical UTC timestamp validation
- Net-worth consistency validation
- Allocation payload validation
- Allocation values reconcile to total assets and weights sum to one within floating-point tolerance

PR #40 added top-level report field validation; PR #43 added allocation reconciliation; PR #47 validates serialized currency-code shape; PR #50 adds semantic timestamp elements; PR #51 validates nested monetary currencies; PR #52 reconciles allocation totals with net-worth assets. PR #45 adds root-level license/notice filename detection. The generated artifact found a root-level license file for all nine flagged dependency versions; file-content and legal review remain open. PR #48 adds a customer-discovery playbook to operationalize the existing revenue-validation plan.

Features

- Executive Report
- Annual Review
- Investment Report
- Net Worth Statement
- PDF
- DOCX
- Excel

---

# Epic 7 — Dashboard

Status

In Progress

Implemented

- Local-first dashboard for assets, liabilities, net worth, category allocation, record search, and CRUD
- Versioned JSON backup import/export with validation and private-workspace safeguards; private schema v2 includes saved goals while schema v1 remains compatible (PR #173)
- Local CSV import/export with strict row/currency validation, spreadsheet-formula-like text neutralization, and custom-category preservation (PRs #127, #174, #176)
- Record-type filtering (assets/liabilities) combined with search and a no-matches state (PR #128)
- Persistent multi-goal tracker with edit/delete confirmation and approximate monthly savings pace without assumed returns (PRs #169, #175)

Implemented

- Stable record sorting by name A–Z or value ascending/descending, combined with current search and type filters (PR #130)
- CI static accessibility-contract checks for FIRE/Goal Tracker labels, validation alerts, live regions, semantic naming, and progress indicator (PR #147), plus accurate percentage-of-target accessible wording (PR #149); interactive accessibility validation remains open
- FIRE planner correctness: clear stale required-contribution output when shared assumptions change, with a real-browser regression test (PR #183)
- FIRE planner correctness: invalidate stale comparison-report snapshots when comparison-specific assumptions change, with a real-browser regression test (PR #186)

Planned

- Cash-flow charts and net-worth historical timeline remain gated on the snapshot-persistence ADR decision and requirements validation.
- Portfolio explorer and additional KPIs after customer discovery

---

# Epic 8 — AI

Status

Planned

Features

- AI Advisor
- Prompt Library
- Annual Review
- Portfolio Assistant
- Investment Committee
- Ollama/Gemma model-provider integration: introduce a small, model-agnostic provider boundary and evaluate Ollama's `gemma4:31b-cloud` for opt-in AI assistance. Keep deterministic calculators and validated domain data as the source of truth; AI may explain results but must not invent balances, holdings, market data, or financial calculations.
- Privacy and operational contract for AI: default to no AI/network calls until explicitly invoked; never transmit household financial records by default; require explicit user selection and data minimization before any cloud request; keep API keys in environment/local secret storage and out of Git, browser bundles, logs, reports, and prompts where not needed. Document cloud data handling, cost/usage limits, timeouts, retries, structured-output validation, and behavior when the provider is unavailable.
- Provider verification: confirm the exact model identifier, API contract, authentication method, cost/usage behavior, and data handling against current official Ollama documentation before implementation. Test with synthetic fixtures and mocked provider responses; no live household data or secrets in tests.

---

# Epic 9 — Automation

Status

Planned

Features

- Repository Bootstrap
- Data Importers
- Data Validation
- Scheduled Reports
- Health Checks

---

# Future Backlog

Future enhancements are added here and prioritized during sprint planning.

No work should begin unless it has been added to the backlog.
- Add a recurring-only cash-flow CSV export for the selected reporting period, retaining the standard transaction schema and spreadsheet formula neutralization (delivered in PR #264).
- Warn before cash-flow CSV replacement or append when exact duplicate transactions occur within the selected file; preserve explicit user confirmation and do not silently drop rows (implemented in this change).
- Improve cash-flow CSV import confirmation with imported income/expense counts and the date range, alongside post-import totals, before any data is replaced or appended (implemented in this change).
- Add a separate re-importable `date,return_percent` CSV export for the validated return observations used in the risk analysis, invalidated with stale results (delivered in PR #266).
- Add an all-period category budget history CSV export, including budgeted categories and expense-only categories, with deterministic month/category ordering and formula-safe text (delivered in PR #265).
- Show expandable budget history in the dashboard, including explicit no-budget states, actual expenses, utilization, remaining amounts, and status; reuse the CSV aggregation and guard against invalid private storage. Year and category filters with a visible row count are included in the follow-up. Status filtering for over-budget, within-budget, not-spent, and no-budget rows is also included.
- Show the selected month's count of over-budget categories and total positive category overruns; do not offset overruns with categories under budget.
- Add an annual cash-flow summary CSV grouped by transaction year with income, expenses, net, savings rate, transaction count, deterministic ordering, and local-only export (delivered in PR #270).







- Filter cash-flow transactions and filtered exports by an optional minimum and maximum amount; validate invalid or reversed ranges and reset both filters with the existing view controls (implemented in this change).
- Compare two recorded cash-flow years side by side for income, expenses, net cash flow, savings rate, and transaction counts; show absolute differences and savings-rate percentage-point changes, with a local-only CSV export (implemented in this change).
- Add a month-over-month budget performance trend showing budgeted-category actuals, remaining amounts, utilization, count of over-budget categories, and positive overruns; never infer budgets or include unbudgeted categories in totals (implemented in feature/budget-performance-trend).
- Export the month-over-month budget performance trend to a deterministic CSV with explicit aggregate fields and local-only/storage-validation guards (implemented in feature/budget-performance-trend-export).
