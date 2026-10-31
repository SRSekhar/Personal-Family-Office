# P1 Acceptance Matrix — Previously Committed Scope

**Review date:** 2026-10-31  
**Status:** Previously committed P1 deliverables are implemented and have automated coverage. Manual accessibility review and external product-validation gates remain deferred/open as called out below.

This matrix consolidates the P1 work previously committed to in project conversations. The repository backlog is organized by epics and does not define a formal P1 priority field; this document records the concrete P1 commitments that were made, rather than assigning new priority labels to every backlog item.

## Acceptance status

| Previously committed P1 area | Acceptance criteria | Evidence | Status |
|---|---|---|---|
| Financial data integrity | Reject malformed, inconsistent, wrong-currency, duplicate-ID, invalid aggregate, and invalid backup data; never partially replace a workspace on failed restore. | PR #384; `apps/dashboard/tests/data-integrity.test.js`; `apps/dashboard/tests/backup.test.js`; `apps/dashboard/tests/storage.test.js`; `scripts/dashboard/workspace-database.test.mjs` | Complete |
| Atomic restore and rollback | Failed writes/restores preserve the previously committed records, goals, cash flow, budgets, and historical snapshots. | PR #384; `apps/dashboard/tests/data-integrity.test.js`; browser restore/recovery checks in `scripts/dashboard/fire-planner-browser-smoke.mjs` | Complete |
| Corrupt/truncated/oversized backup rejection | Reject malformed, truncated, wrong-schema, and >10 MiB imports before destructive mutation; prove existing workspace remains intact. | PRs #408–#409, #413–#414; `apps/dashboard/tests/backup.test.js`; `scripts/dashboard/serve.test.mjs`; browser smoke in `scripts/dashboard/fire-planner-browser-smoke.mjs` | Complete |
| Database persistence and recovery | Persist the complete five-collection workspace transactionally; explicit save/restore, opt-in autosave, startup recovery protection, stale-write conflict handling, portable committed-snapshot export, integrity diagnostics, and clean close/reopen. | PRs #390, #394, #397, #400, #403, #404, #406–#409; `scripts/dashboard/workspace-database.test.mjs`; `scripts/dashboard/serve.test.mjs`; `docs/operations/LOCAL_BACKUP_AND_RECOVERY.md` | Complete |
| SQLite shutdown/reopen reliability | Reopen a cleanly closed database and recover the committed snapshot; integrity checks do not mutate saved state. | `scripts/dashboard/workspace-database.test.mjs`; PRs #403–#404 | Complete |
| Import/export hardening | Strict CSV/JSON validation, previews and confirmations, formula-safe CSV output, bounded file reads, stable IDs and preservation of unrelated collections. | PRs #384, #408, #413–#414; `apps/dashboard/tests/csv-import.test.js`; `apps/dashboard/tests/backup.test.js`; cash-flow and investment calculator tests; browser smoke | Complete |
| FIRE planner and Goal Tracker regression | Exercise valid and invalid inputs, stale-result invalidation, required-contribution solve, scenario ordering, goal progress/over-target behavior, reset, report downloads, and keyboard operation in Chromium. | `scripts/dashboard/fire-planner-browser-smoke.mjs`; `packages/calculators/tests/FireReadiness.test.ts`; `packages/calculators/tests/FireScenarioComparison.test.ts`; `packages/calculators/tests/RequiredFireContribution.test.ts`; `packages/calculators/tests/GoalProgress.test.ts` | Complete |
| Calculator correctness and formula edge cases | Unit coverage for validation, boundaries, zero denominators, dates, contribution timing, overflow, ambiguous XIRR roots, return-series risk, and deterministic assumptions. | `packages/calculators/tests/`; `packages/analytics/tests/`; CI typecheck/build/test jobs | Complete |
| Financial-health dashboard and budget insights | Reconcile displayed financial-health metrics, prior-month comparison, explicit budget coverage/overruns, saved goals, exports, and repeated-overrun insights using recorded data only. | PR #385, #412; `apps/dashboard/tests/financial-health.test.js`; `apps/dashboard/tests/budget-overrun-insights.test.js`; browser smoke | Complete |
| Historical financial data | Validate snapshot dates/totals, preserve exact historical records in backup/restore, display only captured dates, and verify historical detail/report behavior. | PRs #223, #304–#305, #406; `apps/dashboard/tests/historical-snapshots.test.js`; `apps/dashboard/tests/historical-snapshots-report.test.js`; browser smoke | Complete |
| Offline report verification | Validate report payloads and reconcile downloads with on-screen results; verify self-contained, script-free reports open without network access. | Report unit tests under `apps/dashboard/tests/*report*.test.js`; Chromium smoke covers financial summary, monthly/annual review, financial health, FIRE single/comparison, saved goals, historical net worth, allocation, ratios, return risk, CAGR, growth projection, investment performance, loan amortization, and tax estimate reports. | Complete |
| Browser workflow regressions | Exercise real Chromium interactions for import/restore, data persistence, filters, calculations, report downloads, budget workflows, historical details, and local SQLite save/restore. | `scripts/dashboard/fire-planner-browser-smoke.mjs`; CI workflow `.github/workflows/ci.yml`; PRs #384–#415 | Complete |
| Keyboard navigation and validation | Automated keyboard tests verify skip-link behavior, focus on invalid fields, keyboard activation, focus retention/restoration, and report actions. | `scripts/dashboard/fire-planner-browser-smoke.mjs`; PR #192 and subsequent browser smoke coverage | Complete for automated workflows |

## Explicit exclusions and remaining gates

- **Manual accessibility review remains low priority/deferred**, as directed: screen-reader testing and actual browser-chrome 400% zoom are not claimed as complete. Automated keyboard and narrow-viewport checks are not substitutes for those manual reviews.
- SQLite encryption, automatic backup rotation, remote backup, cloud synchronization, multi-user access, and a Google Sheets adapter are not included in the completed local-first P1 scope. The database and portable JSON backups are not encrypted.
- Customer discovery (8–10 interviews and two paid-pilot commitments), repository-history exposure review, license/distribution decisions, and owner-side GitHub Pages configuration are release/product gates, not code tasks that can be truthfully marked complete by implementation.
- Portfolio Health and recommendation features remain requirements-gated; no composite score, risk threshold, or investment recommendation is invented.

## Verification entry point

The CI workflow runs the package unit tests and the real Chromium dashboard smoke:

`pnpm test` and `node scripts/dashboard/fire-planner-browser-smoke.mjs` (with the isolated Playwright Chromium setup defined in `.github/workflows/ci.yml`).

All test claims above refer to committed repository tests and workflow coverage. PRs #412–#414 add the latest budget-overrun browser regression and remaining import-size guards; PR #415 synchronizes the sprint and handoff documentation.
