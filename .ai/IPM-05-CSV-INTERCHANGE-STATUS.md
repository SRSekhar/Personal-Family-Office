# IPM-05 — Investment CSV interchange status

Updated: 2026-11-01

## Delivery status

- Branch: `feature/investment-ledger-csv-interchange`
- Pull request: [#432](https://github.com/SRSekhar/Personal-Family-Office/pull/432), draft/open/unmerged.
- Base: `feature/investment-cash-ledger-ui` (PR #430).
- Required dependency order: #425 → #426 → #427 → #428 → #429 → #430 → #432.
- Latest fully verified feature head: `4389b2ad109f50d98474b97fc73980241b699469`.

## Implemented

PFO-native, versioned CSV import/export covers all eight investment and cash-ledger collections:

1. `investmentAccounts`
2. `investmentInstruments`
3. `investmentTransactions`
4. `investmentValuations`
5. `investmentCashAccounts`
6. `investmentCashMovements`
7. `investmentCashTransfers`
8. `investmentCashStatements`

The format preserves stable IDs, canonical timestamps and nested money values. Human-readable text remains readable; formula-like and reserved-prefix strings use reversible safe-text encoding. Parsing validates manifest/version, exact columns, quoting, row widths, JSON, finite numbers and field types. Candidate imports are validated against the complete investment/cash workspace before preview.

The private-workspace UI supports per-collection export, multi-file preview, append or replace-selected-collections, explicit confirmation and cancellation. Demo mode is excluded. Files larger than 10 MiB are rejected before reading. Invalid rows block the whole batch; row-level diagnostics include file, collection, logical row, field, message and original row data, with a downloadable spreadsheet-safe error report.

Browser-storage writes attempt rollback of all investment/cash keys if a multi-collection commit fails. Workspace events fire only after successful browser-storage writes. SQLite autosave remains optional/debounced and is a separate persistence operation. JSON full-workspace backup remains the authoritative lossless backup format.

## Verification on feature head

Verified commit: `4389b2ad109f50d98474b97fc73980241b699469`

- CI run **1410**: passed; 80 test files and 715 tests, repository checks, dependency audit, lint, typecheck, build, Chromium installation and real-browser smoke.
- Secret Scan run **1202**: passed, scanning current changes and full Git history.
- Dashboard packaging run **740**: passed; Pages publishing was skipped as expected for a pull request.
- Chromium smoke covers CSV export/import, row-error report download and confirmation blocking, append/replace revalidation, reload/export/re-import equality, browser-storage rollback, oversized-file rejection, multi-tab stale-write protection, transient SQLite 503 failure and subsequent autosave recovery, startup recovery pause, and absence of uncaught browser errors.
- SQLite transaction tests verify a failed database update preserves the previous committed snapshot. Browser-local data remains available after an API failure; a later edit triggers a save containing both edits.

Transient autosave failures now receive bounded automatic retries: HTTP 408, 429, 5xx and network `TypeError` failures retry after 1, 2 and 4 seconds (three retries after the initial attempt). Validation errors, ordinary 4xx responses and 409 write conflicts are not retried. After exhaustion, the UI pauses automatic retries but retains browser-local data; a later edit starts a fresh retry window. An explicit manual save cancels a pending retry.

These tests do **not** establish one atomic transaction spanning browser localStorage and SQLite. Retry success is verified independently from browser-local storage; the database save remains a separate persistence operation.

## Remaining scope / acceptance boundary

- Provider-specific external CSV mappings are **not implemented**. Exact redacted provider exports and user-confirmed field, transaction-type and sign conventions are required. Do not infer broker schemas or financial events from the provider name.
- Until mappings exist, unsupported external layouts must be rejected rather than guessed.
- No broker API synchronization, FX conversion, transaction classification inference, automatic opening-balance creation or automatic settlement linking is included.
- No cross-store atomicity is claimed. SQLite persistence and browser storage remain separate systems.
- Google Sheets or other remote sync is not part of this increment; local-first SQLite and JSON backup remain the current storage approach.

## Next action

Continue independent backlog work that does not require provider samples. When external mapping is resumed, obtain redacted source CSV samples first and confirm transaction/sign semantics before implementing a provider adapter.

Do not merge PR #432 or any dependency PR without explicit approval of the complete stacked merge sequence.
