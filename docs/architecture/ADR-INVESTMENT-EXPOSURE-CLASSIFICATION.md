# ADR — Investment exposure classification contract

- Status: Accepted — Option B (weighted multi-group look-through)
- Date: 2026-11-13
- Scope: user-managed issuer, sector, geography and custom exposure classifications for investment instruments
- Decision owner: product owner
- Related: [Investment risk policy readiness](./INVESTMENT-RISK-POLICY-READINESS.md), [Investment concentration policy](./ADR-INVESTMENT-CONCENTRATION-POLICY.md)

## Context verified in the current repository

The investment ledger currently validates instrument identity and descriptive metadata in `apps/dashboard/investment-ledger.js`. An instrument has:

- required `id`, `name`, `type` and `currency`;
- optional `symbol`, `exchange`, `isin` and free-text `description`.

The ledger does not currently define issuer, sector, geography or custom exposure classifications. It also does not attach classification-specific provenance or effective/recorded-at timestamps to instrument metadata.

The current concentration policy supports one grouping key per position: either the instrument type or the instrument ID. Its input is the existing FIFO position projection and complete eligible valuations. The concentration policy is immutable and versioned, with explicit currency, portfolio/account scope, effective date and recorded-at timestamp. Those policy timestamps describe the policy version; they are not classification-data timestamps.

The baseline inspected for this decision used schema v8 and persisted investment ledger collections, allocation policies and concentration policies. The accepted implementation introduces schema v9, an additive classification collection, a transactional v8→v9 migration, a pre-migration recovery artifact, and schema-v9 JSON backup/restore validation.

## Problem to decide

For a classification dimension (for example, issuer, sector, geography or a user-defined dimension), can one instrument have exactly one assigned group, or can it have multiple group allocations whose weights represent look-through exposure?

This is a product/data-contract decision. Neither model is implemented or implied by the existing instrument metadata.

## Option A — One group per instrument per dimension

Each instrument receives zero or one group assignment for a given classification dimension.

Illustrative shape (not an approved schema):

```text
instrumentId + dimensionId -> groupId
```

### Advantages

- Simple authoring, validation, display and audit history.
- No allocation arithmetic or rounding/tolerance rules.
- Straightforward classification coverage: classified versus unclassified instruments.
- Suitable where the classification is inherently singular, such as a user-defined primary issuer attribution.

### Limitations

- A fund or ETF containing multiple issuers, sectors or countries can only be represented by one selected group.
- Any primary-group convention may conceal material secondary exposure.
- The application must not present a single primary label as a complete look-through view.

## Option B — Weighted multi-group look-through per instrument per dimension

An instrument may map to multiple groups in the same dimension. Each mapping has a user-entered weight, and the mappings for one instrument/dimension are expected to reconcile to 100%.

Illustrative shape (not an approved schema):

```text
instrumentId + dimensionId -> [{ groupId, weightPercent }]
```

### Advantages

- Can represent diversified funds and ETFs across multiple issuers, sectors or geographies.
- Makes partial look-through and group-level exposure aggregation expressible.
- Can represent a mixture of directly classified instruments and user-entered underlying allocations.

### Limitations and unresolved rules

- Requires explicit numeric precision and a tolerance/reconciliation rule for 100%.
- Requires a policy for partial look-through: reject incomplete allocations, allow an explicitly marked partial state, or keep the whole instrument unclassified for that dimension.
- Requires rules for duplicate group entries, zero weights, rounding, nested funds, circular references and whether look-through is one level or recursive.
- A 100% user allocation is not proof that the underlying data is accurate or current.
- Requires provenance at the allocation/mapping level, not merely at the instrument level.

## Cross-cutting contract questions (required for either option)

1. **Dimension identity:** Are issuer, sector and geography fixed built-in dimensions, user-created dimensions, or both? What stable identifier and display-name rules apply?
2. **Group identity:** Are groups user-created, selected from a controlled vocabulary, or both? How are renamed, merged, retired or deleted groups handled without rewriting history?
3. **Assignment ownership:** Are classifications always manually authored per workspace, or may a future provider import them? No external provider or taxonomy is assumed in this ADR.
4. **Provenance:** For each assignment, what source is recorded (user, import, provider, correction), who/what supplied it, and what evidence/reference is retained? Do not infer provenance from free-text descriptions.
5. **Time:** Record both effective-from and recorded-at timestamps so historical evaluations can distinguish when a classification applied from when the workspace learned it. Define correction and supersession behavior.
6. **Missing data:** Distinguish not classified, explicitly unknown, not applicable, stale and incomplete look-through. Do not silently treat missing classification as zero exposure or silently omit it from a denominator.
7. **Aggregation:** Define whether exposure is aggregated by instrument market value multiplied by classification weight, then divided by the total valued position market value in the selected currency/scope. This formula is a candidate only; it needs explicit approval and hand-calculated examples.
8. **Scope and currency:** Reuse the established portfolio/account and currency separation only if the selected metric's denominator and position selection are confirmed. No implicit FX.
9. **Policy evaluation:** Define whether user exposure limits refer to a group within one dimension, and how unclassified positions affect availability. Preserve explicit user-entered limits and comparison operators; no product defaults or inferred risk appetite.
10. **Lifecycle and backup:** Define immutable assignment history, correction semantics, import/export behavior, and migration from schema v8 before persistence work begins.

## Hand-calculation examples and implementation verification

The implementation's deterministic unit tests cover the approved examples, including:

- one directly held instrument assigned 100% to one group;
- one fund assigned across two groups (for example 60% / 40%);
- two positions in the same instrument held in different accounts;
- a missing classification alongside a classified position;
- a partially mapped instrument;
- a historical correction where effective date and recorded-at date differ;
- a zero-value position and an empty portfolio;
- currency-separated portfolios/accounts.

Expected group values and percentages are asserted against hand-calculated examples in `apps/dashboard/investment-exposure.test.js`.

## Decision status

The product owner selected Option B on 2026-11-13. The former recommendation and unresolved questions above are superseded by the accepted contract below. The first increment is one-level look-through only; nested fund recursion is deliberately excluded.

## Accepted decision

**Option B — weighted multi-group look-through.** Each instrument may have one or more user-authored group allocations within a dimension. The allocation weights must reconcile to 100% within 0.01 percentage points. Zero-weight entries and duplicate group IDs within one instrument/dimension snapshot are rejected.

The implementation contract is:

- A classification snapshot is scoped to one instrument and one stable user-defined dimension ID. Group IDs are stable within that dimension; display names are descriptive labels.
- Each snapshot records source type/name, optional evidence reference, effective-from date and recorded-at timestamp. Supported source types are manual, import, provider and correction; no provider integration is implied.
- Classification history is append-only. Historical selection requires both effective-from and recorded-at timestamps to be visible at the requested cutoffs. A later-recorded correction cannot rewrite what was previously known.
- A positively held instrument must have a complete 100% classification for the selected dimension and cutoffs. Missing classifications remain listed as unclassified positions and make the entire exposure result unavailable; they are never silently excluded from the denominator. Missing valuation also makes the result unavailable.
- Group market value is the position market value multiplied by the group's allocation weight. Group percentage is group market value divided by the total positively held, fully valued position market value in the selected currency and scope. Multiple accounts holding the same instrument are aggregated. No implicit FX is performed.
- The first implementation is one-level user-entered look-through. Nested fund recursion, circular-reference traversal, provider taxonomy synchronization, automatic stale-data detection and exposure-limit evaluation are not part of this increment.
- No classifications are inferred for existing instruments during migration. Existing schema-v8 workspaces start with an empty classification collection.

## Acceptance gate

The domain implementation must include deterministic validation, bitemporal selection and aggregation tests with hand-calculated examples before persistence, UI or policy evaluation is enabled.


## Implementation status — Sprint 9

- Domain contract and deterministic tests are implemented in `apps/dashboard/investment-exposure.js` and `apps/dashboard/investment-exposure.test.js`.
- The first private-workspace UI is implemented in `apps/dashboard/investment-exposure-workspace.js` and the dashboard HTML. It supports user-entered immutable classification snapshots and historical exposure analysis.
- SQLite schema v9 adds `investmentExposureClassifications`; v8→v9 migration is transactional, creates a mode-restricted pre-v9 JSON recovery artifact, and never infers classifications.
- JSON backup validation and preview recognize schema v9 while preserving imports from schemas 1–8. Legacy restores preserve existing classifications only when they remain valid against the restored instrument collection.
- CI validation is required before this increment can be considered complete or merged.
