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

Deferred; current local persistence and portable backup/recovery acceptance criteria are complete.

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



#### IPM-03 progress note (2026-10-31)
- In progress on PR #425: schema-v5 investment collections, transactional SQLite v4 migration, v5 backup validation with v1-v4 compatibility, browser-local persistence, and initial dashboard ledger entry forms.
- Added a durable, exclusive-create schema-v4 JSON recovery artifact before the migration changes the live SQLite table; the migration aborts if the backup cannot be written. Automated tests verify artifact contents/permissions and that invalid v4 data leaves the original schema and row untouched.
- Not accepted as complete yet. Chromium workflow coverage, new-ledger multi-tab conflict tests and final green CI remain required.

### IPM-04 — Investment performance and reconciliation
- Calculate realised/unrealised P&L, open cost basis, dividends, interest, fees and taxes.
- Calculate XIRR from dated investor-perspective cash flows and CAGR only where its beginning/end-value assumptions are valid.
- Reconcile ledger cash movements, unit quantities, position cost basis and valuation snapshots.
- Show missing data, incomplete history and unsupported corporate actions explicitly.
- Acceptance: hand-calculated test cases, multi-currency rejection/no FX, negative returns, partial exits, multiple lots, fees, and no cash-flow sign ambiguity.

### IPM-05 — Allocation targets and risk policy
- User-defined target allocation by asset class/category/instrument and optional account.
- Calculate actual weights, percentage-point drift and absolute currency drift.
- User-configured concentration, liquidity, exposure and drawdown policies; no hidden defaults.
- Rebalancing observations are explanatory, not orders; user must approve target policy.
- Acceptance: exact target reconciliation, zero/empty denominator states, target version history, and no action suggestion without configured target.

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
