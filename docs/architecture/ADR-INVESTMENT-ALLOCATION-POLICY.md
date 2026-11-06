# ADR — Investment allocation policy and drift

- Status: Accepted — domain, schema-v7 persistence and private dashboard workflows implemented and verified; CI, Secret Scan, deployment and Chromium acceptance passed 2026-11-06
- Date: 2026-11-06
- Scope: deterministic allocation-policy domain and analytics foundation

## Context

The investment ledger already provides validated accounts, instruments, immutable transactions, FIFO positions, manual/provider valuation observations, cash reconciliation and per-currency portfolio XIRR. Allocation targets must build on those projections without changing ledger facts or introducing price/FX assumptions.

## Decision

### Policy contract

An allocation policy version contains:

- `id`: unique immutable version identifier.
- `policySetId`: stable identity shared by successive versions of one policy.
- `version`: positive integer unique within a policy set.
- `name`: user-supplied label.
- `currency`: one supported currency; currencies are never combined.
- `scope`: `portfolio` or `account`; account scope requires one existing same-currency investment account.
- `groupBy`: `instrumentType` or `instrument`.
- `effectiveFrom`: real calendar date from which the version applies.
- `recordedAt`: canonical UTC timestamp recording when PFO learned the version.
- `targets`: unique grouping keys with finite `weightPercent` values from 0 through 100; total must equal 100% within a small floating-point tolerance.

Instrument-specific targets must reference an existing instrument in the policy currency. Instrument-type targets use the existing ledger's enumerated instrument types. Zero-weight targets are valid and allow explicit exclusions. Unspecified actual holdings remain visible with a zero target; they are never silently dropped.

### Historical selection

Policy selection is bitemporal. A version is eligible only when both `effectiveFrom <= asOfDate` and `recordedAt <= recordedAtCutoff`. Among eligible versions for the requested currency/scope, choose the latest effective date, then latest recorded timestamp, then highest version. A later correction cannot rewrite what was known at an earlier recorded-at cutoff.

### Allocation calculation

The engine consumes FIFO-projected positions and the existing instrument/account metadata. It calculates market-value weights, target weights, percentage-point drift, and currency-value drift. It also reports HHI, effective category count, and largest-category share as descriptive concentration measures.

- Portfolio scope includes all accounts in the selected currency; account scope includes only the selected account.
- No FX conversion or cross-currency aggregation.
- Any open position without an eligible valuation makes that currency/scope allocation unavailable; no partial allocation is shown.
- No positive valued holdings produces an explicit empty state.
- Holdings not present in target rows appear with zero target; target rows without holdings appear with zero actual value.
- Drift is descriptive. It does not generate trades, recommendations, or rebalancing instructions.

## Persistence and compatibility

The policy collection is persisted as `investmentAllocationPolicies`, the 14th collection in schema v7. The v6→v7 migration validates the full schema-v6 snapshot, writes a protected `.pre-v7-*.json` recovery artifact with exclusive creation and fsync, then transactionally upgrades the snapshot. Existing data is preserved and the new collection starts empty; no policies are inferred.

Schema-v7 JSON backups require the policy collection and validate every policy against the existing account/instrument references. Legacy v1–v6 imports remain supported. If a legacy backup includes an investment ledger but omits allocation policies, the existing policy collection is retained only when all references remain valid against the incoming ledger; otherwise the import is rejected before any workspace data changes. Legacy backups without investment collections leave the investment ledger and policies untouched.

A dedicated browser-storage key and SQLite snapshot field persist the collection. Online SQLite backup/restore, schema-v7 backup export/import and collection-count reporting include policy versions. Private-workspace UI supports creating a policy set, appending immutable versions, reviewing policy history and analyzing actual-vs-target drift. A version must retain its policy set's currency, scope, account and grouping dimensions. The UI is disabled in demo/hosted workspaces and requires explicit confirmation before saving.

The investment CSV importer validates existing policy references against the candidate ledger and blocks imports that would orphan a policy reference.

## Acceptance boundary

The domain engine must test exact 100% validation, account/currency scoping, instrument references, unique policy versions, bitemporal selection, zero targets, unplanned holdings, missing valuations, empty portfolios, negative values and no-FX separation. Browser and SQLite acceptance is required before describing policies as saved or production-persistent.

## Consequences

This separates policy facts from ledger events and market valuations. It makes allocation drift reproducible at historical effective and recorded-at cutoffs while preserving the existing accounting source of truth. The policy UI remains descriptive: it does not generate investment recommendations, rebalancing instructions or trades.

## Verification record

Verified on PR #435 head tree `0a21c20638e4e4a192ae73554f7b3732806c714f`: CI run 42169616949 passed lint, typecheck, build, full tests and Chromium browser smoke; Secret Scan run 42169616950 passed; dashboard deployment run 42169616957 passed. The browser smoke covers immutable v1/v2 policy creation, allocation drift analysis, schema-v7 backup and compatible legacy v6 backup preservation.
