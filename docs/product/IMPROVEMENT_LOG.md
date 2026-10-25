## 2026-10-25 — Offline monthly financial review verification

### Delivered in feature branch
- Extended Chromium browser smoke coverage for the monthly financial review download using fictional saved transactions, a saved category budget, and a saved goal.
- Verified the downloaded report filename includes the explicitly selected month and that the report includes its month, budget overrun, and saved goal.
- Opened the generated HTML directly from a local file URL with HTTP/HTTPS requests blocked and verified its essential content still renders without network requests.
- This adds coverage for the monthly review only; it does not claim every export type has been tested offline.

### Product and engineering lessons
- Reports that combine several saved data sources need end-to-end reconciliation checks, not only renderer unit tests.
- Keep offline-opening checks explicit and scoped to the report types actually exercised.

## 2026-10-20 — Monthly cash-flow category budgets

### Delivered in feature branch
- Added explicit monthly spending limits per category and a local comparison against recorded expenses for the selected month.
- Budget actuals aggregate expense transactions by category without case sensitivity; categories with recorded spending but no budget are shown separately.
- The table identifies over-budget, within-budget, and not-spent states, with edit/delete controls for saved limits.
- Budgets use a separate validated local-storage key and fail closed if saved budget data is invalid; ledger transaction storage and backup formats are unchanged.
- No default budgets, recurring forecasts, network calls, or financial recommendations are introduced.

### Validation
- Chromium regression coverage added for saving a budget, aggregating expense actuals, overspend calculation, and persistence across reload.
- Full CI, browser smoke, dashboard packaging, and Secret Scan are pending for the pull request.

# Product Improvement Log

## 2026-10-20 — Append cash-flow transactions from CSV

### Delivered
- Added a separate Append CSV action alongside the existing replace-all CSV import.
- Preview the post-import transaction count and income, expenses, and net cash flow before confirming an append.
- Warn when imported rows exactly match existing transactions; retain those rows only after explicit confirmation rather than silently deduplicating.
- Preserve the existing replacement workflow and reject append when saved ledger data cannot be validated.
- Added Chromium coverage for append semantics, duplicate warning, and total reconciliation.

### Product and engineering lessons
- Import should make the data operation explicit: replacement and append are different user intents. Duplicate warnings protect against accidental repeated imports without deleting legitimate repeated transactions.

## 2026-10-20 — Export filtered cash-flow categories

### Delivered
- Added a dedicated category CSV export derived from the exact visible transaction set, applying period, date, type, frequency, category, and search filters.
- Calculate each category's expense share against only the expenses in the filtered view, rather than mixing it with unfiltered reporting-period totals.
- Keep the existing selected-period category export unchanged and disable the new export for inverted date ranges.
- Add Chromium download assertions for schema, selected-category-only output, and expense-share reconciliation.

### Product and engineering lessons
- A filtered report should apply the same constraints to both its rows and its denominators; otherwise percentages can be technically valid but misleading for the current view.


## 2026-10-20 — Export filtered cash-flow summary

### Delivered
- Added a dedicated CSV export for the exact currently visible transaction set, with income, expenses, net, savings rate, and transaction count.
- Kept the full transaction export and period-based monthly/category exports separate.
- Represented savings rate as an empty CSV field when filtered income is zero and disabled the action when the date range is invalid.
- Added unit and Chromium browser coverage for output schema, selected-category totals, zero-income behavior, and invalid-range protection.

### Product and engineering lessons
- Let users take a compact analytical summary away from the app without forcing them to recalculate from the raw transaction export.
- Keep the summary schema explicit and machine-readable; do not mix reporting-period totals with filtered-view totals.


## 2026-10-20 — Cash-flow date-range validation

### Delivered
- Handle inverted inclusive date filters without throwing during dashboard rendering.
- Show an explicit accessible error, replace misleading transaction counts with an invalid-range state, and disable filtered CSV export until corrected.
- Extend Chromium regression coverage for valid one-sided ranges, inverted ranges, validation messaging, export safety, and reset recovery.

### Product and engineering lessons
- Validate combinations of otherwise-valid inputs at the UI boundary, not only individual field values in the calculation layer.
- Invalid filter state must not leave stale results visible or allow an export that silently bypasses the user's intended constraints.


## 2026-10-20 — Filter-aware cash-flow totals

### Delivered
- Added a summary for the currently visible cash-flow transactions: income, expenses, net cash flow, and savings rate.
- Applied the existing period, inclusive date range, type, frequency, category, and text-search filters consistently to the summary.
- Kept reporting-period KPIs and period-based category/month summaries unchanged, and clarified the filtered summary scope in the UI.
- Added a Chromium regression proving category-filtered totals exclude non-matching income and reconcile to the visible expense.

### Product and engineering lessons
- Show both reporting-period context and totals for the current filtered view; otherwise filters can make displayed totals feel inconsistent.
- Sorting is presentational and must not alter aggregate values.


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

## 2026-10-20 — Cash-flow CSV import

### Delivered
- Added CSV import for the cash-flow ledger using the exact column schema emitted by the existing CSV export: date, type, category, description, amount, recurring.
- Strictly validates header, column count, calendar dates, transaction types, positive finite amounts, and recurring flags before touching stored data.
- Supports quoted fields, commas, escaped quotes, CRLF/LF row endings, and UTF-8 BOM input.
- Shows an income/expense/net preview and requires explicit confirmation before replacing the existing local ledger.
- Rejecting the confirmation preserves existing transactions; malformed input is rejected without storage writes.
- Added a Chromium smoke regression for importing a quoted description and checking the resulting totals and status message.

### Product and engineering lessons
- A round-trip CSV workflow is more useful than export-only data portability.
- Reuse the exported schema as the import contract; do not guess alternate column names or silently coerce invalid values.
- Validate the complete import and preview its financial effect before replacing local data.
- CSV import remains local-only and does not add network calls or a new persistence location.

## 2026-10-20 — Cash-flow expense share by category

### Delivered
- Added a selected-period expense-share column to the cash-flow category table.
- Each share is calculated as category expenses divided by all recorded expenses in the same reporting period.
- The table explicitly shows an unavailable marker when the selected period has no expenses; it does not present a misleading percentage.
- Added a Chromium regression proving that the housing category accounts for 100% of expenses while an income-only category accounts for 0% in the sample period.

### Product and engineering lessons
- Ratios need a clearly named denominator and a matching time window.
- Keep expense mix distinct from income share, and do not interpret the metric as a budget, target, or recommendation.
- Zero-denominator behavior must be explicit rather than silently reported as zero percent.

## 2026-10-20 — Dashboard balance-sheet ratios

### Delivered
- Surfaced the existing shared analytics ratios on the dashboard overview: liabilities/assets, net worth/assets, and assets/liabilities.
- Reused the existing validated ratio analyzer rather than duplicating financial formulas in the UI.
- Packaged the analyzer into the static dashboard runtime and added deployment validation for the module and app import.
- Added browser smoke assertions for the sample portfolio's ratios and for the unavailable assets/liabilities result when imported data has zero liabilities.

### Product and engineering lessons
- Existing deterministic analytics should be made visible in the product before introducing a second formula implementation.
- Ratios must be labeled by their numerator and denominator; percentages and multiples are different presentations.
- A zero denominator is unavailable, not zero or infinity.
- The dashboard reports descriptive ratios only and does not invent benchmarks, thresholds, or recommendations.

## 2026-10-20 — Investment cash-flow CSV import

### Delivered
- Added a local CSV import action to the investment-performance calculator using the strict `date,amount` schema.
- Preserves investor-perspective signs: contributions are negative and proceeds or an explicitly supplied terminal valuation are positive.
- Validates the header, row shape, ISO dates, real calendar dates, and non-zero finite signed amounts before changing inputs.
- Previews flow count, gross contributions, and gross proceeds; replacing the entered flow list requires explicit confirmation.
- Invalid input and cancelled replacement leave the existing cash-flow inputs untouched.
- Added Chromium smoke coverage for quoted CSV fields, return calculation after import, malformed date rejection, and cancelled replacement.

### Product and engineering lessons
- Import formats should match the calculator's actual input semantics rather than export-result summaries.
- Signed cash flows are domain-significant; do not normalize all amounts to positive values.
- Keep the imported data ephemeral and local-only, consistent with the calculator's existing privacy model.

## 2026-10-20 — Cash-flow category export metric parity

### Delivered
- Added `expense_share_percent` to the selected-period category CSV export so exported summaries include the same expense-mix metric as the dashboard table.
- Calculates each category's share against the sum of category expenses in the selected period.
- Exports a blank share when total expenses are zero instead of reporting a misleading 0%.
- Added browser regression assertions for a category with 100% of expenses and an income-only category with 0%.

### Product and engineering lessons
- Downloaded summaries should preserve the key metrics users see on screen.
- Document the percentage denominator in the field name and keep it scoped to the selected period.
- A zero denominator is unavailable; do not conflate unavailable with zero percent.

## 2026-10-20 — Re-importable investment cash-flow export

### Delivered
- Added a second export action that downloads only the dated signed cash flows in the importer's exact `date,amount` CSV schema.
- Kept the existing performance-summary CSV unchanged, preserving both human-readable results and a machine-readable re-import file.
- Disabled both export actions when inputs change or results become stale.
- Added unit coverage for signed values and invalid inputs, plus Chromium coverage that exports cash flows and imports the exported file back into the calculator.

### Product and engineering lessons
- A summary export and a data-interchange export serve different purposes; don't make users edit a report to reuse its source inputs.
- Round-trip tests catch schema drift between import and export workflows.
- Preserve investor-perspective cash-flow signs and explicit dates through the full export/import loop.

## 2026-10-20 — Monthly cash-flow savings rate

### Delivered
- Added a savings-rate column to the monthly cash-flow trend using the existing net-divided-by-income calculation.
- Added the same `savings_rate_percent` field to monthly summary CSV exports.
- Displays an unavailable marker and exports an empty field for months with zero income.
- Added unit and Chromium regression coverage for the 80% savings-rate example and the zero-income CSV behavior.

### Product and engineering lessons
- Reuse the existing savings-rate definition to keep monthly and selected-period metrics consistent.
- Ratios should use the same month grouping as the totals beside them.
- Zero income makes the rate unavailable; do not silently display zero percent.

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
- Validation: PR #169 passed CI, Secret Scan, and dashboard packaging on exact head `3a6e7156e7e33c0bc53bcb7e24d55f1a9ff71df9`; merged to `main` as `df4c5084abdb3e6d5a4273a066107fc254c887f7`. The Chromium suite verified create, reload persistence, edit, and confirmed deletion using fictional data. No production deployment is claimed.

### Saved-goal backup and recovery — implementation in progress
- Private workspace exports use backup schema version 2 and include saved goals alongside financial records; sample/demo exports remain record-only version 1.
- The importer remains compatible with version 1 backups. Since those backups never contained goal data, restoring one replaces financial records but preserves the current saved-goal storage.
- Version 2 validation rejects malformed goals and duplicate IDs before any writes, and strips unknown goal fields before persistence.
- Version 2 restore writes validated goal data and financial records as a coordinated operation, attempts to restore the prior goal-storage value if the records write fails, and fails closed if the rollback itself cannot be completed.
- Added unit coverage for legacy compatibility, valid/empty goal collections, invalid goal fields, duplicate IDs, and unknown-field stripping; expanded the real Chromium smoke workflow to cover goal backup export and restore.
- Validation: PR #173 passed CI (40 test files plus Chromium goal-backup export/restore round trip), full-history Secret Scan, and dashboard packaging on exact head `fdd41f774741dc83ca967969335a60d54dbb7222`; merged to `main` as `955d405b1948d71d54ab53580ff09703ffe94a33`. The packaging workflow passed; this does not by itself establish live Pages publication.
- Privacy impact: backups can contain sensitive household records and goal progress; they are generated locally and should be stored privately. No remote upload or telemetry was added.



### CSV financial-record import — implementation in progress
- Added a strict parser for the dashboard's own CSV schema, including escaped quotes, commas, embedded newlines, BOM, CRLF/LF, currency validation, and all-row validation before any writes.
- The UI imports CSV only in the loopback-only private workspace, requires replacement confirmation when existing records are present, recalculates totals, and preserves saved goals because CSV contains records only.
- Added parser unit coverage and Chromium smoke checks for successful import, recalculated totals, goal preservation, and malformed-file rejection.
- Validation: PR #174 passed CI (41 test files plus Chromium CSV import, totals recalculation, saved-goal preservation, and malformed-file rejection), full-history Secret Scan, and dashboard packaging on exact head `65e134fe67ebea1fc26743c3d2155f29ad6bcc43`; merged to `main` as `9a86032e031bdad8732c499d08f1727cae55932b`. The post-merge CI, Secret Scan, and packaging workflows also passed. This does not by itself establish live Pages publication.
- Privacy/safety: CSV is read locally in the browser; imported text is treated as data and never executed. No upload or telemetry was added.


### Goal monthly savings pace — implementation in progress
- Added a deterministic estimate of the approximate monthly amount needed to close the remaining goal gap, dividing the remaining amount by the approximate number of months until the target date.
- The estimate explicitly assumes no interest or investment returns. Completed goals show no further pace required; goals due today or overdue do not show a misleading achievable monthly amount.
- Added calculator tests and Chromium assertions for the single-goal result and saved-goal cards.
- Validation: PR #175 passed CI (41 test files plus Chromium goal progress assertions), full-history Secret Scan, and dashboard packaging on exact head `a1091588c4ef28adb04fc264da60c9ce6e810e5c`; merged to `main` as `6a8685fb2f61cdf15a4fb0b4796a1f2c258c4443`. The estimate is an arithmetic illustration, not a forecast or investment recommendation.
- No new financial data is inferred or persisted; the estimate is derived from the user-entered target, accumulated amount, and target date.


### Preserve custom categories on imported-record edits — implementation in progress
- CSV and JSON imports accept user-defined category strings, while the record editor offers the built-in categories. Previously, opening and saving an imported record with a custom category could silently change it to the first built-in category.
- The record editor now includes the current non-standard category as an option while editing, preserving imported data unless the user deliberately changes the category.
- Added Chromium coverage that imports a fictional custom category, edits the record name, and verifies the category remains unchanged.
- Validation: PR #176 passed CI (41 test files plus the Chromium custom-category edit regression), full-history Secret Scan, and dashboard packaging on exact head `5cf9e8d110336fcc9cf82b6d600c8c5a93dafa41`; merged to `main` as `ab0b6a20670255affc0d947e3ec5be2ae543e2e3`. Post-merge main-branch checks were running at the time this entry was prepared.

### FIRE planner reset regression coverage — PR #178
- Extended the real Chromium smoke workflow to exercise the Reset assumptions action after single-scenario and three-scenario report generation.
- Verified the main assumptions return to their documented defaults, and reset clears readiness/contribution/comparison results, both report-download actions, and validation messaging so stale calculations cannot be mistaken for current results.
- Validation: PR #178 passed CI, including the real-browser FIRE planner smoke test, and full-history Secret Scan on exact head `fa08ac5688333953c0a8674b71d3fae3a6e71a4f`; merged to `main` as `a97b0d66b13ba0668bbbc49f8d2a9ae035e6c1e9`.
- Scope stayed test-only; no product behavior or household financial data changed.

### FIRE planner zero-year boundary regression — PR #180
- Added Chromium coverage for the valid zero-years-until-retirement boundary.
- Verified the projected portfolio remains equal to the current portfolio even when annual contributions are non-zero, and the target corpus uses today's spending without applying future inflation at a zero-year horizon.
- The first browser run caught a locale-sensitive assertion: Indian currency formatting includes the rupee symbol and grouping commas. The test now normalizes the displayed amount before comparison rather than assuming western digit-grouping output.
- Validation: corrected PR #180 head `044f3e6fb46eb5b57e02fe930b7b551e8ce90019` passed CI (including the Chromium FIRE planner smoke test) and full-history Secret Scan; merged to `main` as `e8ae08d555ba95b5494e5446b2199d80ea2cb2f9`.
- Test-only change; no product behavior or household financial data changed.

### Invalidate stale FIRE solver results when assumptions change — PR #183
- Fixed a state-consistency bug: editing a shared FIRE assumption already hid the main readiness result, but the required-annual-contribution result could remain visible with values from the previous assumptions.
- The main FIRE form's input handler now hides the required-contribution output as well as the readiness and comparison results and invalidates report snapshots.
- Added a Chromium regression that produces a required-contribution result, edits inflation, and verifies both solver and readiness results are hidden.
- Validation: PR #183 passed CI, including the full suite and real Chromium FIRE planner smoke test, and full-history Secret Scan on exact head `d4c7c08affd1c116be56ba2272b196579d1cef11`; dashboard packaging passed. Merged to `main` as `d23385358b112d0de1657adb05a55a7c53bd5f61`. The dashboard publication step was skipped for the pull request; this does not establish a production deployment.
- No personal financial data is persisted or transmitted by this change.


### FIRE comparison report snapshot invalidation — PR #186
- Fixed a stale-state defense-in-depth gap: editing any comparison-specific assumption now clears the cached comparison report scenarios as well as hiding the previously calculated comparison results.
- Extended the real Chromium smoke suite to edit a scenario after generating a comparison report, confirm the old results are hidden, programmatically attempt the now-hidden download action, and verify no stale report is produced; rerunning the comparison restores fresh results.
- Validation: PR #186 passed CI, including the real Chromium FIRE planner smoke suite, full-history Secret Scan, and dashboard packaging on exact head `53f1babdd369c13548e1cdb9f0ce251c95a8256d`; merged to `main` as `64947b37d72505ea8c272b8c2714a9490338656c`. The publication step was skipped for the pull request; this does not establish a production deployment.
- The change uses fictional browser data only and adds no persistence, network requests, or financial data.


### Saved-goal deletion cancellation safety — PR #189
- Extended the real Chromium smoke workflow to dismiss the saved-goal deletion confirmation, verify the goal and progress remain present, reload the dashboard, and verify the saved data is still intact before the existing confirmed-delete path runs.
- Uses fictional goal values in the isolated browser profile. No production behavior, persistence format, or network behavior changed.
- Validation: PR #189 passed CI, including the real Chromium dashboard smoke suite, and full-history Secret Scan on exact head `052f385ed1c65aa98cfebfacfcd16b35d318d77b`; merged to `main` as `bd0968a0c1867cbfa653dc2c6cf04facff6ee018`.


### Keyboard-only FIRE workflow regression — PR #192
- Extended the real Chromium smoke suite to navigate from FIRE assumptions to readiness calculation with Tab and Enter, verify focus remains on the calculation action, reach the single-scenario report download by keyboard, and activate it with Enter.
- Added keyboard navigation/activation for the three-scenario comparison and its report download, checking focus continuity after calculation.
- Validation: PR #192 passed CI including the real Chromium smoke suite, and full-history Secret Scan on exact head `217ee8b6d0a07636e98aeaf7ca49880a6edbe60c`; merged to `main` as `c462c98c5c80ba6e9faa9e56c487da1d380056a8`.
- The 320 CSS-pixel viewport test remains a narrow-layout proxy; this change does not claim actual 400% browser zoom, comprehensive keyboard coverage, or manual screen-reader validation.


### FIRE planner 400%-zoom-equivalent reflow regression — PR #195
- Extended the real Chromium smoke workflow to resize the CSS viewport to one quarter of its 1280px baseline (320 CSS pixels), then verify the FIRE planner has no page-level horizontal overflow and readiness calculation/results remain operable.
- A first attempt to trigger browser-chrome zoom shortcuts in headless Chromium did not change the CSS viewport. The test was corrected to use the documented 320 CSS-pixel reflow equivalent instead of claiming that headless browser shortcuts validated actual browser zoom.
- Validation: PR #195 passed CI, including the Chromium smoke suite, and full-history Secret Scan on exact head `b03e71e837398c330b0441468a0bee00587a08b3`; merged to `main` as `a3c0e613c603328db90e953786c73119cca176fb`.
- This is automated reflow coverage, not proof of actual browser-chrome zoom, manual screen-reader behavior, or a complete WCAG audit. Those remain open.


### Narrow FIRE comparison keyboard regression — PR #197
- Extended the real-Chromium smoke suite at a 320 CSS-pixel viewport to activate comparison recalculation with Enter, confirm focus continuity, tab to the comparison report action, and verify that action fits within the viewport.
- The first run exposed an overly strict single-Tab assertion: focus did not land directly on the report action at narrow width. The test now searches a bounded number of Tab presses for the expected control, matching the suite's existing robust focus-navigation pattern.
- Validation: PR #197 passed CI including the real Chromium smoke suite and full-history Secret Scan on final head `e4dfa1490ce8ec6ed032ffa68f7f1ec7054d4be3`; merged to `main` as `ab58002f820a7c87d112b4907fdef4d483707e98`.
- This is automated narrow-viewport keyboard coverage using fictional browser data. Manual screen-reader and actual browser-zoom validation remain open.

### Income and expense tracking — PR #200 merged
- Added a local-only transaction ledger for dated income and expenses, category/description, recurring flag, and positive monetary amounts.
- Added month-scoped and all-time summaries for income, expenses, and net cash flow; this ledger remains separate from asset/liability records and does not alter net-worth calculations.
- Added edit/delete flows, local JSON backup/restore, and CSV export with spreadsheet-formula neutralization. Imports validate the full payload before replacement; malformed saved data is left untouched and editing fails closed until recovery.
- The feature is disabled on non-loopback hosted origins. Transactions use a dedicated local-storage key and are not included in the existing asset/liability JSON backup; the dedicated cash-flow backup is separate by design for this increment.
- PR #200 passed CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow category breakdown — PR #201 merged
- Added a selected-period category table with income, expenses, and net cash flow, sorted deterministically by total category activity.
- Reuses the existing local ledger and reporting-period selector without changing stored data, net-worth calculations, or the backup format.
- PR #201 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow transaction filters — PR #202 merged
- Added case-insensitive search across transaction date, category, and description, plus income/expense filtering and reset.
- Visible-row counts distinguish filtered rows from the period-wide summary and category totals.
- PR #202 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow savings rate — PR #203 merged
- Added a selected-period savings-rate KPI defined as (income - expenses) / income, shown as a percentage.
- Zero income produces an unavailable marker instead of division by zero; negative rates are allowed when expenses exceed income. The KPI is descriptive, not a recommendation.
- PR #203 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow frequency filter — PR #204 merged
- Added recurring vs one-time transaction filtering, composing with period, type, and text search filters.
- The existing boolean flag is treated as a label only; no schedule cadence or future amount is inferred.
- PR #204 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow CSV export scope — PR #205 merged
- Added explicit filtered-row and full-ledger CSV export actions so the downloaded scope is clear.
- Browser regression coverage verifies that filtered export includes visible matching transactions and excludes rows outside the active filter.
- PR #205 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow transaction sorting — PR #206 merged
- Added deterministic date, amount, and category sort options to the filtered transaction view.
- Filtered CSV export follows the visible ordering; full-ledger CSV remains an unfiltered export.
- PR #206 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow category filter — PR #207 merged
- Added a dynamic category selector that composes with reporting period, transaction type, frequency, text search, and sort order.
- Categories are derived from validated local entries; removed categories fall back to All categories rather than leaving a stale selection. A category literally named "all" remains filterable.
- PR #207 passed unit tests, CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow transaction duplication — PR #208 merged
- Added a Duplicate row action that pre-fills the transaction form as a new entry, leaving the original untouched.
- Saving a duplicate creates a new ID through the existing add path; the action does not infer a recurrence schedule or automatically persist anything before Save.
- PR #208 passed CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow category transaction counts — PR #209 merged
- Exposed the existing per-category transaction count in the category breakdown table.
- This is descriptive only and does not change category totals, transaction storage, or filtering.
- PR #209 passed CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow import preview — PR #210 merged
- Before replacing the local cash-flow ledger, show the import's transaction count, total income, total expenses, and net cash flow in the confirmation dialog.
- Cancelling leaves existing transactions unchanged; valid imports still pass full-ledger validation before any write.
- PR #210 passed CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow date-range filtering — PR #211 merged
- Added inclusive start/end date filters that compose with reporting period, type, recurring frequency, category, text search, and sort order.
- Invalid calendar dates and reversed ranges are rejected by the ledger filter; reset clears the date bounds, and filtered CSV follows the visible rows.
- PR #211 passed CI, Chromium browser smoke tests, dashboard packaging, and Secret Scan before merge.

### Cash-flow delete confirmation — PR #213 merged
- Expanded deletion confirmation to show description, date, transaction type, category, and amount so repeated descriptions can be distinguished (main commit a7a821a).
- Added a browser regression that dismisses the confirmation and verifies the transaction row, net cash flow, and savings rate remain unchanged before confirming a separate deletion.
- PR #213 passed CI, Chromium browser smoke tests, and Secret Scan before merge.

### Balance-sheet financial ratios — PR #214 merged
- Added deterministic liabilities-to-assets, net-worth-to-assets, and assets-to-liabilities ratios to explicit portfolio analysis.
- Ratios are dimensionless, zero denominators return null, inputs must reconcile and share a currency, and overflow is rejected rather than returned as Infinity.
- The metrics are descriptive only: no thresholds, forecasts, or investment recommendations are inferred.
- PR #214 passed CI, typecheck, lint, tests, and Secret Scan.

### Category concentration metrics — PR #215 merged
- Added deterministic concentration metrics based only on caller-supplied asset-allocation categories: HHI, effective category count, and largest-category share.
- Validates allocation weights and values reconcile; empty allocation returns null metrics instead of misleading zeros.
- This is category concentration, not a correlation-aware risk or diversification recommendation.
- PR #215 passed CI, typecheck, lint, tests, and Secret Scan.

### Return-series risk analysis — PR #216 merged
- Added deterministic annualized sample volatility, maximum drawdown, worst period return, and negative-period count for caller-supplied dated simple returns.
- Annualization frequency is explicit; dates must be valid and ordered; returns below -100% and numeric overflow are rejected.
- No market data, forecasts, risk ratings, or investment recommendations are inferred.
- PR #216 passed CI, typecheck, lint, tests, and Secret Scan.

### Annualized Sharpe ratio — PR #217 merged
- Added an optional annualized Sharpe ratio that is only calculated when the caller explicitly supplies a risk-free return per period.
- Missing rate, fewer than two observations, or zero excess-return volatility yields null; invalid rates and numeric overflow are rejected.
- PR #217 passed CI, typecheck, lint, tests, and Secret Scan.

### Annualized Sortino ratio — PR #218 merged
- Added an optional annualized Sortino ratio that requires an explicit minimum acceptable return per period.
- Missing target, no observations, or no below-target returns yields null; invalid targets and numeric overflow are rejected.
- PR #218 passed CI, typecheck, lint, tests, and Secret Scan.

### Cash-flow analytics — PR #220 merged
- Added a public analytics API for caller-supplied dated income/expense transactions, with explicit currency validation, monthly totals and savings rates, and category breakdowns.
- Zero-income savings rates are null; negative savings rates are preserved when expenses exceed income. Missing months are not synthesized, and no recurrence cadence, forecast, market data, or recommendation is inferred.
- PR #220 passed CI, lint, typecheck, tests, and Secret Scan.

### Goal progress analytics — PR #221 merged
- Added a public `analyzeGoalProgress` API that composes the existing domain Goal with an explicitly supplied current amount and reference date.
- Reports uncapped progress percentage, remaining amount clamped at zero, signed UTC calendar-day distance to deadline, target reached, and overdue status only when the target remains unmet.
- Validates target/current amounts, matching currencies, and valid dates. No contribution schedule, investment return, success probability, or recommendation is inferred.
- PR #221 passed CI, lint, typecheck, tests, and Secret Scan.

### Investment performance analytics — PR #222 merged
- Added a public API for explicit investor-perspective dated cash flows that composes the existing XIRR calculator and reports annualized money-weighted return, gross contributions/proceeds, net gain, simple return on contributions, and date range.
- The caller must supply any terminal valuation. Mixed currencies, invalid dates/amounts, overflow, and ambiguous XIRR sign patterns are rejected.
- PR #222 passed CI, typecheck, lint, tests, and Secret Scan.

### Financial snapshot invariants — PR #223 merged
- Hardened the existing FinancialSnapshot model so capture dates must be valid, asset/liability/net-worth totals use one currency, asset and liability totals are non-negative, and net worth reconciles to assets minus liabilities.
- Negative net worth remains valid when liabilities exceed assets. This does not introduce snapshot persistence, history, or charting.
- PR #223 passed CI, typecheck, lint, tests, and Secret Scan.

### Loan domain model — PR #224 merged
- Added Loan as a specialized Liability so it can be held in the existing Portfolio liability collection.
- The model records original/outstanding principal, annual interest rate, monthly payment, start/maturity dates, loan type, and optional lender. It validates principal bounds, same-currency amounts, date ordering, and immutable outstanding-balance updates.
- PR #224 passed CI, typecheck, lint, tests, and Secret Scan.

### Loan amortization calculator — PR #225 merged
- Added a fixed-payment monthly amortization schedule based on the Loan's current outstanding principal and annual nominal interest rate divided by 12.
- Payment timing, month-end date anchoring, maximum schedule length, final-payment cap, and no-rounding/no-fees assumptions are explicit. Non-amortizing payments are rejected and an unfinished schedule returns the remaining balance rather than implying payoff.
- PR #225 passed CI, typecheck, lint, tests, and Secret Scan.

### Progressive tax estimate — PR #226 merged
- Added a generic progressive tax calculator using caller-supplied ordered marginal-rate brackets, explicit currency, and taxable income.
- No jurisdiction-specific rates, deductions, credits, exemptions, surcharges, cess, or filing status are hard-coded. Invalid bracket schedules and currency mismatches are rejected.
- PR #226 passed CI, typecheck, lint, tests, and Secret Scan.

### Local progressive tax estimator — PR #227 merged
- Added a local-only dashboard form for caller-defined income brackets and marginal rates, reusing a shared pure numeric calculation function from the calculator package.
- No jurisdiction defaults or tax-rule assumptions are embedded; results are ephemeral and the hosted dashboard disables entry.
- PR #227 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Local loan amortization calculator — PR #228 merged
- Added a local-only loan calculator using the same pure numeric monthly amortization engine as the validated Loan-domain API.
- Shows a summary and the first 12 monthly payments, with full-schedule CSV export. Inputs are not persisted; interest/payment timing and excluded fees/taxes/rate changes are disclosed.
- PR #228 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Local investment performance calculator — PR #229 merged
- Added a local-only form for dated investor-perspective cash flows, reusing a shared pure numeric performance function and the existing XIRR solver.
- Shows gross contributions/proceeds, net gain, simple return on contributions, and annualized money-weighted return. The user must explicitly include terminal valuation when applicable; no valuation is fetched or inferred.
- PR #229 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Local compound-growth projection — PR #230 merged
- Added a local-only UI for a starting amount, fixed annual contributions, annual return assumption, period, and beginning/end-of-year contribution timing.
- Shows projected future value, total contributed capital, and estimated growth. The UI discloses excluded inflation, taxes, fees, volatility, and changing contributions; results are not saved.
- PR #230 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Local CAGR calculator — PR #231 merged
- Added a local-only calculator for beginning value, ending value, and elapsed years, reusing the existing CAGR engine.
- The UI distinguishes CAGR from dated-cash-flow XIRR and discloses that interim contributions/withdrawals, fees, taxes, and inflation are excluded. Results are not saved.
- PR #231 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Compound-growth annual schedule — PR #232 merged
- Extended the existing local projection summary with a year-by-year schedule showing projected value, cumulative contributed capital, and estimated growth, reusing the shared projection engine for every row.
- Added CSV export of the generated schedule. The UI caps the schedule at 100 annual periods to keep browser rendering bounded; assumptions remain explicit and no values are saved.
- PR #232 passed calculator unit tests, typecheck, lint, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Caller-defined tax estimate CSV export — PR #233 merged
- Added a local export of the tax estimate summary and the exact caller-supplied marginal brackets so saved output remains interpretable without assuming a jurisdiction or official tax rules.
- The export contains only numeric inputs/results and fixed headings; no user-entered free text. Editing any input invalidates the displayed result and disables export.
- PR #233 passed export unit tests, typecheck, lint, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Investment-performance CSV export — PR #234 merged
- Added a local export of the investment-performance summary together with the exact dated cash-flow inputs used for the XIRR result.
- Preserves contribution/receipt signs and explicit cash-flow dates; does not infer terminal valuation or adjust for fees/taxes. Editing, adding, or removing a cash flow invalidates the prior result and disables export.
- PR #234 passed export unit tests, typecheck, lint, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Local CAGR CSV export — PR #235 merged
- Added a local CSV export containing the beginning value, ending value, elapsed years, and calculated annualized CAGR.
- Editing calculator inputs invalidates the previous result and disables export; no inputs or results are persisted.
- PR #235 passed export unit tests, typecheck, lint, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Saved-goal progress CSV export — PR #236 merged
- Added an export of saved goals with target/current amounts, remaining amount, progress percentage, due date, days remaining, status, and the explicitly defined no-returns monthly pace.
- Export is available only in the loopback-only private workspace with healthy saved-goal storage. Goal names are CSV-quoted and spreadsheet-formula-neutralized.
- PR #236 passed export unit tests, typecheck, lint, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Financial summary Print / Save as PDF — PR #237 merged
- Added a dashboard action that opens the existing self-contained financial summary in a print-ready window and invokes the browser print dialog, where users can choose Save as PDF.
- Kept the offline HTML download, avoided a PDF runtime dependency, and improved print layout for tables and page breaks. The app does not claim to generate a PDF file directly.
- PR #237 passed renderer unit tests, CI, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Print invocation regression hardening — PR #238 merged
- Strengthened the Chromium smoke test by stubbing the popup's print method and asserting that the print workflow actually invokes it, beyond merely opening the report popup.
- PR #238 passed lint, typecheck, unit tests, Chromium browser smoke, and Secret Scan.

### Monthly cash-flow trend table — PR #239 merged
- Added a month-by-month table grouped from existing dated cash-flow transactions, with income, expenses, net cash flow, and transaction count.
- This is a live summary of existing transaction dates, not a forecast or a separate immutable financial snapshot; no persistence schema or backup format changes.
- PR #239 passed CI, typecheck, lint, unit tests, Chromium browser smoke, dashboard packaging, and Secret Scan.

### Monthly cash-flow summary CSV — feature branch in progress
- Added a dedicated CSV export for the monthly trend table, with month, income, expenses, net cash flow, and transaction count.
- Export contains deterministic summary values only, does not persist anything, and remains local to the browser.
- Validation status: unit tests, Chromium browser smoke, CI, and Secret Scan are pending.

### Portfolio health — requirements remain open
- Existing portfolio analysis now exposes reconciled balance-sheet ratios, category concentration, historical-return volatility/drawdown, and optional Sharpe/Sortino ratios.
- The backlog item remains planned until the product defines which metrics belong in a health view and how users should interpret them. No arbitrary score, thresholds, or investment recommendations will be introduced.


### Selected-period cash-flow category CSV export — implementation
- Added a local CSV download for the category breakdown already displayed for the selected reporting period.
- The export includes category, income, expenses, net cash flow, and transaction count; it reuses the ledger's existing deterministic category aggregation and CSV quoting/formula-neutralization rules.
- Added unit coverage for selected-period totals, empty output, and formula-like category names, plus a Chromium download regression comparing exported values with the visible category summary.
- Privacy and scope: export is generated in-browser from the local ledger; no network calls, persistence changes, forecasts, or financial advice.
- Validation status: pending CI, Chromium browser smoke, dashboard packaging, and Secret Scan on the feature PR.


### Local return-series risk analysis — implementation
- Added a local dashboard calculator for caller-supplied dated simple period returns, with explicit annualization frequency and optional risk-free / minimum acceptable return inputs.
- Reuses the existing analytics engine for sample annualized volatility, compounded maximum drawdown, worst period, negative-period count, and optional annualized Sharpe and Sortino ratios.
- Added a local CSV export of the result metrics and assumptions; edits invalidate the displayed result to avoid stale exports.
- Privacy and scope: loopback-only input, no persistence, network requests, market-data acquisition, composite risk score, forecasts, or investment recommendations.
- Validation status: pending GitHub Actions CI, dashboard smoke, packaging, and Secret Scan on the feature PR.


### Dashboard category concentration summary — implementation
- Added overview metrics derived from the existing analytics engine: HHI, effective category count, and largest asset-category share, using the dashboard's current asset allocation.
- Includes an explicit limitation that category-level concentration does not measure holding-level diversification, correlations, liquidity, or overall portfolio risk.
- Added browser regression coverage against the sample portfolio and packaged the analytics module for the local dashboard.
- No data persistence, network requests, inferred holdings, or recommendations were added.
- Validation status: pending CI, Chromium smoke, dashboard packaging, and Secret Scan on the feature PR.


## 2026-10-24 — Keep workspace selection stable when backup restore fails

### Delivered
- Defer switching from the sample workspace to the private workspace until backup data has been successfully persisted.
- A failed local-storage write now leaves the user in the sample workspace rather than silently changing workspace state after a failed import.
- Add a Chromium regression check that simulates a local-storage write failure during a legacy backup import and verifies that neither the workspace nor displayed records change.

### Product and engineering lesson
- A confirmed destructive action is not successful until persistence completes. UI workspace transitions must follow the transaction outcome, not precede it.


## 2026-10-24 — Multi-year financial history is a core requirement

### Requirement captured
- PFO OS must let users inspect financial history across multiple years, rather than showing only a current balance sheet.
- Historical points must be explicitly dated user-captured snapshots; past values must never be fabricated from current records.
- Historical snapshots must survive reloads and full-workspace backup/restore, with legacy backup compatibility and transactional failure handling.
- Trends must expose gaps honestly and provide a table for accessible exact-value review.

### Product decision
- Keep historical data local-first by default. Do not silently introduce cloud storage, Google Sheets synchronization, external financial data, or automatic snapshot capture.
- Detailed scope and acceptance criteria are maintained in `docs/product/HISTORICAL_FINANCIAL_DATA.md`.


## 2026-10-24 — Historical snapshots in full workspace backup v4
- Private full-workspace exports now use schema v4 and include validated historical snapshots alongside records, goals, cash-flow transactions, and budgets.
- Schema v4 imports validate every historical date, currency, record ID, and value before persistence; restore uses the existing transaction/rollback approach and rolls history back with the other workspace collections.
- Legacy v1–v3 backups omit historical snapshots by design. Import preview states that existing history will be preserved, and restore leaves the history storage key untouched.
- Browser smoke coverage verifies capture, CSV export, schema v4 round-trip, and preservation when restoring schema v1 and v3 backups. All fixtures are fictional.


## 2026-10-24 — Accessible multi-year net-worth trend
- Added a compact bar-style trend view based only on validated historical snapshot dates, alongside the exact-value table.
- The chart has one entry per real snapshot, uses the recorded net-worth amount, labels each date/value in text, and does not create bars for missing years. The table remains the exact-value accessible reference.
- Chromium regression coverage verifies the sample chart includes its three real fixture points and does not invent a 2023 point.


## 2026-10-24 — Inspect snapshot details and category totals
- Added a per-snapshot detail action that reveals the captured records, asset/liability totals, and grouped category breakdown for the selected valuation date.
- Detail content is rendered with DOM text nodes, preserving user-entered text as text rather than HTML. The panel is keyboard-operable and returns focus to its triggering button when closed.
- Browser smoke coverage opens a fictional 2025 snapshot and verifies its record and category detail rows.


## 2026-10-24 — Keyboard focus for historical snapshot details
- Opening a snapshot's details now moves focus to the selected-date heading so keyboard and screen-reader users enter the newly revealed content directly.
- The heading is programmatically focusable without adding it to the normal Tab sequence; closing the panel returns focus to the exact triggering button.
- Chromium browser smoke asserts both focus transitions alongside the existing fictional snapshot detail checks. A manual screen-reader and 400% zoom review remains necessary before release.


## 2026-10-24 — Confirmed historical snapshot correction workflow
- Added a private-workspace-only Remove action for each dated snapshot. Confirmation names the selected date, explains that current records are not changed, and warns that removal cannot be undone locally without a prior full-workspace backup.
- Removal validates the complete saved history before changing it and writes the remaining collection as one storage update. If storage fails, the old history and visible row remain intact.
- After successful removal, the history view refreshes and focus moves to the history heading. The date can then be captured again with corrected current records; duplicate dates are still rejected unless the old snapshot was explicitly removed.
- Unit and Chromium smoke coverage exercises selected-date removal, cancellation, persistence failure, and corrected re-capture using fictional test data only.


## 2026-10-24 — Narrow-viewport checks for historical views
- Extended Chromium smoke coverage to verify the multi-year trend collapses to one column at 320 CSS pixels without internal horizontal overflow.
- Verified the historical panel contains its content, snapshot detail totals stack in one column, and the detail panel remains usable at the narrow viewport.
- Rechecked focus moving into the detail heading and returning to the exact trigger at the narrow viewport. These automated checks do not replace a manual screen-reader or browser-chrome 400% zoom review.


## 2026-10-24 — Offline report opening regression coverage
- Extended Chromium smoke coverage to open the financial summary, single-scenario FIRE report, and three-scenario comparison report directly from local file URLs.
- The isolated report page blocks HTTP/HTTPS requests and asserts no external network requests occur while verifying essential report content renders.
- Uses only existing fictional browser-test data. This verifies the tested HTML artifacts, not every report/export feature in the application.


## 2026-10-25 — Goal progress above target remains accessible
- Extended the existing real-Chromium Goal Tracker smoke path with a case where accumulated funds exceed the target.
- The regression asserts the displayed percentage remains uncapped (150%), the native progress element remains capped at 100, its accessible value says “150 percent of target,” the goal is marked reached, and the remaining amount is zero rather than negative.
- This tests an existing behavior contract; it does not change calculation or persistence logic. Fictional browser data only.
- Validation status: pending CI, Chromium browser smoke, dashboard packaging, and Secret Scan on the feature PR.


## 2026-10-25 — Monthly review user-text HTML safety regression
- Extended the real-Chromium monthly review export path with a fictional goal name containing an HTML image element and event-handler payload.
- The exported report must encode the supplied text and must not emit an image element from user-controlled goal content; the existing offline opening checks continue to verify no scripts or network requests.
- This is regression coverage only; no product behavior or saved-data format changes.
- Validation: PR #320 merged after CI (including Chromium browser smoke) and Secret Scan passed.


## 2026-10-25 — Monthly review category HTML safety regression
- Extended the real-Chromium monthly review workflow with a fictional budget and transaction category containing an HTML image element.
- The exported report must encode the category as text and must not create an image element; budget calculations and existing report/offline checks remain in the same browser path.
- Regression-only change using synthetic data; no application runtime, persistence schema, or network behavior changes.
- Validation status: pending CI, Chromium browser smoke, and Secret Scan on the feature PR.
