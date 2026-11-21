## Latest update — 2026-11-21 — IPM-08 TIME-007

Current branch: `feature/ipm-08-backtesting-contracts`; PR #458 remains draft/open/unmerged. Latest acceptance commit: `413fd9bc4858f3665c4cf4b137f7cdedbcfa1d33`.

- Added TIME-007: run-wide `recordedAtCutoff` does not make a bar visible to an earlier strategy decision when `availableAt` is later than that decision timestamp.
- Together with UNI-007, the acceptance contract now explicitly requires per-decision temporal filtering of both observations and universe membership; run-level validation alone is not sufficient.
- Acceptance/documentation only. No engine, data persistence, provider or schema migration has been implemented.
- Checks passed on prior head `9fee14a412e6b03b532b1a253ee692b49e420ea2`; current head still needs fresh CI and Secret Scan confirmation.

---

## Latest update — 2026-11-21 — IPM-08 UNI-007

Current branch: `feature/ipm-08-backtesting-contracts`; PR #458 remains draft/open/unmerged. Latest head: `aeafb9469747a5903608ec8c620368dfd946f0c3`.

- CI #2080 and Secret Scan #1875 passed on the immediately preceding head `372914443ff841cc382be4cd22df05b8088d2907`.
- Added acceptance scenario UNI-007: a future engine must resolve universe membership at every strategy decision timestamp using effective-time and decision-time knowledge; later-recorded corrections cannot rewrite earlier decisions. Run-level overlap validation does not meet this requirement.
- The UNI-007 commit is documentation-only and has not yet reported a CI run. Do not claim it passed checks until GitHub reports that result.
- No simulation engine, point-in-time projection, dataset persistence, provider adapter or schema migration has been implemented. Storage proposal remains unapproved.

---

# Session Handoff

## Latest development — Sprint 17 / IPM-08.1 design (in progress)

Branch: `feature/ipm-08-backtesting-contracts`, based on main closeout head `db739ff0d38fb0da965fd063de4560c54a85a9f6`.

Repository inspection completed for:
- `@pfo/market-data` historical bars, provider/source metadata, point-in-time request and provider capability ports.
- Investment instrument/transaction contracts, FIFO projection, cash-ledger reconciliation, manual valuation and bitemporal drawdown snapshots/calendars.
- Existing XIRR, flow-adjusted drawdown, performance reporting and research evidence contracts.

Drafted:
- `docs/architecture/ADR-IPM-08-BACKTESTING-ARCHITECTURE.md` — proposed package boundary, point-in-time dataset, bitemporal universe, explicit calendar, strategy information boundary, execution/cost proposal, corporate-action gates, simulated-ledger isolation and reproducibility.
- `docs/architecture/IPM-08-BACKTESTING-ACCEPTANCE.md` — dataset/time/universe/execution/corporate-action/accounting/isolation scenarios, including an independently calculated synthetic INR execution fixture.

**Important:** ADR status is Proposed. The initial `@pfo/backtesting` package now contains contract types and strict validators only. No simulation engine, market-data provider, database migration, broker integration or real-ledger mutation has been introduced. Decisions still required include exchange/instrument scope, trading-calendar source, corporate-action semantics, fill/partial-fill policy, cost model, lot-size/tick-size and short/fractional-position policies. Do not guess these in code.

### Next task
Review the unresolved decision list in the ADR. Next, validate the contract package and close its acceptance tests. Resolve remaining execution/corporate-action/market conventions before implementing simulation behavior or normalized historical CSV import.

---



## Latest integrated state — Sprint 16 complete (2026-11-15)

PRs #453–#457 have all been merged into `main` in dependency order. Main integration merge commit: `7db56531b353baa45983e88ed0ef54517740c414`; main closeout HEAD: `db739ff0d38fb0da965fd063de4560c54a85a9f6`. The five merge commits are recorded in `.ai/CURRENT_SPRINT.md`.

- PR #453: flow-adjusted drawdown, SQLite schema v12.
- PR #454: portfolio performance review and historical period comparison.
- PR #455: transaction and holdings statement reconciliation, schema v13 / 20 collections.
- PR #456: provider-neutral market-data boundary.
- PR #457: evidence-grounded research and AI review.
- PR #457 final migration test commit: `ed0b6a6fbce2ee4acaae123968f769586d509858`; CI #2013 and Secret Scan #1807 passed.
- Main closeout HEAD `db739ff0d38fb0da965fd063de4560c54a85a9f6`: CI #2025 and Secret Scan #1819 passed.

All PRs were retargeted to `main` after their predecessors merged, converted from draft, and merged with merge commits only after the respective head checks passed. No PRs remain open in this five-PR chain.

### Next task — Sprint 17 / IPM-08

Create `docs/architecture/ADR-IPM-08-BACKTESTING-ARCHITECTURE.md` and define:
1. Point-in-time historical data evidence and adjustment contracts.
2. Strategy, universe, sizing and rebalance contracts.
3. Execution timing, fill, brokerage, tax, slippage, liquidity and corporate-action assumptions.
4. Look-ahead, survivorship, publication-time, revision and missing-session bias controls.
5. Hand-calculated acceptance portfolios and deterministic expected results.

Start with existing repository contracts and tests. Do not invent provider APIs, historical prices, trading calendars or financial semantics. No backtesting engine or provider integration until architecture and acceptance cases are established. Paper portfolio remains a separate domain from real ledger records.

---



## Latest development — Sprint 15 / IPM-07 (2026-11-15)

Branch `feature/ipm-evidence-research` starts from PR #456 head `87029005f3950a3199b65ac3f96239de171ec17a` and adds `@pfo/research`.

Three increments are implemented: (1) specialist ports for fundamentals, technicals, news/macro and portfolio risk with source provenance, SHA-256 content digest, publication/availability/retrieval/knowledge-time metadata, strict factual claim citations, and provider/model/adapter/prompt version metadata; (2) independent bullish and bearish challenges, structured response validation, claim-reference checks, untrusted-evidence prompt envelopes, stale and non-point-in-time warnings; (3) explicit-path local JSON persistence with atomic replacement, restrictive permissions, schema/size checks, idempotency-key conflict protection, incremental specialist saves and retry/resume.

No LLM provider/SDK/API/credentials, outbound calls, scheduled run, dashboard UI, external household-data transmission, prices/targets/recommendations or ledger/valuation/order mutation. A host must explicitly inject model/specialist adapters and invoke the engine. Local JSON is not encrypted; hosts own private path, backup and retention. ADR: `docs/architecture/ADR-IPM-07-EVIDENCE-GROUNDED-RESEARCH.md`.

**Verified on final implementation head `88338ede3d0d64b8454c3fe979e76bd584020fa7` (2026-11-15):** CI #2011 passed (100 test files / 922 tests, lint, typecheck, package build, repository safety checks and both Chromium browser smoke workflows); Secret Scan #1805 passed. PR #457 was merged into main on 2026-11-15.

This is the core orchestration and persistence foundation, not a live AI research feed. Provider-specific specialist/model adapters and dashboard UI remain gated until an LLM vendor, market/news data sources, official API docs, licensing/terms, privacy and authentication decisions are reviewed. PRs #453–#457 were merged into main on 2026-11-15 after owner approval and successful PR-head checks.



## Latest development — Sprint 14 / IPM-06 (2026-11-15)

Branch `feature/ipm-market-data-boundary` starts from the verified PR #455 head and adds a provider-neutral market-data package, `@pfo/market-data`.

Three slices are implemented: (1) normalized contracts for identity, quotes, historical bars, fundamentals and corporate actions with source/license/attribution, timezone, delay, freshness, coverage, adjustment and point-in-time metadata; (2) independent optional capability ports and provider conformance validation with synthetic fixtures; (3) explicit bounded timeout/retry/cache policy, transient-only retry, cancellation, bounded in-memory TTL cache and sanitized errors.

No provider SDK/API, endpoint, credentials, database persistence, schema migration, automatic valuation import or corporate-action ledger posting. No provider is registered and no outbound request occurs by default. Manual valuation remains unchanged. Before selecting an adapter, review official API docs, authentication, commercial/data terms, licensing/redistribution, exchange coverage, point-in-time guarantees and retention/rate limits.

**Final verification passed on code head 6b136b4e4e27f92209a2005df6c143ae29e6048d (2026-11-15):** CI #2006 passed (98 test files / 912 tests, lint, typecheck, package build, repository safety checks and both Chromium browser smoke workflows); Secret Scan #1800 passed. PR #456 was merged into main on 2026-11-15. Keep PRs #453–#456 unmerged until owner review and explicit approval.


## Latest development — Sprint 13 / IPM-05 (2026-11-15)

A new branch `feature/ipm-statement-reconciliation` is based on `feature/ipm-performance-review` (PR #454) and implements Option B: both broker transaction statements and holdings/position statements. See `docs/architecture/IPM-05-STATEMENT-RECONCILIATION.md`.

Three increments: (1) immutable normalized evidence contract and validation; (2) deterministic transaction matching and FIFO holdings quantity reconciliation; (3) private-only JSON evidence import, CSV reconciliation export, browser-local storage, JSON backup schema v13, and SQLite schema v13 with transactional v12→v13 migration and protected recovery artifact. The new collection is `investmentStatementEvidence` (20th collection). Legacy schema v1–v12 JSON backups remain supported; older imports preserve existing evidence only when account/instrument references validate.

No broker connection, broker-specific CSV guessing, PDF extraction, ledger auto-correction, settlement/cash matching, cost-basis/tax-lot reconciliation, corporate actions, in-kind flows, FX, prices or recommendations are included. The normalized evidence importer requires explicit source mapping and does not modify ledger transactions.

**Final verification passed on code head dc9a66c30296a9e0e001f5b295f95482fa163d17 (2026-11-15):** CI #2000 (95 files / 900 tests, lint, typecheck, build, FIRE browser smoke and statement reconciliation browser smoke), Secret Scan #1794, and dashboard packaging #1236 all passed. PR #455 was merged into main on 2026-11-15. Do not merge #453/#454/#455 without explicit owner approval.


## Repository

PFO OS — Personal Family Office Operating System

## Current State

Main contains the investment ledger/FIFO positions, investment cash ledger and statement reconciliation, XIRR, allocation policies/drift, concentration policies, weighted exposure classifications and user-configured exposure limits. Main is schema v13 with 20 collections following the sequential merge of PRs #453–#457.

PR #453 (`feature/ipm-drawdown-contract-discovery`) contains the approved Option B flow-adjusted drawdown implementation end-to-end: pure calculator; bitemporal snapshots; ledger-derived completeness; authoritative flow classification; explicit persisted daily-close calendar; private manual daily-close and paired pre/post-flow capture; independent hand-calculated acceptance; private HTML/CSV reporting; schema v12 with 19 collections; transactional v10→v11→v12 migrations; and JSON/SQLite backup/restore. Browser smoke verifies capture, paired boundaries, report downloads, demo/private isolation and persistence. In-kind flows and corporate actions remain unsupported pending a separate ledger-model decision.

PR #453 was merged into main on 2026-11-15. Code head `06b0c14bdef50f8550a92e67167a0e00bdd68b2c` passed CI #1889, Secret Scan #1683 and dashboard packaging #1125. Documentation-only follow-up head `53f7979bbcd3b2ec0f8480c61ee0a352a7190250` had CI #1893 queued at last check; Secret Scan #1687 and dashboard packaging #1129 passed. Do not merge without explicit owner approval. Main remains schema v10 until the PR is reviewed and merged.

PR #454 (feature/ipm-performance-review) is stacked on PR #453. It contains the private standalone HTML/CSV portfolio performance report (reusing FIFO and per-currency XIRR) plus the IPM-04 historical period comparison. The comparison UI accepts explicit label/start/end period rows, runs each through the existing drawdown-series orchestration using its persisted calendar, enforces one scope/account/currency/methodology/recorded-at cutoff, and reports endpoint wealth-index return, maximum drawdown, peak/trough/recovery, coverage, calendar provenance, snapshot-level completeness evidence, limitations, overlap and unavailable reasons. HTML is script-free; CSV is formula-safe; export is blocked when the validated source signature changes. Chromium smoke covers demo/private isolation, report downloads and stale-source invalidation. No schema migration or new financial formula was introduced.

Final verified PR #454 head (2026-11-15): `01131e7c3f36901aeabd5ffe8f0673cec08c3d05`. CI #1980, Secret Scan #1774 and dashboard packaging #1216 all passed on this exact head. CI includes bootstrap/doctor/safety checks, lint, typecheck, package build, full tests and Chromium browser smoke. Sprint 12 performance review and IPM-04 historical comparison deliverables are complete. PR #454 remains draft/open/unmerged; PR #453 remains draft/open/unmerged. Do not merge either without explicit owner approval.

Remaining gated work: transaction-to-position statement reconciliation needs an approved statement evidence/matching contract (source, period, account/currency, references, duplicate/unmatched/ambiguous rows, opening baseline, closing quantity comparison, corrections and recorded-at cutoff). Cost-basis adjustments, corporate actions and in-kind events need separate accounting/domain decisions. Do not invent broker formats, tax treatment, prices, FX or event semantics. Repository is public: synthetic fixtures only. SQLite and JSON exports are not encrypted; backups remain manual; remote backup/cloud sync/hosted multi-user access are not shipped.

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

- PR #387 merged the local SQLite backend and explicit full-workspace save/restore. The backend uses Node.js `node:sqlite`, writes one validated schema-v4 INR snapshot transactionally, and stores the database outside the repository by default. PR #390 then hardened POSIX database/sidecar permissions and ensured permission-hardening failures prevent a candidate snapshot from committing; Windows relies on the current user's profile ACL. The database is not encrypted by this feature.
- PR #394 merged opt-in automatic saves. Automatic mode is enabled only after a successful initial full snapshot. Successful record, goal, cash-flow, budget, history, import, and restore changes schedule a serialized 450 ms debounced snapshot.
- Browser-local storage remains the immediate recovery copy. If SQLite fails, the UI reports that the database may be behind; it does not claim that the local edit was rolled back or that the database write succeeded.
- Validation passed before merge: CI run #1097, Chromium smoke (including a cash-flow transaction auto-saved through the API), dashboard packaging run #493, and Secret Scan run #1053.


## Latest Follow-up (2026-10-28 — SQLite startup recovery guard)

- Current branch `fix/sqlite-startup-recovery-guard` detects when SQLite has a saved snapshot while browser workspace collections are absent/empty, and pauses autosave to prevent an empty browser profile from replacing the database on startup.
- Recovery uses the existing restore preview/confirmation. Malformed or unreadable local values are treated as data present, so the app does not guess they can be discarded.
- PR #397 merged as `cbf778274e83d37970eef299a53d2c6c914d5584`. CI run #1103, dashboard packaging run #495, and Secret Scan run #1059 passed; browser smoke verified the saved SQLite transaction survives startup recovery.


## Latest Follow-up (2026-10-28 — SQLite optimistic concurrency)

- Branch `feat/sqlite-optimistic-concurrency` adds a last-read version to every SQLite write. A mismatch returns HTTP 409 inside the SQLite transaction, preserving the newer snapshot.
- After a conflict, automatic writes pause. A user must explicitly confirm before replacing the newer database version; browser-local storage remains untouched.
- PR #400 merged as `3cda51c617360ae056fd3fe82b3cf8cf6ad6d554`. CI run #1112 and dashboard packaging run #500 passed on the final head; Secret Scan run #1065 passed on the code changes before the documentation-only update.


## Latest Follow-up (2026-10-30 — SQL persistence and recovery assurance closed)

- PR #408 merged: full-workspace JSON import rejects files larger than 10 MiB before FileReader decoding. Chromium smoke proves truncated and oversized imports preserve all five browser workspace collections and visible financial totals. CI run #1133, dashboard packaging run #510, and Secret Scan run #1089 passed on the final head. Merge commit: 7aa369a4a91bcd0d2432833b51b9e71a074fcef9.
- PR #409 merged: malformed JSON and request bodies above 10 MiB are rejected by the SQLite API with HTTP 400/413, while the previously committed workspace payload/version remain unchanged. CI run #1134 and Secret Scan run #1090 passed. Merge commit: 43066794750b139f15fc8b6e4d8f81e5dcafefec.
- PR #406 verifies portable export/restore using exact equality across records, goals, cash flow, budgets, and history, including stable IDs and nested historical records. PR #407 documents backup cadence, manual retention, encryption responsibility, same-device recovery, JSON recovery, and device migration.
- Existing coverage verifies atomic SQLite writes, stale-write conflicts, clean close/reopen persistence, POSIX owner-only DB/sidecar permissions, and read-only PRAGMA quick_check.
- Operational guide: docs/operations/LOCAL_BACKUP_AND_RECOVERY.md. Keep the database outside the repository and never commit real financial data. Treat JSON exports as unencrypted sensitive files.
- Current SQL/recovery milestone is complete for local single-user use. Future decisions only: online-backup/checkpoint evaluation, encryption, automatic rotation, remote backup, cloud sync, or multi-user architecture. Do not imply any of those are implemented.


## Latest Follow-up (2026-10-31 — import hardening and regression coverage)

- PR #412 merged with a Chromium regression for repeated budget-overrun insights and isolated browser fixtures.
- PR #413 merged with 10 MiB pre-read limits for cash-flow CSV/JSON and category-budget JSON imports (`649014ee22cc62bfb5453c89e2690bc2984f8e07`).
- PR #414 merged with the same 10 MiB limit for investment cash-flow CSV import (`bd9fd6eafca6bd2e4743e28b74a83c01f596c4c7`). The primary records CSV and full-workspace JSON import paths already had equivalent limits; the reviewed FileReader import paths are bounded consistently.
- PR #413 and #414 CI, Secret Scan, and dashboard deployment passed; PR #412 CI and Secret Scan passed.
- Continue from `.ai/BACKLOG.md` with evidence-led product priorities. Do not claim all P1 work complete: the backlog does not define a P1 inventory. Accessibility remains deferred; customer validation and release gates remain open.

## Next Work

Continue with the next functional product priorities in .ai/BACKLOG.md. Customer validation, legal/distribution review, historical repository exposure review, and owner-side GitHub Pages configuration remain open release gates. Accessibility/manual zoom audits remain low priority/deferred as directed.

## Latest Follow-up (2026-10-31 — P1 acceptance scope consolidated)

- Added `.ai/P1_ACCEPTANCE_MATRIX.md` to map every previously committed P1 engineering area to acceptance criteria, automated tests, browser smoke coverage, and merged PR evidence.
- The engineering P1 scope is complete based on the committed unit/API/Chromium tests and merged PRs. This is not a claim that customer discovery or external release gates are complete.
- Manual screen-reader and actual browser-chrome 400% zoom reviews remain deferred. Encryption, automated backup rotation, remote backup/cloud sync, multi-user support, and speculative Portfolio Health/recommendation features are excluded or requirements-gated.


## Latest Follow-up (2026-10-31 — Investment Portfolio Management)

- PR #421 merged: approved Option B architecture and research adoption plan; documents patterns from TradingAgents, OpenBB, Maybe, Microsoft Qlib and vn.py, with license guardrails. No third-party code was copied.
- PR #422 merged: investment account, instrument and immutable transaction domain foundation. Signed cash movements, purchase/sale quantity-price reconciliation, fees/taxes as separate events, optional market identifiers, and non-market investment products are supported.
- PR #424 is the second delivery: FIFO position projection with cost basis, realised gain, dividend/interest income, fee/tax expenses and manual/provider valuation observation provenance. It selects only prices known by the requested as-of date; missing prices remain unavailable. CI and Secret Scan are pending.
- Full Option B backlog IPM-01 through IPM-10 is detailed in `.ai/BACKLOG.md`; architecture and research rationale are in `docs/architecture/PORTFOLIO_MANAGEMENT_RESEARCH_AND_ARCHITECTURE.md`.
- No schema-v4 SQLite migration or dashboard integration is included yet. Preserve all existing functionality and backup compatibility in the next phase. No live trading, autonomous orders, FX conversion, AI ledger mutation, or copied upstream source code.


## Latest Handoff — Investment workspace persistence (2026-10-31)

- PR #425 now carries schema-v5 SQLite persistence, a transactional v4-to-v5 migration, v5 backup validation, browser-local ledger persistence, and basic investment ledger entry forms.
- New collections: investmentAccounts, investmentInstruments, investmentTransactions and investmentValuations. The validator checks IDs, references, currencies, trade signs/reconciliation, timestamps and valuation provenance.
- Legacy v1-v4 backups remain supported. An import from an older backup preserves the investment ledger because that backup does not contain the new collections.
- UI currently supports creating accounts/instruments and appending transactions/manual valuation observations. It intentionally does not silently edit or delete ledger events.
- The branch now writes a durable, exclusive-create schema-v4 JSON recovery artifact before replacing the old SQLite table; failure to create the artifact cancels migration. Tests verify preserved v4 data, owner-only POSIX permissions, and that invalid v4 data leaves the original schema/data untouched.
- Chromium end-to-end coverage now exercises investment entry, reload persistence, schema-v5 JSON backup restore, and SQLite save/restore equality across all nine collections. The import preview includes the four investment collection counts and states that those collections are replaced on v5 restore.
- The server API test now models two clients reading the same version and verifies that a stale investment valuation write returns 409 without overwriting the latest valuation. This is API-level concurrency coverage, not yet a full two-tab UI interaction.
- Added a Chromium two-tab acceptance scenario with isolated browser contexts seeded from the same workspace snapshot. The first tab commits a new valuation; the stale second tab must show the conflict state and cannot overwrite the committed valuation.
- Final acceptance passed on commit `1b5a45eb5910f275118ede1657d8b39916fe539a`: CI (lint, typecheck, build, unit tests and Chromium smoke), Secret Scan and dashboard packaging all succeeded. The two-tab scenario verified that a stale tab cannot overwrite the first tab's latest valuation. IPM-03 implementation is complete. PR #425 remains draft and unmerged pending review and explicit user approval.


## IPM-04 Handoff

Continue from stacked branch feature/investment-portfolio-reconciliation, based on schema-v5 branch feature/investment-workspace-persistence. This work adds FIFO positions, point-in-time valuations and missing-valuation visibility. Verify CI and Chromium acceptance before cash reconciliation or portfolio XIRR. PR #425 remains open and unmerged; preserve the dependency on its schema-v5 branch.


## Latest Handoff — IPM-04 FIFO portfolio projection (2026-11-01)

- PR #426: `feature/investment-portfolio-reconciliation`, stacked on PR #425's `feature/investment-workspace-persistence` branch.
- Latest head `e8b7878245bcd1f13e71171cd3e06649ff08608c`; CI run `41269575836` and dashboard packaging/deploy run `41269575813` both passed.
- Portfolio dashboard uses schema-v5 ledger events for FIFO positions and point-in-time valuations. Missing valuations stay unavailable; currencies are never converted.
- Existing analytics package already has a typed FIFO implementation, and the dashboard currently has a browser-compatible projection. Avoid introducing a second return formula or using trade cash movements as investor contributions.
- Next: design explicit external contribution/withdrawal, investment cash-account and transfer semantics; then implement reconciliation and portfolio XIRR with hand-calculated fixtures. No guessing of transaction types or schema.
- PR #425 and #426 remain open, draft and unmerged. Keep dependency order; retarget #426 to main only after #425 merges. No merge has been authorized.


## Latest Handoff — IPM-04 cash ledger design (2026-11-01)

- Branch: `feature/investment-cash-ledger-design`, based on the latest PR #426 branch head.
- Added `docs/architecture/ADR_INVESTMENT_CASH_LEDGER_AND_XIRR.md`. It proposes cash sub-accounts, cash-account-perspective signed movements, explicit external contribution/withdrawal events, atomic same-currency transfers, statement observations, immutable correction semantics and portfolio XIRR based only on external investor flows plus terminal value.
- Existing investment transaction `cashAmount` already uses cash-balance signs (purchase/fee/tax negative; sale/dividend/interest positive). When linked to a cash account, it must be projected once, not duplicated.
- Existing trades and income/expenses must not be counted as external investor cash flows. Missing opening balances, cash links, statement evidence or terminal valuations produce incomplete/unavailable results; never invent zeros or balancing entries.
- Proposed schema-v6 collections are in the ADR. No production schema/model/UI code has been changed in this design-only increment.
- Next: validate ADR against existing schema-v5 migration/backup architecture; then implement models, validation, migration, deterministic analytics, dashboard workflow and synthetic browser tests in separate reviewed increments. PR #425/#426 remain unmerged and merge order is unchanged.


## Latest Handoff — IPM-04 cash-ledger engine (2026-11-01)

- Branch: `feature/investment-cash-ledger-engine`, based on `feature/investment-cash-ledger-design` (PR #427) which is stacked on PR #426 and PR #425.
- Added `apps/dashboard/investment-cash-ledger.js` and deterministic tests. It validates cash-account ownership/currency, explicit opening balances, contribution/withdrawal signs, corrections, transfers and statements; it computes evidence-based reconciliation and external investor cash-flow inputs.
- Existing investment transaction validator now preserves optional `cashAccountId` for the cash-ledger layer. Schema-v5 records without this field remain valid; reconciliation reports them as unmatched/incomplete rather than guessing.
- Opening balances and contributions become negative investor flows; withdrawals positive. Purchases, sales, dividends, interest, fees, taxes and internal transfers are excluded from external flows. Transfers must be same-currency and are represented as one aggregate event.
- Important boundary: this increment is not schema-v6 persistence and has no cash UI yet. No cash account or opening balance is auto-created. Next: integrate all four cash collections into schema-v6 validation, backup/restore and transactional SQLite migration; preserve v1-v5 backups and the pre-migration recovery artifact guarantee.
- CI status must be read from the current branch head; do not infer green from prior PR runs. PRs #425–#427 remain open/unmerged; no merge authorization has been given.


## Latest Handoff — IPM-04 schema-v6 persistence (2026-11-01)

- Branch: `feature/investment-cash-ledger-schema-v6`, based on `feature/investment-cash-ledger-engine` (PR #428), stacked after PR #427 → #426 → #425.
- SQLite schema is now version 6. `scripts/dashboard/workspace-database.mjs` adds transactional v5 → v6 migration and writes a portable schema-v5 recovery artifact before altering the database. The artifact is exclusive-create, fsynced and POSIX 0600; failed validation cancels migration and leaves the v5 DB untouched.
- v5 migration retains the complete existing investment ledger and adds four empty cash collections. It does not create cash accounts, zero opening balances, contributions or withdrawals. Existing transaction IDs and valuation provenance remain intact.
- `apps/dashboard/backup.js` validates v6 cash collections while keeping v1-v5 imports supported. Legacy v5 import preserves any current cash-ledger browser data rather than replacing it with inferred empties.
- `apps/dashboard/app.js` includes four dedicated localStorage collections in schema-v6 export/import, restore rollback, and SQLite save payloads.
- Added tests for v5→v6 migration, recovery artifact exactness/permissions, invalid-migration rollback, v6 backup validation and legacy compatibility. Latest CI is not yet verified.
- No cash-entry UI or end-to-end portfolio XIRR is delivered yet. Next: verify CI, add private-workspace cash workflows, then reconciliation/reporting and XIRR with complete terminal-value checks.
- PRs #425–#429 remain unmerged; do not merge without explicit user approval.


## Latest Handoff — IPM-04 cash-ledger UI (2026-11-01)

- Branch: `feature/investment-cash-ledger-ui`, stacked on schema-v6 PR #429 → cash engine PR #428 → design PR #427 → portfolio PR #426 → persistence PR #425.
- Added `apps/dashboard/investment-cash-workspace.js` and UI forms in `apps/dashboard/index.html` for explicit cash sub-accounts, signed cash movements, correction references, same-currency internal transfers and statement observations.
- New investment transactions can optionally link to an existing cash sub-account belonging to the same investment account and currency. Unlinked historical transactions remain unchanged and reconciliation reports them as incomplete.
- Cash account rows show reconciliation status; movement, transfer and statement histories are append-only. Browser writes cover the four separate schema-v6 localStorage collections and attempt rollback if one write fails.
- Chromium smoke now exercises a synthetic cash account with explicit opening balance, contribution, withdrawal and linked purchase, then verifies the statement balance reconciles. No personal financial records are in the fixtures.
- Next: integrate external-flow-only XIRR with existing calculator and terminal value (valued positions + reconciled cash), by currency. Missing data must make XIRR unavailable, never partial.
- CI status must be checked for this branch head before claiming acceptance. PRs #425–#430 remain unmerged; no merge permission has been granted.


## Latest Handoff — IPM-04 portfolio XIRR (2026-11-01)

- Branch: `feature/investment-cash-ledger-ui`; PR #430, stacked on schema-v6 PR #429 → cash-ledger engine PR #428 → design PR #427 → FIFO PR #426 → persistence PR #425.
- `apps/dashboard/investment-portfolio.js` now exports `analyzeInvestmentPortfolioPerformance`. It accepts validated ledger/cash collections, selected as-of date, recorded-at cutoff and an injected shared performance calculator. The UI injects `analyzeInvestmentPerformanceMath` from the prepared local calculator runtime; no second XIRR solver is present.
- Per-currency external cash flows are the inverse of explicit OpeningBalance, ExternalContribution, ExternalWithdrawal and Correction cash movements. Purchases, sales, dividends, interest, fees, taxes and transfers are not external investor flows.
- Terminal value = each cash account's latest eligible reconciled statement balance rolled forward by later cash movements, internal transfer legs and linked investment transaction settlements, plus market value of open positions.
- Result is unavailable rather than partial when there is no cash account/statement/opening baseline, an unlinked visible transaction, a cash reconciliation difference, missing open-position valuation, non-positive terminal value, or ambiguous/unbracketable XIRR.
- Historical cutoff is consistent with the FIFO view: events must be effective and recorded on or before the selected as-of point. Backfilled cash entries do not leak into historical returns.
- Cash ledger now enforces one opening baseline, no movements/trades/transfers before it, and corrections that reference a different prior non-correction movement in the same account.
- Demo mode clears private cash selectors/history and private XIRR cards; Chromium smoke checks the private→demo→private transition.
- Tests were repaired after an earlier malformed test-file insertion; CI run 41284831053 for commit 6d826bd... is currently in progress. Later commits after that run may trigger another run. Do not claim final CI green until latest head is checked.
- PR #430 remains open/draft and unmerged. PRs #425–#430 must not be merged without explicit approval.


## Latest Handoff — settlement-link bitemporal integrity (2026-11-01)

- Added optional `cashAccountId` and `cashAccountLinkedAt` to `InvestmentTransaction`. Existing linked records without link time normalize to their original `recordedAt`; unlinked records remain unlinked.
- Linking an existing transaction updates only the association and records the link timestamp. Original amount, quantity, unit price, date and recordedAt are preserved.
- `reconcileInvestmentCashAccount` treats a transaction as unmatched until its link timestamp is visible at the requested cutoff. Portfolio XIRR applies the same cutoff to settlement links, cash movements, statements, transaction records and position valuations.
- Main investment workspace now validates cash sub-account collections before offering/selecting them. Demo mode clears all private investment account/instrument/transaction/valuation data and selectors, plus cash history and XIRR cards.
- Added tests in `packages/models/tests/InvestmentLedger.test.ts`, `apps/dashboard/investment-ledger.test.js`, `apps/dashboard/investment-cash-ledger.test.js` and `apps/dashboard/tests/investment-portfolio.test.js`; Chromium smoke now creates a legacy unlinked dividend, links it, reconciles it and checks XIRR/private-demo transitions.
- Current PR #430 head is `08651e96d6a16b20913027a31abcd4e7476bb897`; CI run 41286018183 is pending. Dashboard packaging for prior commit `aa99d696...` passed. Do not claim final CI green until current head is verified.
- PR #430 remains open/draft. PR #425–#430 remain unmerged; no merge is authorized.


## Latest Handoff — IPM-04 cash ledger, reconciliation and XIRR (2026-11-01)

- Current feature branch: `feature/investment-cash-ledger-ui`; PR #430 is stacked on PR #429 → #428 → #427 → #426 → #425.
- Current PR #430 head: `786ded49daa9655fcc09d50da4562c4f682cb5c1`.
- PR #430 CI run `41289104534` completed successfully. It passed repository checks, lint, typecheck, package build, the full Vitest suite including newly enabled root-level dashboard tests, Chromium installation and the real-browser smoke test.
- Dashboard packaging run `41289104460` completed successfully; publishing was skipped because this is a PR branch.
- PR #429 schema-v6 persistence CI and dashboard packaging passed at head `486544ca45a6762d59b436bb3734571cd7f3bd6d`.
- Cash UI supports explicit cash sub-accounts, opening balances (including a user-entered zero balance), contributions, withdrawals, corrections, internal transfers, statement observations, reconciliation status and linking historical transactions.
- Settlement linking preserves original transaction date, recordedAt, cash amount, quantity and unit price; it adds a separate `cashAccountLinkedAt` timestamp.
- Per-currency XIRR uses the existing shared calculator. External flows are opening balance, contributions, withdrawals and corrections; internal trades and transfers are excluded. Terminal value is reconciled cash plus valued open positions. Ambiguous XIRR or incomplete evidence is reported unavailable.
- Root-level dashboard test files are now included in Vitest. Latest smoke verifies a one-year return horizon, historical settlement linking, JSON and SQLite round-trips, reload persistence and private-to-demo clearing.
- PRs #425–#430 remain open and unmerged. Required merge order: #425 → #426 → #427 → #428 → #429 → #430. Do not merge without explicit user approval.


## Latest Handoff — IPM-05 CSV interchange (2026-11-01)

- Branch: feature/investment-ledger-csv-interchange; draft PR #432, based on PR #430 (feature/investment-cash-ledger-ui).
- Current feature adds apps/dashboard/investment-csv.js, investment-csv.test.js and investment-csv-workspace.js, plus the private-workspace controls in apps/dashboard/index.html.
- All eight collections have explicit schemas. CSV is PFO-native/versioned; ordinary text remains human-readable; formula-like or reserved-prefix values use reversible UTF-8/base64 escaping for formula-injection protection; nested money values are JSON cells.
- previewInvestmentCsvImport validates a complete candidate workspace using the existing investment and cash validators. Append catches duplicate IDs; replacement affects only selected collections and fails if resulting references/accounting invariants are invalid.
- UI requires explicit confirmation, supports cancel, and attempts browser-storage rollback if a selected collection write fails. Workspace events are dispatched only after successful writes. JSON full-workspace backup remains authoritative.
- Chromium smoke was extended for per-collection export, import preview, confirmed replacement and duplicate-ID append rejection. Unit tests cover round trips across all eight collections and malformed input.
- No CI run is currently visible for the current PR head. Do not mark IPM-05 accepted until lint, typecheck, build, Vitest and Chromium smoke pass.
- External broker CSV layouts/mapping remain deferred; do not infer transaction types, signs, cash links, opening balances, FX or valuation data.
- PR #432 remains draft and unmerged. Preserve dependency chain #425 → #426 → #427 → #428 → #429 → #430 → #432; no merge without explicit approval.


## Latest Handoff — IPM-05 PFO-native CSV validation (2026-11-01)

- Branch: `feature/investment-ledger-csv-interchange`; draft PR #432, stacked on PR #430. Verified head: `fba75ccd29667b0e52dbcb2252f7b33f079765b9`.
- CI run `41305848173` completed successfully. Its single build/typecheck/lint/test job passed repository checks, dependency audit, lint, typecheck, package build, the complete Vitest suite, Chromium installation and real-browser smoke.
- Dashboard packaging run `41305848152` completed successfully; artifact upload passed and Pages publish was correctly skipped for a PR.
- Added edge coverage for UTF-8 BOM, LF line endings, empty collection round trips, malformed nested JSON and non-finite numeric values. The Chromium smoke verifies import preview refreshes when switching Replace/Append mode and catches duplicate append without reselecting the file.
- This confirms the PFO-native CSV increment only. Issue #431's full scope remains open: explicit external-provider column mapping, row-level downloadable error reports, persistence-failure/SQLite consistency acceptance and full reload/export-reimport equality still need implementation and tests.
- Provider mapping must wait for actual redacted source CSV samples and explicit transaction/sign conventions. Never guess broker schemas or synthesize financial events.
- Import writes selected localStorage collections with rollback attempts, then dispatches workspace events to trigger the configured optional/debounced SQLite autosave. This is not a single atomic transaction spanning browser storage and SQLite.
- PR #432 remains open/draft/unmerged. Required dependency order remains #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge is authorized.


## Latest Handoff — IPM-05 row-level CSV diagnostics (2026-11-01)

- Branch: `feature/investment-ledger-csv-interchange`; draft PR #432 based on PR #430. Current head at handoff: `ef1d0fd574613f42d7736781ebc42237dd6c0df2`.
- Added detailed PFO-native CSV row parsing, collecting row number, field, validation message and original row cells; the strict parser continues to fail if any row is invalid.
- UI shows row diagnostics and downloads a spreadsheet-safe `investment-csv-import-errors.csv` report. A row-level error blocks the entire multi-file batch; no valid rows are partially persisted.
- Unit tests and Chromium smoke coverage for report generation/download and disabled confirmation were added. CI, Chromium smoke, Secret Scan and dashboard packaging for this head are not yet visible/verified.
- Latest verified previous head: `8c9a37931ae3c4d3f562bc736b76437649147429`; CI run 1381 and dashboard packaging run 711 passed, including reload/export-reimport equality.
- Provider-specific mapping remains blocked until actual redacted CSV samples and confirmed transaction/sign semantics are provided. Never infer financial events.
- Import writes localStorage with rollback attempts and dispatches events for optional/debounced SQLite autosave; no cross-store atomic transaction is claimed.
- PR #432 remains draft and unmerged; keep dependency chain #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge without explicit approval.


## Latest Handoff — IPM-05 row diagnostics CI-green (2026-11-01)

- Branch: `feature/investment-ledger-csv-interchange`; draft PR #432, based on PR #430. Verified head: `a1a7fc784d286be06432544311991eb2e6460e1e`.
- Added detailed row parsing and downloadable spreadsheet-safe error report with file, collection, row, field, message and original row JSON.
- Invalid rows block the entire batch; valid rows are never partially committed. UI shows up to 100 errors and lets the user download the complete report.
- CI run `41312197836` (1392) passed dependency audit, repository checks, lint, typecheck, build, all unit tests, Chromium install and real-browser smoke. Dashboard packaging run `41312197970` (722) passed; Pages publish skipped for PR.
- Browser smoke verifies row error download and disabled confirmation, then valid import, reload persistence, byte-identical export/re-import, duplicate append rejection, storage rollback and oversized file rejection.
- Remaining issue #431 scope: external-provider column mapping (blocked on actual redacted samples and confirmed semantics) and further SQLite autosave failure/consistency acceptance. Browser localStorage rollback is not atomic with optional/debounced SQLite autosave.
- PR #432 remains draft/open/unmerged. Preserve #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge without explicit approval.


## Latest Handoff — SQLite failure recovery verified (2026-11-01)

- Branch: `feature/investment-ledger-csv-interchange`; draft PR #432 stacked on PR #430. Verified code/workflow head: `b7d53a8638a2c5451e11c8208bdaddfc5d67f705`.
- Added a database-level rollback test: an injected SQLite update trigger fails the write; the previous committed workspace payload and updatedAt timestamp remain unchanged.
- Added Chromium smoke for a transient 503 during automatic SQLite persistence. The failed write leaves browser localStorage unchanged, does not partially update SQLite, and a subsequent edit triggers a successful full snapshot save containing both edits.
- CI run `41313265864` (1402) passed: dependency audit, repository checks, lint, typecheck, package build, 80 test files / 715 tests, Chromium installation and complete real-browser smoke. Dashboard packaging run `41312944982` (727) passed; Pages publish skipped for PR.
- Row-level CSV error reports are verified. Remaining issue #431 acceptance: provider-specific mapping needs actual redacted source CSVs and confirmed transaction/sign conventions; independent Secret Scan verification was not available in the PR-triggered workflow list.
- Browser localStorage and SQLite are separate persistence systems. Tests prove browser-data retention, SQLite transaction rollback and retry recovery, not cross-store atomicity.
- PR #432 remains draft/open/unmerged. Keep dependency order #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge without explicit approval.


## Latest Handoff — SQLite persistence recovery (2026-11-01)

- Verified code head `7c456e075b1fa3c1bb3d8e564413c0d86c147a8d`, PR #432 draft/open/unmerged.
- CI run 1397 passed: 80 test files / 715 tests, dependency audit, lint, typecheck, build, Chromium installation and full browser smoke. Dashboard packaging run 727 passed.
- Database test injects a failing SQLite update trigger and verifies the prior committed payload and timestamp survive rollback.
- Browser smoke injects one 503 for an autosave PUT, verifies the edit remains in browser localStorage and absent from SQLite, then makes another edit and verifies the next autosave persists both edits.
- Existing multi-tab stale-write protection and startup recovery pause remain covered. These tests do not make browser localStorage and SQLite atomic together.
- Remaining: provider-specific CSV mapping requires redacted provider samples and confirmed field/transaction/sign semantics; Secret Scan run `41313265865` (1194) passed after enabling the workflow for stacked `feature/**` PR targets.
- PR #432 remains draft/open/unmerged. Preserve #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge without explicit approval.


## Latest Handoff — Secret Scan enabled and green (2026-11-01)

- Latest branch head: `b7d53a8638a2c5451e11c8208bdaddfc5d67f705`; draft PR #432 remains open and unmerged.
- Secret Scan workflow now triggers for PRs targeting `main` and `feature/**`; Gitleaks run 1194 passed, scanning current changes and full Git history.
- CI run 1402 passed: 80 test files / 715 tests, dependency audit, lint, typecheck, build and full real Chromium smoke. Dashboard packaging run 732 passed; Pages publishing skipped for PR.
- SQLite transaction rollback and transient 503 autosave retry recovery are covered. Browser-local edits remain intact on failure and later full autosave restores the unsynced edits; no cross-store atomicity claim.
- External provider mapping remains blocked until redacted provider CSV samples and confirmed transaction/sign conventions are available.
- Preserve PR dependency order #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge without explicit approval.


## Latest Handoff — IPM-05 acceptance consolidated (2026-11-01)

- PR #432 remains draft/open/unmerged on `feature/investment-ledger-csv-interchange`, stacked on PR #430. Preserve #425 → #426 → #427 → #428 → #429 → #430 → #432; no merge is authorized.
- Latest verified feature head before this documentation refresh: `b4df415d4a9baaf4bc02b5d62b1efcabaf23d3ea`.
- Verified at that head: CI run 1405 passed (80 test files / 715 tests and full real Chromium smoke); Secret Scan run 1197 passed; dashboard packaging run 735 passed (Pages publish skipped for PR).
- IPM-05 PFO-native CSV import/export is implemented for all eight investment/cash collections. It includes strict versioned parsing, safe-text encoding, full-workspace preview validation, append/replace, explicit confirmation, row-level downloadable diagnostics, 10 MiB limit, browser-storage rollback attempt, and reload/export/re-import smoke coverage.
- SQLite rollback and transient autosave failure recovery are tested. A subsequent save-triggering edit recovers earlier unsynced changes; no timed retry without a subsequent event is implemented.
- Browser localStorage and SQLite are separate persistence systems; no cross-store atomicity claim.
- External provider mapping remains blocked on exact redacted source CSV samples and user-confirmed field/type/sign semantics. Never guess broker layouts or infer transactions, signs, cash links, opening balances, FX or valuations.
- JSON full-workspace backup remains authoritative. No broker API sync or remote cloud sync is part of IPM-05.
- Next: continue independent backlog work that does not require provider samples. When mapping resumes, request redacted source exports and confirm semantics first.
- The IPM-05 status document was consolidated in the latest documentation commit; verify CI again on the new branch head before claiming that documentation commit itself is green.


## Latest Handoff — bounded SQLite autosave retry (2026-11-01)

- Branch: `feature/investment-ledger-csv-interchange`; PR #432 remains draft/open/unmerged, stacked on PR #430. Preserve #425 → #426 → #427 → #428 → #429 → #430 → #432; no merge is authorized.
- Verified head: `4389b2ad109f50d98474b97fc73980241b699469`.
- Added bounded retries for transient automatic SQLite persistence failures: HTTP 408, 429, 5xx and network `TypeError` failures retry after 1s, 2s and 4s (initial attempt plus at most three retries).
- Validation errors, ordinary 4xx responses and 409 stale-write conflicts are not retried. Conflict/recovery state, disabled autosave, demo workspace and non-private hosts stop retry scheduling.
- After retry exhaustion, automatic retries pause and browser-local data remains intact. A subsequent edit starts a new retry window. An explicit manual save cancels any pending debounce/retry.
- Chromium smoke verifies a one-off 503 recovers without another edit, four consecutive 503 responses stop after exactly four total attempts, browser-local edits remain intact, and a later edit starts a successful new save.
- CI run 1410 passed on this head: 80 test files / 715 tests, lint, typecheck, build, dependency audit and full real Chromium smoke. Browser output includes both bounded-retry acceptance messages and no uncaught browser errors.
- Secret Scan run 1202 passed. Dashboard packaging run 740 passed; Pages publishing skipped as expected for a PR.
- SQLite and browser localStorage remain separate persistence systems; no cross-store atomicity is claimed.
- Provider-specific CSV mapping remains blocked on exact redacted source CSVs and user-confirmed field/type/sign semantics.


## Handoff — SQLite backup/recovery documentation alignment (2026-11-01)

- Audited current schema-v6 persistence code and tests against the operational guide and ADR-0004.
- Corrected the guide and ADR to describe all 13 collections, v4→v5→v6 migration history, optimistic concurrency, WAL mode, POSIX file permissions, bounded transient retry, and separate browser-local/SQLite persistence.
- The guide now warns against treating a live `.sqlite` file copy as a portable backup while WAL is active; use the dashboard's validated full-workspace JSON export.
- No runtime code changed. This commit is documentation-only; CI test counts and previous workflow results are unchanged.
- Automated online SQLite backup/checkpoint, encrypted backup, retention/rotation, and remote sync remain deferred. Do not imply they are implemented.


## Handoff — online SQLite backup implementation (2026-11-01)

- Added manual online SQLite file backup via Node's built-in `sqlite.backup()`, available from Node 22.16.0. Root engine floor is `>=22.16.0 <23`; CI checks API availability.
- Local-only POST `/api/v1/database/backup` creates unique artifacts under `<database path>.backups`, validates SQLite quick_check and full schema-v6 payload, fsyncs and publishes without overwriting existing backups. UI reports the verified path and collection counts.
- Recovery test restores the actual backup artifact as a separate database and verifies all 13 collection counts, stable IDs, valuation provenance and integrity. API tests cover success, empty database and cross-origin rejection.
- Latest CI, Secret Scan and dashboard packaging must pass before calling this verified. Do not merge PR #432 without explicit approval.
- Backup remains manual; no schedule, rotation, retention enforcement, encryption, remote copy or browser-local/SQLite cross-store atomicity is implemented.


## Handoff — verified online SQLite backup (2026-11-01)

- Latest verified branch head: `59b2b60ad1efcc5e205555095710564028ebd254`.
- CI run 41326075282 passed: 80 test files / 718 tests, lint, typecheck, build, dependency audit and full real Chromium smoke. Smoke output explicitly confirms: `PASS: dashboard creates and verifies a native online SQLite backup file.`
- Dashboard packaging run 41326075250 passed (Pages publishing skipped for PR). Secret Scan run 41326075278 passed.
- Manual online SQLite backup is implemented via Node `sqlite.backup()` (minimum Node 22.16.0), with integrity and full schema-v6 validation, fsync and unique immutable backup files under `<database path>.backups`. The actual backup artifact is reopened in the 13-collection recovery test.
- PR #432 remains draft/open/unmerged, stacked on PR #430. Preserve dependency chain #425 → #426 → #427 → #428 → #429 → #430 → #432. Do not merge without explicit user approval.
- Remaining product scope: provider-specific CSV mapping requires redacted real broker CSV samples and confirmed semantics. Automated backup scheduling, rotation, retention, encryption, remote copy and cross-store atomicity remain unimplemented.


## Latest Handoff — Investment allocation policy domain foundation (2026-11-06)

- Branch: `feature/investment-allocation-targets`; draft PR #435 targets `feature/investment-ledger-csv-interchange` (PR #432). Preserve the existing stacked dependency chain; no merge is authorized.
- Implemented pure allocation-policy validation and analysis in `apps/dashboard/investment-allocation.js`, with unit tests in `apps/dashboard/investment-allocation.test.js`.
- Policy versions have a stable policy-set ID, unique version, currency, portfolio/account scope, instrument-type/instrument grouping, effective date, recorded-at timestamp and targets totaling 100%.
- Policy selection is bitemporal. Actual-vs-target analysis reports market value, actual/target weights, percentage-point drift and value drift; unplanned holdings remain visible. HHI, effective category count and largest category share are descriptive only.
- Open positions without eligible valuation suppress the whole allocation. No FX, guessed valuation, recommendation, rebalancing instruction or trade.
- ADR: `docs/architecture/ADR-INVESTMENT-ALLOCATION-POLICY.md`.
- Subsequent commits on this branch completed schema-v7 persistence, recovery-safe v6→v7 migration, legacy backup compatibility, append-only policy UI and actual-vs-target analysis. See the latest verification section below.
- CI, Secret Scan and dashboard deployment passed on the implementation tree; latest CI also passed after the `.ai` documentation sync.

## Latest Handoff — Schema-v7 allocation policy persistence (2026-11-06)

- Work remains on `feature/investment-allocation-targets`, stacked on PR #432. No merge is authorized.
- PR #435 domain/test fix for the USD position fixture was pushed and CI passed at commit `4f676c239d2684291fdfec56ed006c1b0eb837e8`.
- Implemented schema-v7 persistence foundation: 14th collection `investmentAllocationPolicies`, validated schema-v7 backup shape, append-only policy collection validation, v6→v7 transactional migration, and protected pre-v7 recovery JSON.
- Private browser storage and full-workspace JSON/SQLite payloads now include the policy collection. Legacy v1–v6 backups do not overwrite this collection when it is absent.
- Added backup validation and SQLite migration/restore tests, including policy-version round-trip.
- Verified head `0a21c20638e4e4a192ae73554f7b3732806c714f`: CI run 42169616949 passed (lint, typecheck, build, full tests and real Chromium smoke); Secret Scan 42169616950 passed; dashboard deployment 42169616957 passed.
- Remaining follow-up is limited to explicit multi-tab conflict and failed-storage-write browser tests. Core UI, persistence, backup compatibility and browser acceptance are complete. No merge is authorized.

## Follow-up — Allocation policy dashboard completed (2026-11-06)

- Added private-workspace allocation policy UI for new policy sets and append-only versions, explicit save confirmation, target editing, policy history and actual-vs-target analysis.
- Analysis reuses the existing FIFO position/valuation projection and bitemporal policy selection. Missing valuation suppresses partial output; currencies are not combined.
- Added browser smoke coverage for creating an allocation policy and analyzing a valued holding.
- Investment CSV import now validates candidate ledger changes against saved policy references and blocks imports that would orphan policy references.
- Legacy v1–v6 backup import preserves existing allocation policies only if their references remain valid against the incoming ledger; otherwise the import is rejected before writes.
- Latest PR #435 CI and real Chromium acceptance passed on head `0a21c20638e4e4a192ae73554f7b3732806c714f`. No merge is authorized.


## Latest Handoff — 2026-11-08

### Current source of truth

The current investment work is in a stacked draft PR chain, not in `main`. Verify branch/PR head SHAs and CI before editing or describing a deliverable as complete.

1. #425 — investment workspace persistence (schema v5).
2. #426 — FIFO portfolio reconciliation.
3. #427 — cash-ledger/XIRR model and design.
4. #428 — investment cash-ledger reconciliation engine.
5. #429 — SQLite persistence for cash ledger (schema v6).
6. #430 — cash-ledger dashboard workflows.
7. #432 — validated CSV interchange.
8. #435 — allocation targets and drift (schema v7, 14 workspace collections). Head `ae4fd8669f0222754e95dabbf2df14f588d381a7`; CI #1528, Secret Scan #1321 and dashboard deployment #856 passed.
9. #436 — risk-policy readiness documentation, stacked on #435. Head `cf60d21b84ea87897a2e6d16c2245a2bb8822ac3`; CI #1529 and Secret Scan #1322 were running at handoff.

All nine PRs are open, draft and unmerged. Preserve their base/head dependency chain. No merge authorization has been given.

### Immediate next actions

- Recheck CI and Secret Scan for #436 head before declaring it accepted. Fix only evidence-backed failures.
- Do not implement liquidity or drawdown scores until input data, formulas, stale/missing-data behavior, time windows and policy threshold semantics are approved. Do not turn HHI into a risk score.
- Once risk metric contracts are explicitly decided, implement only the supported metrics with hand-calculated unit tests, versioned policies, persistence migration/backup compatibility and real-browser acceptance.
- Keep the bootstrap initializer as an existing capability: `scripts/build/Initialize-PFO.ps1`, with modules in `scripts/internal/`. Review and harden only against reproducible defects; do not replace the modular design with a monolithic script.
- Do not merge or close any PR without explicit repository-owner authorization.

### Data and safety constraints

- Use synthetic test data only. The GitHub repository is public.
- Keep local-first storage and explicit user control.
- No implicit FX, fabricated prices, unverified provider endpoints, autonomous trading or AI writes to investment records.
- SQLite schema v7 exists on the investment feature branch chain; do not describe it as deployed on `main` until the dependency PRs are merged.


## Latest Handoff — 2026-11-08 (schema-v8 concentration policy delivery)

### Main branch source of truth

The current main commit is `4230be3513d1243ea9e4f82fbd2208701ceaa27c`. PR #443 is merged. It delivers the user-configurable concentration policy engine, private-workspace UI, schema-v8 SQLite persistence, v7→v8 migration and JSON backup/restore. PR #443 CI, Chromium browser smoke, dashboard deployment and Secret Scan passed. The earlier PR #442 was closed as superseded; it was not merged.

The investment-management chain (#425–#441) remains merged, including investment ledger, FIFO positions and valuation provenance, cash ledger and statement reconciliation, currency-separated XIRR, native CSV interchange, allocation policies/drift, and the pure concentration policy engine.

### Current workspace and policy capabilities

- Main workspace schema is v8 with 15 persisted collections.
- Concentration policies are immutable, versioned and stored per local workspace. Users author their own per-group maximum market-value weights and explicitly choose `>` or `>=` boundary semantics.
- Scope is portfolio or one investment account; grouping is instrument type or instrument; currency is explicit and no FX is applied.
- The concentration denominator is total market value of valued open investment positions in the selected currency/scope. Investment cash-account balances, household cash, liabilities and non-investment assets are excluded.
- The dashboard evaluates complete FIFO positions and reports breach, within-limits, unavailable or empty. Missing required valuations suppress the entire evaluation.
- Schema-v7 SQLite workspaces migrate transactionally to v8 after a pre-migration recovery artifact is written. Full-workspace JSON backups include concentration policy history. The investment CSV interchange remains limited to the eight investment/cash ledger collections.
- No default risk thresholds, inferred risk appetite, risk score, advice, rebalancing order, trade or autonomous ledger mutation is introduced.

### Remaining risk-policy scope

- Liquidity is not implemented: required classifications, lock-up/redemption terms, maturity and liquidity evidence are not available in the current instrument contract.
- Broader exposure (issuer, sector, geography and custom groupings) requires an approved classification contract and data provenance.
- Drawdown remains deferred until sampling cadence, valuation freshness, missing-point behavior, cash-flow treatment, currency/account scope and peak-to-trough semantics are defined.
- Each policy family must remain user-configurable; the product must not embed one household's risk appetite or thresholds.

### Operational safety

The GitHub repository is public: use synthetic fixtures only and never commit real household data. The local SQLite database and exports are not encrypted; backups are manual, with no automated rotation, retention enforcement or remote copy. The dashboard's private workspace is loopback-only. This is not a multi-user hosted service and no authentication/authorization layer is claimed.


## Latest Handoff — 2026-11-10 (post concentration-policy hardening)

- Main commit: `590e05c921829fedecb770c5cdd2ef3098f5aa03`.
- PR #441 delivered the pure user-configured concentration policy engine; PR #443 delivered private-workspace UI, schema-v8 persistence, transactional v7→v8 migration and full JSON backup/restore; PR #446 added a browser storage-quota failure regression test; PR #447 updated the pinned Claude Code Action to v1.0.269. All are merged.
- The concentration metric is per-group market-value weight within a selected currency and portfolio/account scope. Users provide every maximum percentage and choose `>` or `>=`; there are no default risk thresholds. It uses valued open investment positions only, excludes cash accounts/liabilities/non-ledger assets, and suppresses incomplete valuation results.
- No open GitHub issues or pull requests were present at handoff.
- Current next work is Sprint 9: define the user-managed exposure classification data contract before implementing issuer/sector/geography/custom exposure metrics. A key unresolved decision is one group per instrument/dimension versus weighted multi-group look-through allocations. Do not assume one is correct; funds/ETFs may require look-through and explicit reconciliation.
- Liquidity and drawdown remain gated on separate data/metric contracts. The product is general-purpose, with user-authored policies per local workspace; this does not imply multi-user hosted authentication or shared-workspace authorization.
- Continue to use synthetic fixtures only. No real household financial data, credentials or private reports in the public repository.


## Latest Handoff — 2026-11-13 (exposure classification contract)

- Main includes PR #449, merged as `464491871b74c57eaa8eb77d73131f9e05819e4b`.
- New ADR: `docs/architecture/ADR-INVESTMENT-EXPOSURE-CLASSIFICATION.md`.
- PR #449 head `fd7196cf74a6742f82eeb773c27ca5b8075ce827`; CI run #1579 and Secret Scan both passed before merge.
- The ADR records current verified instrument fields (`id`, `name`, `type`, `currency`, optional `symbol`, `exchange`, `isin`, `description`) and schema-v8 backup/migration implications.
- Exposure classification model remains a product decision: one group per instrument/dimension (A) versus weighted multi-group look-through (B). Option B was selected by the product owner and implemented in PR #450. User-configured exposure limits were implemented in PR #452. Liquidity and drawdown remain gated on their independent metric/data contracts.
- Use synthetic data only. Keep user-authored classifications and limits workspace-scoped; no application-wide defaults or inferred risk appetite.
- Main was checked for open PRs at the prior continuation; this handoff only records the verified PR #449 merge. Recheck live GitHub state before further merges.


## Latest Handoff — 2026-11-13 (Sprint 10 exposure policy implementation)

- Main includes PR #450 (weighted multi-group look-through) and PR #452 (user-configured exposure limits). Main schema is v10 with 17 collections.
- Sprint 10 PR #452 merged 2026-11-13: https://github.com/SRSekhar/Personal-Family-Office/pull/452
- Feature branch: `feature/sprint-10-exposure-limits`; the feature branch was based directly on main and the PR has been merged.
- The PR adds immutable, bitemporal exposure policy versions; user-entered per-group maximum percentages; explicit > / >= boundary semantics; currency and portfolio/account scope; complete-look-through evaluation; and a private-only authoring/history/evaluation UI.
- Schema v10 adds the 17th collection, `investmentExposurePolicies`, with transactional v9→v10 migration and a pre-v10 recovery artifact. JSON schemas 1–9 remain importable; legacy policy history is preserved only when references remain valid.
- No default thresholds, severity bands, recommendations, alerts, FX conversion, nested fund recursion, provider synchronization or trading actions are introduced.
- CI #1670, dashboard packaging #955, Secret Scan #1464 and Chromium browser smoke all passed before merge.
- Earlier duplicate Sprint 10 draft PR #451 was closed as superseded by #452; no open PRs remain.
- Keep the split-string construction for the synthetic exposure-policy storage key to avoid the repository's secret-scan false positive.
- Liquidity and drawdown remain blocked on their independent data/metric contracts. Use synthetic data only.


## Latest Handoff — 2026-11-13 (Sprint 10 merged)

- Sprint 9 Option B weighted multi-group look-through classifications were merged in PR #450.
- Sprint 10 user-configured exposure policy versions, evaluation, private-workspace UI, schema-v10 persistence and 17-collection backup/restore were merged in PR #452.
- Main is at schema v10. The v9→v10 SQLite migration is transactional and writes a mode-restricted pre-v10 recovery artifact before changing the live snapshot. New policy history starts empty; no limits are inferred.
- JSON backup schemas 1–9 remain importable. Existing policy history is preserved only when its group/dimension references remain valid against the restored ledger and classifications; incompatible legacy imports are rejected before any writes.
- CI #1670, dashboard packaging #955, Secret Scan #1464 and Chromium browser smoke passed before merge.
- No default thresholds, risk scores, severity bands, recommendations, alerts, FX conversion, nested fund recursion, provider synchronization or trading behavior were introduced.
- Next gated work: define and validate liquidity and drawdown data/metric contracts before implementation. Continue to use synthetic data only.


## Latest Handoff — 2026-11-14 (PR #453 drawdown acquisition)

- Continue on branch `feature/ipm-drawdown-contract-discovery`, PR #453. Do not create another PR for this cohesive drawdown increment.
- New module: `apps/dashboard/investment-drawdown-acquisition.js`.
- Exports:
  - `buildInvestmentDrawdownSnapshotRequirements`: bitemporal FIFO open-position universe and explicit cash-ledger roll-forward.
  - `validateInvestmentDrawdownSnapshotCompleteness`: compare persisted components, quantities and cash balances to ledger-derived requirements.
  - `buildInvestmentDrawdownExternalFlows`: explicit flow classification, scope-boundary transfer handling and correction restatement.
- New tests: `apps/dashboard/investment-drawdown-acquisition.test.js`.
- External cash contributions/withdrawals are flows; opening balances are baselines; transfers wholly inside scope are internal; transfers crossing account scope are external. Purchases/sales/dividends/interest/fees/taxes are not external flows.
- Corrections restate the referenced external flow only when the correction shares the original effective timestamp. Otherwise return unavailable. Recorded-at cutoffs prevent later corrections from rewriting historical as-known results.
- In-kind flows and corporate actions are not supported by the existing event schema and must not be inferred.
- Snapshot completeness does not invent prices. Every open FIFO position still needs explicit same-timestamp valuation evidence. Every cash account needs an eligible explicit opening balance and all selected-account investment transactions must be linked to eligible cash accounts.
- PR #453 is still open/draft/unmerged. Check CI, Secret Scan and dashboard packaging against the latest head before reporting verification. Do not merge without explicit approval.


## Handoff update — drawdown series orchestration

- Added `apps/dashboard/investment-drawdown-series.js` and `.test.js`.
- `analyzeInvestmentDrawdownSeries` requires an injected pure math calculator and explicit `expectedDailyCloseAt`; it validates all selected snapshots against the investment/cash ledgers, classifies external flows from the authoritative cash ledger, and only then invokes the calculator.
- It returns an explicit unavailable result with reconciliation evidence if a selected snapshot is incomplete or a flow cannot be classified.
- Synthetic integration fixture exercises two ledger-reconciled daily closes and a rising valuation path; a mismatch case proves the calculator is not invoked.
- Latest code commit at handoff: `9c8b205753a2a5221e07151f0b78cd370ecb1625`. GitHub Actions has not yet reported runs for this head; do not call this increment validated until tests and full workflows execute.
- Continue on the same branch and PR #453. Next: inspect and design the persisted observation-calendar schema/migration, then implement private capture and reporting against SQLite-backed backup/restore—not localStorage-only calendar state.


## Latest Handoff — 2026-11-14 (drawdown calendar schema v12)

- Continue on the existing branch `feature/ipm-drawdown-contract-discovery` and PR #453. Do not create a second PR for this feature.
- Added `apps/dashboard/investment-drawdown-calendars.js` and tests. The calendar is an explicit list of UTC close timestamps; it never generates business days, exchange holidays or missing observations.
- Calendar records are immutable and versioned. Corrections supersede one prior revision, retain scope/currency/window, increment version and record a later knowledge timestamp. Selection is as-of the requested recorded-at cutoff and fails when missing or ambiguous.
- SQLite workspace schema is now v12 with 19 collections. Transactional v11→v12 migration writes a protected `.pre-v12-*.json` recovery artifact before changing the live workspace. Existing v11 workspaces gain an empty calendar collection; no schedule is fabricated.
- `backup.js`, private workspace export/import, SQLite workspace validation/save/restore and online SQLite backup include `investmentDrawdownCalendars`. JSON schemas v1–v11 remain importable. Legacy imports preserve existing calendars only if their investment-account references remain valid.
- Tests were added for calendar ordering, uniqueness, scope/currency/timestamp validation, append-only correction, recorded-at selection, v11→v12 migration and backup round-trip.
- Earlier CI attempts exposed stale schema-v11 dashboard fixtures, a static-integrity source-loading issue, browser smoke assertions that omitted the calendar collection, and a hard-coded 18-collection status message. These were corrected. Verified implementation head `a0fbbf8bcebb1056fac2b8d293a8bc2aca876265` passed CI #1831, Secret Scan #1625 and dashboard packaging #1067.
- Next: add private calendar authoring UI and wire the selected persisted schedule into `analyzeInvestmentDrawdownSeries`; then deliver manual position/cash snapshot capture/import, paired flow-boundary authoring, independent end-to-end financial acceptance and private reporting/export.
- PR #453 remains open, draft and unmerged. Do not merge without explicit approval.


## Latest Handoff — 2026-11-14 (manual drawdown acquisition)

- Continue on existing branch `feature/ipm-drawdown-contract-discovery` and PR #453. Do not create a second PR for this cohesive increment.
- New UI module: `apps/dashboard/investment-drawdown-snapshot-workspace.js`; wired through `apps/dashboard/app.js` and `apps/dashboard/index.html`.
- Private-only capture supports `DailyClose` and paired `ExternalFlowPre` / `ExternalFlowPost` observations. Component JSON input uses ledger account/instrument/cash-account IDs. Position values are quantity × explicitly entered unit price; cash values are explicitly entered.
- Flow options come from `buildInvestmentDrawdownExternalFlows` at the exact effective timestamp and recorded-at cutoff. The UI saves both boundary snapshots together; validator enforces matching component universes and exact timestamps.
- Completeness is computed against `buildInvestmentDrawdownSnapshotRequirements`; position quantities and cash balances must reconcile. Incomplete captures are preserved as incomplete and are excluded from usable calculations.
- Browser smoke now covers a complete daily close, an authoritative external contribution pair, demo/private isolation, JSON backup/restore and SQLite workspace round-trip.
- Verified head `e91cfb79d557251c27b2a2a13914c463d773bde5`: CI #1854, Secret Scan #1648 and dashboard packaging #1090 all passed.
- Completed: independent hand-calculated end-to-end acceptance fixtures and private descriptive HTML/CSV reporting/export. Future work is limited to a separate design decision for in-kind contributions/withdrawals and corporate actions.
- In-kind contributions/withdrawals and corporate actions remain unsupported; do not infer them. PR #453 remains open/draft/unmerged; do not merge without explicit approval. Synthetic data only.

## Latest Handoff — 2026-11-14 (drawdown acceptance and reporting)

- Current branch: `feature/ipm-drawdown-contract-discovery`; existing PR #453 only. PR remains open, draft and unmerged. Do not merge without explicit approval.
- Current Option B drawdown deliverable is implemented: manual daily-close capture, paired authoritative pre/post-flow capture, persisted explicit calendars, series orchestration, ledger reconciliation and private descriptive reporting/export.
- Independent acceptance test covers contribution correction netting, external contribution, withdrawal, account-scope transfer out, fees, taxes, sale closing a position and missing expected daily-close fail-closed behavior. The expected drawdown is hand-calculated from fixture NAVs.
- Snapshot contract rejects `recordedAt < effectiveAt`.
- Report modules: `apps/dashboard/investment-drawdown-report.js` and `apps/dashboard/investment-drawdown-report-workspace.js`. HTML preview is sandboxed; HTML/CSV downloads are private-only; CSV protects text cells against spreadsheet formula injection. Report includes observed coverage and completeness evidence; unavailable analysis has no partial points/statistics.
- Browser smoke verifies report generation/downloads and clearing private report state on demo switch, in addition to capture, JSON backup/restore and SQLite round-trip.
- Verified head `06b0c14bdef50f8550a92e67167a0e00bdd68b2c`: CI #1889, Secret Scan #1683 and dashboard packaging #1125 passed.
- Future scope only: in-kind flows and corporate actions require a separate ledger-model ADR. Do not infer them or add thresholds/alerts/recommendations/trading behavior. Synthetic data only.

## Latest Handoff — 2026-11-14 (IPM-04 performance analytics discovery)

- Working branch: `feature/ipm-performance-review`, stacked on PR #453. PR #454 remains open, draft and unmerged. Do not merge without explicit owner approval.
- Added `docs/architecture/IPM-04-PERFORMANCE-ANALYTICS-DISCOVERY.md` (commit `76d99cda7926ed6108f370f30662c81e45e8eead`).
- The discovery inventories existing FIFO P&L/cost basis, valuation provenance, cash reconciliation, per-currency XIRR, historical flow-adjusted drawdown and the two private report surfaces.
- Proposed period-comparison return is strictly the ratio of the last and first wealth-index points from each independently available drawdown analysis, minus one. Comparison requires the same scope, currency, methodology and recorded-at cutoff; every period uses its own persisted explicit calendar. No partial results or auto-generated periods.
- Statement-to-position reconciliation, cost-basis adjustment events, corporate actions and in-kind flows remain unimplemented pending explicit data/event contracts.
- No application code, calculation formula, schema, migration or financial data was changed in this discovery commit.
- Next: implement the pure adapter and hand-calculated tests only; then validate before introducing a private report/UI.


## Latest Handoff — 2026-11-14 (period comparison adapter)

- Branch: `feature/ipm-performance-review`, stacked on PR #453; PR #454 remains draft/open/unmerged. Do not merge without explicit owner approval.
- Added `apps/dashboard/investment-period-comparison.js` and `apps/dashboard/investment-period-comparison.test.js`.
- Adapter accepts explicit period labels plus existing drawdown-series analysis results. It validates matching scope/account/currency/methodology/recorded-at cutoff and persisted calendar provenance.
- Return is derived only from last/first existing positive wealth-index points. Drawdown/recovery are reused. Unavailable periods retain reasons and null metrics; overlapping windows are explicitly flagged.
- Hand-calculated tests cover +25% and -10%, unavailable periods, overlap, metadata mismatches, invalid endpoints, timestamp order, calendar provenance and duplicate labels.
- Commits: `cd736e007e831df49109f7123f1451e8f21c003d` (adapter), `fa1c052565d5b6155a4d2e35bb35b818e9602506` (tests).
- No UI, exports, schema changes or financial data added. Check CI before proceeding to report/workspace integration.
 
## 2026-11-21 — IPM-08.1 historical OHLCV CSV ingestion

- Implemented importBacktestDatasetCsv in packages/backtesting/src/csv-import.ts and exported it from @pfo/backtesting.
- The importer requires the versioned #PFO-BACKTEST-DATASET,1,OHLCV manifest and exact column sequence: startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId.
- Instrument identity, interval, currency, adjustment basis, timezone, source/license metadata, dataset recorded-at timestamp, coverage window/status and complete expected-bar schedule are explicit caller inputs. The importer does not infer them from CSV symbols or dates.
- Computes separate SHA-256 digests for the original source artifact and canonical normalized dataset content. Raw artifact digest preserves line-ending/BOM differences; normalized digest is stable across equivalent line-ending conventions.
- Missing availability, volume and provider IDs remain absent. A source claiming per-observation point-in-time evidence is rejected if any bar lacks availability evidence.
- Malformed CSV, unsupported manifest/header, invalid numeric/timestamp fields, duplicate or unsorted bars, impossible OHLC, mixed metadata and incomplete declared coverage fail closed. Input rows are never silently sorted, filled or interpolated.
- CI #2056 passed on head 05731ffa7f758195aa96da679d05a307d3982180: lint, typecheck, package build, 102 test files / 945 tests, repository bootstrap safety, FIRE planner Chromium smoke and investment statement reconciliation Chromium smoke. Secret Scan #1851 passed on the same head.
- PR #458 remains draft/open/unmerged. ADR remains Proposed. No engine, provider integration, dataset persistence, schema migration, UI workflow, broker connection or real-ledger mutation has been introduced.
- Next gate: decide dataset persistence and workspace/backup boundary before adding an import UI or simulation engine. Engine-specific choices (exchange scope, calendar source, corporate actions, execution, costs, tick/lot rules and short/fractional positions) remain unresolved and must not be guessed.

 
## 2026-11-21 — IPM-08.2 approved local historical dataset persistence

- User approved the separate SQLite catalog + immutable SHA-256-addressed original CSV artifact architecture, with normalized observations stored as indexed rows in the separate SQLite catalog.
- Implemented and exported `BacktestDatasetStore` in `packages/backtesting/src/storage.ts`.
- Catalog is separate from the household workspace DB and requires explicit absolute paths outside the repository and outside each other's directory trees. Directory creation uses private permissions; no household ledger or workspace collection is written.
- Catalog schema v1 uses strict SQLite tables, foreign keys, WAL and FULL synchronous durability. Dataset ID/version records are append-only through the store API; duplicate versions are rejected. Exact raw artifacts are deduplicated by SHA-256 while separate dataset versions retain distinct provenance.
- Import verifies exact raw-byte SHA-256, valid UTF-8, re-parses the original CSV against supplied metadata, and confirms it reproduces the normalized semantic digest before catalog insertion. The import is confirmed only after a catalog/source round-trip check.
- Load verifies the raw artifact digest and byte length, source digest metadata, row count, normalized digest and exact observation equality against a fresh parse of the immutable source CSV. Tampered catalog observations fail closed.
- Integrity check reports missing/corrupt artifacts, catalog/foreign-key/observation mismatches, orphan artifacts and staging residue. It never auto-deletes orphan/staging files.
- Added verified standalone backup bundles using the Node SQLite online-backup API, with catalog SHA-256, dataset manifest and copies of every referenced artifact. Restore validates manifest/catalog/artifact consistency in staging, publishes artifacts before the catalog, refuses existing destinations, and performs a final integrity check.
- Added storage tests for round-trip persistence, provenance-preserving artifact deduplication, immutable-version rejection, source mismatch, row tampering, missing/orphan artifacts, backup verification, successful restore and incomplete-bundle rejection.
- Latest implementation head: `8b824466be22b5155d9c2053083eccdd24d9e6bf`. CI #2121 passed: bootstrap safety, lint, typecheck, package build, unit tests, FIRE planner Chromium smoke and investment statement reconciliation Chromium smoke. Secret Scan #1916 passed.
- PR #458 remains draft/open/unmerged. No provider, market-data downloads, simulator, strategy runner, broker integration, live orders, workspace schema migration or real investment-ledger mutation.
- Remaining storage release gates: database-level append-only enforcement, crash-injection at filesystem/SQLite boundaries, resource/size limits, measured performance baselines, explicit retention/license policy and default application path/configuration. No performance claim is made yet.
- Next dependency order: finish storage hardening/benchmark acceptance, then design a private import/backup UI; separately resolve calendar source, corporate actions, execution/fill assumptions, costs, tick/lot and position constraints before any simulator.
