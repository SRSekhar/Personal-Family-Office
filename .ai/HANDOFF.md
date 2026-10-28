# Session Handoff

## Repository

PFO OS — Personal Family Office Operating System

## Current State

The technical foundation, deterministic calculators, portfolio analysis, offline HTML report renderer, local-first dashboard, dashboard backup-currency guard, and local report CLI are merged to main. Dashboard action updates were merged in PRs #58, #62, and #64; PR #66 documents the required Pages setup. PR #67 added a reproducible CI check of all nine flagged npm tarballs: every packed tarball integrity matched `pnpm-lock.yaml`, and every tarball contained a root-level license file whose byte length and SHA-256 are recorded in `docs/security/DEPENDENCY_LICENSE_EVIDENCE_REVIEW.md`. Legal/distribution disposition remains open. The dashboard can now be previewed locally with `pnpm dashboard:serve` (loopback-only, no external data service). The hosted GitHub Pages demo still needs the repository's one-time setting configured (Settings → Pages → Source: GitHub Actions); workflow logs confirmed the `GITHUB_TOKEN` cannot create the Pages site automatically. PR #48 adds the interview guide for the revenue-validation experiment; no customer demand has been validated yet.

## Latest Follow-up (2026-10-14)

- PR #89 merged: dashboard record add/edit/delete/import now writes the candidate JSON to browser storage before updating in-memory records. Failed storage writes leave the previously saved state unchanged and display an explicit warning; focused persistence tests were added. PR CI and full-history secret scan passed before merge.
- PR #90 merged: corrected the dependency license evidence review's last-refresh date and clarified that CI inspected the exact `lightningcss-linux-x64-gnu@1.33.0` tarball's root `LICENSE` file. This is evidence of file presence/identity, not legal clearance.
- PR #88 merged: documented the Claude for Open Source eligibility evidence. The current evidence does not establish a qualifying threshold; the application remains unsubmitted and identity fields must not be inferred.
- PR #92 merged: ADR-0002 documents historical snapshot requirements and compares browser storage, local files, SQLite, self-hosted, and hosted options. It deliberately makes no technology decision before customer workflow and deployment requirements are validated.
- PR #93 merged: refreshed the public GitHub search evidence for Claude for Open Source. The search returned 64 merged PRs in the prior 12 months, all in the applicant-owned repository; it does not establish the external-PR eligibility route. The application remains unsubmitted.
- Dashboard Actions upgrades are merged: `upload-pages-artifact@v5`, `configure-pages@v6`, and `deploy-pages@v5`. Hosted deployment remains blocked until a repository owner enables GitHub Pages under Settings → Pages → Source: GitHub Actions. The workflow token cannot create the Pages site automatically. Local preview remains available with `pnpm dashboard:serve`.
- PR #95 merged: unreadable or invalid saved dashboard data now fails closed; duplicate record IDs are rejected, normal edits/exports cannot overwrite or misrepresent unreadable data, and validated backup import is the recovery path. Tests cover malformed JSON, invalid data, duplicate IDs, storage read failures, and writes. The hosted dashboard displays a public-demo privacy warning; use the loopback-only local preview for sensitive records. CI and full-history secret scanning passed before merge.
- PR #97 merged: the hosted dashboard was made sample-only on `*.github.io`. PR #104 tightens the boundary further: private workspace is permitted only on loopback hostnames (`localhost`, `127.0.0.1`, IPv6 loopback), and all non-loopback origins remain sample-only. Focused tests cover the allowlist.
- PR #98 merged: dashboard static-file, JavaScript syntax, privacy-notice, sample-only-guard, and no-remote-asset checks run before GitHub Pages setup and on pull requests. The validation workflow passed; actual publication still needs Settings → Pages → Source: GitHub Actions.
- PR #100 merged: root Vitest now includes the dashboard storage and backup test suites. The first run revealed an invalid test predicate in a fixture; the corrected suite passed 185 tests across 27 files in PR CI.
- PR #102 merged: importing a backup now requires confirmation before replacing existing private records, and shows a specific confirmation before recovering unreadable saved storage.

## Verified CI

The full GitHub Actions workflow passed with:
- Frozen pnpm install
- PowerShell initialization, validation, and doctor
- WhatIf non-mutation test
- Existing-file preservation test
- Unsafe-path rejection tests
- ESLint
- TypeScript typecheck
- Package build
- Vitest tests

The XIRR pull request passed the full workflow after addressing strict TypeScript indexed-access checks and an unused assignment.

## Implemented Capabilities

- Configuration-driven PowerShell initializer with initialize, validate, doctor, and WhatIf modes.
- Safe repository-relative path validation and no-overwrite behavior.
- Git ignore rules for root local financial data and generated reports.
- Local `@pfo/cli` host that validates versioned portfolio input or converts a dashboard JSON backup into a self-contained offline HTML report. Dashboard-backup mode requires an explicit `--as-of` valuation timestamp and preserves categories while mapping assets/liabilities to generic domain types.
- Deterministic CAGR calculation.
- Annual compound-growth projection with beginning/end contribution timing.
- XIRR for dated cash flows, using ACT/365 and bisection; multi-sign-change cash flows are rejected to avoid ambiguous results.

## Immediate Next Steps

1. Confirm the intended distribution artifact (source repository, compiled CLI, bundled app, or hosted product), then validate the actual artifact and map the Blue Oak/MPL obligations. Current manifests and lockfile point to development/build/test-only dependency paths, but legal disposition remains open.
2. If a hosted demo is desired, enable GitHub Pages once in repository Settings → Pages → Source: GitHub Actions, then rerun the dashboard deployment workflow and verify the live page. Local preview is already available via `pnpm dashboard:serve`.
3. Run customer-discovery interviews and paid-pilot validation using the now-demonstrable dashboard-backup-to-report workflow; do not treat prototype completion as demand validation. Define persistence/source-of-truth requirements before historical snapshots.
4. Run the 8–10 interview experiment using `docs/product/CUSTOMER_DISCOVERY_PLAYBOOK.md`; record only anonymized notes and evidence.
5. Keep licensing/product-boundary decisions explicit; do not change repository visibility or license automatically. The Claude for Open Source application remains unsubmitted.

## Latest Follow-up (2026-10-15)

- PR #104 merged: private dashboard records are restricted to loopback origins only (`localhost`, `127.0.0.1`, IPv6 loopback). Any non-loopback origin is sample-only; focused tests cover the host allowlist.
- PR #105 merged: dashboard static-integrity regression tests verify HTML IDs, controller selectors, local entry assets, and relative module imports. The Pages workflow's validation check now follows the shared loopback guard helper. PR CI, full-history secret scan, and pull-request dashboard packaging passed before merge.
- Main CI and full-history secret scanning should be rechecked after the latest merge. GitHub Pages deployment still fails at Pages setup until the owner sets **Settings → Pages → Source: GitHub Actions**. Do not claim the hosted dashboard is published until a deployment succeeds and the live page is verified.

## Important Constraints

- Never commit real personal financial data, statements, credentials, or private reports.
- Do not claim a full security audit has passed.
- Do not change repository visibility or publish a license without an explicit product-boundary decision.
- Do not claim the Anthropic application was submitted; the current document is a draft.
- Do not mark a task complete until tests or validation have actually run.


## Latest Follow-up (2026-10-17)

- PR #107 merged: an hourly GitHub Actions autonomous-development workflow was added. It is scheduled twice hourly at minutes 17 and 47 UTC and can also be manually dispatched. The first end-to-end agent run remains unverified until the required Actions secrets are configured and a manual run succeeds.
- PR #108 merged: the workflow now supports HCNSEC gateway authentication alongside Claude Code OAuth. HCNSEC uses the Claude Code-compatible endpoint at `https://api.hcnsec.cn` with a configurable model (default `DeepSeek-V4-Pro`). Authentication and a complete agent run through the gateway have not yet been verified. A third-party gateway receives the prompts and repository content required for the run.
- PR #109 merged: the autonomous workflow no longer exposes the repository write token as the agent's `GH_TOKEN`, and checkout credentials are not persisted. The agent receives a read-only GitHub token; a separate post-agent step receives the write token to push a branch and create/update a PR. PR CI and full-history secret scanning passed before merge.
- PR #110 merged: `@pfo/calculators` now exports a deterministic FIRE-readiness calculator. It projects an investable portfolio under an explicit nominal return and constant nominal annual contribution, inflates retirement spending, derives a target corpus from the supplied withdrawal-rate assumption, and reports surplus/shortfall. Focused tests and the full CI/secret-scan checks passed before merge. It is a scenario calculator, not a probability model, recommendation, or guarantee.
- The full FIRE planner, scenario comparison/UI, Monte Carlo analysis, and goal tracking remain unfinished. Do not imply that the calculator alone constitutes a complete retirement plan.
- The autonomous workflow's required secrets are still an operational setup step: either `HCNSEC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`, plus `PFO_AUTOMATION_TOKEN`. Configure them only in repository Actions secrets, then manually run the workflow once and verify its output. Never paste secrets into chat or commit them.
- Existing release blockers remain: the GitHub Pages repository setting has not been enabled through this connection; customer demand and paid pilots remain unvalidated; legal/distribution disposition remains a human release gate. These should not prevent safe, local-first product development.


## Latest Follow-up (2026-10-17, continued)

- PR #112 merged: added Claude Code native file tools to the allowed-tools list, increased the turn budget to 40, corrected the missing-token summary quoting, and removed a stray quote from the allowed-tools argument. PR CI and Secret Scan passed.
- PR #113 merged: added `compareFireReadinessScenarios` with input validation, explicit per-scenario assumptions, ordered deterministic results, tests, and documentation. It does not rank scenarios or make recommendations.
- PR #114 merged: added `calculateRequiredFireContribution` to solve the constant annual contribution required to reach the inflation-adjusted FIRE target. It handles already-met targets, zero-year shortfalls, zero/negative return assumptions, and floating-point rounding conservatively. Full CI and Secret Scan passed.
- The FIRE feature merges through PR #114 passed CI and Secret Scan on main. PR #117's trigger correction passed PR CI and Secret Scan; verify the post-merge main checks and the next scheduled autonomous run.
- The HCNSEC gateway key and `PFO_AUTOMATION_TOKEN` are configured. The previous manual agent run authenticated and initialized the gateway but failed before publishing a PR because of tool/turn-limit issues. The corrected workflow has not yet been proven end-to-end; verify the next scheduled run, including branch/PR publication and CI.

## Immediate Next Steps

1. Verify the post-merge main CI for PR #114 and the next scheduled autonomous-development run.
2. Confirm the corrected agent publishes one focused, tested PR without exposing the write token to the agent.
3. Review proposed ADR-0003 and validate its open questions before implementing the local-first FIRE planner UI; retain transparent assumptions and deterministic math.
4. Continue to keep real financial data out of the public repository. Customer demand, paid pilots, licensing/distribution review, and GitHub Pages setup remain open and must not be represented as complete.

- PR #116's immediate post-merge run failed with `Unsupported event type: push`; no agent work was performed. PR #117 removed the unsupported trigger and changed the cadence to twice hourly. Do not report autonomous delivery as working until a scheduled/manual run publishes a valid PR.


## Latest Follow-up (2026-10-28 — supersedes older status notes)

- PR #384 merged: data-integrity batch validates aggregate financial totals and verifies atomic rollback for writes to records, goals, cash-flow transactions, budgets, and historical snapshots. CSV, backup/restore, storage, and ledger validation edge cases are covered.
- PR #385 merged: financial-health reporting now compares the selected month with the previous calendar month for income, expenses, net cash flow, and savings rate. Missing prior-month activity is explicitly unavailable, not assumed to be zero. The same visible comparison is included in CSV and standalone offline HTML exports.
- Validation for PR #385: CI run #1079 passed, dashboard packaging run #481 passed, and Secret Scan run #1035 passed. Merge commit: 0e7bcf03b9374cd3d1de5597c44690d8cd186f08.
- Continue with cohesive functional batches rather than file-by-file pauses. Keep real financial data out of the public repo; use fictional fixtures only. Accessibility/manual zoom reviews remain low priority/deferred. Customer validation, repository-history exposure review, licensing/distribution decisions, and owner-side GitHub Pages configuration remain open release gates.


## Latest Follow-up (2026-10-28 — Local SQLite persistence)

- SQLite persistence is available through `pnpm dashboard:serve`. The loopback server opens the local database outside the checkout by default and exposes status plus validated workspace read/write endpoints.
- One atomic schema-v4 snapshot stores records, goals, cash-flow transactions, budgets, and historical snapshots. Save/restore actions are explicit; restore reuses the existing preview, confirmation, and transactional local-storage restore path.
- Database API has loopback Host/Origin checks, a 10 MiB request limit, no CORS, and validation before database mutation. POSIX database and sidecar files are owner-only; Windows access relies on the user's profile ACL.
- Not included: automatic browser-to-database sync, encryption, remote hosting, multi-user identity/authorization, or cloud replication. Do not describe this as a cloud backend.
- PR #390 is merged (commit `4260e1f80cf30e3e597ff1f932be1a48c35b8eca`). CI run #1093 and Secret Scan run #1049 passed; CI includes the Chromium smoke test and dashboard API/unit tests.


## Latest Follow-up (2026-10-28 — SQLite automatic-save follow-up)

- PR #390 merged the local SQLite backend and explicit full-workspace save/restore. The backend uses Node.js `node:sqlite`, writes one validated schema-v4 INR snapshot transactionally, and stores the database outside the repository by default. POSIX database and sidecar permissions are owner-only; Windows relies on the current user's profile ACL. The database is not encrypted by this feature.
- The current follow-up adds opt-in automatic saves. Automatic mode is enabled only after a successful initial full snapshot. Successful record, goal, cash-flow, budget, history, import, and restore changes schedule a serialized 450 ms debounced snapshot.
- Browser-local storage remains the immediate recovery copy. If SQLite fails, the UI reports that the database may be behind; it does not claim that the local edit was rolled back or that the database write succeeded.
- Validate the final PR head with CI, Chromium smoke (including a real cash-flow auto-save), dashboard packaging, and Secret Scan before merging.
