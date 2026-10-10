# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The deterministic analytics engine and offline HTML report renderer are merged into `main`. PRs #35, #36, #38, and #39 are merged; #37 was closed as superseded. PR #39 adds defensive allocation-payload validation, and PR #40 adds defensive top-level report-model validation. Main CI and full-history secret scanning passed after #40 (merge commit `fd5a90f10f386cbdd63c34221d069b3f932451be`). Nine dependency license entries remain flagged for manual review; inventory metadata is not legal clearance.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest recorded scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, and XIRR calculators
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- Versioned portfolio report model and self-contained offline HTML renderer
- TypeScript package build, typecheck, lint, and test gates in CI
- High-severity dependency vulnerability audit in CI

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
