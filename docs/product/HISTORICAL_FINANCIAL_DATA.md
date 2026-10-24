# Historical Financial Data — Product and Engineering Requirements

## Goal

Let a household understand how its financial position changes over multiple years, not just see today's balance sheet. Historical trends are a core product capability, not an optional chart added later.

## Data principles

1. **Explicit dates, honest history.** Every historical point must have a user-visible valuation date. Never infer prior balances from current records, fabricate past values, or connect points as if historical data exists when it does not.
2. **Local-first and private.** Historical data stays in the trusted local dashboard's browser storage by default. No cloud sync, telemetry, external market data, or network upload is implied.
3. **Preserve years of data.** Keep dated snapshots across years; do not limit the model to the current year, recent months, or a rolling window. Sorting and charting may filter a view but must not delete older history.
4. **Portable recovery.** Full-workspace backups must include historical snapshots. Import validation must finish before writes begin; a failed restore must preserve the previous workspace or clearly report that rollback was incomplete.
5. **Reproducible totals.** Store enough validated snapshot detail to explain and recalculate assets, liabilities, net worth, and category breakdowns for each valuation date. Do not overwrite a previous date silently.
6. **Honest gaps.** Show missing periods as missing. A yearly chart may show snapshots actually captured; it must not interpolate balances or suggest a complete monthly series when only annual points exist.
7. **Currency and schema safety.** Snapshots must use the workspace currency and validated finite, non-negative record values. Backup format evolution must retain support for existing v1, v2, and v3 files.
8. **No unwanted automation.** Do not silently capture a snapshot whenever records change. The user should explicitly capture or confirm a valuation point, with clear date and replacement behavior.

## Initial functional scope

- Capture a snapshot of the current validated balance sheet for an explicitly selected valuation date.
- Prevent accidental duplicate dates. To correct a mistaken snapshot, require a clearly labelled removal action with explicit confirmation and a full-backup warning before re-capture; never silently replace a date.
- Show a chronological history with assets, liabilities, net worth, and change from the previous available snapshot.
- Provide a multi-year trend visualization and a readable table alternative for accessibility and exact values.
- Allow a selected historical snapshot's record/category detail to be inspected without changing current records.
- Export historical data to CSV and include it in a full-workspace JSON backup.
- Import older backup schemas without erasing snapshots already present when the older file has no historical collection; newer full backups should restore the historical collection transactionally.
- Handle empty history, one point, date gaps, large values, malformed storage, storage quota failures, and rollback failures explicitly.
- Clearly distinguish current live records from dated historical snapshots in UI labels and reports.

## Acceptance criteria

- A user can retain and review snapshots spanning several years.
- Reloading the dashboard preserves snapshots.
- Full-workspace export/import round-trips all dated snapshots and their detail.
- v1/v2/v3 backups remain importable; collections absent from a legacy backup are preserved as indicated by the preview.
- Invalid snapshots are rejected before any collection is changed.
- A failed storage write cannot produce a partial snapshot or falsely report success.
- Snapshot removal is private-workspace-only, explicitly confirmed, validated before persistence, leaves current records unchanged, and preserves the old history if persistence fails.
- History views use only real snapshot dates and show missing periods honestly.
- Keyboard users and screen-reader users can operate snapshot capture, inspect history, and access the same values without relying on a chart alone.
- Browser tests use fictional data only; no household financial values are committed to the public repository.

## Delivery sequence

1. Implement and test a standalone historical-snapshot validation/calculation module.
2. Integrate local persistence, explicit capture, history table/trend, and CSV export.
3. Extend full-workspace backup to a new schema version while retaining v1/v2/v3 compatibility and transactional rollback.
4. Add Chromium end-to-end tests for multi-year capture, reload, date collision, legacy import preservation, full restore, and storage failures.
5. Update product docs and validate keyboard/small-screen behavior before release.

## Deliberate exclusions

No automatic price retrieval, brokerage/bank connection, investment recommendations, inferred historical performance, or cloud/Google Sheets synchronization in this phase. Any optional remote storage requires a separate privacy, security, and consent review.
