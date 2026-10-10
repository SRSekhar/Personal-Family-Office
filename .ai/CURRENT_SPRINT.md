# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The deterministic analytics engine and offline HTML report renderer are merged into `main`. PRs #35, #36, #38, and #39 are merged; #37 was closed as superseded. PR #39 adds defensive allocation-payload validation. Main CI and full-history secret scanning passed after #39. Nine dependency license entries remain flagged for manual review; inventory metadata is not legal clearance.

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

- PR #40 hardens validation of malformed top-level report payloads; confirm CI and full-history secret scanning pass before merging.
- Keep the nine dependency-license entries flagged for manual review until actual license texts and notice obligations are checked.
- Keep project licensing and the public/private product boundary as explicit release gates; no license or visibility change is authorized.

## Next Deliverables

1. Complete PR #40 only after CI and full-history secret scanning pass; fix any failures before merging.
2. Synchronize sprint, project state, handoff, roadmap, and changelog with merged repository reality.
3. Record evidence-based dispositions for the nine flagged dependency-license entries without treating metadata as legal advice.
4. Define the application/CLI boundary before adding report-to-file host commands.
5. Establish persistence and source-of-truth requirements before implementing historical snapshot storage.
6. Continue customer discovery and validate a paid-pilot hypothesis.

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
