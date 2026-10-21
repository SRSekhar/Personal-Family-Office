# Future Storage and Synchronization Proposal

**Status:** Proposed — not approved for implementation  
**Scope:** Future capability; current local-first workflows remain unchanged.

## Context

PFO OS handles sensitive household financial information. The current browser-based experience and local export/import workflows avoid requiring a remote financial-data service. Users may eventually want cross-device access, resilient backups, or a user-controlled remote copy.

Google Sheets is one candidate because a user can own and inspect the destination, but a spreadsheet is not automatically a secure or transactionally consistent database. The project must not commit to it before validating security, reliability, quotas, schema evolution, and recovery requirements.

## Principles

1. **Local-first by default.** Existing features must continue to work offline and without a cloud account.
2. **Explicit opt-in.** No records are transmitted until a user deliberately connects a provider and invokes or enables a clearly disclosed sync workflow.
3. **Provider-neutral domain layer.** Financial calculations and domain validation must not import provider SDKs or depend on spreadsheet row/column positions.
4. **User-owned data and portability.** Preserve a documented, versioned local export/import format that can be used independently of any provider.
5. **Least privilege and secret safety.** Never place OAuth client secrets, refresh tokens, or access tokens in source control or browser bundles. Define scopes, token storage, revocation, and disconnect semantics before implementation.
6. **Integrity over convenience.** Detect conflicts and partial writes; do not silently overwrite newer records or report a sync as successful when it is incomplete.
7. **No public data destinations.** Never store household financial information in a public spreadsheet or public repository.

## Candidates to evaluate

| Candidate | Potential fit | Questions to resolve |
| --- | --- | --- |
| Google Sheets API | User-visible records, familiar editing, simple small-workspace integrations | Row-level integrity, quotas, concurrent edits, OAuth scopes, schema drift, restore, and suitability as a canonical store |
| Google Drive app data / private app files | User-controlled cloud backup with less spreadsheet coupling | App-folder visibility, access and recovery UX, conflict handling, provider API and quota behavior |
| Self-hosted API and database | Stronger control over transactions, schema, and multi-device workflows | Hosting, authentication, patching, operational cost, backups, and user burden |
| Encrypted versioned file backup | Simple portability and low provider coupling | User-managed file placement, backup cadence, conflict handling, and recovery UX |

## Proposed architecture

If a remote option is approved, introduce a narrow storage-provider contract with operations defined from actual PFO domain needs rather than mirroring a vendor API. Keep validation and business calculations in PFO OS. A provider adapter should handle transport and serialization only; a sync coordinator should own version checks, conflict detection, retries, and user-visible status.

The precise interface, canonical source of truth, data mapping, and synchronization direction are intentionally not specified until the current domain entities and existing persistence paths have been audited. Do not create fake endpoints or assume a schema.

## Required behavior before release

- Local-only use works when offline, disconnected, or when the provider is unavailable.
- Connecting a provider clearly describes which data types will be sent and to which account/destination.
- Sync is explicit and reviewable; any future automatic sync requires a separate, clearly enabled user choice.
- Data is validated and schema-versioned before writes and after reads.
- Repeated requests are idempotent where possible; partial failures are visible and recoverable.
- Conflicting local and remote edits are detected and presented for resolution rather than silently discarded.
- Export and restore work without the provider and are tested against malformed, older, duplicated, and incomplete backups.
- Disconnect/revocation stops future network access; the product explains whether the remote copy remains and how the user can delete it.
- Logs and telemetry never contain financial payloads, credentials, or tokens.
- Automated tests cover auth failures, permission denial, quota/rate limits, timeout/retry, partial writes, conflict handling, migration, restore, and deletion.

## Decision gate

Do not implement Google Sheets synchronization until the team has:

1. Audited all existing storage keys, schemas, import/export paths, and module-specific persistence.
2. Defined the canonical data model and source-of-truth rules.
3. Completed a threat/privacy review and authentication/token-handling design.
4. Compared candidates against the user's backup, portability, and cross-device requirements.
5. Approved a concrete ADR with migration, recovery, and acceptance tests.

Until then, this document records a future plan only. No cloud provider, account, or external financial-data service is enabled by this proposal.
