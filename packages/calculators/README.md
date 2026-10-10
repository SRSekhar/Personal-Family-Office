# @pfo/calculators

## Overview

This package contains deterministic, reusable, and unit-testable financial calculations for PFO OS. Financial calculations belong here rather than inside application or presentation code.

## Implemented

### Compound annual growth rate (CAGR)

Import the function and input type from the package entry point:

```typescript
import { calculateCagr } from '@pfo/calculators';

const annualizedRate = calculateCagr({
    beginningValue: 1000,
    endingValue: 1331,
    periods: 3
});

// 0.1 means 10% per period (typically per year).
```

The function requires finite, strictly positive beginning and ending values and a finite, positive period count. It returns a decimal rate. It does not account for deposits, withdrawals, taxes, fees, inflation, or interim cash flows. Do not use CAGR for cash-flow series that require money-weighted return analysis such as XIRR.

## Planned capabilities

- Net worth calculations
- Cash-flow analysis
- Investment-return calculations
- FIRE and retirement projections
- Loan amortization
- Tax estimation
- Portfolio performance analytics

Planned capabilities must not be represented as implemented until code and tests exist.

## Package Structure

```text
src/
    Cagr.ts
    index.ts
tests/
    Cagr.test.ts
```

## Development

```bash
pnpm --filter @pfo/calculators build
pnpm --filter @pfo/calculators typecheck
pnpm --filter @pfo/calculators lint
pnpm test
```

## Design Guidelines

- Calculations must be deterministic and side-effect free.
- Validate inputs explicitly and reject invalid numeric values.
- Keep units and currency assumptions visible in the API.
- Use immutable inputs and strongly typed results.
- Cover normal cases, boundary cases, and invalid input with tests.
- Do not mix calculations with market-data acquisition, persistence, or UI behavior.
