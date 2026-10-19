# Product Improvement Log

This log preserves implementation outcomes, user decisions, lessons, and follow-up opportunities so future versions build on evidence rather than repeating discovery. It records engineering/product learnings; it must not contain real household financial data, credentials, or other secrets.

## 2026-10-18 — Dashboard usability and product-first prioritization

### Delivered
- Added CSV export with correct field quoting and neutralization of spreadsheet-formula-like text.
- Added asset/liability filtering and combined it with search.
- Added stable sorting by name and value without mutating stored records.
- Added reset for search and view options.
- Added category filtering and filtered-view CSV export.
- Added validated financial totals and overflow protection.
- Added a filtered assets/liabilities/net-worth summary. PR #137 was merged to `main` after CI, dashboard packaging, and full-history Secret Scan passed.

Relevant implementation history: PRs #127–#137, especially #133–#137.

### Product and engineering lessons
1. **Prioritize complete user workflows over low-impact engineering automation.** Autonomous development can be delayed while core product functionality is incomplete.
2. **Deliver small, coherent changes with focused tests.** Search, type/category filters, sorting, reset, and export should compose predictably.
3. **Treat financial data as untrusted input.** Validate malformed records and numeric boundaries, guard against aggregate overflow, and neutralize spreadsheet formula-like CSV values.
4. **Keep view operations read-only.** Filtering, sorting, and export should not silently reorder or mutate stored financial records.
5. **Make results explainable.** When a filtered view is active, showing totals for the full matching set helps users understand the subset—not merely the rows currently visible.
6. **Preserve privacy boundaries.** Private household data remains local to the loopback-only workspace; hosted non-loopback origins stay sample-only.
7. **Keep the repository as the durable source of truth.** Record decisions and implementation outcomes here so they survive the end of a chat or agent run.

## 2026-10-18 — FIRE planner scope decisions

### Existing capabilities to reuse
The calculator package already includes deterministic FIRE readiness, scenario comparison, and required annual contribution calculations. The next product gap is a usable interface and an integrated workflow, not duplicating the financial formulas.

### Agreed initial implementation direction
- Build a dedicated FIRE Planner section within the existing dashboard.
- Keep assumptions and results in memory for the first version; do not automatically persist them.
- Support annual contributions only in the first version. Do not silently convert monthly contributions.
- Implement a single retirement-target workflow first, then add scenario comparison and required-contribution planning.
- Keep calculations local, assumptions visible, validation accessible, and limitations explicit.
- Do not infer investable portfolio value from generic dashboard records or include illiquid assets without explicit user intent.
- Do not add remote services, telemetry, market-data feeds, AI calls, investment recommendations, or Monte Carlo analysis as part of this increment.

Source decision contract: `docs/architecture/ADR-0003-deterministic-fire-planner-contract.md`.

### Follow-up sequence
1. Complete interactive browser verification for single-scenario readiness, required contribution, scenario comparison, and explicit report downloads.
2. Validate keyboard operation, accessible status/error messaging, responsive layout, and 400% zoom.
3. Validate that downloaded FIRE reports open offline and disclose the complete assumptions and limitations.
4. Run customer discovery (8–10 anonymized interviews) and seek two paid-pilot commitments before expanding scope.
5. Define source-of-truth and recovery requirements before historical snapshot persistence.

### FIRE planner implementation outcome — PR #139
- Merged the first local-only dashboard planner section after CI, dashboard packaging, and Secret Scan passed on the PR head.
- The dashboard packages the existing calculator modules for browser use; calculator formulas remain in `@pfo/calculators`.
- The initial UI supports one scenario and required annual contribution solving, with ephemeral assumptions/results and hosted-origin controls disabled.
- Remaining validation: interactive browser behavior, keyboard/accessibility and 400% zoom, edge cases through the UI, and the dashboard-to-offline-report workflow.

### FIRE scenario comparison — PR #141
- Added a three-scenario comparison interface that reuses `compareFireReadinessScenarios` from the tested calculator package.
- Users explicitly copy main assumptions into the comparison, then edit each scenario's name, annual contribution, expected return, inflation, withdrawal rate, and contribution timing.
- The results preserve entered order and display assumptions; no scenario is ranked or recommended.
- CI, dashboard packaging, and Secret Scan passed before merge. The implementation does not automatically save comparison inputs/results.

### Offline FIRE report export — PR #142
- Added a report renderer in `@pfo/reports` for one scenario or a comparison, with schema validation, date/currency checks, consistent result checks, unique IDs, and HTML escaping.
- Added explicit download actions that produce self-contained, script-free HTML with no remote assets or network submission.
- CI, tests, dashboard packaging, and Secret Scan passed before merge.
- Reports contain assumptions and results; users are warned to keep downloaded files private. Automatic persistence remains out of scope.
- Browser-level download verification, keyboard/accessibility testing, and 400% zoom validation remain open.

### Goal tracker — PR #145
- Adds a deterministic calculator and dashboard UI for a single financial target: accumulated amount, target amount, progress percentage, remaining amount, target date, and overdue/completion state.
- The dashboard keeps values in memory only; refresh clears them. It does not infer progress from financial records, project returns, or recommend contributions.
- Calculator tests cover normal progress, over-target completion, overdue goals, and invalid inputs. CI typecheck/lint and browser-level accessibility checks must pass before this increment is considered complete.

### Required-contribution validation and stale-result protection — PRs #152–#153
- PR #152 added native form validity checking before solving for a required annual contribution, preventing blank required number fields from being interpreted as zero.
- PR #153 clears the previous FIRE result and in-memory report scenario when the solver's validity check fails, so a failed attempt cannot leave an old result presented as current.
- CI, Secret Scan, and dashboard packaging passed on both PR heads before merge.
- The dashboard already clears result/report state when the main FIRE assumptions change. The new guard protects the solver's own invalid-submit path as an additional defense.
- These are regression-protected code paths, not proof of browser-level behavior. Manual/browser verification of invalid submission, report-download availability, keyboard interaction, and screen-reader announcements remains open.
- After PR #152 merged, the main dashboard deployment workflow failed at the GitHub Pages configuration step, while packaging succeeded. Owner-side Pages setup is still a release prerequisite; do not describe the hosted deployment as verified until a successful main-branch deployment is confirmed.

## Open product and release work (not yet completed)
- Complete interactive browser/accessibility verification of the FIRE planner, comparison, and report-download workflows.
- Validate the end-to-end dashboard-to-offline-report workflow with fictional data and prospective users.
- Define a source of truth and persistence requirements before implementing historical financial snapshots.
- Run the planned 8–10 customer interviews and seek two paid-pilot commitments; do not treat implementation completion as proof of demand.
- Complete repository credential-exposure review, software licensing/distribution review, and owner-side GitHub Pages configuration before release.
- Autonomous delivery reliability is intentionally deprioritized until the core product features are substantially complete.

## Version-to-version learning template

For each meaningful product increment, record:
- **User problem:** What task or friction was observed?
- **Change delivered:** Exact capability and repository/PR reference.
- **Validation:** Tests, CI/security checks, and user evidence.
- **Outcome:** What improved, what did not, and what remains unknown?
- **Next-version opportunity:** A concrete follow-up, not an assumed requirement.
- **Safety/privacy impact:** Data handling, persistence, network access, and recovery implications.

Do not record personal financial values or claim customer demand without evidence.


### Accessibility contract regression checks — follow-up
- Added static-integrity checks for explicit labels on FIRE/Goal Tracker form controls, accessible validation alerts, polite result announcements, semantic section naming, and the native progress indicator's accessible name.
- These checks catch structural regressions in CI without adding a new dependency or changing the dashboard runtime.
- They are **not** a substitute for real browser testing, keyboard-only verification, screen-reader checks, or 400% zoom validation. Those remain open and must not be reported as completed.


### Accessibility contract regression checks — PR #147
- Merged static regression checks for explicit form labels, validation alerts, polite result announcements, semantic section naming, and the Goal Tracker progress indicator's accessible name.
- CI, full-history Secret Scan, and dashboard packaging passed after a test assertion was corrected based on CI output.
- Lesson: inspect the actual failure log and fix the test contract precisely; do not treat static markup assertions as proof of real assistive-technology behavior.
- Outstanding: interactive browser coverage for calculations, reset, validation and downloads; keyboard-only operation; screen-reader behavior; responsive layouts and 400% zoom.


### Goal progress accessibility wording — follow-up
- Updated the progress indicator's accessible value text to say the percentage is 'of target', so a completed goal above 100% is not announced as an impossible percentage 'complete'. The visual percentage remains uncapped to show the amount above target, while the native progress bar remains capped at 100.
- Added a static regression assertion for the accessible wording. Browser/screen-reader validation remains open.


### FIRE planner real-browser regression suite — in progress
- Added a Chromium smoke script that serves the actual dashboard on loopback and exercises FIRE readiness, invalid required-contribution submission clearing stale results, successful required-contribution solving, three-scenario comparison, and both offline HTML report downloads.
- Report checks require a standalone HTML document without executable scripts or remote asset dependencies, and verify that comparison reports include all three named scenarios.
- CI installs Playwright into a temporary directory rather than adding a permanent workspace dependency, installs Chromium, prepares browser calculator modules from the current package build, and runs the browser smoke script.
- This is automated Chromium coverage for key workflows, not a claim that keyboard-only navigation, screen-reader behavior, responsive breakpoints, or 400% zoom have been manually verified. Those remain follow-up validation items.
- Validation: PR #156 CI passed on head `0e1c0e1ee967030dd70b61f30737e406b0fb286c`, including lint, typecheck, build, existing tests, Chromium installation, and the real-browser smoke suite; Secret Scan also passed. This confirms the automated paths listed above, not the separate manual accessibility checks.


### Goal tracker and narrow-layout browser coverage — in progress
- Extended the existing Chromium smoke suite to calculate a 25% goal-progress example, verify the progress bar's accessible value text, and verify reset hides stale results.
- Added a keyboard Tab-order assertion that reaches the first FIRE planner field and a 320 CSS-pixel viewport check for page-level horizontal overflow.
- These checks improve regression coverage but do not replace manual screen-reader testing, real browser zoom at 400%, or comprehensive responsive testing across browsers. Those remain open.
- Validation: the Chromium browser smoke suite passed on PR #157 head `b09a0118bca15b523cdc63f755c92e0ec32e6e39`, including Goal Tracker, keyboard tab reachability, and 320px layout. The test exposed page-level overflow from the absolutely positioned screen-reader-only label inside the records table; adding a negative left offset keeps the visually hidden label off the right edge without removing it from the accessibility tree. CI and Secret Scan passed; the dashboard packaging workflow also passed. Manual screen-reader testing and an actual 400% zoom audit remain open.


### Keyboard skip navigation — in progress
- Added a visually hidden, keyboard-revealed “Skip to main content” link as the first focusable control, targeting the main landmark.
- Added static integrity coverage and Chromium interaction checks for first-Tab focus and Enter activation moving focus to main content.
- Kept the target focusable with `tabindex="-1"` and preserved the browser's focus indication; the link remains available to assistive technology.
- Validation status: pending CI, Secret Scan, and dashboard packaging on the feature PR. This does not replace screen-reader testing or a full WCAG audit.


### JSON backup download reliability — in progress
- Updated JSON backup export to attach the download link to the document, remove it after activation, and defer object-URL revocation briefly so browsers can begin consuming the file before its URL is released.
- Added a static regression contract and a Chromium download test that parses the downloaded backup and verifies its schema version, currency, records array, and export timestamp.
- This does not change the backup format or store data anywhere new; the browser download remains local to the user's device.
- Validation status: pending CI, Secret Scan, and dashboard packaging on the feature PR.


### Backup import round-trip and failure safety — in progress
- Extended Chromium coverage to import a valid versioned INR backup and verify that the financial record and net-worth total update.
- Added a malformed-schema import attempt and assertions that the existing record and totals remain unchanged after rejection.
- This is end-to-end validation using synthetic test data in a temporary browser context; it does not touch real user records or change the backup schema.
- Validation status: pending CI, Secret Scan, and dashboard packaging on the follow-up PR.


### Reduced-motion preference — in progress
- Updated scenario-comparison navigation to use immediate scrolling when the prefers-reduced-motion: reduce media query is active, while retaining smooth scrolling for users who have not requested reduced motion.
- Added a static contract and Chromium test that emulates the reduced-motion preference and observes the requested scroll behavior.
- This addresses one specific motion preference; it does not claim a complete motion/accessibility audit.
- Validation status: pending CI, Secret Scan, and dashboard packaging on the follow-up PR.


### Confirm backup replacement before overwriting existing records — in progress
- Importing a valid backup now prompts before replacing a non-empty private workspace. Cancelling leaves existing records unchanged; confirming intentionally replaces them.
- The prompt is shown only after the backup parses and passes schema/currency/record validation, so malformed files cannot trigger a misleading replacement confirmation.
- Added Chromium coverage for both cancel-preserves-data and confirm-replaces-data paths using synthetic records and verifying recalculated totals.
- The prompt is skipped for an empty workspace, preserving the normal first-import flow. Existing local-only privacy boundaries and backup schema are unchanged.
- Validation status: pending CI, Secret Scan, and dashboard packaging on the follow-up PR.


### CSV download reliability — PR #164 merged
- Updated both full-workspace and filtered-view CSV downloads to attach the anchor to the document before activation, then remove it after activation. CSV contents and filtering semantics are unchanged.
- Added Chromium download checks for filenames, the CSV header, expected full-export rows, and exclusion of non-matching rows from filtered exports.
- Validation passed on exact PR head `155f6d529e0aafed33ddd9bd10cdc7872bafc7e3`: CI (lint, typecheck, build, unit tests, and Chromium browser smoke suite), full-history Secret Scan, and dashboard packaging. The Pages publication step was skipped for this pull-request run; this validates packaging, not a new production deployment.
- Merged by squash as commit `8e5152ec3217bfec62c4f574c760cfca78c4eb0e`.


### Sidebar navigation history synchronization — browser regression coverage added
- Navigation state now derives from the URL fragment on initial load and on `hashchange`, keeping the active link, `aria-current="page"`, and breadcrumb aligned after direct links and browser Back/Forward navigation.
- Extended the existing Chromium smoke suite to verify an initial deep link, sidebar navigation, and Back/Forward restoration of active state and breadcrumb.
- The checks run against the real dashboard on loopback and use no private financial data. They complement static integrity assertions; a full assistive-technology audit remains separate.
- Validation: CI (including the real Chromium smoke suite), full-history Secret Scan, and dashboard packaging passed on PR #165 head `b652e0af6bbd213baf91d43f7df3bdf9908b2e7f`; merged as `ac88df9da651199e3333fd462f011c071559abe8`. The PR packaging run did not publish the Pages site.

### Narrow-layout FIRE comparison regression — PR #166
- Extended the existing real-Chromium smoke test to keep the three-scenario comparison open at a 320 CSS-pixel viewport (a useful narrow-layout proxy, not a claim of testing browser zoom at 400%).
- The first run exposed a real responsive-layout defect: the comparison table's wrapper lacked horizontal overflow containment, expanding the document width to 811px on a 320px viewport.
- Added a scoped wrapper rule (`width`/`max-width: 100%`, `min-width: 0`, and `overflow-x: auto`) so the wide comparison table scrolls within its panel rather than widening the page.
- The regression test asserts both no page-level overflow and contained table scrolling. Uses fictional dashboard sample state and loopback only; no dependencies, financial formulas, persistence, or network behavior changed.
- Validation: after the CSS fix, CI including the real Chromium smoke suite, full-history Secret Scan, and dashboard packaging passed on exact PR head `0d2e58ec9e2ea853ca77f53962a5e9014b668939`; merged as `11368dbee97dc2dde4c1801de209ac4bdaeaf45e`. The PR packaging run did not publish the Pages site.

### Offline financial summary report — implementation in progress
- Added a one-click dashboard download for a self-contained HTML summary containing total assets, total liabilities, net worth, category allocation, and the full record list.
- The renderer validates records and duplicate IDs, rejects numeric overflow, escapes untrusted text, and creates no scripts, remote assets, or network requests. Export uses the current workspace's complete record set rather than silently applying the active table filter.
- The report explicitly discloses that dashboard records do not track valuation dates: its timestamp is report-generation time, not a valuation date. It also warns users to keep downloaded financial reports private.
- Added unit coverage for totals, allocation, empty data, malformed input, duplicate IDs, escaping, offline safety, and overflow, plus Chromium download coverage using fictional demo data.
- Validation passed on exact PR head `a875bfb3aef1e2a1223821632a07ed98cd8df57b`: CI including the real Chromium smoke suite, full-history Secret Scan, and dashboard packaging. The Pages publication step was skipped for the pull-request run. Merged as `585a0da3c9690b841d98be25171333471d04121a`.


### Saved multi-goal financial tracker — implementation in progress
- Expanded the single-goal calculator with a separate saved-goal list. Users can create multiple goals, edit targets/dates/progress, and delete goals after confirmation.
- Goal data uses a dedicated versioned local-storage key, separate from financial records. It is only read or changed in the loopback-only private workspace; hosted demo remains sample-only.
- Storage validation rejects malformed dates, invalid amounts, duplicate IDs, and invalid timestamps. If saved data cannot be read or written safely, changes fail closed and existing data is not overwritten.
- Added unit tests for goal validation and storage failures, plus Chromium lifecycle coverage for save, reload persistence, update, and confirmed deletion using fictional values.
- Validation pending CI, real Chromium smoke tests, full-history Secret Scan, and dashboard packaging on the exact PR head. No production deployment is claimed.
