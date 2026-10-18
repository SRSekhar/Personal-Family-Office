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

Planned

Features

- Financial Entities
- Investment Model
- Asset Model
- Property Model
- Insurance Model
- Loan Model
- Goal Model

---

# Epic 3 — Analytics Engine

Status

In Progress

Implemented

- CAGR calculation with input validation and edge-case tests
- Annual compound-growth projection with explicit contribution timing and tests
- XIRR calculation for dated cash flows using ACT/365 and bisection; ambiguous multi-sign-change streams are rejected
- Net worth calculation with canonical IDs, same-currency validation, and explicit no-FX behavior
- Asset allocation by caller-supplied category with deterministic ordering and validated weights

Planned
- Risk Analysis
- Diversification
- Portfolio Health
- Financial Ratios

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

Planned

- Keyboard/accessibility and 400% zoom verification of the planner and comparison UI
- End-to-end offline report workflow validation with prospective users
- Multi-goal session management and persistence requirements, after validating the initial session-only tracker (PR #145)
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
- JSON backup import/export with validation and private-workspace safeguards
- Local CSV export with spreadsheet-formula-like text neutralization (PR #127)
- Record-type filtering (assets/liabilities) combined with search and a no-matches state (PR #128)

Implemented

- Stable record sorting by name A–Z or value ascending/descending, combined with current search and type filters (PR #130)
- CI static accessibility-contract checks for FIRE/Goal Tracker labels, validation alerts, live regions, semantic naming, and progress indicator (PR #147); interactive accessibility validation remains open

Planned

- Charts and historical timeline after snapshot requirements are validated
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