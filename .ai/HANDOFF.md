# Handoff — 2026-11-24

## Active branch and PR
- Repository: `SRSekhar/Personal-Family-Office`
- Branch: `feature/ipm-08-backtesting-contracts`
- Parent head before Sprint 20: `7dde01c11e761fe4c0ca09118a6794bc86a117ce`.
- PR #458 remains draft/open/unmerged. Do not mark ready or merge without explicit owner approval.

## Sprint 20 — explicit local dataset-management workflow
- Added `BacktestDatasetWorkspace` as the host-facing library boundary.
- `open()` explicitly initializes the separate catalog using `resolveBacktestStoragePaths()`; no auto-startup initialization.
- `importCsv(bytes, metadata)` snapshots exact original bytes, rejects oversized/malformed UTF-8, requires explicit provenance/instrument/coverage/knowledge-time metadata and uses the strict NSE daily importer.
- Exposes immutable dataset listing, verified dataset loading, integrity report, standalone backup, non-overwriting restore and explicit close.
- Added tests for import/list/load/integrity, malformed UTF-8, BSE rejection, backup/restore round-trip, non-overwrite and disjoint paths.
- This is a library API only. No HTTP route, dashboard UI, browser file-picker, arbitrary filesystem path exposure, provider or simulation engine is added.
- No retention purge or source-artifact deletion is implemented.

## Existing verification
- Prior host-path implementation code head `30f302edcb9db5489657ffcbda776f8d3527d56e`: CI #2145 and Secret Scan #1940 passed.
- Sprint 20 changes require fresh PR CI and Secret Scan. Do not claim they are verified until exact new head checks pass.

## Remaining gated work
- Authenticated private dashboard routes and safe upload/file-picker integration.
- Retention/licensing lifecycle; no deletion before policy is approved.
- Simulator-specific calendar source, corporate actions, fill/execution, costs, tick/lot and position constraints.
- Keep PR #458 draft/open/unmerged. Synthetic fixtures only; no real market data/provider/broker/ledger mutation.
