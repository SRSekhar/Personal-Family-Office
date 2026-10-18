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
- Product improvement log is maintained in `docs/product/IMPROVEMENT_LOG.md`.

## In Progress

- Interactive browser validation of FIRE calculation actions, Goal Tracker progress/reset/validation, invalid-input messaging, report downloads, and keyboard-only use.
- Verify responsive layout and usability at 400% zoom.
- Validate the local dashboard-to-offline-report workflow end to end; do not use real household data in the public repository or test fixtures.
- Customer demand remains unvalidated; plan the documented 8–10 anonymized interviews and seek two paid-pilot commitments.

## Next Deliverables

1. Complete interactive browser and accessibility verification for FIRE planner, report exports, and Goal Tracker.
2. Run the offline report workflow using fictional data, then confirm reports open without network access.
3. Capture anonymized customer-discovery evidence and update the product log.
4. Define valuation-date and recovery requirements before selecting historical snapshot persistence.
5. Resolve licensing/distribution and owner-side GitHub Pages setup before public release.

## Release Gates and Constraints

- The dashboard package builds successfully in pull-request CI, but publishing requires the repository owner to configure Settings → Pages with Source set to GitHub Actions.
- The repository is public and has no valid open-source license yet. Do not change visibility or license automatically.
- Historical repository content and commit metadata require a separate credential-exposure review.
- Dependency licensing/distribution disposition remains open.
- Do not add automatic FIRE persistence, external financial data, telemetry, AI calls, investment recommendations, or Monte Carlo analysis without a separately reviewed decision.
- Autonomous engineering workflow improvements are intentionally deprioritized until core product functionality and customer validation are substantially further along.
