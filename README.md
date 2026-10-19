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

The TypeScript monorepo contains deterministic financial models/calculators, portfolio analysis, an offline HTML report renderer, a local report CLI, and a static browser dashboard. These are early development capabilities, not a production-ready financial application; data ingestion, persistence, hosted services, AI integrations, and paid product capabilities remain incomplete.

```text
apps/       Local report CLI and static browser dashboard
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

Use the root commands below for the current CI-aligned build, typecheck, lint, and test gates. The CLI and dashboard remain early-stage and require review before production financial use.

## Local dashboard preview

Run the static dashboard on your own machine without GitHub Pages:

```powershell
pnpm dashboard:serve
```

Open `http://127.0.0.1:4173/` in your browser. To choose a different port, set `$env:PFO_DASHBOARD_PORT = "4174"` before running the command. The server binds only to loopback, serves files from `apps/dashboard`, and does not expose a public network listener. Dashboard records remain in that browser origin's local storage; this preview server does not receive or persist them.

This is a local development preview, not a production hosting service. Publishing the hosted GitHub Pages demo still requires the one-time repository setting **Settings → Pages → Source: GitHub Actions**. The hosted dashboard is sample-only on every non-loopback hostname: private-workspace entry and backup imports are blocked because a hosted origin is not the trusted local workspace. Personal records are available only from `localhost`/`127.0.0.1`/IPv6 loopback; use the loopback-only preview for household records.

The dashboard supports local asset/liability records, case-insensitive search, filtering by record type, stable sorting by name or value, JSON backup import/export (including saved goals in private-workspace version 2 backups, while retaining compatibility with older record-only version 1 backups), and CSV export for spreadsheet analysis. The goal tracker supports multiple saved financial goals with editable targets, dates, and accumulated amounts, stored separately in the browser's private local workspace. A version 1 backup restores financial records without deleting goals because those older backups did not contain goal data. It can also download a self-contained HTML financial summary with net worth, category allocation, and all records; the report clearly distinguishes generation time from an untracked valuation date. CSV text fields are quoted and spreadsheet-formula-like text is neutralized; still review exported files before opening them in spreadsheet software. Exports are created in the browser and are not uploaded by the preview server.

## Local report CLI

The local `@pfo/cli` host turns a versioned JSON portfolio input into a self-contained HTML report using the existing deterministic analysis and report packages. It requires explicit source selections and a valuation timestamp, rejects mixed currencies and unknown fields, and performs no network, database, market-data, or AI calls.

```powershell
New-Item -ItemType Directory -Force reports
pnpm install --frozen-lockfile
pnpm build
node apps/cli/dist/index.js create --input apps/cli/examples/sample-portfolio.json --output reports/sample-portfolio.html
```

The example input is synthetic. Generated reports can contain sensitive financial information; keep real inputs and outputs out of version control. The root `reports/` directory and `*.pfo-report.html` files are ignored.

### Report a dashboard backup

1. Run `pnpm dashboard:serve` and enter your data in the local browser workspace.
2. Use the dashboard's JSON export and save the backup to a private local path.
3. Build the CLI if you have not already, then generate the report:

```powershell
pnpm build
$backup = Join-Path $env:USERPROFILE "Downloads\pfo-dashboard-backup.json"
node apps/cli/dist/index.js create --format dashboard-backup --input $backup --as-of 2026-10-01T00:00:00.000Z --output reports/dashboard-report.html
```

Choose `--as-of` to represent the date the values actually describe. The dashboard's `exportedAt` timestamp is not treated as a valuation date. Dashboard asset/liability records are converted to generic domain types while their reporting categories are preserved; the CLI does not infer investments or property subtypes, and it does not convert currencies.

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
