# PFO OS Roadmap

## Vision

Build a privacy-conscious, explainable, AI-assisted Personal Family Office platform with deterministic financial calculations and repeatable reporting.

---

# Version 0.1 — Repository Foundation

**Technical status:** Complete  
**Release-readiness status:** In Progress

## Completed

- Repository and AI foundation
- Documentation and Git strategy
- Configuration-driven repository bootstrap
- CI for bootstrap, lint, typecheck, build, and tests
- WhatIf, no-overwrite, and path-safety regression checks

## Remaining Release Gates

- Keep scheduled full-history secret scanning enabled and investigate any findings.
- Complete a separate review for personal financial data and other sensitive material.
- Decide the public/private product boundary and licensing approach.
- Confirm ownership and third-party license obligations before publishing reusable components.

---

# Version 0.2 — Domain Model

**Status:** Core model types implemented; integration and validation review remain

## Implemented

- Shared currency, money, and percentage value objects.
- Asset, liability, loan, investment, property, insurance, income, expense, goal, portfolio, and financial snapshot domain models exported through `@pfo/models`.
- Explicit currency-aware calculations and validation boundaries in the existing calculators and portfolio analysis.

## Remaining

- Audit model invariants and cross-model lifecycle requirements against real user workflows.
- Avoid adding duplicate dashboard-specific models where an existing canonical domain model fits; document deliberate adapters.

---

# Version 0.3 — Analytics Engine

**Status:** In Progress

## Implemented

- CAGR
- Annual compound-growth projection with contribution timing
- XIRR for dated cash flows with ACT/365 and bisection
- Net worth totals using canonical financial positions, duplicate-ID checks, and explicit currency validation
- Asset allocation by category with deterministic output and tested weights

## Implemented beyond the initial list

- Portfolio analysis with explicit source-record mapping and currency consistency checks.
- Descriptive return-risk analysis for dated return observations, including cumulative return, volatility, drawdown, worst period, negative periods, Sharpe, and Sortino metrics where defined.
- Balance-sheet ratios with explicit denominators and interpretation limits.
- Diversification/concentration analysis, including category concentration metrics.
- Consolidated financial-health summary using validated local balance-sheet, current-month cash-flow, budget, and goal data.

## Remaining

- Validate metric definitions and usefulness with users before adding new KPIs.
- Do not turn descriptive metrics into recommendations or risk labels without reviewed requirements and appropriate legal/regulatory analysis.

---

# Version 0.4 — Report Engine

**Status:** In Progress

- Executive report
- Annual review
- Investment review
- Self-contained HTML financial summary with deterministic semantic timestamps, XSS-safe rendering, net-worth and analysis-total consistency checks, malformed-payload and currency-code guards, nested currency consistency, and allocation value/weight reconciliation
- Validated self-contained FIRE scenario HTML reports with explicit download, assumption disclosure, no scripts/remote assets, and XSS-safe scenario names (PR #142)
- Self-contained offline HTML reports now cover financial summary, FIRE scenarios/comparisons, goal progress, monthly and annual financial reviews, financial health, asset allocation, balance-sheet ratios, return-risk analysis, tax estimates, growth projection, loan amortization, CAGR, and captured historical net worth. Each report must be validated against its canonical calculator/builder and remain offline-capable.
- CSV exports remain available for supported views. PDF, DOCX, and Excel exports remain planned; define the application/CLI boundary before implementing file-export commands

---

# Version 0.5 — Dashboard

**Status:** In Progress — core local-first dashboard and FIRE planner are implemented

- Dashboard for assets, liabilities, net worth, category allocation, record CRUD, search, filtering, sorting, reset, validated CSV import/export, and versioned JSON backup/restore
- Imported custom categories are preserved when editing records (PR #176)
- Local-only FIRE planner with readiness calculation, required annual contribution, and ordered three-scenario comparison
- Explicit download of self-contained offline FIRE scenario HTML reports
- Persistent multi-goal tracker with create/edit/confirmed-delete, deadline and progress status, and an approximate monthly savings pace that assumes no investment returns (PRs #169, #175)
- Goal-aware private backup/restore with schema v2 and backward compatibility for legacy record-only schema v1 backups (PR #173)
- LOW PRIORITY / DEFERRED: manual screen-reader and real browser 400% zoom review; retain automated coverage and revisit before release if needed. Customer feedback and other release gates remain open. Automated Chromium smoke covers major calculations, keyboard activation, report downloads, offline opening for tested report types, and selected narrow-viewport behavior.
- Multi-year historical snapshots, trend chart, snapshot detail view, CSV export, and schema v4 backup/restore are implemented (PRs #304–#316). Portfolio explorer and additional KPIs remain deferred until customer needs are validated

---

# Version 0.6 — Recommendation Engine

**Status:** Planned

- Portfolio review
- Rebalancing
- Risk alerts

Any future recommendations require explicit assumptions, explainability, and appropriate legal/regulatory review.

---

# Version 0.7 — FIRE Engine

**Status:** In Progress — deterministic planning workflow implemented; user validation remains open

- Deterministic FIRE-readiness calculator foundation: projected portfolio, inflation-adjusted retirement spending, target corpus from an explicit withdrawal-rate assumption, and surplus/shortfall.
- Local-only planner UI and required annual contribution action (PR #139)
- Three-scenario comparison preserving entered order and explicit assumptions (PR #141)
- Explicit downloadable offline HTML reports for one or more scenarios (PR #142)
- LOW PRIORITY / DEFERRED: manual screen-reader and real browser 400% zoom review. Remaining: customer discovery and follow-up requirements for managing multiple goals and deciding persistence
- Monte Carlo scenarios only after a separate requirements and validation plan

The current calculator is a deterministic scenario, not a probability model or guarantee. It excludes taxes, fees, investment volatility, sequence-of-returns risk, changing contributions, pension/benefit income, and longevity adjustments. Keep assumptions visible and validated before exposing results in a user-facing planner.

---

# Version 0.8 — Automation

**Status:** Partially implemented; further scope requires user validation

## Implemented

- Validated CSV import/export for financial records and cash-flow transactions, with explicit replace/append semantics and preview/confirmation where applicable.
- Versioned JSON full-workspace backup/restore with schema compatibility, validation before writes, and rollback protections.
- Automated CI, browser smoke tests, and secret scanning.

## Planned

- Scheduled report generation (requires an explicit scheduling/runtime design; no background service is implied by the static dashboard).
- Additional importers only after source formats, mapping, privacy, and recovery behavior are defined.

---

# Version 0.9 — Release Candidate

Repository stabilization, security review, documentation, and user validation.

---

# Version 1.0 — Initial Production Release

Release only after functionality, privacy, security, licensing, support, and validation requirements are met.
