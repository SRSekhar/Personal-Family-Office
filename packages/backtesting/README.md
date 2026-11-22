# @pfo/backtesting

Point-in-time backtesting domain contracts and validation for PFO OS.

The approved first-release market-data scope is NSE-focused daily OHLCV. BSE and intraday intervals are deferred to later increments. This does not select a market-data provider or authorize an instrument universe.

This package defines validated historical datasets, bitemporal universe membership, explicit trading calendars, strategy/version descriptors, execution and cost assumptions, and run-configuration checks. It also provides a strict PFO-native OHLCV CSV importer that binds source rows to explicitly supplied instrument, provenance, coverage and knowledge-time metadata.

The CSV importer uses this exact file structure:

- Manifest row: #PFO-BACKTEST-DATASET,1,OHLCV
- Header row: startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId
- Required row values: start/end UTC timestamps, OHLC prices and local recorded-at timestamp.
- Optional row values: volume, evidenced availability timestamp and provider instrument ID. Empty optional cells stay absent.
- Explicit import metadata: dataset ID/version, local instrument reference, interval, adjustment basis, market timezone, source/license metadata, dataset recorded-at timestamp, coverage window/status and expected bar-end schedule.

The CSV importer:
- Enforces the approved first-release scope: instrument exchange must be exactly `NSE` and interval must be `1d`; BSE and intraday imports are rejected rather than silently accepted.
- Requires the #PFO-BACKTEST-DATASET,1,OHLCV manifest and canonical column order.
- Preserves source row order and rejects malformed rows, duplicate observations and invalid OHLC values.
- Computes SHA-256 digests for both the original CSV artifact and normalized dataset content. The normalized digest is stable across equivalent line-ending conventions.
- Retains unknown availability as unknown. It never substitutes bar close, retrieval time or import time.
- Requires the caller to supply explicit expected bar-end timestamps and coverage status. It never infers weekdays, exchange holidays or missing sessions.
- Does not fetch market data, create a universe/calendar, or execute a strategy.

Every historical observation must retain source provenance, licensing status, content digests, availability timestamps when evidenced and local recorded-at timestamps. A dataset with unreviewed/restricted licensing or insufficient point-in-time evidence may be imported for inspection but remains ineligible for a validated run.

The persistence layer stores normalized OHLCV observations as indexed rows in a dedicated SQLite catalog and retains exact original CSV bytes in an immutable SHA-256-addressed artifact directory. It supports verified standalone backup and restore bundles. The catalog and artifacts are configured separately from the household workspace database and must both be outside the repository. Imports are append-only by dataset ID/version; identical raw bytes are deduplicated without collapsing distinct dataset provenance. Dataset loads and integrity checks verify artifact digest and byte length before returning observations. Orphan detection is non-destructive. The storage layer also creates a standalone verified backup bundle containing a SQLite online snapshot, all referenced CSV artifacts and a digest manifest. Restore verifies the catalog, manifest and every artifact in staging, publishes the artifact tree first, and publishes the catalog last; existing destinations are never overwritten. Backup and restore are separate from household workspace backups.

### Storage safety and benchmark

The storage boundary applies fail-closed first-release ceilings:

- Original CSV: 64 MiB maximum.
- Normalized observations: 1,000,000 per dataset maximum.
- Backup manifest: 16 MiB maximum.
- Backup SQLite catalog: 512 MiB maximum.
- Artifacts and dataset versions: 100,000 maximum per backup.
- Individual source artifact: 64 MiB maximum; aggregate backup artifacts: 2 GiB maximum.

Oversized inputs are rejected; the importer never truncates data. Restore validates manifest and catalog sizes before processing artifacts. Deterministic fault-injection hooks are available through the optional `faultInjector` storage option for host recovery tests. Supported interruption points exercise import transaction rollback, backup staging/publication and restore artifact/catalog publication ordering. These tests simulate injected software interruption boundaries; they do not represent physical power-loss or hardware-failure certification. Omit the hook in production.

Run the reproducible synthetic storage benchmark after building the workspace:

```sh
pnpm --filter @pfo/backtesting benchmark:storage
```

It reports import throughput, reload time, integrity-check time and backup time for a synthetic 10,000-observation dataset by default. Set `PFO_BACKTEST_BENCHMARK_ROWS` to a value from 1 to 100,000 to change the fixture size. The benchmark does not use real market data and its measurements are environment-specific; it must not be interpreted as a production service-level guarantee. CI runs the default benchmark.

No provider SDK, endpoint, credential, network client, market-data download, broker integration or live order routing is included.

Backtesting records and any future paper portfolio must remain separate from real investment transactions, cash, valuations, FIFO lots and statement evidence.

### Host storage path configuration

The host can resolve OS-appropriate defaults with the exported `resolveBacktestStoragePaths()` helper. It only returns paths; it does not create directories, open SQLite, or initialize a dataset store.

- Windows: `%LOCALAPPDATA%\\PFO-OS\\backtesting-catalog\\catalog.sqlite` and sibling `%LOCALAPPDATA%\\PFO-OS\\backtesting-artifacts`; if `LOCALAPPDATA` is absent, the resolver uses `~/AppData/Local`.
- macOS/Linux: `$XDG_DATA_HOME/PFO-OS` when `XDG_DATA_HOME` is set to an absolute path, otherwise `~/.local/share/PFO-OS`. The catalog and artifacts remain sibling roots.
- Explicit configuration uses `PFO_BACKTEST_CATALOG_PATH` and `PFO_BACKTEST_ARTIFACT_DIRECTORY`. Both must be supplied together, non-empty, absolute, outside the repository and in disjoint directory trees. Relative `XDG_DATA_HOME` values are rejected rather than silently ignored.

The resolver is a host configuration boundary only. A host must still deliberately construct `BacktestDatasetStore` with the returned paths. It does not change dashboard startup, household workspace persistence, or household backup/restore. The store's own path validation remains an independent final guard.
