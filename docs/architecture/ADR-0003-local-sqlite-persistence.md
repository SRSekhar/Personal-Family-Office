# ADR-0003: Local SQLite workspace persistence

- **Status:** Accepted
- **Date:** 2026-10-28
- **Decision owners:** PFO OS project owner

## Context

The browser dashboard currently uses browser storage for active editing. A durable backend is needed so a complete private workspace can be saved outside browser storage while retaining local-first privacy, data exportability, validated financial inputs, and the existing safe restore workflow. The hosted GitHub Pages dashboard is sample-only and must not receive private financial data.

## Decision

Use the built-in `node:sqlite` API on the supported Node.js 22 runtime for the local dashboard preview.

- Store one complete schema-v4 INR workspace snapshot containing records, goals, cash-flow transactions, budgets, and historical snapshots.
- Validate the entire payload before writing; commit the replacement in one SQLite transaction.
- Expose database endpoints only from the loopback-bound dashboard server, validate Host/Origin, limit JSON request bodies to 10 MiB, and do not enable CORS.
- Keep the default database file outside the repository: `%LOCALAPPDATA%\\PFO-OS\\pfo-os.sqlite` on Windows and `~/.local/share/PFO-OS/pfo-os.sqlite` on Linux/macOS. Support an explicit `PFO_DATABASE_PATH` override.
- Restrict database and SQLite sidecar files to owner-only POSIX permissions. On Windows, rely on the user's profile ACL.
- Make persistence explicit through dashboard Save/Restore actions. Restore must continue through validated preview, user confirmation, and the existing rollback-safe browser-storage restore path.

## Consequences

- Local persistence requires no third-party database service, network credentials, or additional runtime package.
- The database holds one current snapshot; saving replaces that snapshot atomically. Keep separate backups for recovery.
- Browser edits are not automatically synchronized to SQLite. Users must explicitly save after changes.
- The database is not encrypted by this feature. Device security and separate encrypted backups are still required.
- This is a single-user local backend, not a cloud or multi-user service. A future hosted backend would require separate decisions for authentication, authorization, tenancy, migrations, encryption/key management, deployment, and threat modeling.
- The persisted payload uses the existing backup schema and validators to avoid creating a second financial-data contract.
