# Changelog

All notable changes to PFO OS will be documented in this file.

The project follows Semantic Versioning.

---

# Unreleased

## Added

- Configuration-driven PowerShell repository initializer with initialize, validate, doctor, and WhatIf modes.
- Safe path validation for configured repository paths.
- CI workflow for frozen dependency installation, bootstrap checks, lint, typecheck, build, and tests.
- PowerShell regression tests for WhatIf non-mutation, existing-file preservation, and unsafe path rejection.
- Security policy and an initial public-repository exposure review.
- Full-history Gitleaks scanning in CI, scheduled weekly and on pull requests.
- Weekly Dependabot updates for workspace dependencies and GitHub Actions.
- GitHub Actions pinned to immutable commit SHAs in the CI workflow.
- Deterministic CAGR calculator with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing and validation.
- XIRR calculator for irregularly dated cash flows using ACT/365 and bisection, with explicit rejection of ambiguous multi-sign-change streams.
- Net-worth calculator with canonical financial position validation and no implicit currency conversion.
- Asset-allocation calculator with category aggregation, deterministic ordering, and validated weights.

## Changed

- The legacy bootstrap.ps1 entry point delegates to the configured initializer.
- Root build and typecheck commands execute workspace dependencies in the correct order.
- Vitest configuration migrated from the deprecated workspace API to the projects configuration.
- The currency test filename now uses the TypeScript test extension.
- Git ignores root local financial data and generated reports.

## Validation status

The full CI workflow passed for the bootstrap safety tests, CAGR, compound-growth projection, and XIRR. Net worth and asset allocation are under validation in PR #19. A full historical secret scan and legal/licensing review remain outstanding.

---

# [0.1.0] — Repository Foundation (In Progress)

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

- Full historical secret and sensitive-data scan
- Product-boundary and licensing decisions
- First validated user/revenue hypothesis
