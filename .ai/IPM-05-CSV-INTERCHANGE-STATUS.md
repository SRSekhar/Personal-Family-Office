# IPM-05 — Investment CSV interchange status

Updated: 2026-11-01

## Current implementation

- Branch: `feature/investment-ledger-csv-interchange`
- Pull request: [#432](https://github.com/SRSekhar/Personal-Family-Office/pull/432), draft and unmerged.
- Latest verified feature head: `a1a7fc784d286be06432544311991eb2e6460e1e`.
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


## Row-level import diagnostics — implementation added, CI pending

- Current branch head: `ef1d0fd574613f42d7736781ebc42237dd6c0df2` at the time of this note; PR #432 remains draft/open/unmerged.
- The parser now exposes a detailed result containing accepted row records and row-level decoding errors (logical CSV row number, field, message and original cell values). The strict parser remains available and rejects a file containing any invalid rows.
- The private import UI displays up to 100 row diagnostics and offers a downloadable `investment-csv-import-errors.csv` report with file, collection, row, field, message and raw row JSON. Error text/file cells use the existing spreadsheet-safe text encoding.
- Any row-level error blocks the entire multi-file batch. Valid rows are not partially committed; the user must correct the source and retry. This preserves the all-or-nothing import policy.
- Unit coverage and a Chromium smoke scenario were added for malformed required cells, report download and confirmation blocking. These changes are **not yet verified by CI**; the latest verified CI remains run `41311246404` (1381) and dashboard packaging run `41311246326` (711) on prior head `8c9a37931ae3c4d3f562bc736b76437649147429`.
- The current head has no workflow run/status result visible yet. Do not claim the new report implementation passed until CI, Chromium smoke, Secret Scan and dashboard packaging are verified on the final head.


## Row-level diagnostics — verified

- Detailed row parsing records file, collection, logical CSV row, field, validation message and raw source cells.
- The downloadable error report is CSV-quoted and spreadsheet-safe. It retains raw row JSON for local troubleshooting.
- Any row-level error blocks the entire multi-file batch; there is no partial import of otherwise valid rows.
- Unit tests and real Chromium smoke cover error collection, report download and disabled confirmation.
- Verified on head `a1a7fc7841b90540db17fc2111c51de99b4b418c`? No — canonical head is `a1a7fc784d286be06432544311991eb2e6460e1e`.
- CI run `41312197836` (1392) and dashboard packaging run `41312197970` (722) both passed. Pages publishing was skipped as expected for this PR.
