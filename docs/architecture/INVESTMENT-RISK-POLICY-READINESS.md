# Investment risk policy — readiness assessment

- Status: Requirements discovery — implementation gated
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

The allocation grouping dimension currently supports `instrumentType` or `instrument`. This provides deterministic category/instrument market-value weights when the relevant valuations are complete. It does not yet define what an exposure policy means (for example, whether it constrains one issuer, sector, geography, currency, instrument type, account, or a user-defined group). Existing instrument metadata has type, currency, symbol, exchange, ISIN and description; it does not provide validated issuer, sector or geography classifications.

### Liquidity

The current investment instrument contract has no liquidity classification, expected liquidation horizon, lock-up, redemption notice, maturity schedule, trading-volume evidence, bid/ask spread or market-depth observations. The instrument types alone are not sufficient evidence to calculate liquidity. In particular, a fixed deposit, provident-fund holding, mutual fund or listed security cannot safely be assigned a liquidity score from its type alone.

A liquidity policy therefore requires a user-entered data contract or a separately approved data-provider capability. No liquidity score or days-to-cash estimate should be generated until the inputs and their provenance are specified.

### Drawdown

Investment valuations are point observations with `asOf`, `recordedAt`, source type and source name. The FIFO portfolio projection can be evaluated at an effective date and recorded-at cutoff. However, the repository has not specified a portfolio drawdown series contract: sampling cadence, valuation freshness, missing-point treatment, cash inclusion, external flows, account/currency scope, historical coverage or peak-to-trough reset semantics.

A drawdown metric cannot be called reliable merely because multiple valuation observations exist. The observation series and completeness rules must be agreed and tested first.

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

## Proposed implementation sequence (product direction confirmed; metric contracts still require approval)

- Define a reusable, workspace-scoped risk-policy envelope: immutable version identity, explicit scope, currency, effective date, recorded-at timestamp and user-authored rules. Support different policy versions across independent portfolios/workspaces; do not hard-code any user's values as application defaults.
- Implement only the metric families whose input data and formulas have been approved and can be independently hand-calculated.
- Treat liquidity as blocked until the liquidity input/provenance model is selected.
- Treat drawdown as blocked until historical valuation completeness, sampling and cash-flow treatment are specified.
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

Allocation target and drift work was merged to `main` via PR #435 on 2026-11-08. The product direction is confirmed: users define their own risk limits for the portfolio/workspace they manage; the application provides the configuration and transparent calculations, not a predetermined risk appetite. Risk-policy metric implementation remains gated because formulas, scope, threshold comparison/boundary semantics and required input data are not yet fully approved. Liquidity and drawdown also require additional data contracts. This is a requirements gate, not a claim that risk policies are implemented.
