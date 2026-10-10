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

Planned

Features

- Retirement Calculator
- FIRE Probability
- Safe Withdrawal
- Monte Carlo Simulation
- Goal Tracking

---

# Epic 6 — Report Generator

Status

In Progress

Implemented and merged (PR #33), with follow-up hardening in PRs #36, #38–#40, and #43:
- Versioned portfolio report model
- Self-contained HTML financial summary with XSS-safe rendering
- Canonical UTC timestamp validation
- Net-worth consistency validation
- Allocation payload validation
- Allocation values reconcile to total assets and weights sum to one within floating-point tolerance

PR #40 added top-level report field validation; PR #43 added allocation reconciliation; PR #45 added root-level license/notice filename detection to the CI inventory. The generated artifact found a root-level license file for all nine flagged dependency versions; file-content and legal review remain open.

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

Planned

Features

- Principal Dashboard
- Charts
- KPIs
- Timeline
- Search
- Portfolio Explorer

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