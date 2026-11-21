# IPM-08 — Backtesting Contract and Acceptance Scenarios

- **Status:** Proposed acceptance contract; dataset contracts/validation and offline CSV ingestion are implemented, but no simulation engine is implemented.
- **Date:** 2026-11-21
- **Approved first-release scope:** NSE-focused daily OHLCV. BSE and intraday intervals are deferred. Provider, instrument segment/universe, adjustment basis, calendar source and execution/cost assumptions remain unapproved until separately reviewed.
- **Related ADR:** `ADR-IPM-08-BACKTESTING-ARCHITECTURE.md`
- **Test data policy:** all fixtures must be synthetic and clearly labeled. Never use fabricated fixtures as evidence of live-market behavior.

## A. Initial release scope and historical dataset validation

The first implementation slice accepts NSE daily OHLCV datasets only. A dataset must identify its exchange and interval explicitly; an NSE dataset with a non-daily interval, or a non-NSE dataset in the first-release workflow, must be rejected as out of scope rather than silently coerced. The underlying contracts remain exchange- and interval-aware so BSE and intraday can be added through later, separately accepted increments. This scope decision does not authorize any particular provider or instrument universe.


| ID | Scenario | Required outcome |
|---|---|---|
| DATA-001 | Valid, single-instrument OHLCV dataset with explicit source digest, currency, timezone, interval, adjustment basis and coverage | Dataset validates and retains exact provenance/version. |
| DATA-002 | Duplicate instrument + interval + bar-start identity | Reject; do not choose first/last silently. |
| DATA-003 | Non-finite, zero or negative OHLC price | Reject. |
| DATA-004 | High below open/close, low above open/close, or high below low | Reject impossible OHLC relationships. |
| DATA-005 | Negative or non-finite volume | Reject. |
| DATA-006 | Mixed currencies, intervals, timezones or adjustment bases in one dataset | Reject; require separate normalized datasets. |
| DATA-007 | Bar end precedes start, non-canonical timestamp or out-of-coverage observation | Reject. |
| DATA-008 | Missing availability timestamp | Retain only as non-point-in-time evidence; prohibit a point-in-time-safe run. Never substitute bar end, published date or retrieval time. |
| DATA-009 | Source claims point-in-time guarantee for a different knowledge-time cutoff | Reject point-in-time eligibility. |
| DATA-010 | Source license status is unreviewed/restricted | Block execution until rights and permitted use are reviewed. |
| DATA-011 | Expected calendar contains a session with no eligible bar | Mark run incomplete/unavailable; do not synthesize or carry forward a bar. |
| DATA-012 | CSV import identifies an exchange other than NSE or an interval other than `1d` | Reject as outside the approved first-release scope; do not coerce or relabel. |

## B. Bitemporal and look-ahead controls

| ID | Scenario | Required outcome |
|---|---|---|
| TIME-001 | A bar's market interval is historical but its availability time is after a strategy decision | The bar is not visible to that decision. |
| TIME-002 | A historical bar was imported/recorded after the run's recorded-at cutoff | Exclude it from that historical knowledge state. |
| TIME-003 | A fundamental has a fiscal period end before the decision but was published after it | Exclude it until publication/availability time. |
| TIME-004 | A later revision to an earlier fundamental is recorded after the cutoff | Preserve revision history; earlier run cannot see it. |
| TIME-005 | Strategy callback attempts to inspect future observations | Strategy context must not contain future bars; test harness proves only the eligible prefix is supplied. |
| TIME-006 | Signal is produced at a bar close | Earliest proposed fill is the next eligible bar open; same-bar close fill is prohibited. |

## C. Universe and survivorship

| ID | Scenario | Required outcome |
|---|---|---|
| UNI-001 | Instrument was not yet listed/effective at the decision timestamp | Exclude it. |
| UNI-002 | Membership was effective but not yet available/recorded by the decision cutoff | Exclude it from a point-in-time run. |
| UNI-003 | Instrument later delists and historical membership records preserve the delisting | Retain its historical membership/position history through the correct effective boundary. |
| UNI-004 | Only today's surviving universe is supplied | Permit only an explicitly disclosed exploratory run; never label it survivorship-bias-free. |
| UNI-005 | Membership revisions are bitemporal and a later correction arrives after the cutoff | Earlier run must retain the originally knowable membership. |

## D. Execution, liquidity and costs

The following numeric example is an acceptance fixture, not a market-data claim or a recommended trading rule.

**Synthetic fixture:**
- Initial virtual cash: INR 1,000.
- Strategy signal: buy one share after synthetic Day 1 close of INR 105.
- Synthetic Day 2 open: INR 110; synthetic Day 2 close: INR 115.
- Explicit slippage: 0 basis points.
- Explicit fixed cost: INR 2 per filled order.
- Synthetic Day 3 close: INR 100; strategy emits a sell signal.
- Synthetic Day 4 open: INR 95.
- Explicit sell-order fixed cost: INR 2.

**Expected event sequence:**
1. No fill on Day 1. The signal is only known after Day 1 closes.
2. Buy one share at Day 2 open for INR 110; deduct INR 2 cost. Virtual cash becomes INR 888; one share is held.
3. At Day 2 close, portfolio value is INR 888 + INR 115 = INR 1,003.
4. Sell signal is emitted after Day 3 close; no Day 3 same-bar fill.
5. Sell one share at Day 4 open for INR 95; deduct INR 2 cost. Final cash is INR 888 + INR 95 - INR 2 = INR 981; position is zero.
6. Final P&L is INR -19 and return on initial capital is -1.9%.

| ID | Scenario | Required outcome |
|---|---|---|
| EXEC-001 | Synthetic sequence above | Exact event ordering, cash, position, fees and final value match the hand-calculated expectations. |
| EXEC-002 | No next eligible bar after signal | Order remains unfilled/expired according to the explicit policy; never fill on the signal bar. |
| EXEC-003 | Missing volume when participation cap is enabled | Reject or mark unavailable according to explicit policy; never assume unlimited liquidity. |
| EXEC-004 | Order exceeds explicit volume participation cap | Apply the selected partial-fill/reject policy and record unfilled quantity. |
| EXEC-005 | Slippage/cost assumptions omitted | Reject run configuration; no implicit zero-cost assumption. |
| EXEC-006 | Cost model returns a different currency | Reject fill; no FX conversion. |
| EXEC-007 | Cost model returns negative or non-finite cost | Reject the cost result and fail the affected run. |
| EXEC-008 | Same run is repeated with identical dataset, strategy, engine and assumption versions | Produce identical orders, fills, cash, positions and metrics. |
| EXEC-009 | Run configuration selects a non-NSE dataset/calendar or non-daily interval | Reject; first-release execution accepts NSE daily data only. |

## E. Corporate actions and adjustment basis

| ID | Scenario | Required outcome |
|---|---|---|
| CORP-001 | Dataset contains mixed adjustment bases | Reject. |
| CORP-002 | Total-return-adjusted prices are supplied as executable fill prices | Reject until a separately approved interpretation exists. |
| CORP-003 | Unadjusted bars cross a split/dividend/other corporate action without complete eligible event evidence | Mark affected run unavailable. |
| CORP-004 | Corporate action is known only after its effective date | Do not expose it to earlier decisions; preserve point-in-time knowledge. |
| CORP-005 | Same action is represented in adjusted prices and separately applied as an event | Reject double counting. |
| CORP-006 | Rights, merger, spin-off, delisting or return-of-capital semantics are unsupported/ambiguous | Fail closed; do not approximate as a trade, fee, tax or cash movement. |

## F. Portfolio accounting and metric integrity

| ID | Scenario | Required outcome |
|---|---|---|
| ACCT-001 | Fill is committed | Cash and position quantity reconcile exactly to the fill and its costs. |
| ACCT-002 | Buy order exceeds available virtual cash after costs | Reject or partially fill only under the explicit policy; cash cannot become negative by accident. |
| ACCT-003 | Sell order exceeds available simulated position | Reject excess quantity; no implicit short position. |
| ACCT-004 | Dataset, initial capital, instrument or cost model currencies differ | Reject; no FX. |
| ACCT-005 | Daily portfolio values contain missing expected observations | No fabricated NAV; affected drawdown is unavailable using existing drawdown contract rules. |
| ACCT-006 | Backtest return/drawdown metrics are calculated | Reuse existing deterministic calculators where definitions fit; disclose metric assumptions and unavailable reasons. |
| ACCT-007 | Benchmark is used | Benchmark currency, interval, adjustment basis, availability cutoff and coverage are compatible and disclosed. |

## G. Isolation, persistence and security

| ID | Scenario | Required outcome |
|---|---|---|
| ISO-001 | Backtest creates a simulated buy/sell/fill | No real investment transaction, cash movement, valuation, FIFO lot or statement-evidence collection changes. |
| ISO-002 | Backtest is reset/deleted | Only paper/backtest domain records are affected. |
| ISO-003 | Run is persisted in a future increment | Persist exact input digests, strategy/engine/cost/calendar versions, assumptions, warnings and generated event history. |
| ISO-004 | Input data or strategy changes after a run | Existing run remains immutable and points to its original versions/digests. |
| ISO-005 | Provider or strategy adapter attempts network access by default | No outbound request; any future provider must be explicitly injected and reviewed. |

## Acceptance exit criteria for IPM-08.1

- ADR is reviewed and decisions required for the first engine slice are resolved.
- Dataset, universe, calendar, strategy, execution, cost and run contracts have strict validation.
- Each scenario above is represented by a deterministic test or explicitly marked blocked pending an approved contract.
- The numeric execution fixture matches independent hand calculation.
- No provider SDK/API, live data, database migration, broker integration or real-ledger mutation is introduced.

 
## H. Offline OHLCV CSV ingestion

| ID | Scenario | Required outcome |
|---|---|---|
| CSV-001 | Canonical version-1 manifest and exact header sequence | Import rows and bind only caller-supplied instrument/source/coverage metadata. |
| CSV-002 | UTF-8 BOM, LF or CRLF line endings | Parse valid rows; raw artifact digest differs when source bytes differ. |
| CSV-003 | Equivalent rows with different line endings | Normalized dataset digest remains identical. |
| CSV-004 | Missing volume, provider ID or availability | Preserve each as absent; never substitute a value. |
| CSV-005 | Source claims per-observation point-in-time evidence but a bar lacks availability | Reject the dataset. |
| CSV-006 | Malformed quoting, wrong manifest/version/header, duplicate headers or wrong row width | Reject the file before returning a dataset. |
| CSV-007 | Invalid decimal, non-canonical timestamp, non-positive/impossible OHLC, duplicate or unsorted bars | Reject; do not coerce, sort, interpolate or deduplicate. |
| CSV-008 | Caller declares complete coverage but one expected bar is absent | Reject; never synthesize a missing bar. |
| CSV-009 | Source license is unreviewed/restricted | Allow evidence import for inspection only; validated run configuration remains blocked. |
| CSV-010 | Same semantic dataset is imported from byte-different but equivalent CSV formatting | Preserve distinct raw source digests and identical normalized content digest. |
| CSV-011 | CSV metadata identifies BSE or an intraday/weekly/monthly interval | Reject; first-release CSV import accepts NSE and daily (`1d`) only. |

The CSV importer is offline and non-persistent. Storage, backup/restore, import UI and simulator execution require separate approved contracts.
