# @pfo/backtesting

Point-in-time backtesting domain contracts and validation for PFO OS.

This package currently defines validated historical datasets, bitemporal universe membership, explicit trading calendars, strategy/version descriptors, execution and cost assumptions, and run-configuration checks. It does not contain a simulation engine.

Historical observations must retain source provenance, licensing status, content digests, availability timestamps and local recorded-at timestamps. Point-in-time eligibility is never inferred from a bar's market timestamp or retrieval time.

No provider SDK, endpoint, credential, network client, market-data download, broker integration, database persistence or live order routing is included. A host must supply all datasets and assumptions explicitly.

Backtesting records and any future paper portfolio must remain separate from real investment transactions, cash, valuations, FIFO lots and statement evidence.
