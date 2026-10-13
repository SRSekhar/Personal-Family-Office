# ADR-0001: Local report CLI boundary

- **Status:** Accepted for the first local report-host increment
- **Date:** 2026-10-13
- **Scope:** Local report generation; no persistent service or hosted financial data

## Context

The repository already has deterministic domain models, explicit portfolio-position selection, net-worth and allocation calculations, and a validated self-contained HTML renderer. The renderer intentionally does not perform filesystem I/O. A host layer is needed to turn validated local input into an HTML file without contaminating domain packages with process, filesystem, network, or persistence concerns.

## Decision

1. Keep `@pfo/core`, `@pfo/models`, `@pfo/calculators`, `@pfo/analytics`, and `@pfo/reports` independent of CLI arguments and filesystem side effects.
2. Add `@pfo/cli` as a thin composition root. It validates a versioned JSON input, constructs the existing domain entities, calls the existing analysis and report APIs, and writes the returned HTML.
3. Require an explicit input path, output path, and valuation timestamp in the input. The report-generation timestamp defaults to current UTC time but can be supplied explicitly for reproducibility.
4. Require explicit source selections and canonical IDs; never auto-select every domain collection because a real holding can appear in multiple collections.
5. Reject mixed currencies, unknown schema fields, invalid/negative amounts, duplicate source IDs, missing source records, and duplicate canonical IDs. No currency conversion is attempted.
6. Keep the first increment local-only: no database, historical snapshot persistence, bank integration, market-data acquisition, AI calls, telemetry, or hosted APIs.
7. Refuse output overwrite by default. `--force` is an explicit destructive override. Generated financial reports stay out of version control.

## Consequences

- The CLI is a host application; it owns argument parsing and filesystem I/O, while domain and report packages remain deterministic.
- The JSON schema is explicitly versioned and follows current domain-model field names. Future model changes require deliberate schema/version handling rather than silent guessing.
- The current product distribution boundary and licensing remain separate release gates. This ADR does not authorize a license, repository visibility, or commercial-distribution change.
- Historical snapshots remain a separate decision requiring a defined source of truth and persistence design.
