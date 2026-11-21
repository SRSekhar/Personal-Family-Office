# ADR — Historical backtesting dataset storage

- **Status:** Proposed — storage design only; no persistence implementation or workspace schema migration is authorized by this proposal.
- **Date:** 2026-11-21
- **Workstream:** IPM-08.2
- **Scope:** Immutable historical OHLCV source artifacts and their dataset catalog.
- **Related:** `ADR-0004-local-sqlite-workspace-persistence.md`, `ADR-INVESTMENT-MARKET-DATA-BOUNDARY.md`, `ADR-IPM-08-BACKTESTING-ARCHITECTURE.md`.

## 1. Verified repository constraints

The existing local workspace persistence has these characteristics:

- The dashboard uses the built-in `node:sqlite` API and stores one complete, validated workspace snapshot as JSON in a single SQLite row.
- The current workspace payload is schema v13 with 20 collections. Its persistence validation requires all 20 collections and INR workspace currency.
- Workspace writes serialize and validate the complete payload, enforce a 10 MiB serialized payload limit, and use optimistic concurrency.
- The default database file is outside the repository. The local dashboard is loopback-only and the current backup flow creates a verified SQLite online backup plus a portable JSON workspace export.
- The workspace backup contract covers the workspace database and JSON snapshot. It does not define a separate immutable market-data artifact directory or a coordinated backup of such artifacts.
- `@pfo/backtesting` currently provides validated contracts and offline CSV parsing. CSV ingestion does not persist source files, dataset manifests or normalized observations.

These constraints make the existing household-workspace snapshot a poor place for bulk historical OHLCV rows or raw market-data files. Adding large data arrays to the current workspace payload would couple research-data volume to financial-workspace saves, the 10 MiB limit, and the current workspace backup/restore lifecycle.

## 2. Proposed decision

Keep historical market-data storage separate from the household financial workspace. Use two local-first persistence components:

1. **Dataset catalog:** a dedicated SQLite database, using the repository-supported built-in `node:sqlite` runtime, for dataset identities, immutable versions, instrument/exchange/interval bindings, provenance, licensing evidence, coverage, validation state, content digests and artifact references.
2. **Immutable source-artifact store:** a filesystem directory outside the repository for original imported CSV bytes, stored by their SHA-256 content digest. The catalog references the artifact by digest and byte length; it does not copy the raw file into the household workspace JSON payload.

This is a proposal for review, not an implementation authorization. It deliberately does not choose a provider, download data, define a cloud object store, or change the existing financial workspace schema.

### 2.1 First-release boundary

The first release is NSE-focused daily OHLCV only, as approved in the parent IPM-08 ADR. BSE and intraday intervals remain deferred.

- Initial acquisition is user-supplied/offline CSV only.
- Dataset metadata must explicitly bind each import to an existing PFO instrument identity, NSE exchange, daily interval, currency, timezone, adjustment basis, source and licensing terms, coverage/calendar evidence and recorded-at timestamp.
- A symbol or filename must never silently create or remap an investment instrument.
- The import process must not infer exchange holidays, missing sessions, instrument identity, adjustment basis, currency, timezone or point-in-time availability.
- Provider adapters and outbound network calls remain separately gated by the market-data provider ADR.

### 2.2 Artifact immutability and deduplication

- The raw source artifact is addressed by SHA-256 of its exact original bytes.
- Identical source bytes may share one stored artifact while retaining separate dataset-version/catalog provenance records when the import context differs.
- A normalized semantic-content digest remains distinct from the raw artifact digest. Equivalent data represented with different line endings may have the same normalized digest but different raw digests.
- Published artifacts are immutable. Re-importing corrected data creates a new dataset version and new digest; it never overwrites an existing object.
- A digest collision or existing object with a mismatched byte length/content verification is a hard integrity failure, not an overwrite.
- Dataset versions and their provenance are append-only. Retirement/deletion behavior must respect the source license and retention policy and is not defined by this ADR.

### 2.3 Safe import and crash recovery

The proposed import lifecycle is:

1. Receive the user-selected file and explicit dataset metadata.
2. Stream/copy the exact source bytes to a unique staging file outside the repository while calculating the raw SHA-256 and byte length.
3. Parse and validate the staged bytes using the existing strict CSV importer and the explicit metadata binding. Compute the normalized semantic digest.
4. Flush the staged artifact and publish it to its digest-derived immutable location without replacing an existing object.
5. Commit the validated dataset-version manifest and provenance in one catalog SQLite transaction.
6. Return success only after both the immutable artifact and catalog record have been verified.

The filesystem and SQLite catalog cannot share one atomic transaction. Therefore:
- A crash after artifact publication but before catalog commit may leave an unreferenced object. Reconciliation must report it as an orphan; automatic deletion is not permitted.
- A catalog row must never be committed before the referenced artifact is durably published and verified.
- A catalog reference to a missing or digest-mismatched artifact is an integrity error and the dataset is unavailable for execution.
- Staging files must be uniquely named and cleaned only when their ownership/age can be established safely.

### 2.4 Catalog contents and boundaries

The catalog should store metadata and references, not duplicate all source bytes or silently become a second investment ledger. Candidate catalog entities include:

- Dataset identity and immutable version.
- Local instrument ID, exchange, interval, currency, timezone and adjustment basis.
- Source name/type/URL, license and terms evidence, attribution, retrieval/import time and user-provided provenance.
- Raw artifact SHA-256, byte length and storage reference.
- Normalized-content digest and importer/normalizer version.
- Declared coverage, expected observation schedule/calendar reference and completeness/validation report.
- Point-in-time availability guarantee and exact cutoff where evidenced.
- Created-at/recorded-at timestamps and immutable version relationships.

Normalized OHLCV rows may be loaded into a future query/processing representation for efficient chronological simulation, but the first storage implementation must not assume that the raw CSV itself is an efficient query engine. The storage format and indexing strategy for normalized observations require measured volume/performance tests before selection.

No live investment transaction, valuation, cash movement, FIFO lot, statement evidence or real account data is copied into this catalog.

### 2.5 Backup and restore

The current workspace backup does not cover the proposed artifact store. A complete historical-data backup must therefore be a separately verifiable unit containing:

- A consistent catalog SQLite snapshot.
- Every immutable source artifact referenced by the snapshot.
- A manifest listing dataset/version IDs, raw digests, byte lengths, normalized digests, and catalog/schema/importer versions.
- A verification report proving every referenced object is present and matches its digest.

Restore must stage the catalog and artifacts, verify all references and digests, then publish the restored catalog/store as one recoverable operation. A partially restored catalog must not be exposed as ready for backtesting. Workspace JSON export remains independent and must not silently include bulk market data.

Automated cloud backup, encryption, scheduling, retention rotation and remote synchronization are not implied. Local filesystem/device protection remains necessary, and licensing restrictions govern whether source artifacts may be retained or copied.

## 3. Alternatives considered

| Option | Assessment |
|---|---|
| Put raw CSV bytes or OHLCV arrays in the current workspace JSON/SQLite snapshot | Rejected for the first release: couples market-data volume to financial workspace saves, 10 MiB payload validation, and household backup lifecycle. |
| Store only file paths in the current workspace snapshot | Rejected as the complete design: paths alone do not provide immutable identity, digest verification, dataset versioning, or a coordinated backup/restore contract. |
| Store all raw files as SQLite BLOBs in the existing workspace database | Rejected for the first release: increases the size and restore cost of the household workspace and still couples unrelated lifecycles. A separate catalog database could be reconsidered if measured requirements justify BLOB storage. |
| Local content-addressed files plus a separate SQLite catalog | Preferred proposal: preserves original source bytes, supports digest-based deduplication and immutable versions, and keeps bulk data out of the household snapshot. Requires explicit cross-store crash recovery and backup verification. |
| Cloud object storage from the first release | Deferred: adds credentials, network availability, costs, security and licensing/retention decisions that are unnecessary for an offline CSV-first increment. |

## 4. Security, privacy and licensing requirements

- All catalog and artifact paths default outside the Git repository and are configurable through a documented local setting.
- Never commit real market-data files, credentials or user financial data.
- Apply restrictive directory/file permissions where supported; do not claim encryption unless implemented and verified.
- Treat source URLs, license text, attribution and retention permissions as evidence, not as proof that redistribution is allowed.
- Do not import or retain data whose license prohibits the intended local storage/use.
- Never log raw CSV contents, credentials or full sensitive local paths in user-facing errors.
- The catalog and artifact store remain local-only in this increment.

## 5. Required validation before implementation

The implementation increment must test at least:

1. Exact-byte digest and byte-length verification.
2. Duplicate raw artifact deduplication without losing distinct import provenance.
3. Same normalized content with different raw bytes.
4. Immutable version creation and refusal to overwrite.
5. Invalid CSV rejected before catalog publication.
6. Crash/failure after staging, after artifact publication and during catalog commit.
7. Orphan detection without automatic destructive cleanup.
8. Missing or digest-mismatched referenced artifact blocks dataset use.
9. Catalog backup includes every referenced artifact and verifies all digests.
10. Restore rejects incomplete/corrupt bundles and never exposes a partially restored catalog.
11. Workspace backup/restore remains independent and all existing financial-workspace tests remain unchanged.
12. Dataset metadata cannot mutate real investment ledger collections.

## 6. Open decisions before implementation

- Exact local catalog and artifact directory configuration and migration/versioning policy.
- Whether normalized OHLCV observations are stored as SQLite rows, a columnar file, or rebuilt from immutable CSV artifacts; select only after representative NSE daily dataset size/performance tests.
- Expected maximum dataset size, number of instruments, retention horizon and acceptable import/query latency.
- Approved source/license categories and user-facing evidence required before retention.
- Trading-calendar source and the authoritative expected daily observation schedule.
- Corporate-action and adjustment-basis eligibility.
- Whether point-in-time availability evidence is required for all first-release backtests or whether explicitly labeled non-point-in-time exploratory runs are permitted.

No schema migration, artifact persistence code, provider integration or simulator implementation should begin until the storage slice's required decisions and acceptance tests are approved.
