# @pfo/analytics

## Overview

`@pfo/analytics` contains the financial analytics engine for PFO OS.

This package transforms financial data into actionable insights, trends and metrics. It should consume domain models and calculation results without introducing presentation or infrastructure concerns.

---

## Responsibilities

- Net Worth Analysis
- Cash Flow Analysis
- Portfolio Analysis
- Investment Performance Analysis
- Asset Allocation Analysis
- Income & Expense Trends
- Financial Health Scoring
- Goal Progress Analysis
- Risk Analysis
- Forecasting Support

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
pnpm --filter @pfo/analytics build
```

Type Check

```bash
pnpm --filter @pfo/analytics typecheck
```

Lint

```bash
pnpm --filter @pfo/analytics lint
```

---

## Design Guidelines

- Analytics must be deterministic.
- Separate analytics from calculations.
- Avoid UI-specific logic.
- Use immutable inputs.
- Return strongly typed analysis results.
- Keep algorithms reusable and independently testable.

---

## Dependencies

Typical dependencies include:

- `@pfo/core`
- `@pfo/models`
- `@pfo/calculators`

---

## Status

Active Development