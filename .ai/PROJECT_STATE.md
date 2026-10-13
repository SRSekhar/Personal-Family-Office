# Project State

## Project

- **Name:** PFO OS
- **Full Name:** Personal Family Office Operating System
- **Version:** 0.1.0
- **Status:** Active Development

## Current Milestone

**M1 — Technical Foundation**  
Status: Complete — repository bootstrap and CI are implemented and validated. Public-release safety decisions remain open.

## Current Work

- **Epic:** Report Engine / Release Safety
- **Status:** Deterministic calculators, portfolio analysis, the offline HTML report renderer, and the local report CLI are merged. Report validation now enforces malformed-payload, currency-code, nested monetary currency, net-worth, analysis-total, and allocation-reconciliation invariants, and exposes canonical timestamps through semantic HTML time elements. The first-pass evidence review for nine dependency-license flags is documented. A new CI check packed all nine exact npm versions with lifecycle scripts disabled; all tarball integrity values matched `pnpm-lock.yaml`, and each tarball contained a root-level license file with byte length and SHA-256 recorded in the evidence review. Legal/distribution dispositions remain open. The dashboard is implemented and now has a loopback-only local preview (`pnpm dashboard:serve`). Its hosted deployment remains blocked until GitHub Pages is enabled in repository Settings → Pages with Source set to GitHub Actions. A customer-discovery playbook is available; market demand remains unvalidated.

## Foundation Verified

- Repository, GitHub Flow, AI onboarding, architecture, and project documentation established.
- Configuration-driven PowerShell bootstrap merged.
- CI uses a frozen pnpm lockfile.
- CI runs initialization, validation, doctor, WhatIf/no-overwrite/path-safety tests, lint, typecheck, build, and tests.
- Pull-request CI passed for the foundation and initial analytics capabilities.

## Implemented Calculator Capabilities

- CAGR calculation with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing, input validation, overflow checks, and tests.
- XIRR for dated cash flows using ACT/365 and bisection, with date/amount validation and explicit rejection of multi-sign-change cash-flow series.

These are mathematical utilities, not investment advice or guaranteed forecasts. XIRR currently supports cash-flow streams with exactly one sign change to avoid ambiguous roots.

## Next Deliverables

1. Confirm the intended distribution artifact (source repository, compiled CLI, bundled app, or hosted product), validate the actual artifact against the current dependency paths, and map Blue Oak notice/MPL source-availability obligations; preserve unresolved status until qualified legal review.
2. Validate the dashboard-to-report workflow with prospective users and seek two paid pilot commitments before expanding scope. Define persistence/source-of-truth requirements before historical snapshot storage.
3. Decide the public/private product boundary and licensing only after ownership and redistribution obligations are reviewed; do not change repository visibility or licensing automatically.
4. Execute the customer-discovery experiment and validate a paid-pilot hypothesis before investing in paid tiers.

## Blockers and Risks

- The GitHub repository is public; do not commit real financial data or private configuration.
- The repository does not yet have a valid open-source license.
- Historical repository content and commit metadata have not been fully scanned.
- The Anthropic application draft is prepared but has not been submitted.
- No revenue, customer demand, or product-market fit has been validated.
- The nine dependency-license inventory flags passed packed-tarball integrity, root-license-file, and upstream license-text hash checks in CI. Current manifests/lockfile indicate development/build/test-only dependency paths, but the final distribution artifact and legal disposition remain outstanding.
- GitHub Pages deployment is blocked by the repository-level Pages setting; the workflow token cannot create the site automatically.

## Last Updated

2026-10-13
