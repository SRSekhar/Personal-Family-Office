# ADR — Point-in-Time Backtesting Architecture

- **Status:** Proposed — architecture and acceptance-contract phase only; no simulation engine or provider integration is authorized by this ADR.
- **Date:** 2026-11-15
- **Workstream:** IPM-08
- **Depends on:** `@pfo/market-data`, investment ledger/FIFO projection, investment cash ledger/reconciliation, XIRR, flow-adjusted drawdown and statement evidence.
- **Related:** `ADR-INVESTMENT-MARKET-DATA-BOUNDARY.md`, `ADR-INVESTMENT-DRAWDOWN-METRIC.md`, `ADR_INVESTMENT_CASH_LEDGER_AND_XIRR.md`, `IPM-04-PERFORMANCE-ANALYTICS-DISCOVERY.md`.

## 1. Context verified in the repository

The following existing contracts are authoritative and must be reused rather than duplicated:

- `@pfo/market-data` defines independent instrument-identity, quote, historical-bar, fundamentals and corporate-action capability ports. A historical request carries an explicit `knownAtOrBefore` cutoff and adjustment basis. Provider result metadata includes provider/version, license, terms, attribution, retrieval time, market timezone, delay, freshness, coverage and a point-in-time guarantee.
- A `HistoricalBar` contains instrument/provider IDs, interval, start/end timestamps, OHLC, currency, optional volume, adjustment basis and market timezone. It does **not** currently carry per-observation availability or local recorded-at timestamps; a backtesting dataset must add those rather than infer them.
- Investment instruments have stable local IDs, type, currency and optional symbol/exchange/ISIN. The existing ledger records immutable purchase, sale, dividend, interest, fee and tax events with effective and recorded timestamps. Trade cash must reconcile to quantity × unit price; fees and taxes are separate events.
- The FIFO projection uses only transactions and valuations eligible at explicit effective and recorded-at cutoffs. It does not perform market-data lookups or FX conversion.
- Cash reconciliation requires an explicit opening balance/statement baseline; missing baselines or unlinked activity are incomplete, not zero.
- `calculateXirr` uses ACT/365 and bisection and rejects ambiguous multi-sign-change streams. `analyzeInvestmentDrawdownMath` requires explicit daily-close timestamps and paired pre/post external-flow valuations; it fails closed when expected observations are missing.
- Workspace persistence is currently schema v13 with 20 collections. Backtesting must not mutate those real-ledger collections.

No historical data provider, API, exchange entitlement, commercial data license, authentication method or point-in-time vendor guarantee has been approved.

## 2. Decision proposal

Create a separate `@pfo/backtesting` domain package. It will consume normalized historical data and existing deterministic calculators, but it will not be a new financial-ledger implementation.

The first deliverable is a validated, reproducible run contract. A later engine must be deterministic, chronological, explicit about assumptions, and isolated from real household financial records.

### 2.1 Historical dataset and observation contract

A backtesting dataset is an immutable, versioned evidence set. Its identity must include:

- Stable dataset ID and version.
- Local PFO instrument ID and provider instrument ID where applicable.
- Exchange, instrument currency, interval, market timezone and one declared price-adjustment basis.
- Source kind (provider, exchange, issuer, user-supplied or other), source name, source URL when available, license name/status, terms, attribution and retrieval timestamp.
- SHA-256 digest of the imported source artifact and a deterministic normalized-content digest.
- Explicit coverage start/end, expected observation schedule and coverage status.
- Point-in-time guarantee status and its exact knowledge-time cutoff, where guaranteed.

Each normalized bar must retain OHLC, volume when supplied, interval, start/end timestamps, currency, adjustment basis, market timezone, availability timestamp when evidenced, and local recorded-at timestamp. Availability is not the same as the market bar timestamp or the date the user imported a file. Unknown availability must remain unknown; it must never be set to bar close, publication date or retrieval time as a convenience.

Dataset validation must reject duplicate instrument/interval/bar identities, invalid timestamps, non-finite or non-positive OHLC, impossible OHLC relationships, negative volume, inconsistent currency/interval/timezone/adjustment basis, and observations outside declared coverage. Missing expected observations remain missing; no interpolation, carry-forward, zero-fill or synthetic bar generation.

A historical observation is eligible at decision time only if its availability timestamp is at or before that decision time and its recorded-at timestamp is at or before the run's recorded-at cutoff. Provider-level point-in-time guarantees must match the exact requested cutoff. A dataset without adequate availability/revision evidence may be retained for inspection, but cannot be described as point-in-time safe.

### 2.2 Universe membership and survivorship

A backtest must reference a versioned universe, not silently use today's surviving instruments as though they existed historically.

Universe membership is bitemporal:
- effective start/end timestamps describe when membership applied in the market;
- available-at and recorded-at timestamps describe when that membership was knowable to the system;
- source evidence identifies the origin of each inclusion, exclusion, listing, suspension or delisting fact.

A point-in-time run may include an instrument only when its membership evidence is effective and knowable at the simulated decision time. A current/static manually supplied universe can be used only as an explicitly labeled exploratory run with survivorship-bias disclosure; it cannot be called survivorship-bias-free.

### 2.3 Trading calendar and missing sessions

The engine must consume an explicit, versioned trading calendar for the exchange and interval. The calendar records expected bar boundaries and its own source/provenance, effective coverage and recorded-at time.

Do not derive sessions from weekdays, public holidays, exchange conventions, operating-system locale or a generic business-day library. Do not assume an absent bar means a holiday. If the expected calendar requires a bar and the dataset lacks an eligible observation, the affected run is incomplete/unavailable unless the user explicitly selects a separately reviewed missing-data policy. No default policy is approved here.

The existing drawdown calendar is a portfolio valuation calendar, not an exchange trading calendar; it must not be reused as if the two had identical semantics.

### 2.4 Strategy contract and information boundary

Every strategy must have:
- Stable strategy ID and semantic version.
- Immutable strategy implementation digest and parameter digest.
- Explicit parameter schema and values.
- Declared instrument/universe eligibility and supported bar intervals.
- Deterministic evaluation behavior for identical inputs.

The engine must call a strategy with an as-of context containing only observations that were both effective and available by the decision timestamp and permitted by the run's recorded-at cutoff. It must not pass the entire future dataset to a strategy callback. A signal calculated from a bar close cannot execute against that same bar's close unless a separately reviewed data/execution contract proves that the close was observable before the fill; the initial proposal is next-bar execution.

Fundamental observations, if a strategy later uses them, must be filtered by actual publication/availability time, not fiscal period end. Revised fundamentals must preserve the revision/recorded-at history. Technical indicators must be computed only from the eligible prefix of the series.

### 2.5 Proposed first execution model — requires explicit acceptance

For an initial daily-bar simulation, the proposed conservative model is:

- Evaluate signals only after an eligible bar is complete.
- Submit market-order intents after that signal.
- The earliest eligible fill is the next expected bar's open; never fill on the signal bar.
- Apply an explicit, versioned slippage assumption to the fill price.
- Require an explicit maximum volume-participation assumption. If volume is absent or insufficient, apply the explicitly selected reject/partial-fill policy; never assume unlimited liquidity or perfect fills.
- Every order and fill records signal time, submission time, fill time, reference bar, quantity, price, slippage and cost breakdown.
- Unsupported order types, missing next bars, out-of-session fills and unresolvable price/volume conditions fail closed.

This is a proposed model, not a claim about actual market execution. Intraday execution, limit/stop orders, order-book depth, price impact and queue priority are outside the first contract increment.

### 2.6 Costs, taxes and currency

Every run must supply a versioned deterministic cost-model descriptor and explicit assumptions. Each fill records a componentized cost breakdown in the run currency.

- No hardcoded brokerage, STT, GST, stamp duty, exchange charge, tax rate or broker schedule.
- No assumed zero costs unless the run explicitly supplies and labels that assumption.
- The cost model is a deterministic port supplied by the host; it cannot make network calls.
- Initial scope is single-currency. Instrument, cash, cost, benchmark and initial-capital currencies must match. No FX conversion or inferred exchange rate.
- Tax-cost estimates are user-configured simulation assumptions, not tax calculations or tax advice.

### 2.7 Corporate actions and adjustment basis

The dataset must declare one adjustment basis. Unadjusted, split-adjusted and total-return-adjusted bars must never be mixed in one run.

The engine must not both consume adjusted prices and apply the same corporate action again. Total-return-adjusted prices cannot be treated as executable market prices without a separately approved interpretation. Unadjusted prices require complete, point-in-time corporate-action evidence and explicit event handling for any action affecting the run window. Unsupported or ambiguous actions (including rights, mergers, spin-offs, delistings and return-of-capital events) make the affected run unavailable; do not approximate them as trades, fees, taxes or cash movements.

The existing `CorporateActionObservation` is informational evidence only. It is not yet a complete backtesting accounting contract. Corporate-action event semantics remain a separate acceptance gate before engine implementation.

### 2.8 Simulated portfolio and accounting isolation

The backtesting portfolio is an isolated simulation:
- Virtual cash, positions, orders, fills, fees and event history are separate from real investment accounts, transactions, cash movements, FIFO lots, valuations, tax lots and statement evidence.
- No simulated event may be written into the live investment ledger.
- Cash and positions must reconcile at every event and valuation point.
- No negative cash, short position, fractional quantity or lot-size behavior may be assumed without an explicit strategy/instrument policy.
- No live broker connection, order routing or account credential is part of IPM-08.

### 2.9 Reproducibility and reporting

A run record must identify exact dataset IDs/versions/digests, universe version, strategy ID/version/code digest/parameter digest, engine version, calendar version, cost-model version, execution assumptions, currency, initial capital, date range, recorded-at cutoff and all warnings.

Metrics must reuse existing deterministic calculators when definitions fit. The report must disclose assumptions, data coverage, missing/rejected observations, execution limitations, cost totals and benchmark methodology. No opaque composite score, recommendation, buy/sell label or price target.

Backtest results are research/simulation evidence, not a forecast or a guarantee of future performance.

## 3. Proposed delivery boundaries

1. **IPM-08.1 — Architecture and contracts:** this ADR, typed contracts, validation and independent acceptance cases. No simulation engine.
2. **IPM-08.2 — Historical data import:** normalized CSV preview/validation and immutable source evidence. No provider adapter until a named provider is separately reviewed.
3. **IPM-08.3 — Deterministic engine:** chronological strategy evaluation, simulated orders/fills, costs and accounting, only after data/calendar/corporate-action contracts are accepted.
4. **IPM-08.4 — Analytics:** returns, drawdown, volatility and benchmark comparisons with explicit definitions and assumptions.
5. **IPM-08.5 — Walk-forward/out-of-sample:** reproducible rolling evaluation and parameter stability.
6. **IPM-08.6 — Paper portfolio:** a separate domain with virtual cash, positions, orders and reporting; no live broker integration.

## 4. Explicitly out of scope

- Selecting or connecting a market-data provider.
- Downloading historical market data or creating fake sample market facts.
- AI-generated strategy rules, AI financial calculations or automatic investment recommendations.
- Live trading, broker connectivity, real account mutations or household-data transmission.
- FX, multi-currency aggregation, margin, leverage, short selling, derivatives or fractional-share assumptions.
- Corporate-action posting to the real investment ledger.
- Automatic session calendars, missing-bar repair or survivorship-free claims without evidence.
- Persistent schema migration before a run-result persistence contract is separately reviewed.

## 5. Decisions still required before engine implementation

The following must be resolved by contract review and acceptance evidence, not guessed in code:

1. Initial instrument and exchange scope; whether the first release is NSE-only or supports other exchanges.
2. Supported intervals and whether daily bars are the only initial execution interval.
3. Eligible adjustment basis and corporate-action event coverage/semantics.
4. Trading-calendar source and how calendar revisions are captured.
5. Market-order fill timing, volume participation, partial-fill and unfilled-order behavior.
6. Cost-model input format and whether user-authored cost schedules are sufficient.
7. Instrument lot-size, tick-size, fractional-quantity and short-position policies.
8. Benchmark selection and risk-free-rate assumptions for any risk-adjusted metric.
9. Historical dataset retention, licensing evidence and privacy/storage requirements.

No engine, provider or persistent schema change should be implemented until the required decisions for its slice are accepted.
