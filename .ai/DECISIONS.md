# Executive Decisions

This document records significant engineering, architectural and product decisions.

---

## DEC-0001

Title

Repository is the Memory

Status

Accepted

Reason

Avoid dependency on AI conversation history.

---

## DEC-0002

Title

Repository Structure First

Status

Accepted

Reason

Create a maintainable long-term project.

---

## DEC-0003

Title

Data is the Source of Truth

Status

Accepted

Reason

Reports and dashboards should be generated rather than maintained manually.

---

## DEC-0004

Title

GitHub Flow

Status

Accepted

Reason

Simpler workflow for a single Principal project.

---

## DEC-0005

Title

Clean Architecture

Status

Accepted

Reason

Separate concerns and improve maintainability.

---

## DEC-0006

Title

Domain Driven Design

Status

Accepted

Reason

Represent the financial domain accurately.

---

## DEC-0007

Title

TypeScript Standard

Status

Accepted

Reason

Single language across the platform.

---

## DEC-0008

Title

AI-Native Repository

Status

Accepted

Reason

Allow any AI assistant to continue development.

---

## DEC-0009

Title

Production Quality Only

Status

Accepted

Reason

Avoid placeholders and technical debt.

---

## DEC-0010

Title

Conventional Commits

Status

Accepted

Reason

Maintain a clean project history.

---

## DEC-0011

Title

Local SQLite Persistence

Status

Accepted

Decision

Use Node.js built-in SQLite for the local dashboard's durable private-workspace persistence. Store one fully validated schema-v4 workspace snapshot in a single transaction, expose the API only through the loopback preview server, and keep explicit save/restore semantics for the first increment. The default database path is outside the repository. Protect database files with owner-only POSIX permissions; Windows relies on the current user's profile ACL.

Consequences

- No external database service, credentials, network upload, or new runtime dependency is required for local use.
- Browser edits are not automatically synchronized; users explicitly save and restore complete snapshots.
- The database file is not encrypted by this feature and must be protected by device security and separate backups.
- This is not a multi-user or cloud backend. A hosted database requires a separate deployment, authentication, tenancy, migration, and threat-model decision.

## Future Decisions

Every significant architectural or product decision shall be recorded here before implementation.