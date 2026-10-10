# PFO OS

**Personal Family Office Operating System** — an early-stage project exploring an engineering-first, AI-assisted way to manage personal and family finances.

> **Status:** early development. This repository is not yet a production-ready financial application. Roadmap items are plans, not shipped capabilities.

## Product direction

PFO OS aims to help individuals and families maintain structured financial records, run deterministic calculations, track goals, analyze portfolios, generate repeatable reports, and use AI to explain—not replace—validated analysis.

## Engineering principles

- Clean Architecture and domain-driven design.
- Deterministic, testable financial calculations separated from AI interpretation.
- Data ownership, exportability, and explainability.
- No invented market data, holdings, or balances.
- Security and privacy by design.

## Current repository

The TypeScript monorepo contains early domain-model and package foundations, plus tested deterministic CAGR and annual compound-growth calculators. The dashboard, reporting, production data workflows, AI integrations, and paid product capabilities are not yet production-ready.

```text
apps/       Application entry points (planned/in development)
packages/   Reusable TypeScript packages
docs/       Product, architecture, governance, and security documentation
scripts/    Development and repository automation
.ai/        Project context and engineering handoff
```

## Development setup

Requirements: Node.js 22.x and pnpm 11.25.0, matching the current package metadata.

```powershell
corepack enable
pnpm install
pnpm test
pnpm lint
```

Root build and validation commands are still being standardized. Review package-level scripts and project-state documentation before treating a command as a complete CI gate.

## Security and personal data

This GitHub repository is **public**. Do not commit real financial records, account identifiers, statements, tax documents, credentials, API keys, private reports, or personal configuration. Use synthetic examples only. See [SECURITY.md](SECURITY.md), [the repository exposure review](docs/security/REPOSITORY_EXPOSURE_REVIEW.md), and the [third-party dependency license inventory](docs/security/DEPENDENCY_LICENSE_INVENTORY.md). The inventory records package metadata; it is not legal clearance.

## Licensing

There is currently **no usable open-source license in this repository**. The empty LICENSE.md does not grant permission to reuse, redistribute, or modify the code. Public visibility is not the same as an open-source license. Licensing and the open-core product boundary are still under review.

## Product and monetization

Candidate directions include a free reusable framework with paid professional features, support, or hosted services. No paid service is currently offered from this repository.

## Roadmap

See [ROADMAP.md](ROADMAP.md). Roadmap items are plans, not claims of shipped functionality.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Until licensing and the public/private product boundary are finalized, do not assume that submitting a contribution grants any particular license or commercial arrangement.

## Disclaimer

PFO OS is software for organizing information and performing calculations. It is not a bank, broker, tax adviser, or registered investment adviser. Outputs require validation and are not a substitute for qualified financial, tax, or legal advice.
