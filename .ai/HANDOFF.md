# Handoff — 2026-11-24

## Active branch and PR
- Repository: `SRSekhar/Personal-Family-Office`
- Branch: `feature/ipm-08-backtesting-contracts`
- Latest verified implementation head: `097d3e7ef43a1ee091011429c43b6adbd2afb56e`.
- PR #458 remains draft/open/unmerged. Do not mark ready or merge without explicit owner approval.

## Sprint 20 — explicit local dataset-management workflow (complete and verified)
- Added `BacktestDatasetWorkspace` as the host-facing library boundary.
- `open()` explicitly initializes the separate catalog using `resolveBacktestStoragePaths()`; no auto-startup initialization.
- `importCsv(bytes, metadata)` snapshots exact original bytes, rejects oversized/malformed UTF-8, requires explicit provenance/instrument/coverage/knowledge-time metadata and uses the strict NSE daily importer.
- Exposes immutable dataset listing, verified dataset loading, integrity report, standalone backup, non-overwriting restore and explicit close.
- Added tests for import/list/load/integrity, malformed UTF-8, BSE rejection, backup/restore round-trip, non-overwrite and disjoint paths.
- This is a library API only. No HTTP route, dashboard UI, browser file-picker, arbitrary filesystem path exposure, provider or simulation engine is added.
- No retention purge or source-artifact deletion is implemented.

## Verification on exact implementation head
- CI #2153: **passed** — lint, typecheck, package build, 105 test files / 979 tests, synthetic storage benchmark, and both Chromium browser smoke tests.
- Secret Scan #1949: **passed**.
- Earlier intermediate lint failures were fixed; the final run on `097d3e7ef43a1ee091011429c43b6adbd2afb56e` is green.

## Remaining gated work
- Authenticated private dashboard routes and safe upload/file-picker integration.
- Retention/licensing lifecycle; no deletion before policy is approved.
- Simulator-specific calendar source, corporate actions, fill/execution, costs, tick/lot and position constraints.
- Keep PR #458 draft/open/unmerged. Synthetic fixtures only; no real market data/provider/broker/ledger mutation.


## Handoff — 2026-11-24 (IPM-08.3)

Current branch `feature/ipm-08-backtesting-contracts`, PR #458 (draft/open/unmerged), final verified code head `265178639eb4d0d81a753da5ec883a743a273afe`.

### Completed this increment
- Explicit environment opt-in `PFO_BACKTESTING_ENABLED=true` opens the separate local backtesting dataset workspace at host-resolved paths. Default dashboard startup does not initialize it.
- Local dashboard endpoints list dataset versions, run integrity checks and import canonical PFO OHLCV CSV bytes with explicit metadata. Local-origin guard and bounded request body are enforced.
- Dashboard UI provides a local file picker, editable explicit metadata JSON, import status, dataset listing and integrity action. Metadata example fields are placeholders only.
- Root dashboard serve script builds backtesting package and dependencies.

### Verification
- CI #2159 passed: lint, typecheck, package build, 105 test files / 982 tests, synthetic 10,000-row storage benchmark and both Chromium smoke tests.
- Secret Scan #1955 passed.
- Dashboard packaging/deploy workflow #1242 passed.

### Boundaries and next work
- No market data provider, download, simulator, strategy execution, backtest-run persistence, broker, orders or household-ledger writes.
- Dataset catalog/artifacts remain separate from household workspace database and backup.
- No authentication/session layer was added; server binds to loopback and API checks local host/origin/fetch-site. Do not expose on LAN/public interfaces without a separately reviewed security design.
- Next gated decisions: retention/licensing, filesystem permissions, instrument universe, calendar evidence, corporate actions, execution/cost assumptions and point-in-time per-decision engine requirements.
- Do not merge PR #458 or mark ready without user approval; remaining design assumptions are not approved.


## Handoff — 2026-11-25 (IPM-08.4)

Branch `feature/ipm-08-backtesting-contracts`, PR #458 remains draft/open/unmerged. Backup/restore implementation head: `e550989da792fdd1179cb93098add8a575d7ef0e`.

### Delivered
- Dashboard creates verified immutable backup bundles under a managed local backup directory and lists their manifests.
- Restore accepts only a generated managed backup ID, validates full bundle/catalog/artifact consistency through `BacktestDatasetWorkspace.restoreBackup`, and writes a new isolated catalog/artifact generation.
- Restore never overwrites the active catalog and does not auto-activate the candidate. UI returns exact PowerShell/Bash environment commands for restarting against the restored paths.
- `PFO_BACKTEST_BACKUP_DIRECTORY` optionally selects an absolute backup root; default is sibling `backtesting-backups` beside the active artifact directory.

### Verification
- CI #2160 passed: lint, typecheck, build, 105 test files / 984 tests, synthetic storage benchmark, both Chromium smoke tests.
- Secret Scan #1956 passed; dashboard packaging/deploy #1243 passed.
- Synthetic 10k benchmark: import 712.61 ms / 14,033 obs/s; load 333.30 ms; integrity 333.27 ms; backup 395.64 ms. One CI-runner observation only.

### Next / safety boundaries
- Add end-to-end browser coverage for the new controls; current browser smoke checks are the existing FIRE and statement-reconciliation checks.
- Define retention/licensing and backup pruning before any automated deletion.
- A verified restore candidate is separate from active storage. Do not add automatic activation without a crash-safe generation switch and explicit user confirmation.
- Keep provider, simulator, broker and ledger mutation out of scope. Keep PR #458 draft/unmerged absent user approval.


## Handoff — 2026-11-27 (IPM-08.5 browser acceptance)

Branch `feature/ipm-08-backtesting-contracts`, PR #458 remains draft/open/unmerged. Verified implementation head: `0b0f4144bd77e833e8fd61c0b03cd4769bbf4ee3`.

### Delivered
- Added `scripts/dashboard/backtesting-backup-browser-smoke.mjs` using Playwright/Chromium and an injected synthetic workspace.
- The browser test opens the real dashboard page, verifies the dataset and empty managed-backup list, creates a managed backup through the UI, verifies the backup card, invokes restore, checks the verified-candidate message and both restart command blocks, and confirms the active dataset list remains unchanged.
- Verifies a cross-origin restore request is rejected without invoking the restore operation.
- CI now runs this smoke after the FIRE planner and investment statement reconciliation browser tests.

### Verification on exact head
- CI #2168: **passed** — lint, typecheck, package build, 105 test files / 984 tests, synthetic storage benchmark, bootstrap safety, and all three Chromium browser smoke tests, including the new backup/restore flow.
- Secret Scan #1964: **passed**.
- Dashboard packaging #1251: **passed**.

### Boundaries / next work
- Test uses synthetic workspace metadata and temporary files; it does not load real market data.
- Restore remains a candidate and never switches the active catalog. No automated deletion, retention pruning, provider, simulator, broker or household-ledger mutation.
- Loopback/local-origin checks are not authentication. Do not expose the dashboard beyond loopback without a separately reviewed security design.
- Next: approve retention/licensing/pruning policy before deletion; separately design crash-safe restore activation and obtain the remaining simulator assumptions.
- Keep PR #458 draft/open/unmerged absent explicit owner approval.
