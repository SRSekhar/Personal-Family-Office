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

- **Completed Epics:** Local SQLite Persistence (PRs #394, #397, #400, #403, #404) and Backup and Recovery Assurance (PRs #406–#409).
- **Current Epic:** User-configurable investment risk policies. Concentration policies (PR #443), weighted exposure Option B (PR #450), and user-configured exposure limits (PR #452) are merged. PR #453 (open draft, unmerged) approves Option B flow-adjusted drawdown and adds the pure kernel, component-level snapshot contract/validation, schema-v11 migration and JSON/SQLite backup integration. Trusted capture/completeness builder, authoritative event taxonomy, daily observation calendar, integration acceptance and private UI remain outstanding. Liquidity remains independently gated.
- **SQLite status:** Main stores schema v10 with 17 collections. PR #453's feature branch advances the workspace to schema v11 with 18 collections and a transactional v10→v11 migration that writes a protected pre-v11 recovery artifact; the branch is not merged. Existing explicit/automatic save, startup recovery protection, optimistic concurrency, portable JSON backup, restore and integrity diagnostics remain intact. PR #452 merged after CI, dashboard packaging and Secret Scan passed. The database defaults outside the checkout; POSIX database and sidecar files are owner-only. Browser-local storage remains the immediate recovery copy.
- **Recovery assurance:** Sprint 10 adds full-content JSON export/restore coverage across all 17 schema-v10 collections. PR #453 extends its branch with schema-v11 drawdown snapshot validation, JSON backup compatibility, SQLite v10→v11 migration and pre-migration recovery artifact tests; latest branch head passed CI #1759 (86 files / 833 tests), Secret Scan #1553 and dashboard deployment workflow #995; CI #1670, dashboard packaging #955 and Secret Scan #1464 passed. Truncated/wrong-schema/oversized backup imports and malformed/oversized API bodies are rejected without replacing existing data. Clean close/reopen persistence and SQLite PRAGMA quick_check are tested. Operational instructions are in docs/operations/LOCAL_BACKUP_AND_RECOVERY.md.
- **Privacy boundaries:** The database and JSON exports are not encrypted by this feature. Exports require user-managed secure storage and retention. Cloud hosting, multi-user access, remote backup, and automatic backup rotation are not shipped.
- The planner reuses the existing deterministic calculator APIs, keeps assumptions/results ephemeral, requires explicit annual assumptions, and disables planner controls on hosted non-loopback origins.
- Scenario comparison preserves entered order, shows the scenario assumptions, and does not rank or recommend scenarios.
- FIRE report export is explicit user action. Reports are script-free, self-contained HTML, validate report inputs/results, escape untrusted scenario names, and are generated locally without network submission.
- The dashboard's static artifact is packaged successfully by CI. The session-only Goal Tracker does not persist goals or project returns. Publishing remains blocked until the repository owner configures GitHub Pages in Settings → Pages with Source set to GitHub Actions.
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

## Current Product Direction\n\n- Option B — full investment portfolio management — approved. Architecture/research ADR is committed at `docs/architecture/PORTFOLIO_MANAGEMENT_RESEARCH_AND_ARCHITECTURE.md`. Delivery is phased and must preserve existing financial workflows and schema-v4 backup compatibility.\n- Research patterns reviewed: TradingAgents specialist research, adversarial challenge, point-in-time correctness and reproducibility; OpenBB provider-neutral typed extension architecture; Maybe self-hosted personal-finance workflows (AGPL-3.0 code reuse prohibited absent licensing approval); vn.py event-driven portfolio/risk/data modules. Microsoft organization URL requires a specific repository before code review.\n- No third-party source code copied. Root project remains UNLICENSED; license review required before any reuse.\n\n## Current Portfolio Management Delivery\n\n- IPM-01 investment ledger domain foundation merged in PR #422. It adds accounts, instruments and immutable signed transactions with currency/date/sign and trade amount reconciliation invariants.\n- IPM-02 FIFO position projection and manual valuation provenance is implemented in PR #424, pending CI/merge. It reports cost basis, realised/unrealised gain, income, fees and taxes, with explicit unavailable values when no as-of valuation exists.\n- Remaining portfolio management scope and acceptance criteria are tracked under Epic 6 in `.ai/BACKLOG.md`; see `docs/architecture/PORTFOLIO_MANAGEMENT_RESEARCH_AND_ARCHITECTURE.md`.\n\n## Current Sprint 9 Deliverables

- Accepted Option B weighted look-through contract in `docs/architecture/ADR-INVESTMENT-EXPOSURE-CLASSIFICATION.md`.
- Implemented immutable exposure classifications, provenance, bitemporal selection and complete weighted exposure aggregation.
- Implemented schema-v9 SQLite migration, JSON backup compatibility and private-workspace UI; PR #450 merged. PR-head CI, Chromium browser smoke, deployment and Secret Scan passed; post-merge CI/deployment are running.

## Next Deliverables

1. Design the separate user-defined exposure-limit policy contract, including explicit thresholds, comparison operators, bitemporal history and schema/backup compatibility. No defaults or inferred risk appetite.
2. Continue functional development using the prioritized product backlog and validate workflows with synthetic acceptance scenarios before expanding scope.
3. Run the planned 8–10 customer interviews and seek two paid-pilot commitments; record only anonymized evidence and do not infer demand from implementation completion.
4. Validate shipped financial-health, return-risk, concentration, and report outputs against user workflows; avoid adding KPIs before needs are validated.
5. Keep historical snapshot guarantees intact: explicit valuation dates, no fabricated history, local-first storage, schema-compatible backup/restore, and transactional recovery.
6. **LOW PRIORITY / DEFERRED:** manual screen-reader and real browser-chrome 400% zoom reviews. Automated keyboard/focus and selected 320 CSS-pixel checks remain in CI.
7. Evaluate SQLite online-backup/checkpoint behavior, encryption, and automated rotation only after explicit operational/security requirements are approved; these are future enhancements, not current completion gaps.

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

## Latest Product Delivery — 2026-11-08

- PRs #425–#441 are merged; main schema is v8 with 15 persisted collections.
- PR #443 delivered user-configured concentration limits. Each workspace stores immutable policy versions; each rule has a user-entered maximum weight and explicit comparison operator. No household-specific limits or product defaults are embedded.
- CI, Chromium browser smoke, dashboard deployment and Secret Scan passed for PR #443; main merge commit is `4230be3513d1243ea9e4f82fbd2208701ceaa27c`.
- Remaining risk families: liquidity, issuer/sector/geography exposure and drawdown. Implement only after their input data, formulas, scope and missing-data semantics are agreed.
- Public repository: synthetic data only. Local SQLite/JSON backups remain unencrypted and manual. Hosted multi-user access is not implemented.

## Last Updated

2026-11-08

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


## Latest Follow-up (2026-10-28 — automatic SQLite saves in progress)

- The local SQLite backend and explicit full-workspace save/restore were merged in PR #390. The database file is local, outside the repository by default, and not encrypted by this feature.
- Follow-up PR #393 adds opt-in automatic saves. The user must successfully save a full snapshot before enabling automatic mode; subsequent successful workspace changes schedule serialized, debounced snapshots. Database failures are surfaced as possible database lag; browser-local storage remains the immediate recovery copy.
- Do not mark the follow-up complete until CI, Chromium browser smoke, dashboard packaging, and Secret Scan pass on the final head commit.


## Latest Follow-up (2026-10-28 — SQLite persistence complete)

- PR #390 hardened SQLite database and sidecar file permissions on POSIX systems and ensured a permission-hardening failure prevents a candidate snapshot from committing.
- PR #394 merged opt-in automatic SQLite saves. The user must save the complete workspace successfully before enabling automatic mode; subsequent successful record, goal, cash-flow, budget, history, import, and restore changes schedule serialized, 450 ms debounced full-workspace snapshots.
- CI run #1097, dashboard packaging run #493, and Secret Scan run #1053 passed for the automatic-save PR before merge. Chromium smoke verified the database contains a cash-flow transaction created through the UI.
- Browser-local storage remains the immediate recovery copy. The database is local and not encrypted; no cloud provider or multi-user service is included.


## Latest Follow-up (2026-10-28 — SQLite startup recovery guard)

- Added startup detection for the specific recovery case where a saved SQLite snapshot exists but all five browser workspace collections are missing or empty.
- Automatic writes wait until database status is checked and remain paused while recovery is required; the UI directs the user to the existing preview-and-confirm restore flow. A manual save remains an explicit user choice.
- Unreadable browser storage is treated as potentially recoverable data, not as an empty workspace. This is a recovery guard, not cross-device synchronization or full optimistic concurrency control.
- PR #397 merged as `cbf778274e83d37970eef299a53d2c6c914d5584`. CI run #1103, dashboard packaging run #495, and Secret Scan run #1059 passed, including the Chromium startup-recovery regression.


## Latest Follow-up (2026-10-28 — SQLite optimistic concurrency)

- Added version-checked writes to the local SQLite API: clients supply the last observed `updatedAt` timestamp (or `null` for an empty database); the database checks it inside the write transaction.
- Stale writes return HTTP 409 without replacing the latest snapshot. Automatic saves pause after a conflict, and manual overwrite requires confirmation. Version timestamps remain monotonic at millisecond boundaries.
- PR #400 merged as `3cda51c617360ae056fd3fe82b3cf8cf6ad6d554`. CI run #1112 and dashboard packaging run #500 passed on the final head; Secret Scan run #1065 passed on the code changes before the documentation-only update.


## Latest Follow-up (2026-10-30 — SQLite and recovery assurance closed)

- PR #408 merged as 7aa369a4a91bcd0d2432833b51b9e71a074fcef9: oversized full-workspace JSON imports are rejected before file decoding. Chromium tests prove truncated and oversized imports preserve all five browser collections and financial totals. Final CI run #1133, dashboard packaging run #510, and Secret Scan run #1089 passed.
- PR #409 merged as 43066794750b139f15fc8b6e4d8f81e5dcafefec: malformed and >10 MiB SQLite API request bodies return 400/413 and leave the committed workspace payload/version unchanged. Final CI run #1134 and Secret Scan run #1090 passed.
- Together with PRs #406–#407, full-content round-trip verification and operator recovery guidance are complete. Clean database close/reopen, transactional snapshot persistence, optimistic concurrency, and read-only integrity diagnostics are already covered.
- Local SQLite persistence and backup/recovery assurance are complete for the current single-user local-first scope. Encryption, remote backup, cloud sync, multi-user support, and automatic rotation remain explicitly unimplemented.

## Latest Follow-up (2026-10-31 — import size limits and budget-overrun regression)

- PR #412 merged: Chromium browser regression covers repeated monthly budget overruns, category filtering, cumulative/average overrun values, and the no-repeat state. Test fixtures restore pre-existing localStorage state to avoid contaminating subsequent browser checks.
- PR #413 merged as `649014ee22cc62bfb5453c89e2690bc2984f8e07`: cash-flow CSV replacement/append, cash-flow JSON restore, and category-budget JSON restore reject files larger than 10 MiB before FileReader decoding.
- PR #414 merged as `bd9fd6eafca6bd2e4743e28b74a83c01f596c4c7`: investment cash-flow CSV import now has the same 10 MiB pre-read guard.
- PR #413 CI, Secret Scan, and dashboard deployment passed. PR #414 CI, Secret Scan, and dashboard deployment passed. PR #412 CI and Secret Scan passed.
- The primary records CSV and full-workspace JSON imports already had 10 MiB guards; the SQLite API separately enforces its request-body cap. The reviewed FileReader-backed import flows are now bounded consistently. This does not imply that all P1 backlog work is complete: the backlog has no explicit P1 priority inventory, and product validation/release gates remain open.

## P1 Scope Closure (2026-10-31)

- Consolidated the P1 commitments made in prior project conversations into `.ai/P1_ACCEPTANCE_MATRIX.md`, with acceptance criteria and concrete test/PR evidence.
- The committed engineering P1 scope is complete: data integrity and atomic rollback, corrupt/truncated/oversized backup rejection, SQLite persistence/recovery/reopen, import/export limits, calculator correctness, FIRE/Goal Tracker browser workflows, historical data, financial-health/budget insights, offline report verification, and automated keyboard/browser regressions.
- Manual screen-reader and actual browser-chrome 400% zoom reviews remain deferred as directed. Customer discovery, legal/distribution, history-exposure review, and owner-side Pages configuration remain open external/release gates. Cloud sync, encryption, automatic backup rotation, and Portfolio Health/recommendations remain out of scope or requirements-gated.

## Follow-up Validation (2026-10-31)

- PR #417 adds a real Chromium regression for an investment cash-flow CSV one byte above 10 MiB, verifying pre-read rejection behavior at the user workflow, file-input reset, and preservation of previously imported cash flows.
- PR #418 adds synthetic Chromium acceptance scenarios for no-activity months, missing prior-month baselines, no-income savings-rate unavailability, no-budget states, and expense-only unbudgeted activity. Temporary fixtures are removed before subsequent report checks.
- Both PRs passed CI (including the complete Chromium smoke) and Secret Scan before merge.
- Backlog status corrected: repeated budget-overrun browser interaction coverage is complete (PR #412); FIRE Goal Gap Analysis is merged (PR #290); historical net-worth timeline is implemented from captured snapshots, while additional cash-flow charts remain requirements/customer-validation gated.


## Portfolio Review reporting increment (2026-10-31)

- Portfolio report schema v2 carries the existing analytics results for balance-sheet ratios and category concentration into the offline HTML artifact.
- The report labels ratios as descriptive, displays zero-denominator values as unavailable, and documents that HHI/category concentration is not correlation-aware risk or a recommendation.
- No persistence schema, holdings model, market-data integration, thresholds, or AI recommendation behavior is changed.
- Validation status: pending PR CI and Secret Scan.


## Investment Portfolio Management — IPM-03 implementation update (2026-10-31)

- PR #425 is open as a draft; schema-v5 persistence and the dashboard ledger entry workflows are being integrated.
- Added strict backup validation for the four investment collections while preserving schema-v1 through schema-v4 backup compatibility.
- Added a transactional SQLite schema-v4 to schema-v5 migration. It preserves the original five collections, record IDs and saved timestamp, then initializes investment collections empty. A failed migration rolls back its table replacement.
- Added local browser persistence and append-only forms for investment accounts, instruments, transactions and manual valuation observations. No market prices are inferred.
- Integrated the new collections into full-workspace v5 backup/export and SQLite save/restore. Older backups that omit the investment ledger preserve the existing ledger.
- Added a durable schema-v4 JSON recovery artifact before table replacement; it uses exclusive file creation, flush-to-disk, and owner-only POSIX permissions. Migration aborts if backup creation fails. Tests verify recovery payload preservation and invalid-v4 rollback.
- Chromium smoke coverage now verifies ledger entry, reload persistence, schema-v5 JSON export/import, and exact SQLite save/restore equality across all nine workspace collections. Import preview reports the investment collection counts and replacement scope.
- API-level stale-client concurrency coverage uses an investment valuation and verifies HTTP 409 prevents a stale write from overwriting the latest committed valuation.
- Added a Chromium two-tab workflow with isolated browser contexts seeded from the same baseline. The first tab commits a manual valuation; the stale second tab must display the conflict state and leave the newer SQLite valuation intact.
- CI exposed and drove fixes to stale backup-preview assertions and date-dependent cash-flow CSV/budget smoke assertions. Final acceptance passed on commit `1b5a45eb5910f275118ede1657d8b39916fe539a`: lint, typecheck, build, unit tests, Chromium smoke (including isolated two-tab conflict), Secret Scan and dashboard packaging all succeeded. IPM-03 implementation is complete; PR #425 remains draft and unmerged pending review and explicit user approval.


## Current Workstream — IPM-04

Investment Portfolio Management is in progress on feature/investment-portfolio-reconciliation, stacked on PR #425's schema-v5 persistence branch. Dashboard FIFO positions and valuation/reconciliation visibility are being implemented. PR #425 remains open and unmerged.


## 2026-11-01 — IPM-04 FIFO portfolio projection

- PR #426 adds the schema-v5 dashboard portfolio projection: FIFO positions, realised/unrealised gain, recorded income/expenses, point-in-time valuation selection, currency-separated totals, missing-valuation states and oversell rejection.
- Latest head: `e8b7878245bcd1f13e71171cd3e06649ff08608c`.
- CI run `41269575836` passed lint, typecheck, build, tests and real Chromium browser smoke; dashboard packaging/deploy run `41269575813` passed.
- Portfolio XIRR and cash reconciliation remain gated on a domain design for external contributions/withdrawals, cash-account balances and internal transfers. Purchases and sales alone do not establish investor cash flows. No assumptions or schema changes are being made until these semantics are explicit.
- PR #425 remains the schema-v5 dependency and PR #426 remains stacked on it; both are open and unmerged.


## 2026-11-01 — IPM-04 cash ledger design

- Added proposed accounting contract in `docs/architecture/ADR_INVESTMENT_CASH_LEDGER_AND_XIRR.md`.
- Design separates cash-account balance movements from investor cash flows, explicitly records external contributions/withdrawals, represents internal transfers atomically, and reconciles to statement observations without auto-balancing.
- Portfolio XIRR uses only external investor flows and a complete terminal value, by currency. Trades and portfolio income/expenses are internal events and are excluded from external-flow inputs.
- Proposed schema-v6 collection additions and migration acceptance are documented. This commit changes documentation only; no live schema or personal financial data was modified.


## 2026-11-01 — IPM-04 cash-ledger engine increment

- Added a pure cash-ledger domain engine and unit coverage on `feature/investment-cash-ledger-engine`, stacked after the cash-ledger design ADR.
- The engine validates explicit cash accounts, cash movements, correction references, same-currency transfers, statement observations and optional investment-transaction cash-account links.
- Reconciliation requires explicit opening balance and statement evidence, respects effective/recorded timestamps, counts unlinked investment transactions as incomplete, and never inserts a balancing adjustment.
- External investor cash-flow projection treats opening capital/contributions as negative and withdrawals as positive; trade and income/expense transactions plus internal transfers are excluded.
- Scope remains partial: no schema-v6 SQLite migration, backup/export integration, cash UI, terminal valuation aggregation or portfolio-wide XIRR calculation is delivered in this increment.


## 2026-11-01 — IPM-04 schema-v6 persistence increment

- Added schema-v6 validation and SQLite v5→v6 migration for four investment cash collections.
- Migration preserves existing v5 records, writes a portable pre-v6 schema-v5 recovery artifact before DDL, and applies the snapshot-table replacement transactionally. Invalid migration data leaves the v5 table unchanged.
- No cash accounts, opening balances or external flows are generated during migration. New cash collections are explicitly empty pending user entry.
- Updated browser JSON backup/restore and SQLite persistence payloads to carry the cash collections. v1-v5 backup import remains supported, and v5 backups do not claim to include cash ledger records.
- Added migration and backup compatibility tests. CI verification is pending; no merge or deployment is claimed.


## 2026-11-01 — IPM-04 cash-ledger workflow UI increment

- Added private-only dashboard forms for explicit cash accounts, opening balances, external funding/withdrawals, corrections, internal transfers and statement observations.
- Added optional cash-account links to newly entered investment transactions. Existing unlinked transactions are not changed; the reconciliation engine marks them incomplete.
- Added cash reconciliation status and append-only history tables. Browser cash-ledger collections are saved separately with best-effort rollback if storage writes fail.
- Added isolated Chromium integration coverage for the signed movement and linked-trade reconciliation path using synthetic test data.
- Portfolio-wide XIRR/terminal value is not yet delivered; the next increment must use the existing XIRR calculator and require complete cash/holding valuations.


## 2026-11-01 — IPM-04 portfolio XIRR increment

- Added per-currency portfolio XIRR using the repository's existing calculator runtime and shared XIRR solver.
- External investor flows are explicit opening balances, contributions, withdrawals and correction adjustments only. Internal investment transactions and transfers are excluded.
- Terminal value requires reconciled cash statements and valued open holdings; statement cash is rolled forward using subsequent movements, transfers and linked settlements.
- Missing cash/valuation evidence, unlinked transactions, reconciliation differences, non-positive terminal value or ambiguous XIRR makes the result unavailable; partial portfolio returns are never presented.
- Historical cash/position calculations use the same effective-date and recorded-at cutoff. Append-only corrections and a single opening baseline are validated.
- Demo mode clears private cash-ledger selectors/history and portfolio XIRR output.
- Unit and Chromium smoke coverage expanded. Latest CI verification remains in progress; no merge or deployment is claimed.


## 2026-11-01 — IPM-04 cash-ledger acceptance verified

- Added and validated the schema-v6 cash-ledger persistence, private-only workflows, historical settlement association, cash reconciliation and per-currency portfolio XIRR across stacked PRs #429 and #430.
- Zero opening balances are accepted only when explicitly entered. They are excluded from XIRR flow arrays rather than passed as zero-valued calculator inputs.
- XIRR uses the shared repository calculator and refuses ambiguous sign-change patterns. Cash and open-position terminal values must be complete; no partial XIRR is shown.
- Vitest now includes all dashboard root-level tests in addition to `apps/dashboard/tests/**`, ensuring investment-ledger and cash-ledger validator tests run in CI.
- PR #430 head `786ded49daa9655fcc09d50da4562c4f682cb5c1`: CI run 41289104534 success; dashboard package run 41289104460 success (publish skipped). PR #429 CI and packaging also passed.
- No PR has been merged. Merge order remains #425 → #426 → #427 → #428 → #429 → #430 and requires explicit user approval.


## 2026-11-06 — Investment allocation policy foundation

- Draft PR #435 adds the pure allocation-policy and drift engine on top of PR #432.
- Domain and unit-test files plus an ADR are present. Saved policy persistence, migration and dashboard CRUD remain outstanding.
- Do not merge the stacked PR chain without explicit approval.

## Investment allocation persistence update — 2026-11-06

PR #435 now includes the schema-v7 persistence foundation on the existing stacked branch. The workspace has 14 collections, adding `investmentAllocationPolicies`. v6→v7 migration is transactional and creates a protected pre-migration recovery artifact. Schema-v7 backup validation checks policy references and targets. Browser-local storage and SQLite payload assembly include the collection. Legacy v1–v6 backups remain compatible and do not overwrite allocation policies when absent. The policy CRUD/dashboard workflow is implemented. CI, Secret Scan, dashboard deployment and real Chromium end-to-end acceptance passed on verified tree `0a21c20638e4e4a192ae73554f7b3732806c714f` (2026-11-06). The PR remains draft/open/unmerged and the stacked dependency chain remains intact; no merge has been authorized.

## Allocation dashboard follow-up — 2026-11-06

The private allocation-policy dashboard is now implemented on PR #435. Users can create policy sets, append immutable versions, review saved policy history and analyze actual-vs-target drift using existing FIFO positions and eligible valuations. The dashboard is private-workspace only and requires confirmation before saving. CSV imports are blocked if they would invalidate existing policy references. Legacy v1–v6 investment backup imports preserve current policy data only when references remain valid against the incoming ledger. Browser smoke coverage passed along with CI, Secret Scan and dashboard deployment on 2026-11-06. The feature remains unmerged and the stacked dependency chain must be preserved.


## Latest Verified Repository State — 2026-11-08

This section supersedes older milestone snapshots above where they conflict with the current investment-management delivery status. Historical entries are retained for traceability.

### Investment-management delivery (stacked, not merged)

The following pull requests are currently **open, draft and unmerged**. They form one dependency chain; do not retarget or merge individual children out of order:

- PR #425 — investment workspace persistence, schema v5; base `main`.
- PR #426 — FIFO portfolio reconciliation; based on #425.
- PR #427 — investment cash ledger/XIRR design; based on #426.
- PR #428 — investment cash ledger reconciliation engine; based on #427.
- PR #429 — cash-ledger persistence, schema v6; based on #428.
- PR #430 — investment cash-ledger dashboard workflows; based on #429.
- PR #432 — validated investment-ledger CSV interchange; based on #430.
- PR #435 — allocation targets, immutable policy versions and actual-vs-target drift; based on #432. Latest head `ae4fd8669f0222754e95dabbf2df14f588d381a7`. CI #1528, Secret Scan #1321 and dashboard deployment #856 passed.

PR #436 is a documentation/readiness child of #435. It records the input/metric gaps that must be resolved before implementing portfolio risk policies. Its latest head at this update is `cf60d21b84ea87897a2e6d16c2245a2bb8822ac3`; CI #1529 and Secret Scan #1322 were still running when this status was recorded. Do not call PR #436 verified until both finish successfully.

### Current investment domain state on the feature chain

- Investment ledger domain, FIFO position projection, valuation provenance, investment cash ledger, CSV interchange and allocation policy/drift are implemented on the stacked feature branches.
- SQLite workspace schema is v7 with 14 collections on the current feature chain; this is not yet the main-branch state while the dependency PRs remain unmerged.
- Allocation policy versions are immutable and bitemporal. Allocation is currency-separated, valuation completeness is enforced, and HHI remains descriptive rather than a risk score.
- No FX conversion, inferred market prices, investment recommendations, rebalancing orders or autonomous trades are introduced.
- Risk-policy implementation is not yet approved for coding: liquidity inputs are absent, drawdown-series rules are undefined, and exposure dimensions beyond instrument type/instrument need explicit requirements. See `docs/architecture/INVESTMENT-RISK-POLICY-READINESS.md` in PR #436.

### Bootstrap status

The repository already contains `scripts/build/Initialize-PFO.ps1` and its modular implementation under `scripts/internal/`. It supports initialization, `-Validate`, `-Doctor`, and `-WhatIf`; CI exercises no-overwrite and configured-path traversal safety. The uploaded continuation note's requested script is therefore not missing. Any further bootstrap change must be based on a concrete review finding and preserve the existing module/configuration architecture.

### Governance

- Keep all investment PRs draft/open/unmerged until the dependency chain is reviewed and the repository owner explicitly authorizes merging.
- Never commit real household financial data, statements, credentials or private reports; use synthetic fixtures.
- Do not mark risk policy, cloud sync, encryption, backup rotation or production readiness complete unless their separate acceptance gates pass.


## Latest Verified Repository State — 2026-11-08 (post-merge)

The investment-management delivery chain is now merged to `main` in dependency order: #425, #426, #427, #428, #429, #430, #432, #435 and #436. Main now contains the investment ledger (schema v5), FIFO position projection, cash ledger (schema v6), cash dashboard/XIRR, PFO-native CSV interchange, and allocation policies/drift (schema v7). The main workspace schema is v7 with 14 persisted collections.

PR #437 is merged and fixes the main-only ESLint failure in `apps/dashboard/investment-portfolio-xirr.js` by importing the existing FIFO projection. PR-head CI #1541, Secret Scan #1334 and dashboard packaging #864 passed. Main push CI #1542 passed on merged main commit `4ee5fadc936758cea4ada0f1c7ec903bf3bd5081`.

Risk-policy implementation is not shipped. The merged readiness assessment at `docs/architecture/INVESTMENT-RISK-POLICY-READINESS.md` documents missing liquidity metadata, undefined drawdown sampling/cash-flow rules and unresolved exposure semantics. No hidden thresholds, risk scores, recommendations, rebalancing instructions or trades are introduced.

Operational limitations remain: SQLite files and exports are not encrypted; backups are manual and have no automated rotation, retention enforcement or remote copy. The repository is public, so only synthetic data may be committed. Use the loopback dashboard on a secured device for private household records.


## Latest Verified Repository State — 2026-11-10

- Main: `590e05c921829fedecb770c5cdd2ef3098f5aa03`.
- Workspace persistence is schema v8 with 15 collections. Concentration policy engine, user-configurable private-workspace UI, v7→v8 migration, pre-migration recovery artifact and JSON backup/restore are merged (#441, #443). Browser storage failure preservation is covered by #446. Pinned Claude Code Action update #447 is merged after CI and Secret Scan passed.
- Each workspace can define its own concentration policy versions, per-group maximum market-value weights and `>` / `>=` boundaries. No application-wide thresholds or inferred risk appetite exist.
- Sprint 9 is focused on exposure classification data-contract discovery. The next decision is whether an instrument maps to one group per dimension or weighted multi-group look-through allocations. No issuer/sector/geography exposure calculations are claimed yet.
- Liquidity and drawdown remain deferred until their respective data, provenance, time and missing-data contracts are approved.
- Repository is public; synthetic fixtures only. The local workspace remains loopback-only and does not provide hosted multi-user authentication/authorization.


## Latest Verified Repository State — 2026-11-13

- PR #449 merged to `main` as `464491871b74c57eaa8eb77d73131f9e05819e4b`; documentation-only exposure-classification decision ADR added at `docs/architecture/ADR-INVESTMENT-EXPOSURE-CLASSIFICATION.md`.
- PR #449 CI run #1579 passed, and the independent Secret Scan passed on head `fd7196cf74a6742f82eeb773c27ca5b8075ce827` before merge.
- Main investment workspace remains schema v8 with 15 persisted collections. No classification collection or exposure calculation has been implemented.
- Sprint 9 remains in discovery. Single-group classification versus weighted multi-group look-through is not yet decided. Weighted look-through is documented as a recommendation only; implementation is gated on explicit owner approval and hand-calculated examples.
- Existing boundaries remain: local-first, user-controlled workspace policies, synthetic public-repository fixtures, explicit currency separation/no implicit FX, no investment advice or trading automation. Local SQLite and backups are not encrypted; dashboard is loopback-only, not a hosted multi-user service.


## Latest Feature State — 2026-11-14 (PR #453)

- Main remains schema v10; PR #453 branch adds schema v11 / 18 collections and is not merged.
- Drawdown uses Option B: time-weighted, external-cash-flow-adjusted performance. The pure calculator kernel and immutable snapshot contract are implemented.
- Ledger-derived acquisition now derives open FIFO positions at effective/recorded cutoffs and cash balances from explicit opening balances plus bitemporal movements, transfers and linked investment settlements.
- Snapshot completeness checks missing/extra components, position quantities and cash balances. It does not fabricate valuation prices; manual/provider evidence must exist at the exact snapshot effective timestamp.
- Existing-ledger flow taxonomy distinguishes owner contributions/withdrawals, opening baselines, internal transfers, account-scope-crossing transfers, investment transactions and corrections. Ambiguous corrections fail closed; later-recorded corrections do not alter as-known historical output.
- In-kind contributions/withdrawals and corporate actions are not represented by the current ledger schema and remain unsupported.
- New files: `apps/dashboard/investment-drawdown-acquisition.js` and `apps/dashboard/investment-drawdown-acquisition.test.js`.
- Remaining production work: private manual snapshot capture/import, paired flow-boundary capture, explicit daily-close calendar, independent end-to-end financial acceptance fixtures and private reporting/export UI.
- Public repository: synthetic fixtures only. Do not commit household financial data. PR #453 remains open/draft/unmerged; validate latest checks before any merge.
