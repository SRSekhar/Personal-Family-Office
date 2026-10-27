# Current Sprint

## Sprint

Sprint 4 — FIRE Planner and Offline Report Workflow

## Version

0.1.0

## Goal

Deliver a usable local-first retirement planning workflow that calculates readiness, compares explicit scenarios, solves required annual contributions, and lets the user download a private offline HTML report without automatic persistence or network submission.

## Completed

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
- PR #365 and #366 — synchronized historical-report validation, roadmap, and project-state documentation.

## In Progress

- LOW PRIORITY / DEFERRED: Manual screen-reader and real browser 400% zoom audits. These are not current sprint blockers. Keep existing automated accessibility, keyboard/focus, and narrow-viewport tests; revisit the manual audits during release readiness or if customer requirements justify them.
- Historical trend and snapshot-detail panels have Chromium checks at a 320 CSS-pixel viewport for single-column reflow, contained content, and focus restoration. PR #370 also verifies the FIRE planner, Goal Tracker, and return-risk panels remain contained without document-level horizontal overflow at that viewport. These checks are not a substitute for browser zoom or manual screen-reader testing.
- Customer demand remains unvalidated; the documented plan is 8–10 anonymized interviews and two paid-pilot commitments. Do not claim demand or revenue until evidence exists.
- Release gates remain open for historical repository exposure review, dependency licensing/distribution disposition, the product licensing decision, and owner-side GitHub Pages setup.

## Next Deliverables

1. LOW PRIORITY / DEFERRED: manual screen-reader and real browser 400% zoom reviews. Keep existing automated accessibility, keyboard/focus, and narrow-viewport regression checks; revisit manual audits during release readiness or if customer requirements justify them.
2. Run customer-discovery interviews using the existing non-leading script; record anonymized evidence and update the product log.
3. Review historical repository content and commit metadata for accidental secrets, then resolve licensing/distribution and public/private product-boundary decisions.
4. Configure GitHub Pages only after the repository owner confirms the public sample-only deployment and required settings.
5. Validate the existing financial-health, risk, concentration, and annual comparison outputs with real user workflows before adding more KPIs; preserve local-first privacy and deterministic calculation boundaries.

## Release Gates and Constraints

- The dashboard package builds successfully in pull-request CI, but publishing requires the repository owner to configure Settings → Pages with Source set to GitHub Actions.
- The repository is public and has no valid open-source license yet. Do not change visibility or license automatically.
- Historical repository content and commit metadata require a separate credential-exposure review.
- Dependency licensing/distribution disposition remains open.
- Historical net-worth trends must come from explicitly dated user-captured snapshots. Never reconstruct or imply historical balances from today's records.
- Preserve a multi-year history in local storage and full-workspace backups; validate migration and rollback behavior before release.
- Do not add automatic FIRE persistence, external financial data, telemetry, AI calls, investment recommendations, or Monte Carlo analysis without a separately reviewed decision.
- Autonomous engineering workflow improvements are intentionally deprioritized until core product functionality and customer validation are substantially further along.


## 2026-10-25 — Follow-up in progress
- Chromium browser smoke covers keyboard submission for the FIRE planner, Goal Tracker, CAGR, and investment-performance calculator; invalid required fields clear stale results and return focus to the missing field where applicable.
- Follow-up: extend keyboard-submit coverage to return-risk analysis and verify its result summary appears when submitted from the keyboard.

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
