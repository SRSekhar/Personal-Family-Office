# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The analytics engine and initial offline HTML report renderer are merged into `main`. PR #35 adds a third-party npm dependency license inventory and CI artifact generation; review the implementation and its nine flagged license entries before merging. Do not treat metadata inventory as legal clearance.

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

- Review PR #35 license inventory generator, tests, workflow changes, and current CI results
- Manually review seven BlueOak-1.0.0 and two MPL-2.0 metadata entries against their actual license texts and notice obligations
- Keep project licensing and the public/private product boundary as an explicit release gate

## Next Deliverables

1. Complete code review and verify CI plus full-history secret scanning for PR #35; do not merge until the required checks pass and review blockers are resolved.
2. Record the disposition of all nine flagged dependency license entries without presenting metadata as legal advice.
3. Decide the project's licensing and product boundary only after ownership and redistribution obligations are reviewed; do not change the license or repository visibility automatically.
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
- Never merge code automatically, change repository visibility or licensing, or include real personal financial data.
- Treat roadmap items as planned until implementation and tests demonstrate completion.
