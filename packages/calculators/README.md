# @pfo/calculators

## Overview

This package contains deterministic, reusable, and unit-testable financial calculations for PFO OS. Financial calculations belong here rather than inside application or presentation code.

## Implemented

### Compound annual growth rate (CAGR)

```typescript
import { calculateCagr } from '@pfo/calculators';

const annualizedRate = calculateCagr({
    beginningValue: 1000,
    endingValue: 1331,
    periods: 3
});

// 0.1 means 10% per period (typically per year).
```

CAGR requires finite, strictly positive beginning and ending values and a finite, positive period count. It returns a decimal rate. It does not account for deposits, withdrawals, taxes, fees, inflation, or interim cash flows.

### Compound-growth projection

```typescript
import { projectCompoundGrowth } from '@pfo/calculators';

const projectedValue = projectCompoundGrowth({
    initialValue: 1000,
    annualRate: 0.07,
    periods: 10,
    contributionPerPeriod: 100,
    contributionTiming: 'end'
});
```

The projection compounds annually. The annual rate is a decimal, periods are whole years, and recurring contributions are annual. The caller must supply and disclose assumptions. The result is a mathematical scenario—not a forecast or guarantee—and excludes taxes, fees, inflation, volatility, and changing contributions.

### XIRR (irregular cash-flow return)

```typescript
import { calculateXirr } from '@pfo/calculators';

const annualizedReturn = calculateXirr([
    { date: new Date('2021-01-01T00:00:00.000Z'), amount: -1000 },
    { date: new Date('2022-01-01T00:00:00.000Z'), amount: 1210 }
]);
```

Amounts must be finite; negative values represent outflows and positive values represent inflows. Dates must be valid Date objects. The solver uses ACT/365 day fractions and bisection. To avoid silently selecting among multiple possible roots, the current implementation requires exactly one sign change after netting cash flows on the same date. Cash-flow streams with multiple sign changes are rejected rather than assigned a potentially ambiguous return.

## Planned capabilities

- Net worth calculations
- Asset allocation
- FIRE and retirement projections
- Loan amortization
- Tax estimation
- Portfolio performance analytics

Planned capabilities must not be represented as implemented until code and tests exist.

## Package Structure

```text
src/
    Cagr.ts
    CompoundGrowth.ts
    Xirr.ts
    index.ts
tests/
    Cagr.test.ts
    CompoundGrowth.test.ts
    Xirr.test.ts
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
- Keep units, timing, date conventions, and currency assumptions visible in the API.
- Use immutable inputs and strongly typed results.
- Cover normal cases, boundary cases, and invalid input with tests.
- Do not mix calculations with market-data acquisition, persistence, or UI behavior.
