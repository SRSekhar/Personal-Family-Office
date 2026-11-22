# Handoff — 2026-11-22

## Active branch and PR
- Repository: `SRSekhar/Personal-Family-Office`
- Branch: `feature/ipm-08-backtesting-contracts`
- PR #458 remains draft/open/unmerged. Do not mark ready or merge without explicit owner approval.
- Latest code work adds `resolveBacktestStoragePaths()` in `packages/backtesting/src/host-storage-paths.ts`, tests in `packages/backtesting/tests/host-storage-paths.test.ts`, export from package index, and README configuration guidance.

## Storage path contract
- Windows: LOCALAPPDATA or ~/AppData/Local.
- macOS: ~/Library/Application Support unless absolute XDG_DATA_HOME is explicitly set.
- Linux/other Unix: absolute XDG_DATA_HOME or ~/.local/share.
- Overrides must be paired: PFO_BACKTEST_CATALOG_PATH + PFO_BACKTEST_ARTIFACT_DIRECTORY. Both must be absolute, non-empty, outside the repository and disjoint from each other's directory trees.
- Resolver only returns paths; host initialization remains explicit. No dashboard auto-start, workspace database integration or household backup integration.

## Still gated
- Retention/licensing lifecycle and any source-artifact deletion.
- Simulator-specific calendar source, corporate actions, fill/execution, cost, tick/lot and position constraints.
- Keep PR #458 draft/unmerged. Use synthetic fixtures only. No real market data/provider/broker/ledger mutation.

## Validation
- Docs-only head `b459c34cad5a285a7cf89599b625cea8b07eda69`: CI #2136 and Secret Scan #1931 passed.
- Resolver commits: `1a08472e1366dca478318466f0167eddb206d21a`, `82079c038317799f86a881a74c69d8254f309d88`; final validation for the resolver changes must be checked on the latest branch head.
