# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The deterministic analytics engine and offline HTML report renderer are merged into `main`. PRs #35, #36, #38–#40, #42, and #43 are merged; #37 was closed as superseded. Report validation now covers canonical timestamps, net-worth arithmetic, malformed payloads, and allocation-value/weight reconciliation. PR #43 CI and full-history secret scanning passed before merge (merge commit `8a39612d5ac1696fdb7390a9f65506c520363320`). PR #42 records first-pass upstream license evidence, and PR #45 extends the CI inventory with root-level license/notice filenames. The generated artifact found a root-level license file for all nine flagged entries; artifact-level content checks and legal disposition remain open.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest recorded scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, and XIRR calculators
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- Versioned portfolio report model and self-contained offline HTML renderer, with canonical timestamp, net-worth, malformed-payload, and allocation-reconciliation validation
- TypeScript package build, typecheck, lint, and test gates in CI
- High-severity dependency vulnerability audit in CI
- First-pass evidence review for all nine flagged dependency-license entries, with final dispositions intentionally open

## In Progress

- Review the nine dependency-license entries against actual license texts and notice obligations, preserving their manual-review status until evidence supports a disposition.
- Keep project licensing and the public/private product boundary as explicit release gates; no license or visibility change is authorized.

## Next Deliverables

1. Record evidence-based dispositions for the nine flagged dependency-license entries without treating metadata as legal advice.
2. Define the application/CLI boundary before adding report-to-file host commands.
3. Establish persistence and source-of-truth requirements before implementing historical snapshot storage.
4. Continue customer discovery and validate a paid-pilot hypothesis.

## Release-Safety Work Still Open

- Third-party dependency license and notice review
- Project licensing and public/private product-boundary decision
- Anthropic Claude for Open Source eligibility; the application remains unsubmitted
- Separate review for personal financial data and other sensitive material
- Customer discovery and paid-pilot validation
- Legal review before any hosted financial product or investment-related recommendations

## Operating Rules

- Inspect the live repository and existing implementation before making changes.
- Keep changes small, testable, independently reviewable, and aligned with documented work.
- Require relevant CI and security checks to pass before considering a merge.
- Require relevant CI and full-history secret-scanning checks to pass before merging; complete routine, low-risk PRs after those checks pass.
- Do not change repository visibility or licensing, make legal/financial determinations, or include real personal financial data.
- Treat roadmap items as planned until implementation and tests demonstrate completion.
