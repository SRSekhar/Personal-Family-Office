# ADR — Investment exposure classification contract

- Status: Proposed; product decision required before implementation
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

The workspace currently uses schema v8 and persists investment ledger collections, allocation policies and concentration policies. JSON backup validation explicitly recognizes schema versions 1–8. Any future persisted classification collection would therefore require a deliberate schema migration, full-workspace backup/restore compatibility, and recovery tests; it must not be slipped into the existing schema without a migration.

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

## Hand-calculation examples needed before implementation

The product owner should approve examples that cover at least:

- one directly held instrument assigned 100% to one group;
- one fund assigned across two groups (for example 60% / 40%);
- two positions in the same instrument held in different accounts;
- a missing classification alongside a classified position;
- a partially mapped instrument;
- a historical correction where effective date and recorded-at date differ;
- a zero-value position and an empty portfolio;
- currency-separated portfolios/accounts.

For weighted look-through, the expected group values and percentages must be calculated independently by hand and agreed before code is written.

## Recommendation (not a decision)

Weighted multi-group look-through (Option B) is more expressive for funds and ETFs and avoids forcing a diversified instrument into a misleading single category. However, it creates materially more validation, provenance and incomplete-data complexity. A safe first release could still support B while requiring complete 100% mappings before an instrument contributes to an exposure result; instruments without complete mappings would make the result unavailable rather than being silently omitted. This is a candidate behavior, not an approved requirement.

If simplicity and a smaller initial scope are preferred, Option A is viable, but the UI and reports must clearly label the assignment as a single user-selected classification and must not claim look-through coverage.

## Decision

**Pending product-owner approval.** No schema, runtime classification model, exposure aggregation or exposure-limit evaluation is authorized by this ADR. The implementation must not choose Option A or B by inference.

## Acceptance gate before implementation

Implementation may begin only after the product owner confirms Option A or Option B and approves the cross-cutting rules that affect correctness: provenance, effective/recorded-at semantics, missing/unclassified behavior, aggregation formula, currency/scope and historical corrections. The selected contract must be covered by deterministic unit tests with hand-calculated expected values before persistence, UI or policy evaluation is added.
