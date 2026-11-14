# IPM-04 Performance Analytics — Contract Discovery

- **Status:** Discovery complete; implementation decisions remain gated
- **Date:** 2026-11-14
- **Inspected revision:** `feature/ipm-performance-review` at `cce9cd46d444eb17430e542b26c0121474376a80`
- **Scope:** Existing investment ledger, FIFO projection, cash reconciliation, XIRR, drawdown series and private reports
- **Data policy:** Synthetic fixtures only; never commit household records or private reports.

## Executive finding

The current branch already supports a substantial point-in-time performance review and a separate flow-adjusted historical drawdown series. The next increment should not introduce another generic return formula. The remaining material gaps are (1) transaction-to-position/cash-statement reconciliation as an explicit workflow, (2) documented adjustment/corporate-action event semantics, and (3) period comparison presentation built only from explicitly selected, fully available historical drawdown analyses.

## Existing supported contracts

| Output / capability | Existing source of truth | Current behavior | Boundary |
|---|---|---|---|
| Open positions and quantity | Immutable investment transactions, projected by `analyzeInvestmentPortfolio` | Purchases add lots; sales consume FIFO lots; oversells fail | No short positions or inferred trades |
| Open cost basis | FIFO lots in the portfolio projection | Remaining lot quantity × recorded unit cost | No adjustment, average-cost or tax-lot election workflow |
| Realized P&L | FIFO lot consumption on sales | Sale proceeds less consumed FIFO cost | Does not imply tax-basis treatment |
| Unrealized P&L / market value | Explicit manual/provider valuation selected by effective as-of and recorded-at cutoff | Missing open-position valuation remains unavailable | No inferred or external prices; no FX |
| Dividends, interest, fees, taxes | Typed investment-ledger transactions | Income is positive; fees/taxes are recorded as positive expense totals | Tax is a recorded amount, not a tax calculation |
| Cash balance / reconciliation | Explicit opening balance, movements, transfers, linked transactions and statements | Bitemporal roll-forward; missing baseline or unlinked transaction prevents a complete result | No implicit zero opening balance |
| Money-weighted return | Existing ledger-backed XIRR path | Per-currency result requires complete investor cash flows and terminal value | Not a time-weighted return; never combine currencies |
| Historical flow-adjusted wealth path and drawdown | Validated immutable valuation snapshots, explicit persisted close calendar, cash-ledger flow classifier and `analyzeInvestmentDrawdownSeries` | Chain-linked TWR wealth index, paired pre/post-flow boundaries, max drawdown, peak/trough/recovery | Manual observations; missing expected closes or incomplete reconciliation make analysis unavailable |
| Private performance report | Existing FIFO projection + per-currency XIRR | Standalone HTML and safe CSV, exact as-of and recorded-at cutoffs | A single point-in-time portfolio review, not a period-comparison report |
| Private drawdown report | Validated drawdown analysis | HTML/CSV with scope, calendar provenance, coverage, completeness and unavailable reasons | No partial statistics; no recommendations or thresholds |

## Candidate next capability: historical period comparison

A comparison can be built without a new financial formula only if each compared period is independently supplied to the existing drawdown-series orchestration and returns an `available` result.

### Required input contract

Each comparison row must retain:

- Explicit user-selected period label, exact canonical UTC `startAt` and `endAt`.
- Same portfolio/account scope and account ID (when account-scoped).
- Same currency; cross-currency comparison is rejected.
- One explicit `recordedAtCutoff` shared by all periods in a comparison.
- The exact persisted calendar ID and version selected for that period.
- The complete result from `analyzeInvestmentDrawdownSeries`, including its methodology, coverage, observation count, flow-boundary count, completeness evidence and limitations.

No automatic calendar periods, business days, missing observations, prices, cash flows, FX or valuations may be generated.

### Supported comparison fields

- **Flow-adjusted period return:** derive only from the first and last valid wealth-index points returned by the existing chain-linked TWR calculation: `last.wealthIndex / first.wealthIndex - 1`. Do not recalculate daily returns or chain links in the report layer.
- **Maximum drawdown:** use the existing `maximumDrawdown` result unchanged.
- **Peak, trough, recovery:** use the existing timestamps and recovered flag unchanged.
- **Coverage and completeness:** show each period's actual coverage and evidence; never imply calendar days not observed.
- **Unavailable period:** show its explicit reason and omit all return/drawdown statistics for that period. Do not compare a partial series.

The first and last wealth-index points must be validated as finite and positive before deriving a period return. Periods must contain at least two points and must be independently available. Comparison rows must be ordered by their supplied period start; overlapping periods may be displayed but must not be represented as disjoint or additive.

### Explicitly out of scope

- Annualized period return, CAGR, benchmark-relative return, volatility, Sharpe/Sortino, beta, risk scores or thresholds.
- Comparing different currencies, account scopes, cutoffs or methodologies.
- Automatically generated month/quarter/year windows or calendars.
- Reconstructing earlier periods from today's positions or valuations.
- In-kind contributions, corporate actions, splits, mergers, spin-offs, rights, bonus issues, return of capital or cost-basis adjustments.
- Tax-lot selection, tax liability, FX translation, external market data or investment recommendations.

## Remaining gaps and evidence needed

### 1. Transaction-to-position reconciliation

The ledger validates transaction structure, trade cash versus quantity × unit price, references and FIFO sale availability. The portfolio projection is a derived position view. This is not equivalent to reconciling each broker/custodian statement transaction and closing quantity against an independently captured statement.

Before implementing a reconciliation workflow, define the statement evidence contract: source identity, statement period, account/currency, transaction reference matching, duplicate detection, unmatched/ambiguous rows, opening quantity baseline, closing quantity comparison, correction behavior and recorded-at cutoff. Do not auto-create or silently modify ledger transactions.

### 2. Cost-basis adjustments

Current FIFO cost basis derives from recorded purchase lots and sales. There is no explicit adjustment event contract. Do not retrofit adjustments as fees, taxes, cash movements or synthetic purchases. A separate decision must define supported event types, quantity effects, per-lot versus aggregate allocation, effective/recorded-at behavior, reversals and historical restatement before schema or calculator changes.

### 3. Corporate actions and in-kind flows

The cash-ledger and current investment transaction taxonomy do not represent these events. They remain unsupported. A separate domain-model decision and migration/backup plan are required before implementation.

## Acceptance gates for a comparison implementation

1. Every row is backed by a separately available `analyzeInvestmentDrawdownSeries` result.
2. All rows share exact scope, currency, methodology and recorded-at cutoff.
3. Period-return derivation uses only the existing wealth-index endpoints and is independently hand-calculated in tests.
4. An unavailable period contributes no numeric statistics; one unavailable period does not silently disappear from the comparison.
5. Duplicate, overlapping, reversed, mismatched or malformed periods are handled explicitly.
6. Tests cover zero/negative/non-finite wealth-index values, fewer than two points, same cutoff, currency/scope mismatch and missing expected daily closes.
7. HTML/CSV output remains private-only, script-free, XSS-safe and spreadsheet-formula-safe.
8. Chromium smoke verifies selection, invalidation after source-data changes, demo/private isolation and exports.
9. No schema migration is introduced unless required by a separately approved data contract.

## Recommended implementation order

1. Implement a pure validation/summary adapter for a supplied set of existing drawdown analyses; do not calculate or acquire observations inside the adapter.
2. Add independently hand-calculated unit tests for period return derived from wealth-index endpoints and fail-closed comparison behavior.
3. Add private HTML/CSV comparison output and browser workflow only after the adapter contract passes.
4. Handle transaction-to-position statement reconciliation as a separate increment after its statement matching contract is approved.
5. Defer cost-basis adjustments, corporate actions and in-kind flows until their ledger-model decisions are approved.

## Source files inspected

- `apps/dashboard/investment-ledger.js`
- `apps/dashboard/investment-cash-ledger.js`
- `apps/dashboard/investment-performance.js`
- `apps/dashboard/investment-portfolio.js`
- `apps/dashboard/investment-portfolio-xirr.js`
- `apps/dashboard/investment-portfolio-report.js`
- `apps/dashboard/investment-drawdown-series.js`
- `apps/dashboard/investment-drawdown-report.js`
- `packages/calculators/src/InvestmentDrawdownMath.ts`
- `docs/architecture/ADR-0002-historical-snapshot-persistence-requirements.md`


## Implementation progress — period comparison adapter

The first implementation slice is now present:

- `apps/dashboard/investment-period-comparison.js` validates explicit periods backed by existing drawdown-series analyses and derives only the endpoint wealth-index return.
- It enforces shared scope/account/currency/methodology/recorded-at cutoff, persisted calendar provenance, positive strictly increasing observations, unique labels and explicit unavailable states.
- It sorts periods chronologically and marks overlaps; it does not imply disjoint or additive windows.
- `apps/dashboard/investment-period-comparison.test.js` includes hand-calculated endpoint cases (+25% and -10%) and fail-closed contract cases.

The private report/workspace integration remains pending CI validation. No schema or financial-data changes were made.
