# IPM-05 — Investment CSV interchange status

Updated: 2026-11-01

## Current implementation

- Branch: `feature/investment-ledger-csv-interchange`
- Pull request: [#432](https://github.com/SRSekhar/Personal-Family-Office/pull/432), draft and unmerged.
- Latest verified feature head: `7c456e075b1fa3c1bb3d8e564413c0d86c147a8d`.
- PR #432 is stacked on PR #430. Preserve dependency order #425 → #426 → #427 → #428 → #429 → #430 → #432. No merge is authorized.

The PFO-native CSV interchange covers all eight investment and cash collections:

1. `investmentAccounts`
2. `investmentInstruments`
3. `investmentTransactions`
4. `investmentValuations`
5. `investmentCashAccounts`
6. `investmentCashMovements`
7. `investmentCashTransfers`
8. `investmentCashStatements`

The format is versioned and collection-specific. It preserves IDs, timestamps and exact nested money JSON. Ordinary text remains human-readable; formula-like and reserved-prefix text uses reversible UTF-8/base64 safe-text encoding. Import validates the manifest, canonical columns, quoting, row widths, field types, JSON, finite numbers and the complete proposed workspace before preview.

The private-workspace UI supports per-collection export, multi-file import preview, replace-only-selected-collections or append, explicit confirmation and cancellation. Demo mode is excluded. Files larger than 10 MiB are rejected before reading. A failed multi-collection browser-storage write attempts to restore all eight investment/cash storage values; real Chromium smoke verifies byte-for-byte restoration after a simulated quota failure. Workspace persistence events are dispatched only after browser-storage commit succeeds.

JSON full-workspace backup remains the authoritative lossless backup. CSV browser-storage writes trigger the configured optional/debounced SQLite autosave path; this is not a single atomic transaction spanning localStorage and SQLite.

## Verified CI on latest feature head

Commit: `a1a7fc784d286be06432544311991eb2e6460e1e`

- CI run `41312197836` (run 1392): passed repository checks, dependency audit, lint, typecheck, package build, full Vitest suite, Chromium installation and real-browser smoke.
- Dashboard packaging run `41312197970` (run 722): passed. Pages publishing was skipped as expected for a pull request.
- The browser smoke includes CSV export, row-level error report download and confirmation blocking, preview, confirmed replace, append duplicate rejection, reload/export-reimport equality, mid-batch storage quota rollback and oversized-file rejection with no data mutation.

The PFO-native CSV increment is CI-green on this head. It does not close the full acceptance criteria of issue #431 because external-provider mapping and further SQLite autosave failure/consistency acceptance remain open.

## Remaining acceptance work

- Explicit external-provider column mapping, only after exact redacted source CSV samples and user-confirmed field/transaction/sign conventions are available.
- External-provider row mapping is still blocked pending exact redacted provider CSV samples and user-confirmed transaction/sign conventions.
- Further SQLite autosave failure/consistency tests and clear recovery behavior. Do not describe localStorage plus SQLite as cross-store atomic.
- Confirm Secret Scan and any remaining SQLite autosave failure/consistency acceptance before marking issue #431 complete.

## Explicit safety boundaries

- Do not infer transaction types, signs, opening balances, cash links, settlement associations, valuation prices, FX rates or missing values.
- Unsupported external formats must be rejected rather than guessed.
- No broker API sync, FX conversion, autonomous trading or automatic settlement linking is included.
- Provider mappings are blocked until the user supplies actual redacted provider CSV samples. A broker name alone is not a schema.
- Keep PR #432 draft/open/unmerged until the user explicitly approves the full stacked merge sequence.


## Row-level diagnostics and SQLite failure recovery — verified

- Verified branch code head: `7c456e075b1fa3c1bb3d8e564413c0d86c147a8d`.
- Detailed row parsing records file, collection, logical CSV row, field, validation message and raw source cells. The private UI displays up to 100 diagnostics and offers the complete spreadsheet-safe `investment-csv-import-errors.csv` report.
- Any row-level error blocks the complete multi-file batch. Valid rows are not partially committed.
- Added SQLite transaction failure coverage: a SQLite trigger forces an update failure and the database test confirms the previous committed snapshot and timestamp remain unchanged after rollback.
- Added real Chromium coverage for a transient 503 during automatic SQLite persistence. It verifies the edit remains in browser localStorage, is absent from the database after the rejected write, and is included with the next edit when automatic persistence recovers.
- Latest CI run `41312944949` (run 1397) passed dependency audit, repository checks, lint, typecheck, package build, **80 test files / 715 tests**, Chromium installation and full real-browser smoke.
- Dashboard packaging run `41312944982` (run 727) passed packaging and artifact upload; Pages publishing was skipped as expected for a PR.
- The tests establish SQLite transaction rollback and retry/recovery behavior. They do **not** make browser localStorage and SQLite one atomic cross-store transaction.
- A separate Secret Scan workflow was not present in the PR-triggered workflow runs inspected; secret scanning is not independently verified here.

## Row-level diagnostics — verified

- Detailed row parsing records file, collection, logical CSV row, field, validation message and raw source cells.
- The downloadable error report is CSV-quoted and spreadsheet-safe. It retains raw row JSON for local troubleshooting.
- Any row-level error blocks the entire multi-file batch; there is no partial import of otherwise valid rows.
- Unit tests and real Chromium smoke cover error collection, report download and disabled confirmation.
- Verified code head: `a1a7fc784d286be06432544311991eb2e6460e1e`.
- CI run `41312944949` (1397) and dashboard packaging run `41312944982` (727) both passed. Pages publishing was skipped as expected for this PR.

## Remaining acceptance boundary

- External-provider column mapping is still blocked until actual redacted provider CSV samples and user-confirmed transaction/sign conventions are available. Do not infer broker schemas or financial events.
- No cross-store atomicity is claimed: browser localStorage writes and optional/debounced SQLite autosave remain separate persistence systems.
- No dedicated Secret Scan workflow appeared in the PR-triggered workflow runs inspected; independently verify secret scanning before final issue acceptance.
- PR #432 remains draft/open/unmerged. Preserve the dependency chain #425 → #426 → #427 → #428 → #429 → #430 → #432; do not merge without explicit approval.
