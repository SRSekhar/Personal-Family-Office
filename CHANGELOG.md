# Changelog

All notable changes to PFO OS will be documented in this file.

The project follows Semantic Versioning.

---

# Unreleased

## Added

- Auditable flow-adjusted investment drawdown foundations: Option B chain-linked calculator, ledger-derived snapshot completeness and external-flow taxonomy, persisted daily-close calendar authoring and as-of series selection, SQLite schema v12 (19 collections), protected v11→v12 recovery, JSON/SQLite backup compatibility and private-only calendar UI. PR #453 remains open/draft; manual valuation snapshot capture, paired flow-boundary authoring, end-to-end financial acceptance and reporting/export remain outstanding. Verified implementation head passed CI #1831, Secret Scan #1625 and dashboard packaging #1067.

- User-configured investment exposure limits over weighted look-through classifications: immutable bitemporal policy versions, explicit user maximum percentages and > / >= comparators, complete-data evaluation, private-workspace authoring, SQLite schema v10, 17-collection backup/restore and v9→v10 migration with pre-migration recovery artifact (PR #452 merged 2026-11-13; CI, Chromium smoke, dashboard packaging and Secret Scan passed).
- User-defined weighted multi-group investment exposure classifications with provenance, bitemporal history and complete look-through aggregation (PR #450 merged).
- Investment exposure-classification decision ADR comparing single-group assignment and weighted multi-group look-through, and defining the data-contract decisions required before implementation (PR #449; CI and Secret Scan passed).
- Customer discovery playbook with a non-leading interview script, anonymized evidence template, privacy guardrails, and explicit paid-pilot decision thresholds.

- Configuration-driven PowerShell repository initializer with initialize, validate, doctor, and WhatIf modes.
- Safe path validation for configured repository paths.
- CI workflow for frozen dependency installation, bootstrap checks, lint, typecheck, build, and tests.
- PowerShell regression tests for WhatIf non-mutation, existing-file preservation, and unsafe path rejection.
- Security policy and an initial public-repository exposure review.
- High-severity dependency vulnerability auditing in CI; patched pnpm and test-runner dependencies, refreshed the lockfile, and confirmed the audit reports no known vulnerabilities.
- Dependency license inventory generator and CI artifact for 152 npm package versions; 9 entries remain flagged for manual review after PR #35 merged. The inventory is not a legal compatibility determination.
- Full-history Gitleaks scanning in CI, scheduled weekly and on pull requests.
- Weekly Dependabot updates for workspace dependencies and GitHub Actions.
- GitHub Actions pinned to immutable commit SHAs in the CI workflow.
- Deterministic CAGR calculator with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing and validation.
- XIRR calculator for irregularly dated cash flows using ACT/365 and bisection, with explicit rejection of ambiguous multi-sign-change streams.
- Net-worth calculator with canonical financial position validation and no implicit currency conversion.
- Asset-allocation calculator with category aggregation, deterministic ordering, and validated weights.
- Portfolio analysis composition and explicit source-record mapping (merged after CI and full-history secret scan passed).
- Versioned portfolio report model and self-contained offline HTML renderer, with canonical UTC timestamp checks, net-worth consistency validation, defensive top-level/allocation payload validation, and allocation value/weight reconciliation (PRs #33, #36, #38–#40, #43).
- First-pass upstream evidence review for all nine flagged dependency-license entries (PR #42).
- CI dependency inventory now records root-level license/notice filenames and found a root-level license file for each of the nine flagged versions (PR #45–#46); file-content review and final legal/redistribution disposition remain open.
- Serialized report currency-code validation prevents malformed values from reaching the formatter (PR #47).
- Report dates use semantic HTML time elements; nested monetary currencies and analysis allocation totals are checked before report serialization (PRs #50–#52).
- Customer discovery playbook operationalizes the existing revenue-validation experiment without claiming demand or paid-pilot commitments (PR #48).

## Changed

- The legacy bootstrap.ps1 entry point delegates to the configured initializer.
- Root build and typecheck commands execute workspace dependencies in the correct order.
- Vitest configuration migrated from the deprecated workspace API to the projects configuration.
- The currency test filename now uses the TypeScript test extension.
- Git ignores root local financial data and generated reports.

## Validation status

The full CI workflow and full-history Gitleaks scan passed on main after PR #39 (merge commit 81d39c0d7617fd1b5b51933d406f813e323dc08b). The automated dependency audit reported no known vulnerabilities at the configured high-severity threshold in that run. Nine dependency-license entries still require manual review; a separate personal-data review and project licensing/product-boundary decision remain outstanding. PR #40 merged at `fd5a90f10f386cbdd63c34221d069b3f932451be` after CI and full-history secret scanning passed. PR #43's CI and full-history secret scan passed before merge at `8a39612d5ac1696fdb7390a9f65506c520363320`.

---

# [0.1.0] — Repository Foundation (Technical foundation complete; release gates remain)

## Added

- GitHub repository
- Repository folder structure
- AI onboarding framework
- START_HERE.md
- AI Context
- AI Contract
- Project State
- Sprint Management
- Product Backlog
- Executive Decisions
- Glossary
- Prompt Library
- Initial README

## Changed

- Repository adopts GitHub Flow.
- Repository designated as the permanent source of truth.

## Remaining

- Ongoing full-history secret scan and separate personal-data review
- Product-boundary and licensing decisions
- First validated user/revenue hypothesis
