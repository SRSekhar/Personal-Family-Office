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

### Net worth

```typescript
import { calculateNetWorth, Currency, Money } from '@pfo/calculators';
// Currency and Money are exported by @pfo/models in application code.

const result = calculateNetWorth({
    currency: Currency.INR,
    positions: [
        { id: 'cash-account-1', kind: 'asset', category: 'Cash', value: new Money(100_000) },
        { id: 'home-loan-1', kind: 'liability', category: 'Loans', value: new Money(25_000) }
    ]
});
```

Net worth returns total assets, total liabilities, and net worth as `Money` values. Every position must have a unique, stable canonical ID, a non-empty category, a non-negative value, and the requested currency. The calculator does not convert currencies or infer whether different source records represent the same economic holding. The caller must map each holding once and explicitly convert amounts before aggregation.

### Asset allocation

```typescript
import { calculateAssetAllocation } from '@pfo/calculators';

const allocation = calculateAssetAllocation({
    currency: Currency.INR,
    positions: [
        { id: 'cash-account-1', kind: 'asset', category: 'Cash', value: new Money(25_000) },
        { id: 'equity-fund-1', kind: 'asset', category: 'Equity', value: new Money(75_000) }
    ]
});
```

Asset allocation groups asset positions by their supplied category and returns each category's value and weight as a fraction from 0 to 1. Liability positions are validated but excluded from allocation. Category names are trimmed and output is sorted deterministically. No asset positions returns an empty allocation; asset positions with a zero total are rejected because weights would be undefined.

## Planned capabilities

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
    FinancialPosition.ts
    NetWorth.ts
    AssetAllocation.ts
    index.ts
tests/
    Cagr.test.ts
    CompoundGrowth.test.ts
    Xirr.test.ts
    NetWorth.test.ts
    AssetAllocation.test.ts
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
