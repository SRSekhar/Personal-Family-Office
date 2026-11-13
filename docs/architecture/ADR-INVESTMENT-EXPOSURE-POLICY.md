# ADR — User-configured investment exposure limits

- Status: Accepted — implemented and merged in PR #452 on 2026-11-13
- Date: 2026-11-13
- Scope: deterministic maximum group-weight limits over the accepted weighted look-through exposure result
- Product principle: thresholds and boundary semantics are explicitly user-authored; the application supplies no defaults or risk appetite.

## Context

Sprint 9 delivered immutable, bitemporal weighted classifications and complete look-through exposure aggregation. An exposure result is available only when every positively held position in the selected currency/scope has an eligible valuation and a complete classification for the selected dimension. It contains group market-value weights that reconcile to 100%.

This ADR defines the next increment: user-configured limits for selected groups within one classification dimension. It does not extend instrument-type concentration rules or infer any threshold from the portfolio.

## Policy contract

Each immutable policy version contains:

- unique policy ID, policy-set ID and positive version;
- user-entered name;
- currency;
- portfolio or one-account scope;
- stable classification dimension ID and display name;
- effective-from date and recorded-at timestamp;
- one or more explicit rules, each containing stable group ID, maximum weight percentage (0–100), and explicitly selected > or >= comparison operator.

Within a policy set, currency, scope, account, dimension ID and dimension name remain stable. A new policy set is required to change those dimensions. A new version is required to change thresholds or operators.

Every rule must reference a group that exists in a saved classification for the same currency and dimension. Group identity and display name are inherited from the immutable classification history; policy rules store the stable group ID.

## Evaluation semantics

- Evaluate the selected policy against the look-through exposure result for the exact same currency, scope, account and dimension.
- Use the exposure result's existing group weights and denominator; do not recalculate, apply FX, or include household assets, liabilities or investment cash balances.
- Only explicitly configured groups are evaluated. A configured group absent from an otherwise complete exposure result has actual weight zero.
- > breaches only above the configured maximum; >= breaches at or above the configured maximum.
- An unavailable or empty exposure result remains unavailable or empty. It must never become a within-limits result.
- Missing classification or valuation data suppresses the whole evaluation through the existing exposure engine; no partial denominator.
- Policy selection requires both effective-from and recorded-at timestamps to be within the requested cutoffs. Policy history is append-only.
- Results are descriptive breach/within-limit measurements only. No severity bands, advice, trade, rebalance, sale, liquidation instruction or automatic alert is generated.

## Deliberate exclusions

- No default or inferred thresholds, comparators, risk appetite or policy sets.
- No policy for liquidity, drawdown, volatility, currency risk or correlation.
- No FX conversion, nested fund recursion, provider synchronization or automatic classification.
- No transaction creation, alerts, recommendations or trading behavior.

## Persistence and compatibility

- Add schema v10 with investmentExposurePolicies as a new full-workspace collection.
- Migrate v9→v10 transactionally, preserve all existing collections and stable IDs, initialize policy history empty, and write a mode-restricted pre-v10 recovery artifact before migration.
- JSON backup schema v10 must preserve the new collection. Schemas 1–9 remain importable. A legacy import must not discard current policy history if it remains valid against the restored ledger and classifications; invalid references must not be silently carried forward.
- Validate the collection against accounts, instruments and exposure classifications before any persistence or restore write.

## Acceptance

- Hand-calculated tests for strict/inclusive boundary semantics, zero exposure for an absent configured group, multiple rules, account/portfolio scope, currency and dimension mismatch, empty and unavailable exposure, missing group references, and bitemporal policy selection.
- SQLite v9→v10 migration, pre-migration recovery artifact, rollback, exact round-trip and JSON backup compatibility tests.
- Private-workspace UI for authoring immutable versions and evaluating explicit policies; no controls enabled in the sample workspace.
- No change to existing concentration policy behavior.
