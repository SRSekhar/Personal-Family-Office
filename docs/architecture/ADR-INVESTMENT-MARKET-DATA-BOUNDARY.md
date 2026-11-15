# ADR — Investment market-data provider boundary

- Status: Accepted — provider-neutral ports only; provider selection and integration are deferred
- Date: 2026-11-15
- Scope: typed identity, quote, historical-bar, fundamentals and corporate-action capabilities
- Related: `.ai/BACKLOG.md` — IPM-06

## Context verified in the repository

The current investment instrument contract contains a local instrument ID, name, type, currency and optional symbol, exchange and ISIN. Investment valuations are append-only observations with instrument ID, currency-qualified price, effective timestamp, recorded-at timestamp, source type and source name. Manual valuation entry is available in the private workspace and explicitly states that no market price is fetched or inferred.

The FIFO portfolio projection consumes only saved valuation observations selected by effective and recorded-at cutoffs. It performs no market-data lookup. This boundary must remain intact: provider data cannot mutate transactions, positions, valuations, cash movements or corporate-action accounting.

No provider has been selected. No provider API documentation, authentication contract, commercial terms, redistribution rights or data-license terms have been reviewed. Therefore this ADR does not authorize an API adapter, SDK, endpoint, credential flow or outbound request.

## Decision

Create a provider-neutral TypeScript package, `@pfo/market-data`, containing ports and normalized observation contracts only. Provider capabilities are independent and optional:

1. Instrument identity resolution.
2. Current quote.
3. Historical OHLC bars.
4. Fundamentals.
5. Corporate actions.

A provider may implement any subset, but must declare exactly the capabilities it implements. Identity resolution returns candidate matches; it never silently changes a PFO instrument's symbol, exchange, ISIN or provider mapping.

Every result discloses provider identity/version, documentation and terms, license name, attribution text, retrieval timestamp, market timezone, delay, freshness, coverage and point-in-time guarantee. Historical requests specify an explicit knowledge-time cutoff. A result is suitable for point-in-time analysis only when its metadata explicitly guarantees that exact cutoff; otherwise it must be treated as unsuitable for that analysis.

Historical bars explicitly identify their interval and adjustment basis. Fundamentals carry metric ID, unit, currency where applicable, fiscal period end and publication time where supplied. Corporate actions are normalized observations only. This package does not apply splits, dividends, mergers or other actions to ledger events, holdings, prices or tax lots.

## Execution and privacy boundary

- Provider construction and invocation are explicit. There is no registered default provider and no network call during app startup, import, build or test.
- A host must explicitly supply an execution policy. The policy validator bounds timeout, attempts, retry delay, cache TTL and cache entry count.
- Only classified transient provider errors may be retried. Authorization, validation and unsupported-capability errors are not retried.
- The optional cache is in-memory, bounded and TTL-based. No market data or credentials are persisted by this package.
- Cancellation is propagated with `AbortSignal`. Errors crossing the boundary are normalized to fixed safe messages; raw provider response bodies, tokens and URLs are not surfaced.
- Credentials, if a future provider requires them, must be held in local secret storage and must never be placed in browser bundles, repository files, logs or workspace backups.
- Manual price entry remains available and remains the only active valuation acquisition workflow until a provider is separately approved and integrated.

## Explicit non-goals

No provider adapter, SDK, API endpoint, OAuth flow, API key storage, scheduled polling, automatic refresh, database collection, JSON backup field, valuation auto-import, market-data UI, benchmark, recommendation, trading or corporate-action ledger posting is included.

No data-provider licensing, real-time entitlement, exchange coverage, redistribution or retention assumption is made by these contracts.

## Required gates before any provider implementation

Before implementing a named provider, record and review:

1. Exact official API documentation and version for each selected capability.
2. Authentication flow, required scopes, credential storage and revocation.
3. Provider terms, data license, exchange entitlements, attribution, redistribution and retention restrictions.
4. Supported instruments, identifiers, exchanges, currencies, market timezone and session conventions.
5. Quote delay, historical coverage, bar intervals, adjustment methodology, fundamentals definitions and corporate-action semantics.
6. Point-in-time/revision guarantees and treatment of corrections, delisted securities and survivorship.
7. Rate limits, timeout/retry guidance, caching/retention limits, costs and failure behavior.

If any required contract is unavailable or ambiguous, do not implement that capability. No fake endpoints, payloads or provider-specific models are permitted.

## Delivery slices

- IPM-06.1 — Define normalized contracts for all five independent capabilities, provenance, licensing, freshness, coverage, adjustment and point-in-time metadata.
- IPM-06.2 — Add capability-specific ports and conformance validation; synthetic fixtures verify contract behavior without network access.
- IPM-06.3 — Add explicit bounded execution policy, transient-only retry, timeout, cancellation, bounded in-memory TTL cache and sanitized errors.

The three slices establish an integration boundary, not a production data feed. A provider-specific implementation remains gated on the review above.
