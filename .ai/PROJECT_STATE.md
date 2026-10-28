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

- **Epic:** Local SQLite Persistence
- **Status:** The loopback dashboard server exposes a validated SQLite workspace API. The database stores all five private workspace collections in one transactional schema-v4 snapshot; dashboard save/restore is explicit and restores through the existing validated preview and atomic browser-storage recovery path. Local database file permissions are hardened on POSIX. Cloud hosting, multi-user access, encryption, and automatic synchronization are not claimed.
- The planner reuses the existing deterministic calculator APIs, keeps assumptions/results ephemeral, requires explicit annual assumptions, and disables planner controls on hosted non-loopback origins.
- Scenario comparison preserves entered order, shows the scenario assumptions, and does not rank or recommend scenarios.
- FIRE report export is explicit user action. Reports are script-free, self-contained HTML, validate report inputs/results, escape untrusted scenario names, and are generated locally without network submission.
- The dashboard's static artifact is packaged successfully by CI. PR #145 adds a session-only Goal Tracker for one target with progress, remaining amount, target date, and completion/overdue status; its calculator, dashboard integration, tests, and documentation passed PR CI, Secret Scan, and dashboard packaging before merge. Publishing remains blocked until the repository owner configures GitHub Pages in Settings → Pages with Source set to GitHub Actions.
- Customer demand remains unvalidated; no revenue or paid-pilot commitment is claimed.

## Foundation Verified

- Repository, GitHub Flow, AI onboarding, architecture, and project documentation established.
- Configuration-driven PowerShell bootstrap merged.
- CI uses a frozen pnpm lockfile.
- CI runs initialization, validation, doctor, WhatIf/no-overwrite/path-safety tests, lint, typecheck, build, and tests.
- Pull-request CI passed for the foundation and initial analytics capabilities.

## Implemented Calculator Capabilities

- CAGR calculation with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing, input validation, overflow checks, and tests.
- Deterministic FIRE-readiness scenario: projected investable portfolio, inflation-adjusted annual retirement spending, target corpus from an explicit withdrawal-rate assumption, and surplus/shortfall; assumptions and limitations are documented and tested.
- Deterministic FIRE scenario comparison: evaluates independently specified assumptions in caller-supplied order, preserves inputs/results, rejects blank/duplicate identifiers, and does not rank or recommend scenarios (PR #113).
- Required annual FIRE contribution solver: solves the constant nominal annual contribution needed to meet the inflation-adjusted target, returns zero when the current portfolio is sufficient, and rejects an unmet target with zero years remaining (PR #114).
- XIRR for dated cash flows using ACT/365 and bisection, with date/amount validation and explicit rejection of multi-sign-change cash-flow series.

These are mathematical utilities, not investment advice or guaranteed forecasts. XIRR currently supports cash-flow streams with exactly one sign change to avoid ambiguous roots.

## Next Deliverables

1. LOW PRIORITY / DEFERRED: manual screen-reader and real browser-chrome 400% zoom reviews. Automated keyboard/focus and selected 320 CSS-pixel checks remain in CI; revisit manual audits during release readiness or if customer requirements justify them.
2. Run the planned 8–10 customer interviews and seek two paid-pilot commitments; record only anonymized evidence and do not infer demand from implementation completion.
3. Validate the shipped financial-health, return-risk, concentration, and report outputs with synthetic acceptance scenarios and then user workflows; avoid adding KPIs before needs are validated.
4. Manually review historical repository content and commit metadata for accidental secrets; finish software distribution/legal review and owner-side Pages configuration before release. These gates do not block safe local-first feature work.
5. Keep historical snapshot guarantees intact: explicit valuation dates, no fabricated history, local-first storage, schema-compatible backup/restore, and transactional recovery.

## Blockers and Risks

- The GitHub repository is public; do not commit real financial data or private configuration.
- The repository does not yet have a valid open-source license.
- Historical repository content and commit metadata have not been fully scanned.
- The Anthropic application draft is prepared but has not been submitted.
- No revenue, customer demand, or product-market fit has been validated.
- The nine dependency-license inventory flags passed packed-tarball integrity, root-license-file, and upstream license-text hash checks in CI. Current manifests/lockfile indicate development/build/test-only dependency paths, but the final distribution artifact and legal disposition remain outstanding.
- GitHub Pages deployment is blocked by the repository-level Pages setting; the workflow token cannot create the site automatically.


## Latest Follow-up (2026-10-18)

- PR #139 merged the local-only FIRE planner after CI, dashboard packaging, and Secret Scan passed.
- PR #141 merged the ordered three-scenario comparison UI after CI, dashboard packaging, and Secret Scan passed.
- PR #142 merged validated, self-contained FIRE scenario HTML reports and explicit download actions after CI, dashboard packaging, and Secret Scan passed. Manual browser/accessibility verification remains open.
- PR #145 merged a deterministic goal-progress calculator and session-only Goal Tracker UI after CI, Secret Scan, and dashboard packaging passed. It does not persist goals or project returns.
- PR #147 merged static accessibility-contract regression checks for FIRE and Goal Tracker after CI, Secret Scan, and dashboard packaging passed. These assertions do not constitute interactive browser, keyboard, screen-reader, responsive, or 400% zoom verification.
- PR #149 clarified Goal Tracker progress-indicator accessible value text as a percentage of target, including above-target values. CI, Secret Scan, and dashboard packaging passed; actual screen-reader behavior remains unverified.
- Product priority remains complete user workflows and customer validation; autonomous engineering workflow work is intentionally deferred.

- PR #107 merged: hourly autonomous-development workflow committed; first end-to-end agent run is not yet verified.
- PR #108 merged: optional HCNSEC gateway authentication documented alongside Claude Code OAuth; live gateway authentication remains unverified.
- PR #109 merged: the autonomous agent receives read-only GitHub context, and the repository write token is only used by a post-agent publishing step. CI and full-history secret scanning passed before merge.
- PR #110 merged: deterministic FIRE-readiness calculator added to `@pfo/calculators`, with focused validation tests and documented assumptions. The broader FIRE planner remains unfinished.
- PR #112 merged: added native Claude Code file tools to the allowed-tools list, raised the turn budget from 25 to 40, fixed the missing-token diagnostic quoting, and removed a stray trailing quote from the allowed-tools argument. PR CI and secret scan passed.
- PR #113 merged: added tested deterministic FIRE scenario comparison with explicit assumptions and no automatic ranking/recommendation. Full CI and secret scan passed.
- PR #114 merged: added the required annual FIRE contribution solver with boundary/invalid-input tests and documented assumptions. Full CI and secret scan passed.
- HCNSEC and `PFO_AUTOMATION_TOKEN` are configured. The previous manual run authenticated and initialized the gateway but failed before publishing a PR due to agent tool/turn limits. PR #112 fixes those defects; the first end-to-end run on the corrected workflow remains unverified until a run publishes a valid PR and its CI passes.
- Product validation and paid-pilot evidence remain open. GitHub Pages setup and legal/distribution review remain release gates, not reasons to stop safe local-first product development.

## Last Updated

2026-10-28

- PR #116 added a main-push trigger, but its first run failed immediately with `Unsupported event type: push` before the agent executed. PR #117 removed that unsupported trigger and changed the schedule to twice hourly at minutes 17 and 47 UTC; PR CI and Secret Scan passed.
- End-to-end autonomous delivery remains unverified. The next scheduled/manual run must reach the agent, create a focused commit, publish a PR, and pass PR CI before the workflow is considered operational.


## Latest Follow-up (2026-10-25)

- PRs #304–#316 delivered historical snapshot requirements, validated snapshot model, local capture/table/trend/detail/CSV, schema v4 backup and rollback, duplicate-date protection, explicit removal, keyboard focus handling, and narrow-viewport checks.
- PRs #317–#321 added offline browser verification for the financial summary, FIRE reports, scenario comparison, monthly financial review, and HTML escaping of user-controlled goal/category text.
- PRs #322–#325 added keyboard removal coverage, duplicate-date capture rejection, malformed-history fail-closed behavior, and full-workspace backup recovery from malformed history.
- PR #326 added keyboard activation coverage for FIRE readiness and Goal Tracker calculations. CI and Secret Scan passed before merge for these PRs.
- LOW PRIORITY / DEFERRED: manual screen-reader and browser zoom review; keep automated accessibility and responsive regression coverage, and revisit during release readiness if warranted.
- Remaining: anonymized customer discovery.
- Release gates: review repository history for exposed credentials, decide distribution/licensing, and complete owner-side Pages configuration.


## Latest Follow-up (2026-10-28)

- PR #377 merged: hardened CSV imports and full-workspace schema-v4 backup/restore coverage, including cancellation safety and rollback protection.
- PRs #378–#380 and #382 merged: strengthened financial-health, return-risk, asset-allocation, and FIRE comparison report fidelity checks.
- PR #383 merged: invalid-date and cancelled CSV replacement flows preserve the existing cash-flow ledger.
- PR #384 merged: added aggregate-total validation to backup validation and exercised atomic restore rollback for all five workspace collections (records, goals, cash flow, budgets, and history). CI, dashboard packaging, and Secret Scan passed.
- PR #385 merged: financial health now compares the selected reporting month with the immediately previous calendar month for recorded income, expenses, net cash flow, and savings rate. It handles year boundaries and does not invent a baseline when no prior-month transactions exist. Unit tests, Chromium smoke, CI, dashboard packaging, and Secret Scan passed.
- Product priority remains useful financial workflows, trustworthy calculations, privacy, and customer validation. Accessibility remains low priority/deferred as directed; automated checks remain in place.


## Latest Follow-up (2026-10-28 — SQLite persistence in progress)

- Major next deliverable: opt-in local SQLite persistence for the private dashboard workspace.
- The proposed implementation uses Node.js built-in `node:sqlite` to avoid a native third-party database dependency and lockfile churn. The database defaults outside the Git checkout and can be relocated with `PFO_DATABASE_PATH`.
- The local loopback server exposes a JSON API for status and full-workspace save/read. A single schema-v4 snapshot row is written in one SQLite transaction; records, goals, cash-flow transactions, budgets, and historical snapshots are validated as a unit.
- The dashboard adds explicit save and restore actions. Restore reuses the established backup preview and atomic browser-storage recovery flow; browser edits are not automatically synchronized in this increment.
- Security boundaries: loopback-only server, local-origin validation, no CORS, 10 MiB request limit, no remote database, no automatic cloud sync, and SQLite database files ignored by Git. This feature does not encrypt the database file.
- Status: local SQLite persistence and POSIX file-permission hardening are merged to main in PR #390. CI run #1093 and Secret Scan run #1049 passed. Chromium browser smoke is included in CI. The backend is local-only and explicitly saved; it is not a cloud or multi-user service.


## Latest Follow-up (2026-10-28 — SQLite persistence)

- Local SQLite persistence is implemented in the loopback dashboard preview using Node.js built-in `node:sqlite`; no external database service or runtime dependency is required.
- The API stores and retrieves a complete validated schema-v4 INR snapshot containing financial records, saved goals, cash-flow transactions, budgets, and historical snapshots. A single SQL transaction keeps each snapshot atomic.
- Save and restore are explicit user actions. Restore goes through the existing backup preview, confirmation, validation, and rollback path; stable record identifiers are retained.
- The database file defaults outside the repository. POSIX database and sidecar files use owner-only permissions; Windows relies on profile ACLs. The file is not encrypted, so device protection and separate backups remain necessary.
- Scope limitation: this is a local single-user persistence backend, not a cloud or multi-user service; automatic synchronization is not included.


## Latest Follow-up (2026-10-28 — SQLite persistence complete)

- PR #390 merged as `4260e1f80cf30e3e597ff1f932be1a48c35b8eca`. It hardens SQLite database/WAL/SHM/journal permissions to owner-only on POSIX and adds a regression test for file modes.
- CI run #1093 and Secret Scan run #1049 passed. CI includes lint, typecheck, unit/API tests, and Chromium browser smoke covering a full five-collection SQLite save/restore round trip.
- SQLite is the chosen local backend for the current local-first dashboard. Explicit save/restore is supported; cloud hosting, multi-user access, encryption, and automatic synchronization remain future decisions, not shipped capabilities.
