# @pfo/backtesting

Point-in-time backtesting domain contracts and validation for PFO OS.

This package defines validated historical datasets, bitemporal universe membership, explicit trading calendars, strategy/version descriptors, execution and cost assumptions, and run-configuration checks. It also provides a strict PFO-native OHLCV CSV importer that binds source rows to explicitly supplied instrument, provenance, coverage and knowledge-time metadata.

The CSV importer uses this exact file structure:

- Manifest row: #PFO-BACKTEST-DATASET,1,OHLCV
- Header row: startAt,endAt,open,high,low,close,volume,availableAt,recordedAt,providerInstrumentId
- Required row values: start/end UTC timestamps, OHLC prices and local recorded-at timestamp.
- Optional row values: volume, evidenced availability timestamp and provider instrument ID. Empty optional cells stay absent.
- Explicit import metadata: dataset ID/version, local instrument reference, interval, adjustment basis, market timezone, source/license metadata, dataset recorded-at timestamp, coverage window/status and expected bar-end schedule.

The CSV importer:
- Requires the #PFO-BACKTEST-DATASET,1,OHLCV manifest and canonical column order.
- Preserves source row order and rejects malformed rows, duplicate observations and invalid OHLC values.
- Computes SHA-256 digests for both the original CSV artifact and normalized dataset content. The normalized digest is stable across equivalent line-ending conventions.
- Retains unknown availability as unknown. It never substitutes bar close, retrieval time or import time.
- Requires the caller to supply explicit expected bar-end timestamps and coverage status. It never infers weekdays, exchange holidays or missing sessions.
- Does not fetch market data, persist files, create a universe/calendar, or execute a strategy.

Every historical observation must retain source provenance, licensing status, content digests, availability timestamps when evidenced and local recorded-at timestamps. A dataset with unreviewed/restricted licensing or insufficient point-in-time evidence may be imported for inspection but remains ineligible for a validated run.

No provider SDK, endpoint, credential, network client, market-data download, broker integration, database persistence or live order routing is included.

Backtesting records and any future paper portfolio must remain separate from real investment transactions, cash, valuations, FIFO lots and statement evidence.
