# @pfo/market-data

Provider-neutral ports and normalized contracts for optional market-data integrations.

This package does not include a provider SDK, credentials, endpoint, network client, or default provider. A host must explicitly construct and invoke a provider. Manual valuation entry in the dashboard remains the default offline workflow.

The capability ports are independent: instrument identity, quotes, historical bars, fundamentals, and corporate actions. Provider disclosures are mandatory and every observation carries source, licensing, market-timezone, delay, coverage, and point-in-time metadata.

The execution helper supplies bounded timeouts, transient-only retries, an in-memory TTL cache, cancellation, and sanitized errors. It does not persist credentials or cache data to disk.

Corporate-action observations are informational evidence only. They are not applied to prices, holdings, transactions, or tax lots.
