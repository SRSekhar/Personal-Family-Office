# ADR-0002: Historical snapshot persistence requirements

- **Status:** Proposed — decision intentionally open
- **Date:** 2026-10-14
- **Scope:** Historical financial snapshots and report reproducibility
- **Depends on:** ADR-0001 local report CLI boundary

## Context

The current dashboard stores editable records in browser `localStorage`; JSON export/import provides portability. The local CLI can generate a self-contained report from a validated input or dashboard backup, but the product does not yet store dated historical snapshots or provide a history/trend view.

Historical persistence changes the trust model: the system must distinguish a current editable record from a point-in-time valuation, preserve the date and currency of the source data, and make it possible to reproduce a previously generated report. The storage technology must not be selected before user workflows, recovery expectations, and deployment boundaries are validated.

## Requirements to validate

The following are candidate requirements, not a claim that they are already implemented.

1. **Explicit valuation date:** Every snapshot has a user-supplied as-of date/time. Record creation time and valuation time are distinct.
2. **Currency integrity:** Each snapshot has one explicit currency. Mixed-currency totals are rejected unless a separately designed, dated conversion workflow is approved; no implicit conversion.
3. **Point-in-time integrity:** A saved snapshot is immutable by default. Corrections create a replacement/revision with an audit trail rather than silently rewriting history.
4. **Provenance:** Store the schema version, source type, source record IDs, calculation/report version, and relevant assumptions needed to explain how a result was produced. Do not store credentials or unnecessary raw source documents.
5. **Deterministic reconstruction:** A report can be reproduced from the same validated snapshot and calculation version, with generated-at time distinguished from the snapshot's as-of date.
6. **Data portability:** Users can export a complete, versioned backup and restore it with validation. Failed writes/imports must not leave partially committed state.
7. **Recovery and deletion:** Define backup frequency, restore behavior, retention, and permanent deletion semantics before accepting real household financial records.
8. **Privacy boundary:** Local/self-hosted/hosted modes must be explicit. No real financial data is sent to an external service or AI provider by default.
9. **Concurrency:** If multiple tabs or devices may edit the same records, define conflict detection and resolution rather than using last-write-wins silently.
10. **Migration:** Version storage schemas and test upgrades from previous versions; unknown future schemas must fail safely without overwriting the original backup.
11. **Operational simplicity:** The first persistence increment should remain supportable by the intended user segment and should not introduce a database/service solely to enable a chart.

## Candidate options

| Option | Strengths | Risks / limitations | Questions to resolve |
| --- | --- | --- | --- |
| Browser `localStorage` | Minimal dependencies; already used by the dashboard; easy local-first behavior | Synchronous and quota-limited; weak fit for large histories; per-browser/device; no built-in transactions or cross-device sync | Is one browser and a small history sufficient for the first validated workflow? |
| Browser IndexedDB | Asynchronous structured storage; better suited to larger datasets and indexed history | More lifecycle/migration complexity; still browser/device-local; backup and recovery remain user-managed | Does the validated workload require more than localStorage can safely support? |
| Local versioned JSON files | Human-inspectable and portable; aligns with current CLI and explicit backups | Requires careful atomic file writes, path safety, locking, and user file management; browser UI cannot directly access arbitrary files without user interaction | Is a desktop/CLI-led workflow acceptable, or must the browser UI own the experience? |
| Local SQLite-backed application | Transactions, relational queries, and robust local history | Requires a local host/service boundary and packaging/backup decisions; not a static-only browser app | Is the value of robust local history worth introducing a local runtime? |
| Self-hosted database/service | Supports multi-device access while keeping infrastructure under user control | Installation, updates, authentication, backups, and operations add substantial burden | Do target users have the capability and willingness to operate it? |
| Hosted database/service | Enables multi-device and collaborative workflows | Introduces security, privacy, availability, legal, and ongoing cost obligations; contradicts a strict local-only promise unless offered as a separate opt-in mode | Has customer discovery demonstrated a need and willingness to pay for hosted sync? |

No option is selected by this ADR.

## Decision criteria

Before selecting an option, document evidence for:

- The primary user segment and the recurring task they want to complete.
- Expected record count, snapshot frequency, and retention horizon.
- Whether one device/browser is sufficient.
- Whether offline operation is required.
- Who owns and controls backups, recovery, and deletion.
- Whether users need collaboration or multi-device sync.
- The support burden users will tolerate.
- The actual distribution artifact and the security/legal obligations it creates.
- Whether the feature is needed to validate a paid pilot or can be deferred.

## Suggested validation sequence

1. Interview target users about the last time they prepared a financial summary and whether they need to compare dated snapshots.
2. Demonstrate the current export-to-report workflow using synthetic data; ask whether a saved history is necessary to repeat the task.
3. Record explicit needs for backup, restore, retention, device access, and collaboration without collecting real account details.
4. Select the smallest storage option that satisfies evidenced needs; do not build cloud sync or multi-user infrastructure from hypothetical demand.
5. Add schema/version migration tests, interrupted-write tests, restore tests, and reproducibility tests before using real financial records.

## Guardrails

- Do not implement historical persistence under this ADR; it records requirements and decision criteria only.
- Do not add bank/brokerage integrations, remote APIs, telemetry, or AI data transfer as a side effect of selecting storage.
- Do not commit real personal financial data or private reports.
- Do not change repository visibility, licensing, or the public/private product boundary.
- Keep this decision open until customer evidence and the intended deployment model support a specific choice.
