# PFO OS — Start Here

Welcome to **PFO OS (Personal Family Office Operating System)**.

This is an early-stage software project. The repository is the source of truth for implementation, design decisions, and project state.

## Important: repository visibility

The GitHub repository is currently **public**, despite older documentation describing it as private. Treat every committed file and its history as potentially visible to anyone.

**Never commit real personal financial data, statements, tax records, account identifiers, credentials, API keys, private reports, or personal configuration.** Use synthetic test fixtures only. Read [SECURITY.md](SECURITY.md) before contributing.

## Read in this order

1. [README.md](README.md) — product intent and current maturity
2. [pfo.json](pfo.json) — machine-readable repository metadata
3. [.ai/AI_CONTEXT.md](.ai/AI_CONTEXT.md) — project context
4. [.ai/AI_CONTRACT.md](.ai/AI_CONTRACT.md) — mandatory contributor rules
5. [.ai/PROJECT_STATE.md](.ai/PROJECT_STATE.md) — current status
6. [.ai/CURRENT_SPRINT.md](.ai/CURRENT_SPRINT.md) — active work
7. [.ai/HANDOFF.md](.ai/HANDOFF.md) — next actions
8. [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md) when relevant

## Repository principles

- Repository is the memory.
- Data is the source of truth.
- Reports are generated from validated source data.
- Architecture before automation.
- Production quality over shortcuts.
- Reuse existing implementation.
- Do not invent APIs, models, data, configuration, or completed capabilities.
- Document meaningful decisions and keep project-state files synchronized.

## Current project state

PFO OS is in early foundation/domain-model development. Features listed in the roadmap are not necessarily implemented. Verify code, tests, and current project-state files before relying on a capability.

## Licensing status

The repository is public but does not currently contain a valid open-source license. Do not assume public visibility authorizes reuse or redistribution. Licensing and the product's open-core boundary require a deliberate review before release of reusable components.

Build carefully. Protect personal data. Leave the repository better than you found it.
