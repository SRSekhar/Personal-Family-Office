# ADR — Portfolio drawdown metric

- Status: **Decision accepted — Option B; pure calculation kernel and component-level snapshot contract implemented; capture/completeness pipeline and UI remain pending**
- Date: 2026-11-13
- Scope: historical, currency-separated investment-portfolio performance drawdown
- Related: `INVESTMENT-RISK-POLICY-READINESS.md`, `ADR-INVESTMENT-CONCENTRATION-POLICY.md`, `ADR-INVESTMENT-EXPOSURE-CLASSIFICATION.md`
- Product boundary: descriptive analytics only; no default risk thresholds, recommendations, alerts, rebalancing or trading

## Decision

Adopt **Option B: time-weighted, external-cash-flow-adjusted drawdown** as the canonical investment-performance drawdown methodology.

This is the correct choice for PFO because the product tracks investments and portfolio performance over time. Raw NAV drawdown confounds investment performance with deposits and withdrawals. Modified Dietz or other periodic approximations would be easier to calculate from sparse observations, but they would introduce approximation error and could conceal material intra-period losses. PFO must not label an approximation as actual drawdown.

The decision is deliberately strict: **if the data cannot support a mathematically valid flow-adjusted return path, the metric is unavailable.** Do not silently substitute raw NAV, Modified Dietz, XIRR, stale prices, interpolation or estimated boundary values.

This ADR approves the methodology, not permission to ship a partial or misleading metric. The data model currently lacks the complete valuation observations needed to calculate it reliably. Implementation remains blocked until the prerequisites below are delivered and tested.

## Why Option B

- External contributions and withdrawals change NAV but are not investment gains or losses.
- A time-weighted return path neutralizes those external flows and is therefore suitable for peak-to-trough investment-performance analysis.
- It is auditable: every return segment can be traced to two eligible portfolio valuations and the external-flow events between them.
- It avoids the known weakness of periodic approximations: an approximation cannot claim to observe peaks and troughs that were never valued.
- It aligns with the existing separation between money-weighted XIRR and investment performance. XIRR remains a distinct metric and must not be repurposed as drawdown.

## Canonical calculation contract

### 1. Portfolio boundary and currency

- Calculate each selected investment portfolio/account scope independently.
- Calculate each currency independently. No implicit FX conversion, cross-currency aggregation or base-currency conversion is permitted.
- Include investment positions and investment cash belonging to the selected scope.
- Internal transfers wholly within the selected scope are not external flows. Transfers crossing the selected scope boundary are external flows for that scope.
- The selected scope and currency must be displayed with every result.

### 2. External-flow neutralization

For each external flow event, require eligible portfolio valuation immediately before and immediately after the event, at the event's effective timestamp.

For a return segment bounded by the prior post-flow valuation (V_{0}^{+}) and the next pre-flow valuation (V_{1}^{-}):

`r = (V_1^- / V_0^+) - 1`

Chain-link segment returns into a wealth index:

`W_1 = W_0 × (1 + r)`

At an external flow boundary, the flow itself must not change the wealth index. The post-flow portfolio valuation establishes the next segment's starting value. The implementation must retain the event and boundary valuations used to establish this neutrality; it must not infer the post-flow value from an amount-only cash ledger.

The initial valid observation establishes the initial wealth-index level. Returns require a strictly positive starting portfolio value. Zero or negative denominators make the affected result unavailable; no artificial return is manufactured.

### 3. Drawdown and maximum drawdown

At each eligible observation point:

`drawdown_t = W_t / max(W_0, ..., W_t) - 1`

Maximum drawdown over the requested interval is the minimum (most negative) drawdown in that interval.

- The running peak is full-history within the explicitly selected analysis window; the first valid point in that window establishes its initial peak.
- Peak, trough and recovery dates must refer to actual eligible observations.
- Recovery is reported only when the wealth index subsequently reaches or exceeds the relevant prior peak within the observed series. Otherwise it is explicitly unrecovered/not observed.
- The product must not claim to measure unobserved intraday market peaks or troughs. The observed path is limited to the valuation and flow-boundary timestamps actually recorded.

### 4. Observation requirements

- Use event-time observations at every external-flow boundary and daily end-of-day portfolio valuation snapshots for the historical path. The daily observation calendar must be an explicit input supplied by a trusted calendar/data pipeline; the calculator must reject any expected close missing at the recorded-at cutoff. Do not infer weekends, market holidays or valuation availability from system time.
- Every observation must have a common effective timestamp and a complete valuation of all open positions plus included cash in the selected scope and currency.
- Every external flow must have paired, complete pre-flow and post-flow boundary valuations. Date-only timestamps are insufficient where ordering or intraday timing is material.
- Daily observations without a complete snapshot are missing observations, not zero returns.
- No stale-price carry-forward, interpolation, synthetic snapshots or backfilled estimates.
- The current model has instrument valuation records and cash statements, but not a canonical complete portfolio snapshot series or paired flow-boundary valuation records. Those are explicit prerequisites, not assumptions.

### 5. Event classification

- Owner/household deposits and withdrawals crossing the selected portfolio boundary: external flows.
- Transfers between accounts wholly inside the selected scope: internal transfers; eliminate from external-flow treatment.
- Transfers crossing the selected scope boundary: external flows for that scope.
- Purchases, sales, reinvestments and cash movements between included portfolio components: internal investment activity, not external flows.
- Dividends and interest retained in the portfolio: investment return, not external flows.
- Fees, taxes and investment expenses charged to the portfolio: reduce investment performance; do not neutralize them as external flows.
- Distributions paid outside the selected portfolio: external withdrawals only when they cross the selected boundary as an owner/portfolio distribution. The event taxonomy must distinguish these from fees and taxes.
- In-kind contributions/withdrawals require a documented fair-value amount and paired boundary valuations; otherwise the affected interval is unavailable.
- An `OpeningBalance` is not automatically an external contribution. It is an initial baseline/legacy opening event unless the user supplies evidence that it represents a real owner contribution within the measured period. The drawdown adapter must not blindly reuse the existing XIRR external-cash-flow builder, which has different semantics.\n- A cash `Correction` that reverses an earlier contribution/withdrawal must correct the classification/value of that original event without creating a second economic flow. Preserve the original and correction's effective/recorded timestamps so point-in-time views remain reproducible. If a correction's economic effect cannot be reconstructed unambiguously, the affected interval is unavailable.\n- Corporate actions must preserve effective-time and recorded-time history and must not create duplicate economic flows.

If an existing transaction type cannot be unambiguously classified under these rules, do not guess. Mark the affected interval unavailable and add an explicit taxonomy decision before implementation.

### 6. Missing data and coverage

- A missing position valuation, cash valuation, flow classification, flow-boundary valuation, or required timestamp invalidates the affected return segment.
- Do not bridge a gap or compute a full-window maximum drawdown across an invalid segment.
- The requested-window result is unavailable when any gap prevents a continuous, auditable wealth-index path from the selected start to end. A future product decision may expose clearly separated valid subperiods, but must not combine them into one misleading full-window statistic.
- Return explicit unavailable reasons and coverage metadata: missing instruments, missing timestamps, unclassified flows, stale/ineligible inputs, and invalid denominators.
- Closed positions remain part of the portfolio path through their actual disposal value/cash proceeds and must not disappear from history prematurely.

### 7. Bitemporal reproducibility

Every calculation must accept:
- an effective-time analysis window; and
- a recorded-at knowledge cutoff.

Only records effective within the requested window and known by the recorded-at cutoff may participate. Later-recorded corrections must not rewrite a historical as-known result. A restated/current-knowledge view may be offered separately, but must be clearly labelled and reproducible.

### 8. Output contract

The descriptive result should include:
- selected scope and currency;
- methodology identifier/version;
- analysis start/end and recorded-at cutoff;
- maximum drawdown magnitude and sign convention;
- peak, trough and recovery dates/status;
- wealth-index observations and drawdown path;
- observation count and valuation coverage;
- flow-boundary count and validation status;
- explicit gaps/unavailable reasons.

Do not add risk scores, severity bands, default thresholds, alerts, recommendations, rebalancing or trading actions under this ADR. User-authored drawdown policies require a separate policy contract and approval.

## Observation acquisition decision

The first production observation path will be **manual-first and provider-neutral**. PFO currently has no bank connection or external market-data feed, and this feature must not introduce an unapproved provider, API credential, or external data transmission.

- Users will capture or import explicit portfolio observations; PFO will not synthesize historical snapshots from sparse prices.
- Each observation must contain component-level values for every open position and every included investment cash account in the selected scope/currency. Component references and position quantities must reconcile to the immutable investment ledger at the observation's effective-time and recorded-at cutoffs.
- Every component must carry its own valuation/balance timestamp, source type and source name. The source timestamp must meet the observation's exact-time eligibility rule; stale values are not silently carried forward.
- Snapshot totals must equal the sum of eligible components within the currency's defined minor-unit tolerance. Missing, extra, duplicate or mismatched components make the observation incomplete.
- External-flow observations are captured as a paired pre-flow/post-flow set at the authoritative flow's exact effective timestamp. Both sides must cover the same scope and component universe.
- A future provider/import adapter may populate the same immutable contract, but it must pass identical validation. Provider availability must never relax completeness rules.

This is a deliberate product trade-off: manual capture is less convenient than automatic market-data ingestion, but it preserves the local-first boundary and makes provenance/completeness explicit. No provider, automatic pricing source, or bank connection is approved by this decision.

## Current repository assessment and implementation gates

The current repository has immutable investment transactions with effective `date` and `recordedAt`, instrument valuations with `asOf` and `recordedAt`, investment cash accounts/movements/transfers/statements, currency-separated portfolio analysis and XIRR. It does **not** currently guarantee:

1. a complete, common-timestamp portfolio valuation snapshot for every daily observation;
2. paired pre-flow and post-flow portfolio valuations at every external flow's effective timestamp;
3. sufficiently precise event timestamps and a complete, approved external-flow taxonomy;
4. a defined historical snapshot retention and correction strategy.

Therefore, do not implement a drawdown calculator against the existing point-valuations and cash statements alone. First design and approve the smallest additive data contract for immutable portfolio snapshots and flow-boundary valuations, including provenance, effective timestamp, recorded-at timestamp, scope, currency, position coverage and validation status. Reuse existing ledger records as event sources where valid; do not duplicate or mutate the financial ledger to simulate snapshots.

A pure, deterministic calculation kernel now exists in `packages/calculators/src/InvestmentDrawdownMath.ts`. It chains daily observations, requires an explicit daily-close calendar plus authoritative external-flow events and exact paired pre/post valuations, neutralizes flow-only NAV changes, applies effective/recorded-at cutoffs, and reports maximum drawdown, peak, trough, recovery, coverage and unavailable reasons. Hand-calculated unit tests cover market movement, contribution neutrality, withdrawal neutrality, unpaired/incomplete observations, flow timestamp mismatch, mixed currency/scope, ambiguous simultaneous flows and bitemporal filtering. This is deliberately only a math kernel: it does not construct or certify complete portfolio snapshots, discover missing calendar observations, classify ledger events, or persist history. It must not be wired to existing point-valuations/cash statements as if they formed a complete series.\n\nNo schema migration is authorized by this ADR. A separate implementation design must demonstrate how the new observations are generated, validated, persisted, replayed and backed up before schema changes begin.

## Required acceptance evidence

Before production implementation, add independently hand-calculated fixtures and deterministic tests for:

- flat and rising wealth-index paths;
- a peak, drawdown, trough and observed recovery;
- contribution at a peak and withdrawal at a trough (neither may create artificial performance);
- multiple external flows between daily closes, each with paired boundary valuations;
- internal transfer within scope (no external flow) and transfer across scope (external flow);
- retained dividend/interest versus fee/tax expense;
- in-kind contribution/withdrawal with and without valid fair-value boundary evidence;
- multiple currencies with no implicit FX;
- missing open-position valuation, stale/missing cash valuation and missing flow-boundary valuation;
- ambiguous/unclassified event;
- zero/non-positive denominator;
- irregular observations and a gap;
- effective-time correction recorded after the historical knowledge cutoff;
- closed position disposal and corporate action;
- exact peak/trough/recovery identification and sign convention.

Tests must prove that an external contribution/withdrawal alone does not create a gain/loss in the wealth index, while fees/taxes and market movement do affect performance. The UI must disclose methodology, scope, currency, analysis window, knowledge cutoff, coverage and unavailable reasons.

## Explicit non-decisions

This ADR does not approve:
- cross-currency or FX-adjusted drawdown;
- household net-worth/property/debt drawdown (this is investment-portfolio performance only);
- default/user-independent risk thresholds, alerts, severity bands or recommendations;
- intraday market drawdown beyond recorded valuation timestamps;
- stale-price carry-forward, interpolation, synthetic/backfilled valuations or Modified Dietz fallback;
- automatic market-data-provider selection or external data transmission;
- any schema migration before the separate data-contract design is reviewed.

## Next implementation sequence

1. Design the additive immutable portfolio-snapshot and flow-boundary observation contract against the existing SQLite v10 schema and backup/migration architecture.
2. Define and test the complete event taxonomy using existing transaction and cash-movement types; explicitly list unresolved types rather than guessing.
3. Implement deterministic snapshot construction/validation and persistence with provenance and bitemporal semantics.
4. Implement the flow-adjusted wealth-index calculator and maximum drawdown only after snapshot prerequisites are satisfied.
5. Add hand-calculated unit/integration tests, then descriptive UI and export support.


**Quality rule:** a truthful “not enough reliable history to calculate” is preferable to a precise-looking but mathematically invalid drawdown number.


## Implementation update — component snapshot contract and persistence groundwork

The open PR #453 feature branch now contains:

- `apps/dashboard/investment-drawdown-snapshots.js`: validation for explicit portfolio/account scope, currency, position/cash component references, component values, per-component source provenance, exact component/snapshot effective-time equality, component-total reconciliation, explicit incomplete reasons, paired pre/post-flow component-universe matching, and immutable supersession with recorded-at point-in-time selection.
- A schema-v11 `investmentDrawdownSnapshots` collection, transactional SQLite v10→v11 migration, and protected pre-v11 JSON recovery artifact.
- Schema-v11 JSON backup validation/preview and SQLite save/restore/online-backup integration. Legacy schema-v1–v10 imports remain supported; if an older import omits drawdown snapshots, existing snapshots are preserved only when they still validate against the target investment and cash ledgers.
- Deterministic validator, backup compatibility and migration tests.

This is **not** a complete drawdown production pipeline. The validator checks declared component references and internal reconciliation, but it does not independently derive the full set of open FIFO holdings and included cash accounts at each historical effective/recorded cutoff. No UI currently captures snapshots. A trusted completeness builder, authoritative external-flow classifier, explicit daily observation calendar, independent integration cases and private UI/export remain mandatory. Schema migration initializes the new collection empty; it does not fabricate historical observations. PR #453 remains open and unmerged. Latest head `76a6e692453a477d4651d1ac8379b2deb5f2a8f5` passed CI #1756 (86 files / 833 tests, lint, typecheck, build and Chromium browser smoke), Secret Scan #1550 and dashboard deployment workflow #992.
