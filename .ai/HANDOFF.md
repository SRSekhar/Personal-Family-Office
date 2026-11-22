# Handoff — 2026-11-22

## Active branch and PR
- Repository: `SRSekhar/Personal-Family-Office`
- Branch: `feature/ipm-08-backtesting-contracts`
- Latest code head: `30f302edcb9db5489657ffcbda776f8d3527d56e`.
- PR #458 remains draft/open/unmerged. Do not mark ready or merge without explicit owner approval.

## Host storage path configuration — complete and verified
- Added exported `resolveBacktestStoragePaths()` in `packages/backtesting/src/host-storage-paths.ts`.
- Windows: LOCALAPPDATA or ~/AppData/Local.
- macOS: ~/Library/Application Support unless absolute XDG_DATA_HOME is explicitly set.
- Linux/other Unix: absolute XDG_DATA_HOME or ~/.local/share.
- Overrides must be paired: PFO_BACKTEST_CATALOG_PATH + PFO_BACKTEST_ARTIFACT_DIRECTORY. Both must be non-empty and absolute, outside the repository and in disjoint directory trees.
- Added cross-platform tests for Windows/macOS/Linux defaults, overrides, partial/empty/relative values, repository containment and nested storage roots.
- Resolver only returns paths; it does not create directories, instantiate SQLite, start storage on dashboard boot, or integrate household backups.
- README documents configuration and focused package validation commands.

## Verification
- CI #2145: **passed** on exact code head `30f302edcb9db5489657ffcbda776f8d3527d56e` — lint, typecheck, package build, 974 tests, synthetic storage benchmark, and both Chromium browser smoke tests.
- Secret Scan #1940: **passed** on the same head.
- Earlier intermediate CI failures were corrected: unused imports, TypeScript index-signature access, and an invalid test fixture whose artifact directory was nested beneath the catalog directory. Final run is green.

## Still gated
- Retention/licensing lifecycle and any source-artifact deletion.
- Simulator-specific calendar source, corporate actions, fill/execution, cost, tick/lot and position constraints.
- Keep PR #458 draft/unmerged. Use synthetic fixtures only. No real market data/provider/broker/ledger mutation.
