# ADR — IPM-07 Evidence-grounded research and AI review

- Status: Implemented; final CI and Secret Scan validation pending
- Date: 2026-11-15
- Scope: provider-neutral investment research orchestration, evidence validation, adversarial review and local run persistence
- Related: `.ai/BACKLOG.md` — IPM-07; `@pfo/market-data`

## Context

PFO already has deterministic financial calculations and a provider-neutral market-data boundary. No LLM vendor, API, credentials, news feed or research-data license has been selected. Research must not bypass the investment ledger or create financial facts.

## Decision

Add `@pfo/research` as a provider-neutral orchestration package. Hosts explicitly inject specialist ports for fundamentals, technicals, news/macro and portfolio risk and a model port for structured challenges. The engine does not instantiate a provider or make network calls.

Every factual claim must cite supplied evidence IDs. Evidence records include HTTPS source, source kind, SHA-256 content digest, publication/availability/retrieval/knowledge-time metadata and a point-in-time guarantee flag. Research requests retain explicit as-of and recorded-at cutoffs and model/provider/adapter/prompt versions. Evidence that was not available at the as-of time is rejected. Excerpts are bounded and treated as untrusted data.

Bullish and bearish challenge calls are separate and receive the same evidence and specialist findings. Their structured outputs must reference known claim IDs. Missing evidence, stale evidence and missing point-in-time guarantees are surfaced. The contract intentionally has no price target, valuation, buy/sell recommendation, trade or order field. The final assessment is descriptive and evidence-limited.

A versioned local JSON repository is available only when the host supplies an explicit path. Writes use atomic replacement, restrictive file permissions, schema validation and a 10 MiB limit. Idempotency keys cannot be reused for a different request. Specialist findings are saved incrementally so a failed run can resume without rerunning completed specialist work. The host owns private directory selection, backups and retention. Files are not encrypted.

## Safety and privacy invariants

- No default provider, model, data source, endpoint, credential, scheduler or startup invocation.
- No household financial data, account balances or portfolio holdings are automatically transmitted.
- No writes to investment transactions, positions, cash, valuations, tax lots, price targets or orders.
- AI output is advisory only; deterministic financial calculations remain authoritative.
- Evidence excerpts are untrusted data and cannot override system instructions.
- Unsupported claims or references to unknown evidence/claim IDs fail validation.
- Synthetic fixtures only; no fabricated live market facts.

## Explicit non-goals

No vendor adapter, news crawler, web scraper, broker connection, market-data acquisition, automatic research scheduling, dashboard UI, remote persistence, encryption/key management, investment recommendation, valuation, forecast, backtest or trading functionality.

## Delivery slices

1. IPM-07.1 — specialist ports and provenance-rich research contracts.
2. IPM-07.2 — independent bull/bear challenge and evidence-grounded validation.
3. IPM-07.3 — reproducible local persistence, idempotency and resume.
