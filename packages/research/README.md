# @pfo/research

Provider-neutral, evidence-grounded investment research orchestration and adversarial AI review.

## Delivery

- Specialist ports cover fundamentals, technicals, news/macro and portfolio-risk research. Hosts explicitly provide only the adapters they have implemented.
- Every factual claim must cite one or more supplied evidence IDs. Evidence requires a SHA-256 content digest, HTTPS source, publication/availability/retrieval timestamps and an explicit point-in-time guarantee flag.
- Evidence excerpts are untrusted input. Prompt envelopes label them as data, constrain specialist behavior and prohibit prompt-injection instructions, unsupported claims, invented citations, prices, targets, trades and recommendations.
- Bullish and bearish challenges run independently against the same findings and evidence. Their claim references are validated before a report can complete.
- Run requests capture as-of and recorded-at timestamps, domains, source evidence, prompt version and model/provider/adapter versions. The repository port supports idempotency and incremental save/resume.
- `FileResearchRunRepository` provides explicit-path, local JSON persistence with atomic replacement, restrictive file permissions, schema validation and a 10 MiB bound. The host must choose a private directory and provide its own backup/retention policy.

## Deliberate boundaries

No LLM provider, SDK, endpoint, API key, remote call, market-data provider, broker, scheduled research or dashboard workflow is selected or enabled. A host must explicitly inject specialist and model adapters and explicitly invoke the engine. No network call happens on import/build/test.

Research output is advisory and evidence-limited. It cannot create or modify ledger entries, valuations, price targets, cash movements, tax lots or orders. This package does not calculate financial ratios or technical indicators; specialists must use authoritative deterministic calculators and cite their source observations. No portfolio holdings or household financial records are transmitted by this package.

The local JSON repository is not encrypted. Use only a private local directory; do not commit run files. The engine intentionally has no default storage path.
