# PFO OS Parallel Agent Team

## Roles

| Agent | Owned files | Responsibility |
|---|---|---|
| Calculator | `packages/calculators/**` and direct tests | Calculation correctness and deterministic edge cases. |
| Dashboard | `apps/dashboard/**`, `scripts/dashboard/**`, and direct dashboard tests | Local-first dashboard workflows and browser regressions. |
| Reports & Data Integrity | `packages/models/**`, `packages/reports/**`, `apps/cli/**`, and direct tests | Import/export, backup/restore, report correctness, and validation. |

## Shared rules

- Start from the current default branch; each role runs in an isolated runner and creates its own branch and pull request.
- Read the repository's AI context/contract, project state, current sprint, handoff, and the directly relevant ADR before implementation.
- Choose one concrete task already supported by the sprint, backlog, failing test, or reproducible defect. Do not invent requirements.
- Stay within the role's owned files. If a task crosses boundaries, report the dependency instead of editing another role's area.
- Keep each change focused, run relevant tests, and report only checks that actually ran.
- Use synthetic test data. Do not include household records, credentials, or private reports in code, logs, or PRs.
- Update only the directly relevant documentation. Avoid shared sprint/handoff edits from concurrent workers.
- Never merge or deploy automatically. Required CI, Secret Scan, and review remain mandatory.
- If no safe scoped task is ready, do not create an empty change; report the blocker.
- Model credentials and the repository-scoped automation token must come from GitHub Actions secrets and must never be printed.
- Parallel workers increase model/API usage. The scheduled batch runs once every hour; manual dispatch can start an additional batch. Workflow concurrency prevents overlapping batches.
