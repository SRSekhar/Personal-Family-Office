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
- Current follow-up verifies keyboard submission of invalid FIRE contribution assumptions clears stale results and moves focus to the invalid required field.

## In Progress

- Added CI static accessibility-contract regression checks for FIRE/Goal Tracker labels, alerts, live regions, section naming, and progress indicator. This is structural coverage only, not browser validation.
- Chromium smoke now covers FIRE calculations/reset, Goal Tracker progress and validation, report downloads, keyboard activation, and over-target progress semantics. The current follow-up adds keyboard submission coverage for invalid FIRE contribution assumptions, stale-result clearing, and focus on the invalid required field. Manual screen-reader review and real browser-chrome 400% zoom verification remain open.
- Historical trend and detail panels now have Chromium regression checks at a 320 CSS-pixel viewport for single-column reflow, contained content, and preserved focus; this is a narrow-viewport test, not a full browser-zoom or manual screen-reader audit.
- Verify responsive layout and usability at 400% zoom.
- Browser smoke opens the financial summary, single-scenario FIRE report, three-scenario comparison report, and monthly financial review from local file URLs with HTTP/HTTPS requests blocked. PRs #320–#321 verify escaped user-controlled goal and category text; fictional data only.
- Customer demand remains unvalidated; plan the documented 8–10 anonymized interviews and seek two paid-pilot commitments.

## Next Deliverables

1. Complete interactive browser and accessibility verification for FIRE planner, report exports, and Goal Tracker.
2. Extend offline report checks to remaining report types and verify downloads stay self-contained under browser file-opening restrictions.
3. Capture anonymized customer-discovery evidence and update the product log.
4. Complete a broader manual screen-reader and real-browser 400% zoom review of the historical trend and snapshot-detail panels; automated keyboard focus and 320 CSS-pixel responsive checks are covered.
5. Automated keyboard checks cover snapshot removal, cancellation, and storage failure. Complete a broader manual screen-reader review and ensure full-workspace backups are available before destructive edits.
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
