# Current Sprint

## 2026-11-13 — Sprint 11: Flow-adjusted portfolio drawdown (in progress — PR #453)

- Sprint 10 exposure limits remain complete and merged in PR #452.
- Approved Option B: time-weighted, external-flow-adjusted drawdown; raw NAV and Modified Dietz fallback are rejected.
- Implemented a pure calculator kernel with chain-linked wealth index, paired pre/post external-flow boundaries, authoritative flow-event matching, scope/currency validation, bitemporal cutoffs, maximum drawdown, peak/trough/recovery and explicit unavailable states.
- Added hand-calculated tests for market movement, contribution neutrality, withdrawal neutrality, costs, missing/incomplete boundaries, flow timestamp mismatch, simultaneous flow ambiguity, mixed scope/currency and recorded-at cutoff.
- Added a component-level snapshot contract and validator for position/cash references, component provenance, exact effective timestamps, component-total reconciliation, incomplete states, paired flow-boundary component universes, immutable supersession and recorded-at selection. This does not yet independently prove that every open holding/cash account is included.
- Added SQLite schema v11 (18 collections), transactional v10→v11 migration with a protected pre-v11 recovery artifact, and full JSON/SQLite backup/restore integration. Legacy v1–v10 JSON backups remain supported; old backups preserve existing drawdown snapshots only if their references remain valid.
- Added deterministic snapshot-contract, backup compatibility and migration tests. Verified latest head `c84c2305c30de50e6678081f537a65fe4cf304d9`: CI run #1759 passed (86 test files / 833 tests, lint, typecheck, package build and Chromium browser smoke); Secret Scan #1553 passed; dashboard deployment workflow #995 passed.
- Production delivery is not complete: trusted capture/completeness builder, authoritative flow taxonomy, explicit daily calendar, integration acceptance and private UI/export remain required. Do not present drawdown as an end-user feature yet.

### Next gated work

Next: implement the manual-first, provider-neutral capture/import workflow and independently verify complete position/cash component coverage against the immutable ledgers at both effective-time and recorded-at cutoffs. Then add authoritative external-flow taxonomy, explicit daily observation calendar, integration acceptance and private UI/export. Do not add a provider or external transmission. Liquidity remains separately gated.

- Sprint 9 weighted multi-group look-through was approved as Option B and merged in PR #450.
- Completed immutable, bitemporal exposure policy versions with stable policy-set identity, currency, portfolio/account scope and classification dimension.
- Completed explicit per-group maximum percentages and user-selected strict (>) / inclusive (>=) boundaries. No default thresholds or risk appetite.
- Completed private-workspace authoring, immutable history and point-in-time evaluation. Sample workspace controls remain disabled.
- Completed complete-data evaluation: configured groups absent from a complete result measure as zero; missing classifications/valuations and empty portfolios remain unavailable/empty and never pass. Available source exposure must reconcile to 100%.
- Completed SQLite schema v10 with 17 collections, transactional v9→v10 migration and mode-restricted pre-v10 recovery artifact.
- Completed JSON schema-v10 backup/restore, legacy schemas 1–9 import, and preservation/rejection checks for existing policy references.
- Completed deterministic domain/backup/migration/static UI tests and Chromium browser smoke for policy creation, breach evaluation, invalid/valid legacy import, JSON backup/restore and SQLite round-trip.
- PR #452 merged 2026-11-13. CI #1670, dashboard packaging #955 and Secret Scan #1464 all passed. Superseded draft PR #451 was closed; no open PRs remain.

### Next gated work

Liquidity and drawdown remain separate backlog items. Do not implement them until their input/provenance, metric, scope, denominator, missing-data and time-series contracts are explicitly defined and tested.

## Completed — Sprint 9: Weighted investment exposure (PR #450 merged)

- Product owner selected Option B — weighted multi-group look-through.
- Implemented immutable user-authored instrument/dimension classifications with source provenance, optional evidence reference, effective-from date and recorded-at timestamp.
- Enforced 100% reconciliation within 0.01 percentage points, unique group IDs, stable dimension identity/display names, and bitemporal selection. Accepted rounding tolerance is normalized during aggregation so the full position value is allocated.
- Implemented complete exposure aggregation by currency and portfolio/account scope. Missing classifications or valuations suppress partial results; no silent denominator exclusions, FX conversion or nested fund recursion.
- Implemented private-workspace classification authoring/history and analysis controls for dimension, currency, scope, as-of date and recorded-at cutoff.
- Added SQLite schema v9 with transactional v8→v9 migration and a mode-restricted pre-v9 recovery artifact. Existing instruments receive no inferred classifications.
- Added schema-v9 JSON backup/restore with backward compatibility for schemas 1–8 and tests for preserving existing classifications only when references remain valid.
- Liquidity and drawdown remain separately gated on validated input and metric contracts.

## Previous Sprint — Sprint 7 (historical, completed 2026-10-30)

## Version

0.1.0

## Goal

Prove that local SQLite persistence and portable backup/recovery preserve the complete private workspace under valid, malformed, truncated, wrong-schema, and oversized inputs.

## Completed — Opt-in automatic SQLite saves (PR #394)

- Added an explicit control to enable/disable automatic SQLite saves after a successful initial snapshot.
- Successful records, goals, cash-flow, budgets, historical snapshots, imports, and restores schedule a serialized, 450 ms debounced full-workspace save.
- Database failures are surfaced as possible database lag; browser-local data remains intact as the immediate recovery copy.
- Chromium smoke enables automatic saves, creates a cash-flow transaction through the UI, and verifies the transaction persisted through the SQLite API. CI run #1097, dashboard packaging run #493, and Secret Scan run #1053 passed before merge.

## Completed — SQLite startup recovery guard (PR #397 merged)

- Detects when a valid SQLite snapshot exists but all five browser workspace collections are absent or empty.
- Pauses automatic database writes until the user reviews recovery or explicitly saves the current workspace, preventing a cleared browser profile from silently replacing a recoverable SQLite snapshot.
- The recovery action reuses the validated backup preview and confirmation; unreadable browser values are treated as existing data rather than empty.
- Chromium smoke verifies that startup recovery is offered and the SQLite snapshot remains unchanged. CI run #1103, dashboard packaging run #495, and Secret Scan run #1059 passed before merge.

## Completed — SQLite optimistic concurrency protection (PR #400 merged)

- Every browser save includes the last-read database timestamp; SQLite compares it transactionally before replacing the snapshot.
- Stale writes return HTTP 409 without changing the newer snapshot. Automatic saves pause on conflict; replacing a newer snapshot requires explicit confirmation.
- Added unit/API tests for stale version rejection and strictly increasing timestamp versions. CI run #1112, dashboard packaging run #500, and Secret Scan run #1065 passed on the code changes; a subsequent documentation-only update also passed CI.

## Completed — Portable SQLite backup export

- Added a dedicated action to export the currently committed SQLite snapshot as a dated, schema-v4 JSON full-workspace backup, independent of unsaved browser-local edits.
- Export is available only on the local private dashboard and only when a database snapshot exists; the browser revalidates the payload before download.
- Chromium smoke checks the download filename, schema version, and all five workspace collections.
- This creates a portable recovery artifact, not an encrypted backup; store exports securely.

## Completed — Read-only SQLite integrity diagnostics (PR #403 merged)

- Added a loopback-protected API check using SQLite `PRAGMA quick_check`, with sanitized failure responses.
- Unit/API tests verify a healthy database passes and its saved workspace/version remains unchanged.
- CI and Secret Scan passed. A passing structural check does not prove financial accuracy or backup restorability.

## Completed — Dashboard-visible SQLite integrity check (PR #404 merged)

- Added a local-dashboard control to run the read-only integrity endpoint and show a clear pass/fail result.
- Chromium smoke verifies a successful check after a validated workspace snapshot is saved.
- CI run #1122, dashboard packaging run #506, and Secret Scan run #1078 passed before merge.

## Completed — Sprint 6: Local SQLite Persistence

The local SQLite persistence milestone is complete. The dashboard supports validated full-workspace snapshots, explicit save/restore, opt-in automatic saves, startup recovery protection, optimistic concurrency, portable JSON backup export, and read-only integrity diagnostics exposed in the UI.

## Completed — Sprint 7: Backup and Recovery Assurance (PRs #406–#409)

- PR #406 verifies exact full-content equality between the portable JSON export and the committed SQLite workspace, then verifies restored browser data across all five collections, stable IDs, and nested historical records.
- PR #407 adds operator guidance for backup cadence, manual retention, encryption responsibility, same-device recovery, portable JSON recovery, and device migration. Exports are explicitly not encrypted; SQLite persistence is not an independent backup.
- PR #408 rejects oversized JSON backup files before `FileReader` reads or decodes them. Chromium regression tests prove truncated and oversized imports preserve all five browser collections and visible financial totals.
- PR #409 verifies malformed JSON and request bodies over 10 MiB are rejected by the SQLite API (400/413) without changing the committed payload/version.
- Existing database tests cover validated atomic writes, stale-version conflicts, `PRAGMA quick_check`, POSIX owner-only database/sidecar permissions, and clean close/reopen persistence.
- Final CI and Secret Scan passed for PRs #408 and #409; dashboard packaging passed for #408. Both PRs are merged to main.

The current local SQLite persistence and portable backup/recovery scope is complete. Keep the product local-first and user-controlled. Do not claim encryption, remote backup, cloud sync, or automated rotation.

## Next — Operational hardening (backlog)

Evaluate SQLite online-backup/checkpoint behavior and backup automation only after a concrete retention, encryption, and restore policy is approved. These are not blockers for the completed local persistence/recovery milestone.

## Completed — Sprint 6: Local SQLite Persistence

- Local SQLite backend is integrated with the loopback dashboard server. It persists the complete schema-v4 workspace (records, goals, cash-flow transactions, budgets, and historical snapshots) as one validated transactional snapshot.
- Dashboard controls explicitly save and restore the private workspace. Restore reuses the existing preview, confirmation, validation, and rollback flow; record IDs remain stable.
- Default database path is outside the repository. POSIX database and SQLite sidecar files are restricted to owner-only permissions. Windows relies on the user's profile ACL.
- The backend has request-size limits, loopback host/origin checks, no CORS, and server/API tests for persistence, validation, and rejected cross-origin writes.
- Browser smoke verifies a full five-collection save/restore round trip and an automatic cash-flow save. Explicit and opt-in automatic persistence are complete; database encryption, cloud hosting, and multi-user access remain out of scope.

## Previous Completed Deliverables

- PR #384 — closed the current data-integrity batch: aggregate financial-total validation, CSV and backup validation edge cases, and atomic restore rollback tests across records, goals, cash flow, budgets, and historical snapshots. CI, dashboard packaging, and Secret Scan passed.
- PR #385 — added prior-calendar-month comparison to the financial-health overview for income, expenses, net cash flow, and savings rate; correctly handles year boundaries and marks comparison unavailable when the previous month has no recorded transactions. Existing CSV and offline HTML exports include the displayed comparison. CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed.

- PR #139 — local-only FIRE planner UI with validated assumptions, readiness outputs, required annual contribution action, reset, and ephemeral inputs/results.
- PR #141 — three-scenario comparison using the existing tested calculator; user-entered order and assumptions are preserved, and scenarios are not ranked or recommended.
- PR #142 — validated, self-contained, script-free FIRE scenario HTML report for single scenarios and comparisons, with XSS-safe rendering and explicit download actions.
- PR #145 — deterministic single-goal progress calculator and session-only dashboard Goal Tracker; reports progress, amount remaining, target date, and completion/overdue state without persistence or return projections.
- CI, full-history Secret Scan, and dashboard packaging passed on each feature PR before merge.
- PR #147 — CI static accessibility-contract regression checks for FIRE/Goal Tracker form labels, validation alerts, live regions, section naming, and progress indicator. These are structural checks, not interactive browser verification.
- PR #149 — corrected Goal Tracker progress indicator's accessible value wording to report the percentage of target, including when the accumulated amount exceeds 100%; CI, Secret Scan, and dashboard packaging passed.
- Product improvement log is maintained in `docs/product/IMPROVEMENT_LOG.md`.

## Completed Historical Data Deliverables

- PR #304 — documented multi-year historical financial data requirements and local-first privacy rules.
- PR #305 — validated snapshot domain model, chronological summaries, and duplicate-date protection.
- PR #307 — private snapshot capture, fictional development-only history, accessible history table, and CSV export.
- PR #308 — schema v4 full-workspace backup/restore with validated history, legacy v1–v3 compatibility, and transactional rollback.
- PR #309–#312 — browser checks for sample/private isolation, restore rollback, trend rendering, detail inspection, and reload persistence.
- PR #313 — synchronized historical-data milestone status.
- PR #314–#316 — snapshot-detail focus restoration, confirmed removal workflow, and 320 CSS-pixel responsive/focus checks.
- PR #317–#318 — offline browser verification for financial summary, FIRE reports, comparison reports, and monthly financial review.
- PR #319 — over-target Goal Tracker progress and accessible native progress semantics.
- PR #320–#321 — monthly-review HTML escaping checks for user-controlled goal names and budget/transaction categories.
- PR #322 — keyboard activation and focus restoration for snapshot removal, cancellation, and storage failures.
- PR #323 — duplicate-date capture rejection without replacing or duplicating history.
- PR #324–#325 — malformed-history fail-closed behavior and recovery through full-workspace backup import.
- PR #326 — keyboard activation of FIRE readiness and Goal Tracker calculations.
- PR #331 — Chromium keyboard submission of invalid FIRE contribution assumptions clears stale results and moves focus to the invalid required field.
- PR #332 — Chromium keyboard submission of an invalid Goal Tracker target clears stale results and focuses the missing required field.
- PR #352 — offline tax estimate report with exact supplied brackets, validation, and offline browser coverage.
- PR #355 — compound-growth offline report with reconciled assumptions and annual schedule.
- PR #356 — loan amortization offline report with validated assumptions, totals, and complete monthly schedule.
- PR #358 — CAGR offline report with canonical recalculation and stale-export protection.
- PR #360 — balance-sheet ratios offline report with reconciled totals and interpretation limits.
- PR #362 — asset allocation offline report with category concentration metrics.
- PR #364 — historical net worth offline report using only captured snapshots and honest date gaps.
- PR #367 — annual financial review year-over-year comparison with explicit zero-baseline handling.
- PR #370 — narrow-viewport Chromium regression checks for the FIRE planner, Goal Tracker, and return-risk analysis; no runtime behavior changed.
- PR #375 — added a local reporting-month selector to the financial-health overview. Cash-flow, savings-rate, budget-control, and budget-coverage metrics recalculate for the selected month; balance-sheet totals and saved-goal progress remain current. Chromium smoke verified September/October 2026 selection; CI, dashboard packaging, and Secret Scan passed.
- PR #365 and #366 — synchronized historical-report validation, roadmap, and project-state documentation.

## In Progress

- LOW PRIORITY / DEFERRED: Manual screen-reader and real browser 400% zoom audits. These are not current sprint blockers. Keep existing automated accessibility, keyboard/focus, and narrow-viewport tests; revisit the manual audits during release readiness or if customer requirements justify them.
- Historical trend and snapshot-detail panels have Chromium checks at a 320 CSS-pixel viewport for single-column reflow, contained content, and focus restoration. PR #370 also verifies the FIRE planner, Goal Tracker, and return-risk panels remain contained without document-level horizontal overflow at that viewport. These checks are not a substitute for browser zoom or manual screen-reader testing.
- Customer demand remains unvalidated; the documented plan is 8–10 anonymized interviews and two paid-pilot commitments. Do not claim demand or revenue until evidence exists.
- Release gates remain open for historical repository exposure review, dependency licensing/distribution disposition, the product licensing decision, and owner-side GitHub Pages setup.

## Next Deliverables

1. Validate startup recovery and autosave conflict protection through Chromium and CI; decide whether optimistic concurrency is required before any multi-tab workflow.
2. Validate existing financial-health, return-risk, concentration, and report outputs with synthetic acceptance scenarios and user workflows before adding more KPIs.
3. Run customer-discovery interviews using the existing non-leading script; record anonymized evidence and update the product log.
4. Review historical repository content and commit metadata for accidental secrets, then resolve licensing/distribution and public/private product-boundary decisions.
5. LOW PRIORITY / DEFERRED: manual screen-reader and real browser 400% zoom reviews. Keep automated keyboard/focus and narrow-viewport regression checks; revisit during release readiness.
6. Configure GitHub Pages only after the repository owner confirms the public sample-only deployment and required settings.

## Release Gates and Constraints

- The dashboard package builds successfully in pull-request CI, but publishing requires the repository owner to configure Settings → Pages with Source set to GitHub Actions.
- The repository is public and has no valid open-source license yet. Do not change visibility or license automatically.
- Historical repository content and commit metadata require a separate credential-exposure review.
- Dependency licensing/distribution disposition remains open.
- Historical net-worth trends must come from explicitly dated user-captured snapshots. Never reconstruct or imply historical balances from today's records.
- Preserve a multi-year history in local storage and full-workspace backups; validate migration and rollback behavior before release.
- Do not add automatic FIRE persistence, external financial data, telemetry, AI calls, investment recommendations, or Monte Carlo analysis without a separately reviewed decision.
- Autonomous engineering workflow improvements are intentionally deprioritized until core product functionality and customer validation are substantially further along.


## 2026-10-25 — Keyboard-submit regression coverage
- Chromium browser smoke covers keyboard submission for the FIRE planner, Goal Tracker, CAGR, investment-performance calculator, and return-risk analysis.
- Invalid required inputs clear stale results and use native validation/focus behavior where applicable; return-risk keyboard submission verifies the result summary and calculated metrics.
- Status: implemented in `scripts/dashboard/fire-planner-browser-smoke.mjs`; CI browser smoke passes.

## 2026-10-26 — Tax estimate report
- Added a self-contained offline HTML report for the caller-defined progressive tax estimate; the report reuses the CSV validation contract and includes the exact supplied brackets and explicit limitations.
- Added browser smoke coverage for the download, report content, script/remote-asset absence, and opening the report without network access.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #352.

## 2026-10-26 — Return risk report
- Add a self-contained offline HTML report for the existing descriptive return-risk calculator, revalidating the exact observation series and metrics before export.
- Include supplied assumptions and dated returns; no market data, forecasts, risk rating, or investment recommendation.
- Validation: CI, Chromium browser smoke, and dashboard packaging passed before merge. The scheduled Secret Scan also runs independently and has three existing historical/documentation-pattern findings; the push-triggered scan passed.


## 2026-10-26 — Loan and growth stale-result protection
- Editing any loan amortization input now invalidates the prior schedule and hides its CSV export until recalculation; failed submissions cannot leave an old schedule exportable.
- Editing any growth projection input now clears prior results and disables CSV export until recalculation.
- Chromium regression checks verify both calculators invalidate stale outputs immediately after input changes.
- Validation: CI, Chromium browser smoke, dashboard packaging, and push-triggered Secret Scan passed on main.


## 2026-10-26 — Compound growth offline report
- Added a standalone HTML report with the exact caller-supplied annual return, contribution amount, duration, timing, and full annual schedule.
- Recalculates the supplied assumptions and rejects a schedule that does not exactly reconcile before rendering.
- Report is script-free and self-contained; no forecasts, external market data, or network requests.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #355.


## 2026-10-26 — Loan amortization offline report
- Added a standalone HTML download for the existing loan amortization calculator, including assumptions, summary totals, payoff status, and the full monthly schedule.
- Recalculates with the existing deterministic calculator and rejects stale or mismatched result summaries before export.
- Keeps the report script-free and offline-capable; preserves the existing CSV export and local-only assumptions.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #356.


## 2026-10-26 — CAGR offline HTML report
- Added a standalone HTML report to the existing CAGR calculator with the exact beginning value, ending value, elapsed years, annualized result, and limitations around interim cash flows.
- Recalculates the rate with the canonical CAGR calculator and rejects a mismatched supplied result.
- Preserves the CSV export; both exports are disabled when assumptions change. The HTML report opens from a local file without scripts or network dependencies.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #358.


## 2026-10-26 — Balance-sheet ratios offline HTML report
- Added a standalone HTML report for the three existing balance-sheet ratios, with reconciled assets, liabilities, net worth, numerator/denominator values, and explicit interpretation limits.
- Recalculates ratios with the existing analytics function and rejects mismatched totals or stale ratios before export.
- Preserves the existing CSV export; the report opens from a local file without scripts or network requests.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #360.


## 2026-10-26 — Asset allocation offline HTML report
- Added a standalone report for the existing category allocation with recorded amounts, category shares, HHI, effective category count, and largest-category share.
- Recalculates concentration using the existing analytics function and escapes user-controlled category names.
- Preserves CSV export; the downloaded report opens offline without scripts or remote requests.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed; merged as PR #362.


## 2026-10-27 — Historical net worth offline HTML report (PR #364 merged)
- Delivered a standalone HTML report for explicitly captured balance-sheet snapshots, including assets, liabilities, net worth, record counts, adjacent-snapshot changes, and first/latest comparison.
- Reuses snapshot validation and summary logic; does not interpolate missing dates or imply that net-worth changes are investment returns.
- Preserves the history CSV export. Unit and Chromium browser tests verify validation, Indian numeric formatting, honest date gaps, download behavior, and offline opening without scripts or remote assets.
- Validation: CI, Chromium browser smoke, dashboard packaging, and Secret Scan passed before merge.


## 2026-10-30 — Backup and recovery assurance progress

- PR #406 merged: Chromium smoke now compares the portable JSON export with the committed SQLite workspace using full deep equality, then verifies the restored browser workspace matches every field across all five collections, including stable IDs and nested historical records.
- CI run #1126 and Secret Scan run #1082 passed before merge. The CI job includes Chromium browser smoke.
- Added an operator-facing local backup/recovery guide covering recommended cadence, manual retention, encryption responsibility, SQLite and JSON recovery, and device migration. These are recommendations and procedures; automated rotation, remote backup, and encryption are not implemented.
- Sprint 7 negative-restore acceptance criteria are now covered by PRs #408–#409. Clean close/reopen persistence is covered by the existing database test suite. Online-backup/checkpoint evaluation and any rotation remain deferred operational enhancements.


## Sprint 7 closure — 2026-10-30

The backup/recovery assurance acceptance criteria are complete. All five workspace collections are covered by exact round-trip tests; invalid, truncated, oversized, malformed API, and oversized API inputs are rejected without replacing existing workspace data. Clean database reopen and integrity checks are tested. Operational guidance is published in `docs/operations/LOCAL_BACKUP_AND_RECOVERY.md`. PRs #406–#409 are merged; CI and Secret Scan passed on the final heads, and dashboard packaging passed for the UI change in PR #408.

## 2026-10-31 — Import size-boundary hardening

- PR #412 merged: Chromium regression coverage for repeated monthly budget overruns, including fixture isolation and empty-state behavior.
- PR #413 merged: 10 MiB pre-read limits for cash-flow CSV replacement/append, cash-flow JSON restore, and category-budget JSON restore.
- PR #414 merged: 10 MiB pre-read limit for investment cash-flow CSV imports.
- The existing primary records CSV and full-workspace JSON import paths already enforce the same 10 MiB browser-side limit. The SQLite API independently enforces its request-body limit.
- Validation for PR #413: CI, Secret Scan, and dashboard deployment passed. Validation for PR #414: CI, Secret Scan, and dashboard deployment passed. PR #412 CI and Secret Scan passed.
- Import-size audit covered the dashboard's FileReader-backed imports in the records, full-workspace backup, cash-flow CSV/JSON, category-budget JSON, and investment cash-flow CSV flows. Each applicable import rejects oversized files before decoding and preserves existing data.

## P1 engineering scope closure — 2026-10-31

The previously committed P1 engineering deliverables are complete and mapped to acceptance criteria and evidence in `.ai/P1_ACCEPTANCE_MATRIX.md`. This includes financial integrity/rollback, SQLite persistence and recovery, import/export hardening, calculator correctness, FIRE and Goal Tracker browser regressions, historical data, financial-health/budget workflows, offline report verification, and automated keyboard/browser checks. Manual accessibility review remains deferred. Customer validation and release/legal/repository-owner tasks remain open and are not represented as completed engineering work.

## Follow-up validation — investment CSV size guard (2026-10-31)

- Added a real Chromium scenario for an investment cash-flow CSV one byte above 10 MiB. It verifies rejection, file-input reset, and preservation of previously imported cash flows. This strengthens PR #414's static pre-read-order regression with an end-to-end user workflow check.

## Follow-up validation — financial-health unavailable states (2026-10-31)

- Added Chromium acceptance scenarios for no recorded transactions/no expenses, no income, no saved budgets, and expense-only unbudgeted activity. Assertions verify unavailable states and prevent zero-activity baselines or savings rates from being fabricated. The temporary synthetic transaction is removed and the reporting month restored before report export checks.

## Validation follow-up — 2026-10-31

- PR #417 merged: Chromium rejects investment cash-flow CSV files over 10 MiB, resets the file input, and preserves previously imported cash flows.
- PR #418 merged: Chromium verifies financial-health unavailable states for empty months, missing prior-month activity, zero income, no budgets, and unbudgeted expense-only months.
- CI (including the full browser smoke) and Secret Scan passed for both PRs. No real financial data was used.


## 2026-10-31 — Portfolio Review report analysis

- Portfolio offline HTML report is being expanded to include existing validated balance-sheet ratios and category-concentration measures.
- The report will preserve unavailable values for zero denominators/empty allocations and explicitly explain that category concentration is not correlation-aware portfolio risk.
- No holdings schema, market-data provider, performance assumptions, risk thresholds, or recommendations are added.
- Validation status: pending PR CI and Secret Scan.


## Current Focus — Investment Portfolio Management (Option B)

- PR #422 merged: typed investment accounts, instruments and immutable transaction events with explicit signed cash movements, currency/date validation, and trade amount reconciliation.
- PR #424 in progress: deterministic FIFO position projection, cost basis, realised/unrealised gain, income/expense tracking, and manual valuation provenance with strict as-of-date selection.
- The approved investment portfolio management backlog is IPM-01 through IPM-10 in `.ai/BACKLOG.md`. Next phases are SQLite workspace migration and dashboard ledger workflows, performance reconciliation, user-defined allocation targets, provider contracts, evidence-grounded research, point-in-time backtesting, and isolated paper portfolios.
- Preserve legacy portfolio records, local-first operation, SQLite schema-v4 backup compatibility, all existing reports/imports/exports, and existing dashboard features. No live broker execution, FX conversion, hidden risk thresholds, or AI ledger writes.


## 2026-11-01 — Investment workspace persistence (IPM-03)

- PR #425 remains open and draft. SQLite schema v5 adds four investment collections while preserving the five existing workspace collections.
- Delivered in branch: transactional v4-to-v5 migration, v1-v4 backup compatibility, browser-local ledger persistence, account/instrument/transaction/manual valuation forms, and v5 JSON/SQLite backup integration.
- A durable schema-v4 JSON recovery artifact is written with exclusive creation and flush-to-disk before schema replacement; POSIX permissions are owner-only. Migration aborts if backup creation fails. Migration tests cover artifact contents/permissions and invalid-v4 rollback.
- Chromium smoke coverage now exercises investment entry, reload persistence, v5 JSON export/import, and exact SQLite save/restore equality for all nine collections. The import preview includes investment counts and replacement scope.
- Added an API-level two-client stale-write test using investment ledger data; it verifies a stale valuation write receives HTTP 409 and cannot replace the latest committed valuation.
- Added a Chromium two-tab scenario using isolated browser contexts with the same initial local workspace: one tab commits a new manual valuation; the stale tab must receive a visible SQLite conflict and must not overwrite the newer valuation.
- Acceptance passed on commit `1b5a45eb5910f275118ede1657d8b39916fe539a`: CI (lint, typecheck, build, unit tests and Chromium smoke), Secret Scan and dashboard packaging are green. The browser suite verified the isolated two-tab conflict scenario and preserved the latest valuation. IPM-03 implementation is complete; PR #425 remains draft pending review/merge. Accessibility remains secondary as directed.


## Next Workstream — IPM-04

Investment portfolio FIFO projection and valuation reconciliation are in progress on feature/investment-portfolio-reconciliation, stacked on schema-v5 persistence PR #425. Acceptance requires lint, typecheck, unit tests and real Chromium browser smoke. Do not merge dependent work independently into main before PR #425.


## 2026-11-01 — IPM-04 FIFO portfolio acceptance

- Implemented the schema-v5 ledger portfolio projection on `feature/investment-portfolio-reconciliation`, stacked on PR #425.
- Added FIFO positions, cost basis, realised/unrealised P&L, recorded income/expenses, point-in-time valuation selection, currency-separated totals, missing-price states and oversell rejection.
- CI run `41269575836` passed, including lint, typecheck, build, unit tests and real Chromium smoke. Dashboard packaging/deploy run `41269575813` passed.
- Cash reconciliation and portfolio XIRR are deliberately not guessed from purchase/sale cash movements. The existing schema has no explicit external contribution/withdrawal or cash-account/transfer events. Next step is to define those semantics before changing the domain model or schema.
- PR #426 remains draft and stacked on PR #425; do not merge it independently.


## 2026-11-01 — IPM-04 cash ledger domain contract

- Added `docs/architecture/ADR_INVESTMENT_CASH_LEDGER_AND_XIRR.md` defining the proposed schema-v6 cash-account, cash-movement, atomic-transfer and statement-observation model.
- Explicitly separates cash-account balance signs from investor XIRR signs. Purchases/sales/dividends/interest/fees/taxes remain internal portfolio events; only external funding/withdrawals are XIRR flows. Internal transfers net to zero at consolidated portfolio scope.
- Defines incomplete/reconciled/difference states, opening-balance evidence, append-only corrections, recorded-at cutoffs and no auto-balancing.
- No data model or database migration has been changed yet. The ADR is on `feature/investment-cash-ledger-design`; implementation follows only after design review and schema-v6 migration/backup test planning.


## 2026-11-01 — IPM-04 cash-ledger engine increment

- Added pure browser-compatible cash-account validation, statement reconciliation and external investor cash-flow projection on `feature/investment-cash-ledger-engine`, stacked after the ADR branch.
- Preserved optional `cashAccountId` on existing investment transactions without requiring it for schema-v5 compatibility; explicit cash validation checks ownership and currency when supplied.
- Tests cover explicit opening balances, reconciliation, incomplete missing-opening state, contribution/withdrawal/XIRR signs, opening capital, cross-currency transfer rejection and recorded-at backfill cutoffs.
- Not yet wired to schema-v6 persistence or dashboard UI. Next delivery is schema-v6 backup/SQLite integration with transactional pre-migration recovery and v1-v5 backup compatibility; then cash workflows and portfolio XIRR.


## 2026-11-01 — IPM-04 schema-v6 persistence increment

- Added schema-v6 backup validation and additive SQLite v5 → v6 migration for investment cash accounts, movements, transfers and statements.
- The migration first writes a schema-v5 recovery JSON artifact (exclusive create, fsync, POSIX 0600), then transactionally replaces the snapshot table. Existing investment records and IDs are preserved; new cash collections start empty and are never inferred.
- v1-v5 JSON backup compatibility is retained. A v5 import does not replace cash-ledger data because it did not contain those collections.
- Browser JSON export/import, local storage and SQLite save payloads now include schema-v6 cash collections; restore rollback snapshots include the additional storage keys.
- Added tests for v5 migration, v5 recovery artifact, rollback on invalid migration, v6 validation and legacy backup compatibility. CI must confirm all changes before acceptance.
- Next: cash ledger entry forms, statement reconciliation UI, and complete per-currency portfolio XIRR with terminal value only when both cash and holdings are complete.


## 2026-11-01 — IPM-04 cash-ledger workflow UI increment

- Added private-only UI for cash sub-account creation, opening balance evidence, external contribution/withdrawal, correction reference/reason, same-currency internal transfer and statement observations.
- Added optional cash settlement-account selection to new investment transactions, enabling cash reconciliation. Legacy transactions without a link are not rewritten and keep the cash account incomplete.
- Added reconciliation status and cash movement/transfer/statement histories. Browser multi-key persistence attempts rollback on write failure.
- Extended isolated Chromium smoke to verify a synthetic opening balance + contribution + withdrawal + purchase reconciles to an explicit statement.
- Next: portfolio-wide per-currency XIRR and complete terminal value checks; do not count internal trades or transfers as external flows.


## 2026-11-01 — IPM-04 portfolio XIRR increment

- Integrated portfolio-wide, per-currency XIRR using the existing calculator runtime. No duplicate XIRR implementation.
- Only explicit opening balances, external contributions, external withdrawals and correction adjustments are investor cash flows. Purchases/sales/distributions/fees/taxes and internal transfers are excluded from external flows.
- Terminal value combines statement-reconciled cash (rolled forward for later cash events and linked trades) with valued open holdings.
- XIRR is unavailable if cash statements/opening evidence are missing, transaction links are incomplete, reconciliation differs, an open holding lacks valuation, terminal value is non-positive, or the XIRR cash-flow pattern is ambiguous. No partial result is emitted.
- Historical calculations use a consistent effective-date and recorded-at cutoff across cash and positions.
- Enforced a single explicit opening balance per cash account; linked trades/transfers cannot predate it. Corrections must reference a prior, non-correction event in the same account.
- Private cash and XIRR UI content is cleared when switching to demo mode.
- Expanded unit and Chromium smoke coverage. CI verification pending for the latest commit.


## 2026-11-01 — historical settlement link integrity

- Added a way to link legacy unlinked investment transactions to cash sub-accounts without editing their financial values or original transaction recordedAt.
- Added `cashAccountLinkedAt` as a separate bitemporal association timestamp in the domain model and browser backup validation. Reconciliation and XIRR require that timestamp to be visible at the selected recorded-at cutoff.
- Demo mode clears all private investment history, counts, selectors, cash rows and XIRR output. Returning to private mode restores the local records.
- Added model, validator, cash reconciliation, portfolio performance and Chromium smoke coverage. Latest CI is pending.


## 2026-11-01 — IPM-04 final cash-ledger acceptance

- Accepted explicit zero opening balance as valid evidence; omitted zero-valued events from XIRR inputs to comply with the shared calculator contract.
- Enabled all dashboard root-level `*.test.js` suites in Vitest; previously these files were outside the configured include glob.
- Added/updated coverage for zero opening balances, historical transaction-link preservation, XIRR flow chronology, backup round-trips and full browser reload.
- Latest PR #430 head `786ded49daa9655fcc09d50da4562c4f682cb5c1`: CI run 41289104534 success; dashboard package run 41289104460 success (publish skipped for PR). PR #429's schema-v6 persistence CI and packaging checks also passed.
- Investment cash ledger, reconciliation, settlement linking and per-currency portfolio XIRR are implemented on stacked branches. All PRs remain open/unmerged pending explicit approval.


## 2026-11-01 — IPM-05 investment CSV interchange

- Draft PR #432 is on `feature/investment-ledger-csv-interchange`, stacked on PR #430. Latest verified head: `fba75ccd29667b0e52dbcb2252f7b33f079765b9`.
- Added typed PFO-native CSV import/export for all eight investment/cash collections, with versioned manifests and human-readable text cells plus reversible safe-text encoding for formula-like/reserved-prefix values.
- Added strict parsing, whole-workspace validation, append/replace preview and private-workspace UI. No writes occur before explicit confirmation; selected browser storage keys are rolled back if a write fails.
- Import success dispatches workspace events so the existing optional/debounced SQLite autosave path can run. This is not a synchronous atomic browser-storage-plus-SQLite transaction; JSON full-workspace backup remains authoritative.
- Unit tests cover all eight collection round trips, Unicode/special characters, BOM, LF, empty collections, malformed JSON/numbers, formula safety, invalid references, duplicate IDs and preview behavior.
- **Verified on current head:** CI run `41305848173` passed lint, typecheck, build, full unit tests and the real Chromium browser smoke. Dashboard packaging run `41305848152` passed; Pages publishing was skipped for this PR.
- PFO-native interchange, row-level downloadable error reports, reload/export-reimport equality, browser-storage rollback, SQLite transaction rollback, and transient autosave failure/retry recovery are implemented and CI-green. Issue #431 remains open for provider-specific explicit mapping (requires actual redacted samples and confirmed semantics) and cross-store atomicity; Secret Scan is now enabled for `feature/**` PR targets and run 1196 passed on the latest documentation head. Do not claim cross-store atomicity.
- External broker layouts remain blocked on exact, redacted provider CSV samples. Do not infer transaction types, signs, cash links, opening balances, FX or valuation data.
- PR #432 remains draft and unmerged. Preserve dependency chain #425 → #426 → #427 → #428 → #429 → #430 → #432; no merge without explicit approval.


## 2026-11-01 — IPM-05 CSV row diagnostics (in progress)

- PR #432 remains draft/open/unmerged on `feature/investment-ledger-csv-interchange`, stacked on PR #430.
- Added detailed row parsing and a downloadable spreadsheet-safe error report containing source file, collection, logical CSV row, field, error message and raw row JSON.
- Any row-level error blocks the complete import batch; valid rows are never partially committed. Correct the source file and retry.
- Unit and Chromium smoke coverage verifies report download and disabled confirmation. CI run 1402 passed on code head `b7d53a8638a2c5451e11c8208bdaddfc5d67f705` (80 test files / 715 tests, real Chromium smoke); dashboard packaging run 732 passed; Secret Scan run 1194 passed after enabling scans for stacked feature PRs.
- External provider mappings remain blocked pending actual redacted provider CSV samples and explicit user-confirmed field/type/sign conventions. SQLite autosave is optional/debounced and is not atomic with localStorage.


## 2026-11-01 — IPM-05 CSV row diagnostics verified

- Added row-level error collection and a downloadable spreadsheet-safe report. Any invalid row blocks the entire batch; valid rows are not partially imported.
- Unit tests and Chromium smoke verify the report and disabled confirmation behavior.
- Verified on `a1a7fc784d286be06432544311991eb2e6460e1e`: CI run 1392 and dashboard packaging run 722 passed. CI includes dependency audit, lint, typecheck, package build, Vitest, Chromium installation and real-browser smoke. Pages publishing skipped for PR.
- Issue #431 remains open for explicit external-provider mapping (requires redacted source samples and confirmed transaction/sign conventions) and further SQLite autosave failure/consistency acceptance. Do not claim cross-store atomicity.


## 2026-11-01 — SQLite persistence failure and recovery verified

- Added a SQLite transaction rollback test using a controlled failing update trigger; the previous committed payload and timestamp remain unchanged after the failed write.
- Added Chromium smoke coverage for a transient 503 during automatic SQLite save. Browser-local data remains intact, the failed snapshot is absent from SQLite, and the next automatic save persists both the earlier edit and the new triggering edit.
- Verified code head `7c456e075b1fa3c1bb3d8e564413c0d86c147a8d`: CI run 1397 passed (80 test files, 715 tests, dependency audit, lint, typecheck, build and full Chromium smoke). Dashboard packaging run 727 passed; Pages publishing skipped for PR.
- Row-level CSV diagnostics and downloadable error reports are also verified. Remaining issue #431 work is external-provider mapping (requires redacted samples and confirmed semantics) and independent Secret Scan verification. Browser localStorage and SQLite are not a single atomic transaction.


## 2026-11-01 — Latest persistence acceptance status

- CI-green code head: `7c456e075b1fa3c1bb3d8e564413c0d86c147a8d`; CI run 1397 passed 80 test files / 715 tests and complete real Chromium smoke. Dashboard packaging run 727 passed.
- Added SQLite write-failure rollback test and transient API failure/retry browser test. Browser-local data is retained after failed autosave; subsequent automatic save persists both the earlier unsynced edit and the new edit.
- Provider-specific CSV mapping remains blocked on actual redacted broker samples and explicit semantic confirmation. Independent Secret Scan was not present in the PR-triggered workflow list inspected.
- LocalStorage and SQLite remain separate persistence systems; no cross-store atomicity claim.


## 2026-11-01 — Secret Scan enabled for stacked PRs and verified

- Updated `.github/workflows/secret-scan.yml` pull-request base filters to include `feature/**` as well as `main`, so stacked PRs receive Gitleaks scanning.
- Secret Scan run 1194 passed on `b7d53a8638a2c5451e11c8208bdaddfc5d67f705`.
- CI run 1402 passed (80 test files / 715 tests, full Chromium smoke); dashboard packaging run 732 passed.


## 2026-11-01 — bounded SQLite autosave retry verified

- Automatic SQLite autosave now retries transient HTTP 408/429/5xx and network failures using bounded 1s, 2s and 4s backoff (three retries maximum after the initial attempt).
- Does not retry validation failures, ordinary 4xx responses or 409 stale-write conflicts. Retry scheduling stops if autosave is disabled, workspace is not private/local, or recovery/conflict protection is active.
- Retry exhaustion pauses automatic retries without discarding browser-local data. A later edit starts a fresh retry window; manual save supersedes a pending retry.
- Real Chromium smoke verifies automatic recovery without another edit, maximum four total attempts under repeated 503s, retained local data and successful recovery after a later edit.
- Verified head `4389b2ad109f50d98474b97fc73980241b699469`: CI run 1410 passed (80 test files / 715 tests and full Chromium smoke); Secret Scan run 1202 passed; dashboard packaging run 740 passed (publish skipped for PR).
- PR #432 remains draft/open/unmerged. No stacked PR merge is authorized.


## 2026-11-01 — SQLite recovery documentation aligned

- Updated `docs/operations/LOCAL_BACKUP_AND_RECOVERY.md` and ADR-0004 to reflect schema-v7 and all 14 persisted collections.
- Clarified that portable JSON export represents the last committed SQLite snapshot, not unsaved browser-local edits.
- Documented WAL sidecar caution, bounded retry behavior, and the fact that browser localStorage and SQLite are not one atomic transaction.
- No runtime code changed; prior CI/Secret Scan/dashboard packaging results remain applicable to code, not a new code change.


## 2026-11-01 — Online SQLite backup and restore verification

- Added a local private-workspace UI action to create a verified online SQLite file backup. The loopback/origin-protected API does not accept a caller-supplied path.
- Backup artifacts are uniquely named under the configured database path's `.backups` sibling directory; integrity and full schema-v6 validation plus fsync precede publication.
- Expanded the recovery drill to restore from the actual online backup file and verify all 13 collections, stable IDs, valuation provenance and SQLite integrity.
- Raised the supported Node.js minimum to 22.16.0 and added a CI guard for `sqlite.backup()`. Await latest CI before claiming verification.
- Automated scheduling, rotation, retention, encryption and remote backup remain deferred.


## 2026-11-01 — Online SQLite backup acceptance passed

- Verified head `59b2b60ad1efcc5e205555095710564028ebd254`: CI run 41326075282 passed, including 80 test files / 718 tests and real Chromium smoke; dashboard packaging run 41326075250 passed; Secret Scan run 41326075278 passed.
- Browser smoke confirms the user-facing online SQLite backup action creates a verified file and reports its location and 13-collection coverage.
- The database recovery drill restores the actual backup file and checks all 14 persisted collections, stable identifiers, valuation provenance and SQLite integrity.
- Node runtime floor is 22.16.0. Backups remain manual and are not encrypted, rotated, retained by policy or copied remotely.


## 2026-11-06 — Investment allocation policy domain foundation

- Started IPM allocation targets on draft PR #435, stacked on PR #432. No merge is authorized.
- Added immutable versioned policy validation, portfolio/account scopes, currency-specific instrument-type/instrument targets, 100% weight reconciliation and bitemporal policy selection.
- Added deterministic actual-vs-target drift, value drift and descriptive concentration metrics using the existing FIFO position projection.
- Missing valuation on any open position suppresses partial allocation results. No FX, inferred price, recommendation, rebalance or trade behavior.
- Added ADR and unit tests in the initial domain-only checkpoint; subsequent work on this branch completed schema-v7 persistence, backup compatibility, private policy CRUD and browser acceptance.

## 2026-11-06 — Investment allocation persistence

Implementation complete and verified on draft PR #435 (stacked on PR #432; no merge authorization).

- Schema-v7 extends the SQLite/JSON workspace from 13 to 14 collections with `investmentAllocationPolicies`.
- Added recovery-safe v6→v7 migration and pre-migration schema-v6 JSON artifact.
- Added schema-v7 backup validation and policy collection validation against ledger account/instrument references.
- Private browser storage and SQLite payload assembly now carry allocation policy versions.
- Private policy CRUD, append-only version UI, backup compatibility and browser smoke are implemented. CI run 42169616949, Secret Scan 42169616950 and dashboard deployment 42169616957 passed on verified tree `0a21c20638e4e4a192ae73554f7b3732806c714f`.

## Follow-up — Allocation dashboard implementation (2026-11-06)

Implemented on draft PR #435:
- Private-only policy creation and append-only version workflow with explicit confirmation.
- Policy history table and bitemporal actual-vs-target allocation analysis over FIFO positions and valuations.
- CSV import guard prevents orphaning existing policy references.
- Legacy investment backups preserve policies only when the imported ledger remains reference-compatible.
- Browser smoke covers policy creation, append-only v2, allocation analysis, backup and legacy restore; CI, Secret Scan and deployment passed on 2026-11-06.


## 2026-11-08 — Investment-management chain merged to main

- Merged PRs #425, #426, #427, #428, #429, #430, #432, #435 and #436 in dependency order using merge commits; the full stack is now on `main`.
- Main workspace schema is v7 with 14 collections. Delivered ledger persistence, FIFO portfolio projection, valuation provenance, cash ledger and statement reconciliation, per-currency XIRR, PFO-native CSV interchange, immutable allocation policies and actual-vs-target drift.
- PR #437 fixed the main-branch lint failure in `investment-portfolio-xirr.js` by importing the existing FIFO projection as `analyzePortfolio`. Its PR CI (including lint, typecheck, build, unit tests and Chromium browser smoke), Secret Scan and dashboard packaging passed before merge.
- Risk-policy readiness documentation is merged via #436. Risk thresholds, liquidity scores, exposure limits and drawdown policies remain unimplemented pending approved metric/data contracts.
- Operational residuals remain explicit: local SQLite and exports are not encrypted; backups are manual, with no automated rotation/retention or remote copy. Use synthetic data in the public repository and loopback-only private workspace for household records.

- Post-merge main push CI run #1542 passed on `4ee5fadc936758cea4ada0f1c7ec903bf3bd5081` after PR #437 was merged.
