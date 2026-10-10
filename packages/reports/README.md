# @pfo/reports

## Purpose

`@pfo/reports` turns validated portfolio-analysis results into a versioned, serializable report model and a self-contained HTML financial summary.

## Current capability

- Net worth summary: total assets, total liabilities, and net worth.
- Asset allocation table with category values and percentage weights.
- Explicit valuation date and generation timestamp.
- Self-contained HTML with responsive layout, semantic headings, accessible table structure, and print styles.
- HTML escaping for all dynamic text.
- No scripts, remote assets, external stylesheets, market-data fetching, persistence, or AI-generated advice.

## Example

```typescript
import { analyzePortfolio } from '@pfo/analytics';
import {
    createPortfolioReport,
    renderPortfolioReportHtml
} from '@pfo/reports';

const analysis = analyzePortfolio({
    portfolio,
    currency,
    selections
});

const report = createPortfolioReport({
    analysis,
    asOfDate: new Date('2026-10-01T00:00:00.000Z'),
    generatedAt: new Date('2026-10-10T06:00:00.000Z')
});

const html = renderPortfolioReportHtml(report);
// Save the html string to a local .html file using the host application.
```

The example intentionally leaves `portfolio`, `currency`, and `selections` to the host application; they must come from validated domain data. No data is invented by this package.

## Data and safety contract

- The report only reflects the analysis result supplied by the caller.
- Dates are explicit and serialized as ISO-8601 UTC timestamps.
- Currency values are formatted with their currency code.
- Inputs must use one currency; conversion is outside this package.
- Dynamic portfolio names and category labels are HTML-escaped.
- Output is designed to work offline and contains no JavaScript.
- Reports are informational summaries, not investment, tax, or legal advice.

## Development

```bash
pnpm --filter @pfo/reports build
pnpm --filter @pfo/reports typecheck
pnpm --filter @pfo/reports lint
pnpm test
```
