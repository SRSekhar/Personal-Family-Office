# Current Sprint

## Sprint

Sprint 3 — Report Engine / Release Safety

## Version

0.1.0

## Goal

Maintain deterministic, testable portfolio analysis and privacy-conscious offline reporting while closing security, licensing, and release-readiness gaps.

## Current Status

The deterministic analytics engine, offline HTML report renderer, and local report CLI are merged into `main`. PRs #35, #36, #38–#40, and #42–#48, #50–#52 are merged; #37 was closed as superseded. Report validation covers canonical timestamps with semantic HTML time elements, currency-code shape, nested monetary currency consistency, net-worth arithmetic, analysis total reconciliation, malformed payloads, and allocation-value/weight reconciliation. PR #43 CI and full-history secret scanning passed before merge (merge commit `8a39612d5ac1696fdb7390a9f65506c520363320`). PR #42 records first-pass upstream license evidence, PR #45 adds root-level license/notice filename detection, and PR #46 records the resulting evidence. CI run 38430307691 packed all nine exact npm artifacts with lifecycle scripts disabled; every tarball integrity matched `pnpm-lock.yaml`, and each contained a root-level license file with recorded byte length and SHA-256. Legal/distribution disposition remains open. Local dashboard preview is available via `pnpm dashboard:serve`; hosted deployment remains blocked until GitHub Pages is enabled once in repository Settings → Pages with Source set to GitHub Actions. PR #48 adds an operational customer-discovery playbook; demand is still unvalidated.

Dashboard follow-up completed on 2026-10-14: PR #89 makes add/edit/delete/import operations persist candidate records before changing in-memory state, so failed browser-storage writes do not appear successful; focused storage tests cover normal writes, storage exceptions, and serialization failures. PR #90 corrected the dependency evidence review's date and its statement about the inspected Lightning CSS platform tarball. PR #88 and PR #93 recorded refreshed Claude for Open Source eligibility evidence: a public search found 64 merged PRs in the last 12 months, all in the applicant-owned repository, so the 100-external-PR route is not evidenced and the application remains unsubmitted. ADR-0002 now records historical-snapshot persistence requirements and compares storage options without selecting a technology. PR #95 also hardens unreadable dashboard storage: malformed JSON, invalid records, duplicate IDs, and storage read failures now fail closed; normal edits/exports cannot overwrite or misrepresent the saved dataset, and a validated backup import is the explicit recovery path. The dashboard private workspace is restricted to loopback hostnames (`localhost`, `127.0.0.1`, IPv6 loopback); all other origins are sample-only. PR #104 adds a tested host-allowlist helper so future custom domains or hosted environments cannot accidentally enable personal-record entry/import. PR #98 moved dashboard file/syntax/privacy-guard validation before Pages setup and added pull-request validation, while the one-time Pages repository setting remains a deployment blocker. CI and full-history secret scanning passed before merge. PR #100 includes the dashboard storage and backup test directory in root Vitest; after correcting an invalid test fixture, CI passed 185 tests across 27 files. PR #102 adds explicit confirmation before a backup replaces existing private records and a separate confirmation for recovery from unreadable storage.

## Completed

- Repository foundation, bootstrap, and CI quality gates
- Scheduled full-history Gitleaks scanning; latest recorded scans passed without findings
- Dependabot workspace and GitHub Actions updates
- CAGR, annual compound-growth projection, XIRR, deterministic FIRE readiness, ordered scenario comparison, and required annual contribution solver (the planner UI and any probabilistic analysis remain unfinished)
- Net-worth and asset-allocation calculators with explicit currency and canonical-ID rules
- Portfolio mapping and analysis composition with duplicate-selection protection
- Versioned portfolio report model and self-contained offline HTML renderer, with semantic timestamps, currency-code, nested-currency, net-worth, analysis-total, malformed-payload, and allocation-reconciliation validation
- Local `@pfo/cli` host with versioned portfolio-input and dashboard-backup modes, explicit valuation date for backups, currency safeguards, and safe HTML output
- TypeScript package build, typecheck, lint, and test gates in CI
- High-severity dependency vulnerability audit in CI
- First-pass evidence review and root-level license-file inventory for all nine flagged dependency-license entries, with final dispositions intentionally open
- Customer-discovery interview playbook linked from the revenue validation plan
- PR #124: zero retirement spending remains exactly zero even when an extreme inflation assumption would overflow; regression test merged
- PR #125: autonomous workflow prompt now limits context loading and broad exploration, and the bounded agent turn budget is 60 rather than 40; PR checks passed and the merge is on `main`

## In Progress

- Verify the autonomous workflow end-to-end after PR #125: a scheduled run must complete and publish a valid focused PR; a successful preflight or a workflow run with no publishable branch does not count.
- Confirm the main-branch CI run for PR #125's merge has completed successfully.
- Define whether each flagged dependency is included in a distributable product or used only for development/build, then map the Blue Oak notice and MPL source-availability obligations to that boundary. Preserve manual-review status until qualified review supports a disposition.
- Complete the one-time GitHub Pages repository setup and verify the dashboard deployment.
- Keep project licensing and the public/private product boundary as explicit release gates; no license or visibility change is authorized.

## Next Deliverables

1. Verify the autonomous workflow's next scheduled run and capture whether it creates a valid PR, including the actual conclusion and publication result.
2. Validate the open FIRE planner choices in ADR-0003 before implementing the local-first UI with existing calculator APIs.
3. Use the local dashboard-to-report flow to conduct the documented customer-discovery experiment; prioritize actual user evidence and paid-pilot commitments before adding persistence or unrelated feature families.
4. Establish persistence and source-of-truth requirements before implementing historical snapshot storage.
5. Keep distribution-artifact, dependency-license, and product-boundary decisions as release gates before external distribution; do not let unresolved release decisions stop safe local-first product development.

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
- Require relevant CI and full-history secret-scanning checks to pass before merging; complete routine, low-risk PRs after those checks pass.
- Do not change repository visibility or licensing, make legal/financial determinations, or include real personal financial data.
- Treat roadmap items as planned until implementation and tests demonstrate completion.

## Follow-up (2026-10-15)

- PR #104 merged: personal-record entry/import is now allowed only on loopback hostnames (`localhost`, `127.0.0.1`, IPv6 loopback); all other origins remain sample-only. Focused tests cover allowed and blocked hostnames.
- PR #105 merged: root CI now checks dashboard HTML/controller ID consistency, duplicate IDs, local CSS/JS entry assets, and relative module imports. The Pages packaging workflow was updated to validate the loopback privacy helper rather than the removed GitHub-hostname-specific function. CI and full-history secret scan passed before merge.
- Deployment remains blocked until a repository owner enables GitHub Pages under Settings → Pages → Source: GitHub Actions. The pull-request packaging/validation job can pass without this setting; actual publication cannot.

## Follow-up (2026-10-17)

- PR #107 merged: hourly autonomous-development workflow is committed, but the first end-to-end agent run still needs secrets and a successful manual verification.
- PR #108 merged: HCNSEC gateway authentication is an optional mode alongside Claude Code OAuth; live authentication remains unverified.
- PR #109 merged: the agent no longer receives the repository write token in its shell environment. A post-agent publishing step handles branch push and PR creation/update. CI and full-history secret scanning passed before merge.
- PR #110 merged: deterministic FIRE-readiness calculation is now implemented and tested in `@pfo/calculators`. It calculates projected portfolio value, inflation-adjusted retirement spending, target corpus from an explicit withdrawal rate, and surplus/shortfall. It is not a complete retirement planner.
- The next FIRE increment should retain deterministic, explicit assumptions; do not add market data, financial recommendations, historical storage, or Monte Carlo behavior without a clear requirements basis.

## Follow-up (2026-10-17, continued)

- PR #112 merged after CI and Secret Scan passed: the autonomous agent now has its native file tools allowed, a 40-turn budget, corrected preflight diagnostics, and clean allowed-tools quoting. The workflow still needs an end-to-end post-merge run.
- PR #113 merged after full CI and Secret Scan passed: deterministic scenario comparison is implemented and documented.
- PR #114 merged after full CI and Secret Scan passed: the required annual FIRE contribution solver is implemented with tests for zero/negative return assumptions and zero-year boundaries.
- HCNSEC and `PFO_AUTOMATION_TOKEN` are configured. The previous agent run failed before producing a PR; do not mark autonomous delivery complete until the corrected workflow produces a valid PR and CI passes.

## Follow-up (2026-10-17, autonomous trigger correction)

- PR #116's push-triggered run failed before agent execution because the pinned Claude Code Action rejects `push` events. PR #117 removes that trigger and schedules two bounded cycles per hour at minute 17 and 47 UTC; manual dispatch remains available. PR CI and Secret Scan passed.
- Verify the next scheduled/manual run end-to-end. A successful preflight alone is not evidence of autonomous code delivery.

## Follow-up (2026-10-18)

- PR #124 merged: FIRE readiness now preserves a zero-spending result without evaluating an inflation factor that would overflow; a regression test covers the extreme-inflation boundary.
- PR #123 was closed as superseded by PR #124.
- PR #125 merged after CI and Secret Scan passed: it reduces unnecessary agent context loading and increases the bounded turn budget to 60. Main-branch Secret Scan passed; main-branch CI was still running at the time of this update.
- End-to-end autonomous delivery remains unverified. The latest completed scheduled run before this change failed with `error_max_turns`; verify a later scheduled run actually creates/publishes a focused PR before marking W0 complete.
