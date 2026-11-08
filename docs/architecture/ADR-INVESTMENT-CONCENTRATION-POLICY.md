# ADR — User-configured investment concentration limits

- Status: Accepted; concentration engine, workspace persistence and UI delivered
- Date: 2026-11-08
- Scope: deterministic concentration limits using the existing valued investment allocation projection
- Product principle: each user configures limits for the portfolio/workspace they manage; the application supplies no default risk appetite or thresholds.

## Context

The allocation domain already calculates currency-separated market-value weights by instrument type or instrument, for portfolio or single-account scope. It also suppresses allocation output when an open position lacks an eligible valuation. Those outputs can support a narrowly defined first risk-policy family without inventing liquidity, issuer, sector, geography or historical-return data.

Concentration statistics such as HHI remain descriptive. A user-configured limit is a separate policy input and is not inferred from HHI or allocation targets.

## Decision

The first concentration-policy metric is **maximum market-value weight for a selected allocation group**.

For each explicitly configured group key:

`actualWeightPercent = groupMarketValue / scopedPortfolioMarketValue * 100`

The rule stores:
- `key`: an existing instrument type or instrument ID, according to the policy grouping.
- `maxWeightPercent`: a user-entered percentage from 0 through 100.
- `operator`: explicitly selected `>` or `>=` boundary semantics.

A breach is reported only when the selected operator evaluates true. The operator is part of the user's saved rule; the application does not silently choose inclusive or exclusive boundary behavior.

The policy envelope is immutable and versioned:
- unique policy ID and policy-set ID/version;
- user-entered name;
- currency;
- portfolio or one-account scope;
- instrument-type or instrument grouping;
- effective date and recorded-at timestamp;
- one or more explicit per-group limits.

Within a policy set, currency, scope, account and grouping remain stable across versions. A user creates a new policy set to change those dimensions. Different workspaces can hold different policies. The current local workspace boundary is the persistence boundary; this ADR does not claim multi-user authentication or shared-workspace authorization.

## Evaluation behavior

- Evaluate against the existing allocation projection for the exact same currency, scope and grouping.
- Use market values and allocation weights already calculated by the investment ledger; do not calculate a second denominator or apply FX.
- Only explicitly configured group keys are tested. An unconfigured category does not create a rule.
- If a configured key has no current holding in an otherwise complete allocation, its actual weight is zero.
- Missing required valuation data suppresses the entire evaluation as unavailable; never evaluate a partial portfolio.
- An empty portfolio returns an explicit empty state, not a zero-risk or within-limit conclusion.
- A future-effective or not-yet-recorded policy cannot be evaluated at an earlier cutoff.
- Output is descriptive status and measured values only. No severity bands, advice, trade, rebalance, sale or liquidation instruction is generated.

## Deliberate exclusions

This first slice does not implement:
- issuer, sector, geography, currency or correlated exposure classification;
- liquidity scores, time-to-cash, redemption restrictions or maturity estimates;
- drawdown, volatility, Sharpe/Sortino or return-series analysis;
- automatic alerts, recommendations or transaction creation;
- application-wide default limits.

Those capabilities require their own data and metric contracts. In particular, this ADR does not relabel HHI as risk.

## Implementation sequence

1. [x] Deliver and test the pure concentration-policy validator, immutable history selector, valued-position aggregation and evaluator.
2. [x] Integrate schema-v8 workspace persistence, transactional v7→v8 migration, pre-migration recovery backup and JSON backup/restore.
3. [x] Add the private-workspace user interface, explicit confirmation, immutable version history and transparent evaluation states.
4. [x] Include policy history in authoritative full-workspace JSON backups. PFO-native investment CSV remains focused on the eight ledger collections and does not export policy sets.

## Acceptance

- Hand-calculated deterministic test cases for both boundary operators, above/below/equal values, absent configured groups, multiple rules, account and portfolio scopes, currency mismatch, incomplete valuation, empty holdings and bitemporal policy selection.
- No default limit or hidden operator.
- No cross-currency aggregation or partial result.
- No mutation of investment ledger records.
- Historical policy versions remain immutable and reproducible.
