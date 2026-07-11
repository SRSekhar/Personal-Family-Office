# @pfo/charts

## Overview

`@pfo/charts` contains the charting and visualization components for PFO OS.

This package is responsible for transforming financial data and analytical results into clear, interactive and reusable visualizations. It should remain presentation-focused and independent of business logic.

---

## Responsibilities

- Financial charts
- Portfolio visualizations
- Net Worth timeline
- Cash Flow charts
- Asset Allocation charts
- Investment Performance charts
- Dashboard widgets
- Chart configuration
- Export-ready visualizations

---

## Package Structure

```
src/
    index.ts
```

---

## Development

Build

```bash
pnpm --filter @pfo/charts build
```

Type Check

```bash
pnpm --filter @pfo/charts typecheck
```

Lint

```bash
pnpm --filter @pfo/charts lint
```

---

## Design Guidelines

- Keep visual components reusable.
- Separate visualization from analytics.
- Do not perform financial calculations.
- Consume typed models and analytics results.
- Support responsive layouts.
- Keep chart libraries abstracted behind adapters where practical.

---

## Dependencies

Typical dependencies include:

- `@pfo/core`
- `@pfo/models`
- `@pfo/analytics`

---

## Future Scope

- Interactive dashboards
- Historical trend analysis
- Portfolio allocation charts
- Sankey diagrams
- Waterfall charts
- Heat maps
- PDF-ready visualizations

---

## Status

Active Development