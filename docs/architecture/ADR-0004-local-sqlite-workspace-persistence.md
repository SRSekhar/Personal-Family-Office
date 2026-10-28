# ADR-0004: Local SQLite workspace persistence

- **Status:** Proposed with implementation in progress
- **Date:** 2026-10-28

## Context

PFO OS currently stores its private browser workspace in separate local-storage collections. This works offline but does not provide a durable, independently addressable database file and makes browser-profile loss a recovery risk. The existing schema-v4 backup format already defines the complete workspace boundary: records, goals, cash-flow transactions, budgets, and historical snapshots.

The first database increment must not imply cloud hosting, multi-user access, encryption at rest, or automatic synchronization. Existing local-first behavior and validated backup recovery must remain available.

## Decision

Use the built-in `node:sqlite` API provided by the repository's Node.js 22 runtime. Do not add a native third-party SQLite dependency for the initial local persistence capability.

Persist one complete, validated schema-v4 INR workspace snapshot in a single SQLite row and write it inside one transaction. This makes all five collections an atomic unit and avoids partial cross-collection updates. Preserve stable record IDs in database snapshots.

The local preview server exposes a small JSON API for database status, workspace read, and workspace write. It binds to loopback, rejects non-loopback hosts and cross-origin requests, does not enable CORS, limits request bodies to 10 MiB, and returns sanitized server errors.

The default database path is outside the repository:
- Windows: `%LOCALAPPDATA%\\PFO-OS\\pfo-os.sqlite`
- Linux/macOS: `~/.local/share/PFO-OS/pfo-os.sqlite`

`PFO_DATABASE_PATH` overrides the default. SQLite files and journal files are ignored by Git.

The dashboard's initial integration uses explicit **Save to SQLite** and **Restore from SQLite** actions. Restore reuses the existing schema validation, user confirmation, and atomic browser-storage rollback. Browser edits are not automatically synchronized in this increment; do not claim otherwise.

## Consequences

### Benefits
- Durable persistence across browser restarts and profile changes, provided the database file is retained.
- One atomic snapshot covers all current workspace collections.
- No third-party database dependency, cloud account, network service, or new runtime dependency.
- Existing offline browser storage and exported JSON backups remain available.

### Trade-offs and limitations
- The initial UI requires explicit saves; automatic write-through is a separate design/implementation step.
- SQLite file contents are not encrypted by this feature. Filesystem/device protection and independent backups remain the user's responsibility.
- This is a single-user local database API, not a remote, multi-user, or production-hosted database service.
- The Node.js `node:sqlite` API is experimental in Node 22; CI must verify the exact supported runtime.

## Validation required before acceptance

- Unit tests for snapshot persistence across reopen, schema validation, stable IDs, and failed-write safety.
- API tests for local origin enforcement, payload validation, request size/content type, and read/write behavior.
- Chromium smoke coverage for full-workspace save and restore.
- Full CI, dashboard packaging, and Secret Scan passing before merge.
