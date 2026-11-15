# IPM-05 — Investment Statement Reconciliation

**Status:** Implemented and verified on PR #455; CI #2001, Secret Scan #1795 and dashboard packaging #1237 passed on 2026-11-15  
**Decision date:** 2026-11-15  
**Scope:** Broker transaction statements and holdings/position statements (Option B)

## Decision

PFO supports two independent forms of external statement evidence:

1. **Transaction statements** — source rows are reconciled against existing immutable investment transactions.
2. **Holdings statements** — source quantities are reconciled against the existing FIFO-projected positions at the statement's explicit as-of timestamp.

Both are account-scoped, currency-specific, source-attributed, immutable evidence. They are imported in a normalized PFO JSON contract. Broker-specific CSV or PDF formats require an explicit mapping step; the application must not guess column semantics or silently normalize ambiguous source data.

Statement evidence is not an accounting event and does not create, update, reverse or delete investment ledger transactions.

## Evidence contract

Each evidence document contains:

- Stable unique ID.
- Kind: transactions or holdings.
- Existing accountId and matching account currency.
- Exact canonical UTC periodStart, periodEnd, statementAsOf and recordedAt.
- Non-empty sourceName, optional statementReference.
- At least one source row with a stable sourceRowId.

Transaction rows contain effectiveAt, existing instrumentId, canonical transaction type, currency-qualified cashAmount, optional externalReference, and trade quantity/unitPrice for Purchase and Sale. Existing ledger arithmetic/sign rules are applied. Every row must fall within the statement period.

Holdings rows contain an existing instrumentId and a finite non-negative quantity. A statement may contain only one row per instrument/account. Market value and reported cost basis are deliberately not used in this first contract: valuation provenance and cost-basis methodology need separate matching decisions.

## Transaction matching rules

Matching is deterministic and deliberately conservative:

1. When a source row supplies an external reference, only an exact account-scoped ledger external-reference match is eligible.
2. Without an external reference, matching requires exact account, instrument, transaction type and effective timestamp.
3. If multiple candidates remain, a unique exact amount/quantity/unit-price match may disambiguate; otherwise the row is ambiguous.
4. A candidate whose instrument, type, timestamp, amount, quantity or unit price differs is a mismatch.
5. Source rows without candidates are unmatched-statement; ledger transactions in the statement period without a selected source match are unmatched-ledger.
6. Repeated external references inside one statement are duplicate-statement.

Amount and unit-price comparison tolerance is 0.01 in the statement currency; quantity comparison tolerance is 1e-8. These are comparison tolerances only, not accounting rounding rules. A report is reconciled only when all rows match. Ambiguous, duplicate and unmatched rows make it incomplete; numeric differences make it difference.

## Holdings matching rules

The existing FIFO portfolio projection is run at statementAsOf and the requested recorded-at cutoff. Open positions are compared by account and instrument ID:

- Equal quantities within 1e-8 are matched.
- Different quantities are quantity-mismatch.
- A statement-only positive quantity is unmatched-statement.
- A ledger open position absent from the statement is unmatched-ledger.
- An explicit zero quantity is accepted as a source assertion; no absent holding is inferred from a missing row.

Only quantities are compared. No prices, market values, tax lots, cost basis or FX conversions are invented.

## Bitemporal and audit behavior

- Statement recordedAt controls whether the evidence was known at the selected cutoff.
- Ledger transaction recordedAt controls whether a transaction was known at that same cutoff.
- Transaction date and statement periodStart/periodEnd control the effective-time window.
- Holdings use the existing FIFO projection with both statementAsOf and recordedAtCutoff.
- Evidence documents and source-row IDs are preserved as imported. A later correction is a separately imported evidence document with a new ID; existing evidence is not rewritten.

## Persistence and compatibility

- New browser-local collection: investmentStatementEvidence.
- SQLite workspace schema v13 adds the twentieth collection.
- Transactional v12→v13 migration writes a protected exact pre-v13 JSON recovery artifact before changing the schema. Existing workspaces receive an empty evidence collection; no broker history is fabricated.
- Full JSON backup schema v13 includes statement evidence. Schema v1–v12 backups remain importable; when an older backup omits evidence, current evidence is preserved only if its account/instrument references remain valid against the target ledger.
- SQLite save, restore, online backup and integrity validation include the new collection.

## Privacy and reporting

Evidence import, reconciliation and CSV report export are private-workspace-only. Reports are local, spreadsheet-safe and invalidated when ledger/evidence changes. Source text is rendered as text, not HTML. Original broker statements remain the user's source documents and should be retained separately.

## Explicit exclusions

This increment does not implement broker API connections, direct PDF extraction, automatic broker CSV column detection, settlement/cash reconciliation, cost-basis reconciliation, tax-lot reconciliation, corporate actions, in-kind transfers, FX, market prices, auto-correction, investment recommendations or trade execution. Each requires a separate approved data/accounting contract.

## Acceptance

- Contract validation rejects unknown accounts/instruments, mixed currencies, duplicate IDs, invalid periods, malformed transaction arithmetic and duplicate holdings instruments.
- Transaction reconciliation covers exact references, exact fallback matching, amount/quantity mismatch, unmatched rows, ambiguous candidates, duplicates and recorded-at cutoff.
- Holdings reconciliation compares FIFO quantities and reports missing/mismatched positions.
- No test or runtime path mutates the investment ledger as a side effect of reconciliation.
- Browser workflow is private-only; full JSON and SQLite backup/restore preserve evidence; schema migration is transactional and recoverable.
