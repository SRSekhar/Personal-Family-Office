# Product Backlog

## Overview

This document represents the long-term product backlog for PFO OS.

Work is organized into Epics and implemented through Sprint milestones.

---

# Product Vision

Build an enterprise-grade Personal Family Office Operating System that provides financial planning, analytics, reporting and AI-assisted decision support.

---

## Future Platform Capability — Storage, Backup & Sync

Status

Planned — architecture and requirements first; no cloud provider is enabled by this item.

- Preserve local-first, offline-capable use as the default. No financial records are uploaded unless the user explicitly configures and initiates a supported remote-storage workflow.
- Evaluate Google Sheets as a possible user-owned storage/synchronization adapter, alongside alternatives such as Google Drive app data, a self-hosted API/database, and encrypted file-based backup. Select a provider only after assessing privacy, authentication, data integrity, quotas, portability, offline behavior, and recovery.
- Introduce a provider-neutral storage boundary so domain logic and deterministic financial calculations do not depend on a vendor SDK or spreadsheet layout.
- Treat remote sync as opt-in, with clear account/permission disclosure, explicit connect/disconnect and sync actions, conflict detection, schema/versioning, idempotent writes, retry limits, and visible sync status.
- Never embed OAuth client secrets or access tokens in the browser bundle or repository. Use the minimum required scopes; define token handling, revocation, and account-data deletion behavior before implementation.
- Keep local JSON export/import as a provider-independent escape hatch. Require round-trip, corruption, duplicate-write, partial-failure, conflict, and disconnect tests before calling sync production-ready.
- Do not use a public spreadsheet as a database or publish household financial data. Google Sheets is a candidate, not a final architectural decision; evaluate whether it meets the security and consistency requirements before selecting it.
- Acceptance gate: approved storage/sync ADR, threat/privacy review, data model/schema mapping, migration and recovery plan, automated integration tests, and explicit user opt-in.

## Local SQLite — Future Operational Enhancements

Status

Partially implemented; core local persistence and portable backup/recovery acceptance criteria are complete; remaining operational hardening is deferred.

- Implemented bounded automatic SQLite save retries for transient HTTP 408/429/5xx and network failures: three retries at 1s/2s/4s after the initial attempt; 4xx validation/client errors and 409 conflicts are not retried. Retry exhaustion preserves browser-local data, pauses automatic retry, and a later edit starts a fresh retry window. Manual save cancels a pending retry. CI/Chromium acceptance passed on PR #432 head `4389b2ad109f50d98474b97fc73980241b699469` (CI 1410, 80 files / 715 tests; Secret Scan 1202; packaging 740).
- Evaluate SQLite online-backup API and WAL checkpoint behavior under the actual dashboard lifecycle; document tested shutdown, reopen, and restore procedures before adding automation.
- Consider optional encrypted backup artifacts only after selecting a key-management model that does not place secrets in the browser bundle or repository.
- Consider automatic backup rotation only with an approved retention policy, safe failure behavior, and restore verification. Never silently delete the only known-good backup.
- Consider remote backup or synchronization only through a separately approved provider/security architecture, explicit user opt-in, and conflict/recovery tests. Google Sheets remains a candidate, not a selected database.

These items are not prerequisites for the completed single-user local SQLite milestone. The existing database and portable JSON exports are not encrypted by this feature.

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

- Financial Health Dashboard: consolidated local-only balance-sheet net worth, current-month recorded income/expenses/net/savings rate, explicit monthly budget overruns, and saved-goal progress; validated inputs, unavailable states, and live refresh after cash-flow/budget changes (implemented in feature/financial-health-dashboard).
- Monthly Financial Review: downloadable self-contained offline HTML report for an explicitly selected month, comparing recorded cash flow with the prior month and summarizing explicit saved-budget results, category activity, and saved-goal progress; local-only, validated, historical/descriptive, and no forecasts. Includes current-versus-prior category income and expense changes, treating categories absent from a month as zero.
- Monthly financial review validates saved goal target dates as real calendar dates, rejecting impossible dates while allowing valid leap days.

# Epic 4 — Recommendation Engine

Status

Planned — recommendation and automation capabilities remain requirements- and validation-gated.

Initial reporting capability delivered:
- Offline Portfolio Review report schema v2 includes the already-calculated balance-sheet ratios (liabilities/assets, net worth/assets, assets/liabilities) and category concentration metrics (HHI, effective category count, largest category share). Zero denominators and empty allocations remain explicitly unavailable. The report states that category concentration is not correlation-aware risk analysis; no thresholds, scoring, or recommendations are introduced.

Features

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

- FIRE Goal Gap Analysis (PR #290 merged): target-corpus funding percentage, absolute corpus surplus/shortfall, solved constant annual contribution, and additional annual contribution with a monthly arithmetic equivalent; reuses validated FIRE calculators and does not persist assumptions.
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

- Historical net-worth timeline is implemented from explicitly captured snapshots; missing dates are not interpolated. Snapshot persistence is no longer a blocker. Additional cash-flow charts remain gated on workflow requirements and customer validation.
- Portfolio explorer and additional KPIs remain gated on customer discovery.

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
- Compare category-level income and expenses for two selected recorded months, show expense differences, and export a local-only formula-safe CSV; missing categories are represented as zero and no forecast is inferred (implemented in this change).
- Add a month-over-month budget performance trend showing budgeted-category actuals, remaining amounts, utilization, count of over-budget categories, and positive overruns; never infer budgets or include unbudgeted categories in totals (implemented in feature/budget-performance-trend).
- Export the month-over-month budget performance trend to a deterministic CSV with explicit aggregate fields and local-only/storage-validation guards (implemented in feature/budget-performance-trend-export).

- Repeated budget-overrun insights are implemented in `apps/dashboard/budget-overrun-insights.js`: show categories exceeding explicit saved budgets in at least two recorded months, with over-budget month count, budgeted month count, cumulative overrun, and average overrun. Analysis uses only saved budgets and recorded expenses; unbudgeted categories are excluded. Unit tests and a Chromium browser interaction regression (PR #412) cover qualifying categories, one-month-only and unbudgeted exclusions, and the no-repeat empty state.
- In the monthly financial review, separately show recorded expense categories without an explicitly saved budget, with expense totals and transaction counts; do not infer budgets or assign thresholds (implemented in this change).
- Summarize monthly budget coverage by budgeted expense amount, unbudgeted expense amount, category counts, and the percentage of recorded expenses in categories with an explicit saved budget; show coverage as unavailable when no expenses are recorded.
- Export the validated local financial-health dashboard summary to a formula-safe CSV with metric labels, displayed values/details, reporting period, and explicit private-workspace scope; no data is sent externally (implemented in feature/financial-health-summary-export).
- Financial-health overview reports the share of recorded monthly expenses in explicitly budgeted categories, covered versus total expense-category counts, and unbudgeted expense amount; coverage is unavailable when no expenses are recorded.


# Epic 6 — Investment Portfolio Management

Status

Approved for phased implementation. Scope: full investment portfolio management with user-defined allocation targets, manual valuations, deterministic performance calculations, and optional research/data providers. Preserve every existing dashboard, report, calculator, import/export, SQLite workspace and backup workflow.

Architecture and research direction: `docs/architecture/PORTFOLIO_MANAGEMENT_RESEARCH_AND_ARCHITECTURE.md`.

### Adopted engineering patterns

- Typed, provider-neutral domain core; manual valuation works without external providers.
- Event/history-led investment ledger with derived positions and auditable corrections.
- Point-in-time provenance for all external observations; no look-ahead in historical analytics.
- Deterministic calculations first; optional AI research is advisory-only and cannot modify financial records.
- Specialist evidence reports, an explicit bull/bear challenge, risk review, citations, uncertainty, and reproducible run metadata.
- Separate research/backtesting from paper simulation; no live order execution or autonomous trading.
- Allocation targets and risk policies are user-defined; no hidden default thresholds or portfolio recommendations.

### Delivery slices

1. Domain and migration ADR; preserve schema-v4 backup compatibility.
2. Investment instruments, accounts, transactions, tax lots/cost basis, dividends, fees, and corporate-action-ready events.
3. Derived positions, manual price observations, valuation history and provenance.
4. Realised/unrealised P&L, cash-flow reconciliation, XIRR and CAGR.
5. Allocation targets, drift, exposure and explicit user risk policies.
6. Typed market-data provider contract and opt-in providers after API/security review.
7. Optional structured research workflow with evidence grounding, challenge stage, run provenance and no ledger writes.
8. Point-in-time backtesting and separately gated paper portfolio.

### License guardrail

Do not copy source wholesale. TradingAgents advertises Apache-2.0; Maybe is archived and AGPL-3.0; OpenBB and vnpy components require exact license inspection; the Microsoft URL must be narrowed to a specific repository. PFO currently has no declared open-source license. Prefer clean-room implementation of ideas and keep a source/commit/license/attribution register for any reused code.


## Investment Portfolio Management — Detailed Delivery Backlog

The following work is approved under Option B. It is a functional product epic, not a prototype. All deliverables must preserve existing financial workflows, local-first privacy, current Investment records, SQLite persistence, schema-v4 backup/restore, CSV imports/exports, and offline reports.

### IPM-01 — Investment ledger domain foundation
**Status: Delivered — PR #422 merged.**
- Typed investment accounts, instruments and immutable transactions.
- Support equities, mutual funds, ETFs, bonds, deposits, PPF, NPS, EPF, gold, silver, alternatives and other existing InvestmentType values.
- Optional symbol/exchange/ISIN; non-market products need no ticker.
- Signed cash events for purchase, sale, dividend, interest, fee and tax.
- Trade cash reconciliation, currency, identifier, date and event-sign validation.
- Acceptance: domain unit tests; legacy Investment and Portfolio constructors remain compatible; no provider or network dependency.

### IPM-02 — FIFO position and valuation projection
**Status: Implemented; PR #424 pending CI/merge.**
- Derive account/instrument positions from transaction history.
- FIFO cost basis and realised gain on partial/full sales; reject overselling.
- Record dividend/interest income and fee/tax expense separately.
- Apply only explicit valuation observations dated on or before the requested as-of date.
- Manual valuation is first-class; no valuation means market value and unrealised gain are unavailable, never zero or fabricated.
- Keep provenance (source type/name, valuation date, recorded date).
- Acceptance: deterministic FIFO fixtures, as-of date tests, missing/future valuation tests, currency and reference validation.

### IPM-03 — Portfolio workspace and migration
- Add the investment ledger to the local dashboard and SQLite snapshot without removing legacy investment records.
- Version the persistence schema and migration; transactional migration, backup-before-upgrade, rollback and reopen tests.
- Add account/instrument/transaction/valuation CRUD with confirmation for destructive edits; corrections use reversal/adjustment events, not silent history mutation.
- Preserve current schema-v4 import compatibility and all existing five workspace collections.
- Acceptance: v4-to-new-schema migration, round-trip equality, old backup restore, failure rollback, browser reload and multi-tab conflict behavior.



#### IPM-03 progress note (2026-11-01)
- In progress on PR #425: schema-v5 investment collections, transactional SQLite v4 migration, v5 backup validation with v1-v4 compatibility, browser-local persistence, and dashboard ledger entry workflows.
- Added a durable, exclusive-create schema-v4 JSON recovery artifact before the migration changes the live SQLite table; migration aborts if the backup cannot be written. Automated tests verify artifact contents/permissions and that invalid v4 data leaves the original schema and row untouched.
- Chromium coverage now exercises account/instrument/trade/manual valuation entry, browser reload, v5 JSON export/import, and SQLite save/restore equality across all nine workspace collections.
- Import preview shows investment collection counts and clarifies replacement semantics. An API-level two-client stale-write test now carries real-shaped investment account/instrument/transaction/valuation data and proves a stale valuation cannot overwrite the latest committed valuation.
- Added an isolated second-browser-context acceptance flow: both tabs start from the same persisted snapshot; the first commits a new manual valuation, and the stale second tab must show the SQLite conflict state while the committed valuation remains unchanged. This browser test is now part of the Chromium smoke suite.
- **Acceptance complete (2026-11-01):** final CI passed on commit `1b5a45eb5910f275118ede1657d8b39916fe539a`, including lint, typecheck, build, unit tests, Chromium ledger entry/reload/JSON restore/SQLite nine-collection round-trip, and isolated two-tab stale-write conflict. Secret Scan and dashboard packaging also passed. IPM-03 implementation is complete; PR #425 remains draft pending review and explicit merge approval.

### IPM-04 — Investment performance and reconciliation
- Calculate realised/unrealised P&L, open cost basis, dividends, interest, fees and taxes.
- Calculate XIRR from dated investor-perspective cash flows and CAGR only where its beginning/end-value assumptions are valid.
- Reconcile ledger cash movements, unit quantities, position cost basis and valuation snapshots.
- Show missing data, incomplete history and unsupported corporate actions explicitly.
- Acceptance: hand-calculated test cases, multi-currency rejection/no FX, negative returns, partial exits, multiple lots, fees, and no cash-flow sign ambiguity.

### IPM-05 — Allocation targets and risk policy
- Allocation targets, immutable version history, actual weights, percentage-point drift and currency-value drift are implemented in schema v7 and merged to `main` via PR #435 on 2026-11-08.
- Risk-policy implementation is a separate gated deliverable. Do not extend the allocation-policy schema by assumption or treat allocation HHI as a risk score.
- Required policy families remain concentration, liquidity, exposure and drawdown. This is a general-purpose capability for any PFO OS user, not a policy profile hard-coded for one household. Each user configures limits for the portfolio/workspace they manage; separate workspaces may have different policies. No product-wide default thresholds, inferred risk appetite, automatic orders or recommendations. An unset policy means no threshold-based alert is evaluated.
- Policy configuration must support user-authored limits and explicit scope; the product supplies validated calculations and transparent status, while the user supplies their own risk appetite. Keep the configuration independent of any one person's financial profile or sample data.
- Before implementation, approve the metric contract for each family: measurement formula, scope, currency treatment, observation/as-of rules, stale/missing-data behavior, denominator/empty states, threshold direction, breach severity and policy effective/recorded-at semantics.
- Data-readiness findings are recorded in `docs/architecture/INVESTMENT-RISK-POLICY-READINESS.md`: current instrument metadata has no liquidity classification/lock-up/maturity fields; valuation history has effective and recorded timestamps but no agreed drawdown sampling/peak/staleness rules; current HHI is descriptive only.
- Acceptance: hand-calculated deterministic cases for every approved metric; explicit zero/empty and incomplete-data states; immutable version history; reproducible as-of results; no risk alert or rebalancing observation without an active configured policy; no partial result where required inputs are missing.

### IPM-06 — Market-data provider boundary
- Define typed provider contract for instrument identity, quotes, historical bars, fundamentals and corporate actions as separate capabilities.
- Manual price entry remains available offline.
- Provider adapter must disclose source, timestamps, market timezone, delay, coverage, adjustments and licensing.
- Opt-in only, credentials in local secret storage, bounded retries/timeouts/cache and sanitized errors.
- No provider implementation until exact API docs, auth and terms are reviewed; no invented endpoints or payloads.
- Acceptance: contract tests, provider mocks, stale/missing data states, point-in-time guarantees and no outbound calls by default.

### IPM-07 — Evidence-grounded research and AI review
- Optional specialist research: fundamentals, technicals, news/macro and portfolio risk.
- Separate bullish and bearish challenge stages; final synthesis must cite evidence, dates, sources, uncertainty and conflicting evidence.
- Deterministic calculations remain authoritative; AI cannot write ledger entries, prices, targets or orders.
- Persist reproducible run inputs/configuration/model/provider versions, timestamps, evidence references, report and errors; idempotent retry/resume.
- Explicit user invocation, data minimization and provider disclosure; no household data transmission by default.
- Acceptance: synthetic fixtures, structured-output validation, prompt-injection handling, stale evidence warnings, missing-source handling and no unsupported recommendation.

### IPM-08 — Point-in-time backtesting and paper portfolio
- Reproducible historical evaluation with as-of data constraints, corporate-action handling, transaction costs, slippage, liquidity and benchmark assumptions.
- Prevent look-ahead and survivorship bias; document limitations and out-of-sample/walk-forward evaluation.
- Keep paper portfolio and simulated fills separate from real investment ledger.
- No live broker connection, order routing or autonomous trading in this scope.
- Acceptance: deterministic replay, known-answer fixtures, no future-data leakage, explicit costs, run provenance and strict paper/live separation.

### IPM-09 — Research-inspired UX and observability
- Portfolio overview, account/instrument drilldown, transaction ledger, valuation history, allocation drift and downloadable reports.
- Event timeline, data freshness, provider health, research run status and actionable validation errors.
- Responsive/accessible improvements remain secondary to correctness and complete workflows.
- Acceptance: Chromium end-to-end workflows, keyboard smoke, empty/error/loading states, report parity and no regression to existing dashboard features.

### IPM-10 — Third-party reuse and licensing
- Prefer clean-room implementation of architectural patterns.
- Before any source reuse, record exact repository, commit, files, license, notices, modifications and distribution implications.
- No AGPL source integration without an explicit licensing decision; PFO's current root license is unresolved.
- Never copy code from an organization URL without identifying the exact repository and reviewing its license.


## Investment Portfolio Management — IPM-04

Status

In Progress — FIFO portfolio projection and valuation reconciliation.

Implemented on the stacked IPM-04 branch:
- Deterministic FIFO position projection from schema-v5 investment ledger events.
- Point-in-time transaction and valuation selection using both effective and recorded timestamps.
- Per-account/instrument quantity, open cost basis, realised/unrealised gain, dividends, interest, fees, taxes and net gain.
- Currency-separated totals, explicit missing-valuation warnings, and oversell rejection. No FX conversion or inferred prices.
- Net gain is distinct from XIRR and tax-adjusted return.

Next: define investment cash-account and transfer semantics before cash reconciliation; derive portfolio XIRR only from explicit external contributions, withdrawals and terminal valuations; define snapshot correction semantics before historical persistence.


## IPM-04 Acceptance Update — FIFO Portfolio Projection

Status

Implemented on feature/investment-portfolio-reconciliation; CI and Chromium acceptance passed on commit `e8b7878245bcd1f13e71171cd3e06649ff08608c`.

- Browser portfolio view projects schema-v5 ledger events into FIFO positions by account and instrument.
- Shows open quantity/lots, cost basis, realised/unrealised gain, dividends, interest, fees, taxes and net gain.
- Applies effective-date and recorded-at cutoffs to transactions and valuations.
- Keeps currencies separate, rejects oversells/currency mismatches, and marks valuation-dependent results unavailable when a price is missing.
- Net gain is descriptive ledger arithmetic; it is not XIRR, tax-adjusted return or an investment recommendation.
- CI run `41269575836` passed all steps, including lint, typecheck, package build, unit tests and real Chromium browser smoke. Dashboard packaging/deploy run `41269575813` passed.

### IPM-04 follow-on — Cash reconciliation and portfolio XIRR

Status

Requirements/model design required before implementation. The current ledger does not represent cash-account balances, external contributions/withdrawals, or internal transfers. Do not infer them from Purchase/Sale events.

Required design and acceptance:
- Distinguish external funding/withdrawals from purchases/sales inside an investment account. A sale is not automatically a withdrawal from the investor's portfolio.
- Define cash-account identity and ownership, account-to-cash-account links, and how broker cash balances are captured/reconciled.
- Define atomic internal transfer semantics with source, destination, currency, effective date, recorded-at date, and idempotent reference; transfer pairs must net to zero at portfolio level.
- Define treatment of dividends, interest, fees, taxes, settlement timing, reversals/corrections and corporate actions without double-counting.
- Reconcile opening cash + signed ledger movements to an explicitly recorded statement/closing cash balance; report unmatched items and differences, never fabricate balancing entries.
- Portfolio XIRR must use explicit external contributions (negative), withdrawals/distributions (positive), and terminal value (positive), by currency. Internal purchases, sales and transfers must not be misclassified as investor cash flows. Missing terminal valuations make the affected result unavailable.
- Require hand-calculated fixtures for funding, withdrawal, reinvestment, partial sale, transfer, fee/tax, dividends, multiple accounts, multi-currency separation, backdated corrections and incomplete statements.
- Snapshot/history persistence requires explicit correction/version semantics and point-in-time reproducibility before implementation.


### IPM-04 cash ledger design decision

A proposed domain contract is documented in `docs/architecture/ADR_INVESTMENT_CASH_LEDGER_AND_XIRR.md`. It defines cash-account ownership, signed cash-balance movements, explicit external funding/withdrawals, atomic internal transfers, statement reconciliation, correction history and external-flow-only XIRR. Proposed additive schema-v6 collections are documented. This is a design artifact, not an implemented schema or migration; implementation remains gated on review and compatibility tests.


### IPM-04 cash-ledger engine — implementation increment

- Added a browser-compatible cash-ledger validation/projection module and deterministic unit tests on `feature/investment-cash-ledger-engine`, stacked on the cash-ledger ADR branch.
- Validates explicitly created cash accounts against their owning investment account/currency; validates opening-balance evidence, external contribution/withdrawal signs, immutable correction references, same-currency atomic transfer shape, statement periods and optional transaction-to-cash-account links.
- Reconciliation is evidence-led: requires an explicit opening balance and statement observation, applies effective-time and recorded-time cutoffs, includes linked investment transaction settlements and transfer legs once, and returns `incomplete`, `reconciled` or `difference` without auto-balancing.
- External cash-flow projection uses investor-perspective signs (opening capital and contributions negative; withdrawals positive) and excludes purchases/sales/dividends/interest/fees/taxes and internal transfers.
- This is the pure domain engine only. Schema-v6 persistence, backup migration, dashboard entry forms and full portfolio-wide XIRR/terminal-value integration remain outstanding; do not describe cash ledger as production-persisted yet.


### IPM-04 schema-v6 persistence — implementation increment

- Added schema-v6 backup validation for the four cash collections and optional cash-account links on existing investment transactions.
- Added additive transactional SQLite v5 → v6 migration. Before changing the database, it writes a portable schema-v5 JSON recovery artifact using exclusive creation, fsync and POSIX 0600 permissions. Migration preserves all existing records/IDs and adds four empty cash collections; it never infers cash accounts, opening balances or external flows.
- Preserved v1-v5 backup import compatibility. Older v5 backups normalize to empty cash collections but do not claim the cash ledger was included, so importing them does not overwrite existing cash-ledger browser data.
- Wired schema-v6 local backup/export/import and SQLite workspace payloads to four separate browser storage keys; schema-v6 restore includes them in rollback coverage.
- Added migration, recovery artifact, schema validation and compatibility tests. This remains an open stacked PR pending CI; no PR is merged.
- Remaining: verify CI, add cash-account/movement/transfer/statement UI, connect reconciliation to portfolio reporting, and complete portfolio XIRR/terminal-value completeness using the existing XIRR calculator.


### IPM-04 cash-ledger workflow UI — implementation increment

- Added private-workspace forms for explicitly creating cash sub-accounts, appending opening balances/contributions/withdrawals/corrections, recording same-currency internal transfers and appending statement observations.
- Added optional cash settlement-account linkage to new investment transactions. Existing transactions without a link remain preserved and cause reconciliation to remain incomplete rather than being guessed.
- Added a cash-account reconciliation table with incomplete/reconciled/difference states, plus append-only movement, transfer and statement histories.
- Browser storage writes use four dedicated schema-v6 keys with rollback of prior values if a multi-key save fails. The dashboard never fetches bank/broker data and never auto-creates opening balances.
- Chromium smoke coverage uses isolated synthetic fixtures to exercise opening capital + contribution + withdrawal + linked purchase against a statement closing balance.
- Portfolio-wide XIRR and terminal-value completeness remain the next accounting increment.


### IPM-04 — portfolio XIRR and terminal-value completeness increment

- Added portfolio-wide XIRR by currency using the existing shared `analyzeInvestmentPerformanceMath` / `calculateXirr` implementation; no second solver was introduced.
- Investor flows include only explicit opening balances, external contributions, external withdrawals and append-only correction adjustments. Trade settlement, dividends, interest, fees, taxes and internal transfers are excluded as internal portfolio activity.
- Terminal value is reconciled cash balances plus valued open holdings. Cash is rolled forward from the latest eligible statement using later recorded movements, transfers and linked transaction settlements.
- Any missing cash statement/opening baseline, unlinked visible transaction, statement difference, missing open-position valuation, non-positive terminal value or ambiguous XIRR pattern makes the result unavailable. No partial totals or inferred values are shown.
- Applies the same bitemporal cutoff to cash and holdings: both effective and recorded timestamps must be visible at the selected historical as-of date.
- Strengthened append-only cash accounting: exactly one explicit opening baseline per cash account; no movements, linked trades or transfers before it; corrections must reference a different non-correction event in the same account and cannot predate it.
- Demo workspace now clears private cash account selectors/history and private portfolio XIRR results when switching away from private mode.
- Added tests for multi-account transfer reconciliation, correction signs/chronology, pre-opening events, statement differences, historical backfills, complete XIRR terminal value, missing data and Chromium UI behavior. Latest CI is being verified; no merge has occurred.


### IPM-04 — historical settlement linking and bitemporal integrity

- Added a workflow to link pre-existing unlinked investment transactions to an explicit cash sub-account. The action adds only the settlement association; cash amount, units, price, effective date and original recordedAt remain unchanged.
- Added optional `cashAccountLinkedAt` to the investment transaction model and serialized validator. New linked transactions default link time to transaction recordedAt; historical links record their own timestamp.
- Reconciliation and XIRR only treat a settlement link as visible when its link timestamp is at or before the selected recorded-at cutoff. This prevents a link added today from rewriting historical knowledge.
- Demo mode now clears private investment account/instrument/transaction/valuation tables and selectors, in addition to cash-ledger history and XIRR output.
- Added model, validator, reconciliation and performance tests for link chronology and historical cutoffs. Latest CI for current head is pending; no merge has occurred.


### IPM-04 — cash-ledger and portfolio XIRR validation complete (2026-11-01)

- Added an explicit zero opening-balance baseline as a valid user-entered fact. Zero is never inferred, and zero-valued opening events are omitted from the XIRR calculator input because the shared calculator requires non-zero cash-flow amounts.
- Corrected the post-statement XIRR fixture so it exercises a valid single-sign-change flow pattern while verifying cash roll-forward.
- Expanded the dashboard Vitest project include from only `apps/dashboard/tests/**` to all `apps/dashboard/**/*.test.js`. This brings the previously excluded root-level investment-ledger, cash-ledger and budget-overrun tests into CI.
- Fixed the cash-ledger cutoff test to count all three valid opening/contribution/withdrawal flows before the requested recorded-at cutoff.
- Chromium smoke now checks the realistic one-year XIRR path, historical transaction link preserving original financial values, JSON backup round-trip, SQLite persistence/restore, reload persistence and private-to-demo data clearing.
- Latest PR #430 head: `786ded49daa9655fcc09d50da4562c4f682cb5c1`. CI run 41289104534 completed successfully; dashboard packaging run 41289104460 completed successfully (publish skipped for the PR). PR #429 CI and dashboard packaging also passed. PR #429 and #430 remain open and unmerged.
- Remaining before this investment-accounting increment is merge-ready: review stacked PR ordering and obtain explicit user merge approval. Next product backlog: cash/investment CSV import/export with explicit mapping and validation; broker integrations and FX remain out of scope until separately designed.


## Investment Portfolio Management — IPM-05 CSV interchange

Status

In progress on draft PR #432, stacked on PR #430.

- Added a versioned PFO-native CSV format for all eight investment and cash-ledger collections.
- Ordinary text remains human-readable; formula-like or reserved-prefix strings use reversible UTF-8/base64 escaping to prevent spreadsheet formula execution. Unicode, commas, quotes and multiline text round-trip; nested money values remain exact JSON cells; timestamps and IDs remain unchanged.
- Import validates the manifest, format version, canonical headers, row width, quoting, encoded text, JSON values and finite numbers. It builds and validates the entire candidate workspace before preview.
- UI supports private-workspace-only per-collection export, multi-file preview, replace-only-selected-collections or append, explicit confirmation and cancel.
- Browser persistence attempts rollback if any selected collection write fails and dispatches the existing workspace events only after successful writes. JSON backup remains authoritative.
- Unit tests cover all eight collection round trips, Unicode/formula-like text, nested money, bitemporal settlement links, invalid manifests/headers/rows, missing references and duplicate IDs. Chromium smoke now exercises export, preview, confirmed replace and duplicate-append rejection.
- External broker layouts and arbitrary column mapping are explicitly deferred; unsupported files are rejected rather than guessed. No broker sync, FX or inferred accounting events.
- Acceptance is pending CI on the current PR head.


## 2026-11-01 — SQLite persistence documentation alignment

- Audited the local backup/recovery guide and ADR-0004 against the current schema-v6 implementation.
- Corrected stale schema-v4/five-collection descriptions to the current 13-collection workspace (five core collections, four investment collections, four investment-cash collections).
- Documented WAL sidecar implications, portable JSON as the recommended live-database backup path, bounded autosave retry behavior, and the explicit absence of cross-store atomicity and automated online SQLite backup/rotation.
- This is a documentation correction only; no database behavior or backup API was changed.


## 2026-11-01 — Verified online SQLite backup

- Added a manual loopback-only online SQLite backup action using Node's built-in `sqlite.backup()`; supported runtime minimum is Node 22.16.0.
- Unique backup files are created under `<database path>.backups`; existing files are never overwritten. Artifacts pass SQLite integrity and full schema-v7 validation across all 14 collections, are fsynced, and are only then published.
- Added an online-backup restore drill across all 14 collections, checking stable identifiers, valuation provenance and integrity, plus API success/no-data/cross-origin tests.
- Scheduling, rotation, retention, encryption, remote copy and cross-store browser-storage/SQLite atomicity remain out of scope.


## 2026-11-01 — Online SQLite backup verified

- Verified on PR #432 head `59b2b60ad1efcc5e205555095710564028ebd254`: CI run 41326075282 passed (80 test files / 718 tests, lint, typecheck, build, dependency audit and real Chromium smoke); dashboard packaging run 41326075250 passed (Pages publish skipped for PR); Secret Scan run 41326075278 passed.
- Real Chromium smoke confirms the dashboard action creates a verified online SQLite backup file. Unit/API recovery tests restore the actual backup file and verify all 13 collections and stable identifiers.
- Manual backups only; scheduling, rotation, retention enforcement, encryption and remote copies remain deferred.


## Investment Portfolio Management — Allocation targets and drift

Status

Domain foundation, schema-v7 persistence and private dashboard workflows implemented on `feature/investment-allocation-targets`; CI, Secret Scan, deployment and Chromium acceptance passed 2026-11-06. PR #435 remains draft/open/unmerged.

- Added validated, immutable allocation-policy versions with a stable policy-set ID, positive version number, currency, portfolio/account scope, instrument-type/instrument grouping, effective date, recorded-at timestamp and explicit percentage targets.
- Policy target weights must total 100%; duplicate keys, invalid dates, unsupported types, unknown instruments, wrong-currency instruments/accounts and invalid scopes are rejected.
- Added bitemporal policy selection using both effective date and recorded-at cutoff. Later-recorded changes cannot rewrite earlier knowledge.
- Added deterministic actual-vs-target analysis over existing FIFO positions and eligible valuations. Reports actual market value/weight, target weight, percentage-point drift and currency-value drift.
- Holdings absent from target rows remain visible at zero target; target rows with no holdings remain visible at zero actual. Missing valuation on any open position suppresses the entire affected allocation rather than presenting partial totals.
- Added descriptive HHI, effective category count and largest-category share. No thresholds, recommendations, rebalancing instructions, trades, FX or inferred prices.
- Unit tests cover policy validation, 100% reconciliation, account scope, instrument-specific targets, policy version uniqueness, bitemporal selection, unplanned holdings, missing valuations, empty states and currency separation.
- Architecture decision: `docs/architecture/ADR-INVESTMENT-ALLOCATION-POLICY.md`.
- Persistence and private dashboard workflows are now implemented on PR #435. Schema-v7 migration, legacy backup compatibility, append-only policy creation, history and actual-vs-target analysis are covered by CI and Chromium acceptance.

### IPM — Investment allocation policy persistence and dashboard

**Status:** Allocation-policy implementation is merged to `main` via PR #435 (2026-11-08). Risk-policy metric implementation remains gated on explicit metric and data-contract decisions.

- [x] Add schema-v7 collection `investmentAllocationPolicies` to complete workspace snapshots.
- [x] Add validated immutable policy collection validation against existing account/instrument references.
- [x] Add transactional v6→v7 SQLite migration with durable schema-v6 recovery artifact; initialize policies empty without inference.
- [x] Extend schema-v7 JSON backup validation and SQLite online backup/restore coverage.
- [x] Preserve legacy v1–v6 backup compatibility without replacing allocation policies when absent.
- [x] Build private-workspace allocation policy CRUD with append-only version creation and explicit confirmation.
- [x] Add Chromium browser smoke for policy creation/versioning and compatible legacy-backup preservation.
- [x] Add Web Locks-based cross-tab append guard and storage-event refresh.
- [ ] Add explicit multi-tab conflict and failed-storage-write browser tests.
- [x] Verify latest PR CI and end-to-end migration/backup restore before marking complete (CI, Secret Scan, deployment and Chromium smoke passed on 2026-11-06).

### IPM allocation policy dashboard — implementation update

- [x] Private-workspace policy set creation and append-only version workflow with explicit confirmation.
- [x] Policy history view and bitemporal actual-vs-target drift dashboard using FIFO positions and eligible valuations.
- [x] Prevent CSV imports from orphaning policy references.
- [x] Preserve existing policy versions on legacy backup imports when incoming ledger references remain valid; reject unsafe imports before writes.
- [x] Add browser smoke coverage for policy creation and valued-position drift analysis.
- [x] Confirm latest PR CI and end-to-end browser/SQLite acceptance before marking the IPM allocation increment complete (all required checks passed on 2026-11-06).


## Latest delivery status — 2026-11-08

The investment-management dependency chain is merged to `main` in order: PRs #425, #426, #427, #428, #429, #430, #432, #435 and #436. Schema v7 is the main-branch workspace schema with 14 persisted collections. PR #437 fixed the portfolio-XIRR lint defect. PR #434 updated the pinned Claude Code Action and PR #439 refreshed the development toolchain; both were merged on 2026-11-08 after CI and Secret Scan passed. GitHub issue #431 was closed as completed after the native CSV interchange implementation in PR #432 was verified.

Delivered capabilities include the investment ledger, FIFO positions and valuation provenance, investment cash ledger and statement reconciliation, currency-separated portfolio XIRR, PFO-native validated CSV interchange, and immutable allocation target policies with bitemporal actual-vs-target drift. Risk-policy calculations are **not** implemented. The product direction is generic: every user defines their own risk limits for their own portfolio/workspace. The application must not embed one household's thresholds or infer a user's risk appetite. Liquidity, exposure and drawdown calculations remain gated on approved metric and data contracts in `docs/architecture/INVESTMENT-RISK-POLICY-READINESS.md`.

Residual operational limitations: local SQLite and exported backups are not encrypted; backups are manual and have no automated rotation/retention or remote copy. Keep real household data out of this public repository and use the loopback local dashboard for private records.
