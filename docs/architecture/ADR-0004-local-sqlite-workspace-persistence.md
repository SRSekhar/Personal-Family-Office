# ADR-0004: Local SQLite workspace persistence

- **Status:** Accepted — local SQLite snapshot persistence, opt-in automatic saves, schema-v6 migration, and bounded transient retry are implemented on the current feature stack.
- **Decision date:** 2026-10-28
- **Last reviewed:** 2026-11-01

## Context

PFO OS began with private browser-local storage and portable JSON backup. A durable local database was needed without introducing cloud hosting, multi-user access, or a third-party native database dependency. The persistence boundary must preserve validated financial data, stable identifiers, historical records, and offline operation.

The workspace has since expanded beyond the original schema-v4 financial records/goals/cash-flow/budgets/history model. The current schema-v6 snapshot also includes investment and investment-cash ledger collections. Documentation and recovery procedures must describe the current schema, not the initial five-collection design.

## Decision

Use the built-in `node:sqlite` API from the repository's supported Node.js runtime. Persist one complete, validated schema-v6 workspace snapshot in a single SQLite row and write it inside one transaction. The 13 collections are:
1. Financial records
2. Goals
3. Cash-flow entries
4. Budgets
5. Historical snapshots
6. Investment accounts
7. Investment instruments
8. Investment transactions
9. Investment valuations
10. Investment cash accounts
11. Investment cash movements
12. Investment cash transfers
13. Investment cash statements

The server validates the complete schema-v6 payload before persistence. It enforces INR workspace currency, record ID integrity, domain backup validation, a 10 MiB serialized payload limit, and optimistic concurrency using the expected prior `updatedAt` value. A stale write returns a conflict rather than overwriting a newer snapshot.

The local preview server exposes JSON endpoints for database status, workspace read, and workspace write. It binds to loopback, rejects non-loopback hosts and cross-origin requests, does not enable CORS, limits request bodies to 10 MiB, and returns sanitized server errors.

The default database path is outside the repository:
- Windows: `%LOCALAPPDATA%\\PFO-OS\\pfo-os.sqlite`
- Linux/macOS: `~/.local/share/PFO-OS/pfo-os.sqlite`

`PFO_DATABASE_PATH` overrides the default. SQLite files and journal/sidecar files are ignored by Git. On POSIX systems, the database and existing WAL/SHM/journal files are restricted to mode 0600; the containing directory is created with restrictive permissions.

SQLite uses WAL journaling, `synchronous=FULL`, and a 5-second busy timeout. The implementation performs transactional v4→v5 and v5→v6 migrations. Before each populated migration, it writes a versioned JSON recovery artifact using exclusive file creation, fsync, and restrictive permissions. The v5→v6 migration adds empty cash-ledger collections; it does not infer cash accounts, opening balances, movements, or external flows.

The dashboard provides explicit save and restore actions plus opt-in automatic SQLite saves. Automatic mode is enabled only after a successful initial save. Subsequent workspace changes schedule a debounced full-workspace snapshot, and writes are serialized. Transient HTTP 408/429/5xx and network failures retry with bounded 1s/2s/4s delays (three retries after the initial attempt). Validation/client errors and 409 stale-write conflicts are not retried. Retry exhaustion pauses automatic retry without discarding browser-local data; a later edit starts a fresh retry window. Explicit manual save supersedes a pending retry.

Browser-local storage remains the immediate working/recovery copy. SQLite persistence is separate and asynchronous: a browser-local change and its SQLite snapshot are not one atomic transaction. The portable, versioned full-workspace JSON export/import remains the provider-independent recovery mechanism and includes all 13 collections. CSV is an interchange format, not a replacement for JSON backup.

## Consequences

### Benefits
- Durable local persistence across browser restarts, provided the database file is retained.
- A single SQLite transaction covers all 13 workspace collections.
- Stable IDs and historical ledger records are retained.
- No cloud account, remote service, or third-party database dependency is required.
- Existing offline browser storage and portable JSON backup remain available.
- Optimistic concurrency prevents a stale browser tab from silently overwriting a newer database snapshot.

### Trade-offs and limitations
- Automatic saves are opt-in and debounced, not synchronous with every browser-local write.
- Bounded retries improve transient recovery but cannot guarantee persistence during a prolonged outage; after exhaustion, a later edit or explicit save is required.
- Browser localStorage and SQLite are separate persistence systems. No cross-store atomicity is claimed.
- SQLite and portable JSON exports are not encrypted by this feature. Filesystem/device protection and independent backups remain the user's responsibility.
- WAL sidecar state can be relevant while the database is live. The application currently recommends portable JSON export rather than manual live-file copying; an online SQLite backup/checkpoint workflow is not implemented.
- This is a single-user local database API, not a remote, multi-user, or production-hosted database service.
- The Node.js `node:sqlite` API's runtime support must be checked against the repository's pinned Node version and CI matrix.

## Validation and operational status

- Unit tests cover schema-v6 validation, all 13 collections, reopen persistence, stable IDs, migration recovery artifacts, migration rollback, stale-write conflicts, integrity checks, file permissions, and injected SQLite write-failure rollback.
- API tests cover local-origin enforcement, payload validation, request size/content type, and read/write behavior.
- Chromium smoke covers save/restore, reload persistence, multi-tab stale-write protection, transient save failure, bounded retry exhaustion, and recovery after a later edit.
- Current PR #432 head `9af3b36b9ccac75e5e149c956567f9f6f35fc075`: CI run 1411, Secret Scan run 1203, and dashboard packaging run 741 completed successfully. CI reports 80 test files / 715 tests and full real Chromium smoke.
