# Current Sprint

## Sprint

Sprint 3 — Report Engine

## Version

0.1.0

## Goal

Turn validated, deterministic portfolio analysis into a useful, privacy-conscious report that can be viewed offline.

## Current Status

The analytics engine is merged and passes CI. The initial report package and self-contained HTML renderer are being validated in PR #33. Do not merge until the full CI and secret-scan workflows pass.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, and XIRR calculators
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- CI-passing TypeScript package build, typecheck, lint, and tests

## In Progress

- Serializable portfolio report model
- Self-contained HTML report with responsive styling, semantic structure, and print layout
- HTML escaping for dynamic labels and names
- Tests for deterministic output, invalid data, empty allocations, and XSS safety

## Next Deliverables

1. Pass CI and full-history secret scan for PR #33; fix all failures before merge.
2. Add an export-to-file host command only after selecting the app/CLI boundary.
3. Decide the source-of-truth and persistence approach before building historical snapshot storage.
4. Review the generated inventory of 152 npm package versions; 9 license labels require manual review (7 BlueOak-1.0.0, 2 MPL-2.0). The high-severity vulnerability audit passes and remains a CI gate.
5. Resolve the open-source license and public/private product boundary before any public framework release.

## Release-Safety Work Still Open

- Dependency license and vulnerability inventory
- Product licensing and public/private boundary
- Anthropic application eligibility; the application remains unsubmitted
- Customer discovery and paid-pilot validation
- Legal review before any hosted financial product or investment-related recommendations
