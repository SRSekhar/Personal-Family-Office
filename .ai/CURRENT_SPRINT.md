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
- PR #323 — Chromium verification that duplicate snapshot dates are rejected without replacing or duplicating saved history.
- PR #324 verifies malformed-history detection, paused capture, and preservation of the invalid storage value. Current follow-up verifies recovery through the normal full-workspace backup import workflow.
- Current follow-up adds Chromium coverage that a duplicate snapshot date is rejected without replacing or duplicating saved history.
- Historical snapshot detail keyboard focus — opening details moves focus to the labelled heading; closing returns focus to the exact trigger, verified in Chromium smoke.
- Confirmed historical snapshot correction — private history rows expose removal with explicit confirmation and a backup warning; persistence is atomic, current records stay untouched, and the date can then be recaptured.

## In Progress

- Added CI static accessibility-contract regression checks for FIRE/Goal Tracker labels, alerts, live regions, section naming, and progress indicator. This is structural coverage only, not browser validation.
- Interactive browser validation of FIRE calculation actions, Goal Tracker progress/reset/validation, invalid-input messaging, report downloads, and keyboard-only use remains open. The current follow-up adds an explicit Chromium regression for progress above 100%, capped native progress semantics, accessible percentage wording, completion status, and non-negative remaining amount.
- Historical trend and detail panels now have Chromium regression checks at a 320 CSS-pixel viewport for single-column reflow, contained content, and preserved focus; this is a narrow-viewport test, not a full browser-zoom or manual screen-reader audit.
- Verify responsive layout and usability at 400% zoom.
- Browser smoke opens the financial summary, single-scenario FIRE report, three-scenario comparison report, and monthly financial review from local file URLs with HTTP/HTTPS requests blocked; fictional data only. PR #320 adds passing Chromium coverage for HTML escaping of user-controlled goal names; the current follow-up also checks user-controlled budget and transaction category text.
- Customer demand remains unvalidated; plan the documented 8–10 anonymized interviews and seek two paid-pilot commitments.

## Next Deliverables

1. Complete interactive browser and accessibility verification for FIRE planner, report exports, and Goal Tracker.
2. Extend offline report checks to remaining report types and verify downloads stay self-contained under browser file-opening restrictions.
3. Capture anonymized customer-discovery evidence and update the product log.
4. Complete a broader manual screen-reader and real-browser 400% zoom review of the historical trend and snapshot-detail panels; automated keyboard focus and 320 CSS-pixel responsive checks are covered.
5. Chromium now exercises keyboard activation and focus restoration for confirmed snapshot removal, cancellation, and storage failure. Complete a broader manual screen-reader review and ensure full-workspace backups are available before destructive edits.
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
