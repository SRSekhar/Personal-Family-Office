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

- PR #304 — documented multi-year historical financial data requirements, local-first privacy, explicit valuation dates, and no fabricated gaps.
- PR #305 — validated historical snapshot domain model with duplicate-date protection, chronological summaries, and regression tests.
- PR #307 — local development-only fictional history, private snapshot capture, history table, and CSV export.
- PR #308 — schema v4 full-workspace backup/restore with validated snapshots and transactional rollback; legacy v1–v3 imports preserve history.
- PR #309 — browser regressions for fake-data isolation, sample/private switching, and restore rollback on snapshot storage failure.
- PR #310 — accessible net-worth trend visualization with one point per actual snapshot date.
- PR #311 — per-snapshot record and category breakdown details with safe text rendering and focus restoration.
- PR #312 — Chromium verification that historical snapshots survive page reloads.
- Historical snapshot detail keyboard focus — opening details moves focus to the labelled heading; closing returns focus to the exact trigger, verified in Chromium smoke.

## In Progress

- Added CI static accessibility-contract regression checks for FIRE/Goal Tracker labels, alerts, live regions, section naming, and progress indicator. This is structural coverage only, not browser validation.
- Interactive browser validation of FIRE calculation actions, Goal Tracker progress/reset/validation, invalid-input messaging, report downloads, and keyboard-only use remains open.
- Verify responsive layout and usability at 400% zoom.
- Validate the local dashboard-to-offline-report workflow end to end; do not use real household data in the public repository or test fixtures.
- Customer demand remains unvalidated; plan the documented 8–10 anonymized interviews and seek two paid-pilot commitments.

## Next Deliverables

1. Complete interactive browser and accessibility verification for FIRE planner, report exports, and Goal Tracker.
2. Run the offline report workflow using fictional data, then confirm reports open without network access.
3. Capture anonymized customer-discovery evidence and update the product log.
4. Complete a broader manual screen-reader, responsive-layout, and 400% zoom review of the historical trend and snapshot-detail panels; the automated keyboard focus contract is covered.
5. Review an explicit, confirmed correction/removal workflow for erroneous historical snapshots without permitting silent replacement.
6. Resolve licensing/distribution and owner-side GitHub Pages setup before public release.

## Release Gates and Constraints

- The dashboard package builds successfully in pull-request CI, but publishing requires the repository owner to configure Settings → Pages with Source set to GitHub Actions.
- The repository is public and has no valid open-source license yet. Do not change visibility or license automatically.
- Historical repository content and commit metadata require a separate credential-exposure review.
- Dependency licensing/distribution disposition remains open.
- Historical net-worth trends must come from explicitly dated user-captured snapshots. Never reconstruct or imply historical balances from today's records.
- Preserve a multi-year history in local storage and full-workspace backups; validate migration and rollback behavior before release.
- Do not add automatic FIRE persistence, external financial data, telemetry, AI calls, investment recommendations, or Monte Carlo analysis without a separately reviewed decision.
- Autonomous engineering workflow improvements are intentionally deprioritized until core product functionality and customer validation are substantially further along.
