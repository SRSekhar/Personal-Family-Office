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
1. Implement and test the single-scenario FIRE planner UI using existing calculators.
2. Add scenario comparison while preserving user-defined scenario order and assumptions.
3. Add required annual contribution results.
4. Validate keyboard operation, accessible status/error messaging, responsive layout, and 400% zoom.
5. Validate the dashboard-to-offline-report workflow with prospective users before expanding scope.

## Open product and release work (not yet completed)
- Complete the FIRE planner UI and related workflows described above.
- Validate the end-to-end dashboard-to-offline-report workflow.
- Define a source of truth and persistence requirements before implementing historical financial snapshots.
- Run the planned 8–10 customer interviews and seek two paid-pilot commitments; do not treat implementation completion as proof of demand.
- Complete historical secret review, licensing/distribution review, and the owner-side GitHub Pages configuration when release readiness requires them.
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
