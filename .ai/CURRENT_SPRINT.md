# Current Sprint

## Sprint

Sprint 7 — Backup and Recovery Assurance (completed 2026-10-30)

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
