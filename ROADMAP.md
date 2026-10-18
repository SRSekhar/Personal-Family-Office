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

**Status:** Planned

## Deliverables

- Financial entities
- Investment models
- Goal models
- Property models
- Insurance models
- Loan models
- Explicit currency, date, and valuation conventions

---

# Version 0.3 — Analytics Engine

**Status:** In Progress

## Implemented

- CAGR
- Annual compound-growth projection with contribution timing
- XIRR for dated cash flows with ACT/365 and bisection
- Net worth totals using canonical financial positions, duplicate-ID checks, and explicit currency validation
- Asset allocation by category with deterministic output and tested weights

## Planned


- Portfolio health
- Risk analysis
- Financial ratios

---

# Version 0.4 — Report Engine

**Status:** In Progress

- Executive report
- Annual review
- Investment review
- Self-contained HTML financial summary with deterministic semantic timestamps, XSS-safe rendering, net-worth and analysis-total consistency checks, malformed-payload and currency-code guards, nested currency consistency, and allocation value/weight reconciliation
- Validated self-contained FIRE scenario HTML reports with explicit download, assumption disclosure, no scripts/remote assets, and XSS-safe scenario names (PR #142)
- PDF, DOCX, and Excel exports remain planned; define the application/CLI boundary before implementing file-export commands

---

# Version 0.5 — Dashboard

**Status:** In Progress — core local-first dashboard and FIRE planner are implemented

- Dashboard for assets, liabilities, net worth, category allocation, record CRUD, search, filtering, sorting, reset, and CSV/JSON export
- Local-only FIRE planner with readiness calculation, required annual contribution, and ordered three-scenario comparison
- Explicit download of self-contained offline FIRE scenario HTML reports
- Session-only Goal Tracker for one target, with validated progress and completion/overdue state (PR #145)
- Remaining: interactive browser verification, accessibility/400% zoom validation, and customer feedback
- Charts, historical timelines, portfolio explorer, and additional KPIs remain deferred until snapshot requirements and customer needs are validated

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
- Remaining: keyboard/accessibility and 400% zoom verification, customer discovery, and follow-up requirements for managing multiple goals and deciding persistence
- Monte Carlo scenarios only after a separate requirements and validation plan

The current calculator is a deterministic scenario, not a probability model or guarantee. It excludes taxes, fees, investment volatility, sequence-of-returns risk, changing contributions, pension/benefit income, and longevity adjustments. Keep assumptions visible and validated before exposing results in a user-facing planner.

---

# Version 0.8 — Automation

**Status:** Planned

- Scheduled reports
- Data validation
- Importers

---

# Version 0.9 — Release Candidate

Repository stabilization, security review, documentation, and user validation.

---

# Version 1.0 — Initial Production Release

Release only after functionality, privacy, security, licensing, support, and validation requirements are met.
