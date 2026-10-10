# Current Sprint

## Sprint

Sprint 3 — Report Engine

## Version

0.1.0

## Goal

Turn validated, deterministic portfolio analysis into a useful, privacy-conscious report that can be viewed offline.

## Current Status

The analytics engine and initial versioned, self-contained HTML report are merged into `main`. PR #36 hardens serialized report timestamp validation; its CI and full-history secret scan passed on 2026-10-10, but the PR remains open and unmerged. PR #35 adds a dependency-license metadata inventory; its CI and full-history secret scan also passed, while manual review of flagged entries remains outstanding. That release-readiness review does not block continued report-engine development.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest recorded scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, and XIRR calculators
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- Versioned portfolio report model and self-contained offline HTML renderer
- Responsive layout, semantic report structure, print styling, and HTML escaping
- CI quality gates for install, vulnerability audit, bootstrap safety, lint, typecheck, build, and tests

## In Progress

- PR #36: canonical ISO-8601 UTC timestamp validation for serialized report data; CI and full-history secret scan passed, awaiting review
- PR #35: dependency license metadata inventory; CI and full-history secret scan passed, with manual review still required for flagged entries

## Next Deliverables

1. Add regression-tested validation that serialized report net worth equals total assets minus total liabilities.
2. Define the application/CLI boundary before adding an export-to-file host command.
3. Decide the source-of-truth and persistence approach before building historical snapshot storage.
4. Keep PRs #35 and #36 open until reviewed; do not merge automatically.

## Separate Release-Safety Gates

- Review dependency license texts and notice obligations; the inventory is metadata, not legal clearance.
- Resolve project licensing and the public/private product boundary before any public framework release.
- Complete a separate review for personal financial data and other sensitive material.
- Anthropic Claude for Open Source application eligibility remains unverified and the application remains unsubmitted.
- Validate customer demand and a paid-pilot hypothesis before investing in paid tiers.
- Obtain appropriate legal review before any hosted financial product or investment-related recommendations.
