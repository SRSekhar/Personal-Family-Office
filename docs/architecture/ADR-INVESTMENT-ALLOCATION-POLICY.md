# ADR — Investment allocation policy and drift

- Status: Accepted for phased implementation
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

## Persistence and compatibility plan

The pure domain module is the first increment and does not yet persist policies. The next persistence increment must add one schema-v7 collection, `investmentAllocationPolicies`, to the existing 13-collection schema-v6 workspace. It must include:

1. Transactional SQLite v6→v7 migration and a durable schema-v6 recovery artifact before mutation.
2. Full schema-v7 validation, JSON export/import and restore compatibility for legacy v1–v6 backups. Older backups normalize the new collection to empty without overwriting existing policy data when that older backup format did not contain it.
3. A dedicated browser-storage key, rollback coverage, SQLite save/restore, optimistic concurrency and multi-tab stale-write tests.
4. Append-only policy versions; editing a policy creates a new version rather than mutating history.
5. Local/private workspace UI only, explicit confirmation, and no policy changes in demo/hosted workspaces.

No persistence schema change is included in the initial domain-only increment.

## Acceptance boundary

The domain engine must test exact 100% validation, account/currency scoping, instrument references, unique policy versions, bitemporal selection, zero targets, unplanned holdings, missing valuations, empty portfolios, negative values and no-FX separation. Browser and SQLite acceptance is required before describing policies as saved or production-persistent.

## Consequences

This separates policy facts from ledger events and market valuations. It makes allocation drift reproducible at historical effective and recorded-at cutoffs while preserving the existing accounting source of truth. It deliberately defers persistent policy CRUD and dashboard controls to a schema-v7 increment.
