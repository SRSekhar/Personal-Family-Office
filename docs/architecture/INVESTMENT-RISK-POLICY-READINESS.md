# Investment risk policy — readiness assessment

- Status: Concentration, weighted exposure classification and user-configured exposure-limit policy delivered (PRs #443, #450 and #452)
- Date: 2026-11-08
- Scope: assess the existing investment domain and data contracts before implementing user-configured portfolio risk policies for a general-purpose product used by different people and portfolios.
- Product principle: risk appetite belongs to the user, not the application. Each portfolio/workspace may have its own explicit policy configuration; the product must not ship one household's limits as defaults or infer limits from personal data.

## Purpose

IPM-05 calls for user-configured concentration, liquidity, exposure and drawdown policies. This document records what the current repository actually supports and what must be decided before implementation. It does not define investment advice, risk appetite, default thresholds or trading behavior.

## Existing capabilities verified in the current feature branch

### Allocation and concentration

The allocation domain in `apps/dashboard/investment-allocation.js` supports immutable, versioned allocation target policies, portfolio/account scope, currency separation, bitemporal selection, actual-vs-target drift and descriptive HHI, effective category count and largest-category share. These are reusable product capabilities; user-specific target weights belong to the selected portfolio/workspace and are not product defaults.

These concentration statistics describe the observed allocation distribution. They are not a risk score, do not express a user's risk tolerance and do not define breach thresholds. No threshold or severity is implied by the existing calculations.

### Exposure

Weighted multi-group look-through classification is implemented in PR #450 using user-authored dimensions and group IDs. Each instrument/dimension snapshot allocates 100% across distinct groups, carries provenance and bitemporal timestamps, and is selected using both effective and recorded-at cutoffs. Exposure is aggregated by currency and portfolio/account scope from valued FIFO positions. Missing classifications or valuations suppress partial results. No FX conversion, nested fund recursion or automatic issuer/sector/geography inference is performed.

User-configured exposure limits are implemented and merged in PR #452. Each immutable policy version defines explicit maximum group weights and explicit > / >= boundary semantics for one dimension, currency and portfolio/account scope. An unconfigured group is not evaluated; a configured group absent from a complete result measures as zero. Incomplete and empty exposure remain unavailable/empty rather than passing. No default thresholds, severity bands, recommendations or trade actions are generated.

### Liquidity

The current investment instrument contract has no liquidity classification, expected liquidation horizon, lock-up, redemption notice, maturity schedule, trading-volume evidence, bid/ask spread or market-depth observations. The instrument types alone are not sufficient evidence to calculate liquidity. In particular, a fixed deposit, provident-fund holding, mutual fund or listed security cannot safely be assigned a liquidity score from its type alone.

A liquidity policy therefore requires a user-entered data contract or a separately approved data-provider capability. No liquidity score or days-to-cash estimate should be generated until the inputs and their provenance are specified.

### Drawdown

Option B — time-weighted, external-cash-flow-adjusted drawdown — is approved in `ADR-INVESTMENT-DRAWDOWN-METRIC.md`. A pure calculator kernel is implemented in `packages/calculators/src/InvestmentDrawdownMath.ts`; it requires authoritative external-flow events and paired same-timestamp pre/post portfolio valuations, chains returns, and reports maximum drawdown, peak, trough, recovery and explicit unavailable states. Deterministic tests cover hand-calculated market movement, contribution/withdrawal neutrality, expenses, incomplete boundaries, currency/scope and bitemporal cutoffs.

The production feature is **not yet delivered**. Open draft PR #453 adds a component-level snapshot contract/validator, bitemporal supersession and point-in-time selection, plus schema-v11 SQLite migration and JSON/SQLite backup integration. The validator checks declared references, provenance, timestamp equality, component totals and paired flow-boundary component universes, but it does not independently derive the complete set of open FIFO holdings and included cash accounts at each historical cutoff. The repository still needs a trusted capture/completeness builder, authoritative external-flow taxonomy, explicit daily observation calendar, independent integration tests and private-workspace UI/export. Do not connect the math kernel directly to sparse point-valuations or infer missing history. Until those prerequisites are implemented, the production drawdown metric must remain unavailable.

## Decisions required before coding

For each risk-policy family, product requirements must define:

1. **Metric:** exact formula and units; whether the policy uses a maximum, minimum, range or categorical rule.
2. **Scope:** whole portfolio, currency, account, instrument, instrument type, or a user-defined grouping. Define whether overlapping policies are allowed and how their results are displayed.
3. **Threshold semantics:** explicit user-entered limit, comparison direction, inclusive/exclusive boundary, and any user-defined severity bands. No built-in financial thresholds.
4. **Time semantics:** effective date, recorded-at cutoff, observation window and historical reproducibility. State whether a policy is evaluated against current data or point-in-time data.
5. **Data sufficiency:** required fields, provenance, freshness/staleness, missing observations and whether incomplete data suppresses the result.
6. **Denominators and currencies:** zero/empty states, treatment of cash and liabilities, and explicit no-FX behavior unless an FX model is separately approved.
7. **Policy lifecycle:** immutable versioning, corrections, policy retirement, audit history and selection rules.
8. **Output boundary:** descriptive status only. A breach is not an instruction to buy, sell, rebalance or liquidate.

## Implementation sequence (product direction confirmed; concentration contract accepted)

- The concentration and exposure policy families now use separate, immutable, workspace-scoped policy contracts with explicit scope, currency, effective date, recorded-at timestamp and user-authored rules. No user's limits are hard-coded as application defaults.
- Concentration: the first metric contract is defined in `ADR-INVESTMENT-CONCENTRATION-POLICY.md`; the validator, bitemporal selector, valued-position aggregation, evaluator, schema-v8 persistence, v7→v8 migration, JSON backup/restore and private-workspace configuration UI are implemented with deterministic and browser smoke coverage.
- Implement only the remaining metric families whose input data and formulas have been approved and can be independently hand-calculated.
- Treat liquidity as blocked until the liquidity input/provenance model is selected.
- Drawdown methodology is approved and the pure math kernel is implemented; production delivery remains blocked until the trusted snapshot/flow-boundary data pipeline, bitemporal persistence, backup/restore and UI are delivered.
- Keep existing HHI and allocation drift as separate descriptive analytics; do not retroactively label them risk classifications.
- Add browser workflows and persistence only after domain contracts and deterministic tests pass. Any schema change must include migration, backup/restore, CSV compatibility and SQLite acceptance.

## Safety and acceptance boundaries

- No hidden default thresholds, risk-free rates, liquidity scores or inferred classifications.
- No cross-currency aggregation or implicit FX.
- Missing or stale required inputs produce an explicit unavailable state, never a partial risk result presented as complete.
- Policy versions are immutable and historical evaluation is reproducible from explicit as-of and recorded-at cutoffs.
- No trade generation, order routing, autonomous trading or prescriptive investment advice.
- Every metric requires hand-calculated tests for boundary, zero/empty denominator, incomplete data, stale data, currency mismatch and historical cutoff behavior as applicable.

## Current disposition

Allocation target and drift work was merged to `main` via PR #435 on 2026-11-08. Concentration policy evaluation is delivered in PR #443 and schema-v8 persistence/UI. Weighted exposure classifications are delivered in PR #450 and schema-v9. User-configured exposure limits are implemented and merged in PR #452 with schema-v10 persistence, pre-v10 recovery artifact, JSON backup/restore and private-workspace UI. Open draft PR #453 adds schema-v11 drawdown snapshot persistence and backup groundwork on its feature branch; main remains schema v10 until that PR is reviewed and merged. The drawdown production metric remains gated on trusted capture/completeness, event classification, daily calendar, integration tests and UI.
