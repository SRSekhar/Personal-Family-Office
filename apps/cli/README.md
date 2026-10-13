# @pfo/cli

## Purpose

`@pfo/cli` is the local host/composition layer for creating an offline HTML report from a versioned JSON portfolio input. It owns command-line parsing and filesystem I/O; domain models, calculations, analysis, and HTML rendering remain in the existing `@pfo/*` packages.

## Build

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm build
```

## Generate a report

The repository includes fictional sample data only. Create the ignored output directory if it does not exist, then run:

```powershell
New-Item -ItemType Directory -Force reports
node apps/cli/dist/index.js create --input apps/cli/examples/sample-portfolio.json --output reports/sample-portfolio.html
```

To make the generation timestamp deterministic, pass an explicit canonical UTC timestamp:

```powershell
node apps/cli/dist/index.js create --input apps/cli/examples/sample-portfolio.json --output reports/sample-portfolio.html --generated-at 2026-10-13T12:00:00.000Z --force
```

Existing output is not overwritten unless `--force` is supplied. The valuation timestamp (`asOfDate`) is required in the input; it is never inferred. Output is self-contained HTML and can be opened offline.

## Input contract (schema version 1)

- `schemaVersion` must be `1`.
- `currency` must be one of the supported `@pfo/models` currencies.
- Every record's money value must use that same currency; the CLI does not convert currencies or fetch exchange rates.
- The `portfolio` object contains `id`, `name`, and arrays for `assets`, `investments`, `liabilities`, and `properties`. Record field names and enum values mirror the current domain models.
- `selections` must explicitly map records to canonical positions and reporting categories. This avoids automatic aggregation that could double-count the same economic holding across asset, investment, and property collections.
- `asOfDate` must be a canonical ISO-8601 UTC timestamp such as `2026-10-13T00:00:00.000Z`.
- Unknown fields, duplicate IDs within a collection, negative/invalid amounts, missing source records, duplicate selections, and duplicate canonical IDs are rejected.

## Data and safety boundary

- All input and output are local files; no network, bank connection, market-data source, database, or AI provider is used.
- No files are discovered automatically. Both input and output paths must be explicit.
- The CLI never writes to the input file and refuses to overwrite output unless `--force` is explicit.
- Generated reports may contain sensitive financial information. Keep real input files and reports outside version control; the repository's root `reports/` directory is ignored.
- The report is an informational summary, not investment, tax, or legal advice.
