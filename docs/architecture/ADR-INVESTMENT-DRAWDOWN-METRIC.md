# ADR — Portfolio drawdown metric contract discovery

- Status: Discovery only — no drawdown formula or policy contract approved
- Date: 2026-11-13
- Scope: historical, currency-separated drawdown analytics for the investment portfolio
- Related: `INVESTMENT-RISK-POLICY-READINESS.md`, `ADR-INVESTMENT-CONCENTRATION-POLICY.md`, `ADR-INVESTMENT-EXPOSURE-CLASSIFICATION.md`
- Product boundary: descriptive analytics only; no default risk thresholds, recommendations, alerts, rebalancing or trading

## Purpose

Prepare the drawdown metric decision using the current repository's actual investment data model. This document is not authorization to implement a formula, create a new persistence collection, or expose a risk score. The measurement method must be explicitly selected before implementation.

## Current repository capabilities inspected

The current main branch provides:

- Immutable investment transactions with effective `date` and `recordedAt`, account/instrument references, transaction type, currency, and signed cash amount.
- FIFO position projection by account and instrument, with explicit valuation `asOf`, `recordedAt`, source type and source name.
- Investment cash accounts linked to investment accounts, with opening balances, external contributions, external withdrawals, corrections, transfers and dated cash statements.
- Statement reconciliation for investment cash accounts.
- Portfolio XIRR that requires explicit cash accounts, reconciled statements, linked investment transactions and complete terminal holdings valuation.
- Currency separation and no implicit FX conversion.
- Bitemporal filtering for transactions and valuations in portfolio analysis.

These capabilities provide useful building blocks but do not yet define a historical portfolio NAV series suitable for drawdown.

## Verified gaps

1. **No canonical portfolio valuation snapshot series.** Instrument valuation records are point observations, but there is no approved common portfolio sampling calendar or guarantee that every open position has a valuation at every portfolio observation time.
2. **Cash history is not a uniform daily balance series.** Cash statements are dated observations; movements and transfers can roll a statement balance forward, subject to reconciliation and recorded-at cutoffs. The product has not specified the maximum permitted statement age for a historical observation.
3. **External-flow timing matters.** Contributions and withdrawals change portfolio NAV but are not investment gains or losses. A raw NAV peak-to-trough calculation can therefore misstate drawdown when external flows occur.
4. **Transfers need classification.** Transfers between cash accounts in the same selected portfolio should not be treated as external portfolio flows. Transfers crossing the selected scope need explicit treatment.
5. **Investment transaction classification is not yet a complete performance-event taxonomy.** Purchases, sales, dividends, interest, fees and taxes exist, but the drawdown contract must state how each affects portfolio value and performance, including corporate actions and non-cash events.
6. **Sampling, stale-data and gap semantics are undecided.** No daily, weekly, monthly or event-driven observation frequency is currently canonical.
7. **Historical knowledge must remain reproducible.** Existing transaction and valuation records have effective and recorded timestamps; a drawdown result must not silently include later-recorded corrections when evaluating an earlier knowledge cutoff.

## Candidate measurement approaches — decision required

### Option A — Raw portfolio NAV drawdown

For each observation, calculate total portfolio NAV and measure its decline from the preceding running peak.

Candidate formula:

`drawdown_t = NAV_t / max(NAV_0, ..., NAV_t) - 1`

**Limitation:** external contributions and withdrawals change NAV independently of investment performance. Unless the series is flow-adjusted, the result can misstate investment drawdown. Do not implement this as investment-performance drawdown without an explicit product decision and prominent interpretation.

### Option B — Time-weighted, flow-adjusted drawdown

Construct subperiod returns around external cash flows, chain-link the returns into a wealth index, and calculate peak-to-trough drawdown on that index.

Candidate formula:

`drawdown_t = WealthIndex_t / max(WealthIndex_0, ..., WealthIndex_t) - 1`

**Requirements:** reliable portfolio valuations at the boundaries needed to isolate external flows; precise effective timestamps; classification of external versus internal flows; consistent handling of fees, taxes, income and transfers. If the required boundary valuation is missing, the affected result must be unavailable rather than estimated silently.

### Option C — Periodic approximation (for example, Modified Dietz)

Estimate a period return using beginning/end values and weighted external flows, then chain-link the periodic returns.

**Trade-off:** can operate with less frequent observations but is an approximation. It requires a selected period convention, day-count weighting, flow timing convention and disclosure that intra-period peaks/troughs are not observed. It cannot honestly claim to capture drawdowns between observations.

### Important distinction

Portfolio XIRR is money-weighted over a dated cash-flow stream. It is not, by itself, a path-dependent peak-to-trough drawdown series. Reusing XIRR as the drawdown engine would not answer the same question.

## Decisions required before implementation

The product owner must select or define:

1. **Metric purpose:** investment-performance drawdown (external-flow adjusted) versus total-wealth/NAV decline (flow-inclusive).
2. **Method:** Option A, B, C, or another explicitly specified method. If B or C, define the exact return equation and chaining convention.
3. **Observation frequency:** event-driven, daily, weekly, monthly, or user-selected. State whether observations are calendar-based or only on dates with complete inputs.
4. **Peak and reset semantics:** full-history running peak, selected-window peak, or user-defined rolling window; whether the first observation establishes the initial peak.
5. **Scope:** whole investment portfolio or one investment account; currency remains separate unless an explicit FX contract is separately approved.
6. **Valuation eligibility:** required position coverage, same-time valuation rules, maximum age/freshness policy, treatment of zero-value and closed positions, and whether manual/provider sources are treated equally.
7. **Cash inclusion:** include reconciled investment cash; define statement age and roll-forward rules; distinguish internal transfers from external portfolio flows.
8. **Flow taxonomy:** treatment of contributions, withdrawals, purchases, sales, dividends, interest, fees, taxes, corrections, corporate actions and transfers crossing the selected scope.
9. **Missing data:** whether one missing holding valuation, cash statement, flow boundary or observation invalidates the whole selected series or only a clearly delimited interval. Never bridge gaps or interpolate without explicit approval.
10. **Bitemporal semantics:** effective observation cutoff and recorded-at knowledge cutoff; define correction/supersession behavior and reproducibility.
11. **Output contract:** maximum drawdown, peak date, trough date, recovery date (if observed), observation count, coverage/gap metadata and explicit unavailable reasons. Decide which metrics are in scope.
12. **Policy evaluation:** only after the metric is approved, define user-authored threshold direction, comparison boundary, immutable policy versions, effective/recorded-at selection and no-default behavior.

## Required acceptance evidence

Before a calculator is implemented, prepare hand-calculated examples covering:

- A rising series with no drawdown.
- A peak followed by a decline and recovery.
- External contribution at a peak and external withdrawal at a trough.
- Internal transfer between accounts within scope.
- Transfer across the selected account/portfolio boundary.
- Dividend, interest, fee and tax treatment.
- Multiple currencies with no implicit FX.
- Missing valuation for one open position.
- Stale cash statement and a missing flow-boundary valuation.
- Same effective date with later-recorded correction.
- A correction recorded after the historical knowledge cutoff.
- Empty portfolio, zero NAV and non-positive denominator behavior.
- Irregular observation intervals and gaps.

Expected outputs must be calculated independently by hand and asserted in deterministic tests. The browser workflow must show the selected method, frequency, scope, as-of cutoff, recorded-at cutoff, coverage and unavailable reasons.

## Explicit non-decisions

This ADR does not approve:

- A specific drawdown formula or observation frequency.
- Any household-specific or application-wide threshold.
- A risk score, severity band, alert, recommendation or rebalance instruction.
- Price interpolation, stale-price carry-forward, synthetic history or reconstructed historical valuations.
- FX conversion or cross-currency aggregation.
- A schema migration or new persistence collection.
- A market-data provider or external data transmission.

## Next step

Review and approve the metric purpose, method and observation frequency first. Then resolve the remaining input, scope, missing-data and bitemporal rules. Only after those decisions are explicit should implementation proceed.
