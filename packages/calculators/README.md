# @pfo/calculators

## Overview

`@pfo/calculators` contains the financial calculation engines used throughout PFO OS.

The package provides deterministic, reusable and unit-testable calculation logic. All financial computations should reside here rather than inside applications or services.

---

## Responsibilities

- Net Worth calculations
- Cash Flow calculations
- Investment Return calculations
- FIRE calculations
- Retirement projections
- Loan amortization
- Tax estimation
- Portfolio performance calculations

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
pnpm --filter @pfo/calculators build
```

Type Check

```bash
pnpm --filter @pfo/calculators typecheck
```

Lint

```bash
pnpm --filter @pfo/calculators lint
```

---

## Design Guidelines

- Calculations must be deterministic.
- Avoid side effects.
- Keep functions pure.
- Use immutable inputs.
- Return strongly typed results.
- Business rules belong here, not in UI applications.

---

## Status

Active Development