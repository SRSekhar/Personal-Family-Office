# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The deterministic analytics engine, offline HTML report renderer, and local report CLI are merged into `main`. PRs #35, #36, #38–#40, and #42–#48, #50–#52 are merged; #37 was closed as superseded. Report validation now covers canonical timestamps with semantic HTML time elements, currency-code shape, nested monetary currency consistency, net-worth arithmetic, analysis total reconciliation, malformed payloads, and allocation-value/weight reconciliation. PR #43 CI and full-history secret scanning passed before merge (merge commit `8a39612d5ac1696fdb7390a9f65506c520363320`). PR #42 records first-pass upstream license evidence, PR #45 adds root-level license/notice filename detection, and PR #46 records the resulting evidence. CI run 38430307691 packed all nine exact npm artifacts with lifecycle scripts disabled; every tarball integrity matched `pnpm-lock.yaml`, and each contained a root-level license file with recorded byte length and SHA-256. Legal/distribution disposition remains open. Local dashboard preview is available via `pnpm dashboard:serve`; hosted deployment remains blocked until GitHub Pages is enabled once in repository Settings → Pages with Source set to GitHub Actions. PR #48 adds an operational customer-discovery playbook; demand is still unvalidated.

Dashboard follow-up completed on 2026-10-14: PR #89 makes add/edit/delete/import operations persist candidate records before changing in-memory state, so failed browser-storage writes do not appear successful; focused storage tests cover normal writes, storage exceptions, and serialization failures. PR #90 corrected the dependency evidence review's date and its statement about the inspected Lightning CSS platform tarball. PR #88 and PR #93 recorded refreshed Claude for Open Source eligibility evidence: a public search found 64 merged PRs in the last 12 months, all in the applicant-owned repository, so the 100-external-PR route is not evidenced and the application remains unsubmitted. ADR-0002 now records historical-snapshot persistence requirements and compares storage options without selecting a technology. PR #95 also hardens unreadable dashboard storage: malformed JSON, invalid records, duplicate IDs, and storage read failures now fail closed; normal edits/exports cannot overwrite or misrepresent the saved dataset, and a validated backup import is the explicit recovery path. The hosted GitHub Pages view is sample-only: private-workspace entry and backup imports are blocked on `*.github.io`; use the loopback-only local preview for sensitive records. PR #98 moved dashboard file/syntax/privacy-guard validation before Pages setup and added pull-request validation, while the one-time Pages repository setting remains a deployment blocker. CI and full-history secret scanning passed before merge.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest recorded scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, and XIRR calculators
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- Versioned portfolio report model and self-contained offline HTML renderer, with semantic timestamps, currency-code, nested-currency, net-worth, analysis-total, malformed-payload, and allocation-reconciliation validation
- Local `@pfo/cli` host with versioned portfolio-input and dashboard-backup modes, explicit valuation date for backups, currency safeguards, and safe HTML output
- TypeScript package build, typecheck, lint, and test gates in CI
- High-severity dependency vulnerability audit in CI
- First-pass evidence review and root-level license-file inventory for all nine flagged dependency-license entries, with final dispositions intentionally open
- Customer-discovery interview playbook linked from the revenue validation plan

## In Progress

- Define whether each flagged dependency is included in a distributable product or used only for development/build, then map the Blue Oak notice and MPL source-availability obligations to that boundary. Preserve manual-review status until qualified review supports a disposition.
- Complete the one-time GitHub Pages repository setup and verify the dashboard deployment.
- Keep project licensing and the public/private product boundary as explicit release gates; no license or visibility change is authorized.

## Next Deliverables

1. Confirm the intended distribution artifact, validate its actual contents against the current dependency paths, and map the Blue Oak notice/MPL source-availability obligations; do not infer legal clearance from matching license text alone.
2. Use the local dashboard-to-report flow to conduct the documented customer-discovery experiment; prioritize actual user evidence and paid-pilot commitments before adding persistence or new feature families.
3. Establish persistence and source-of-truth requirements before implementing historical snapshot storage.
4. Execute the 8–10 interview experiment in the customer-discovery playbook and validate a paid-pilot hypothesis.

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
