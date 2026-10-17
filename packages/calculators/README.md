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

### FIRE readiness scenario

```typescript
import { calculateFireReadiness } from '@pfo/calculators';

const readiness = calculateFireReadiness({
    currentPortfolio: 1_000_000,
    annualContribution: 100_000,
    yearsToRetirement: 10,
    expectedAnnualReturn: 0.07,
    annualInflationRate: 0.04,
    annualRetirementSpendingToday: 300_000,
    withdrawalRate: 0.04,
    contributionTiming: 'end'
});
```

The calculator estimates projected portfolio value using a nominal annual return and constant nominal annual contributions. It inflates annual retirement spending from today's money to the retirement year, then calculates the target corpus as that spending divided by the caller-supplied withdrawal rate. A positive `surplusOrShortfall` means the projected value exceeds the target; a negative value means a shortfall.

This is a deterministic screening scenario, not a probability model, financial recommendation, or guarantee. It excludes taxes, fees, volatility, sequence-of-returns risk, changing contributions, pension/benefit income, and longevity adjustments. The withdrawal rate and all return/inflation assumptions must be chosen and disclosed by the caller.

### FIRE scenario comparison

```typescript
import { compareFireReadinessScenarios } from '@pfo/calculators';

const comparison = compareFireReadinessScenarios([
    {
        id: 'base',
        name: 'Base case',
        input: {
            currentPortfolio: 1_000_000,
            annualContribution: 100_000,
            yearsToRetirement: 10,
            expectedAnnualReturn: 0.07,
            annualInflationRate: 0.04,
            annualRetirementSpendingToday: 300_000,
            withdrawalRate: 0.04,
            contributionTiming: 'end'
        }
    },
    {
        id: 'lower-return',
        name: 'Lower return',
        input: {
            currentPortfolio: 1_000_000,
            annualContribution: 100_000,
            yearsToRetirement: 10,
            expectedAnnualReturn: 0.04,
            annualInflationRate: 0.04,
            annualRetirementSpendingToday: 300_000,
            withdrawalRate: 0.04,
            contributionTiming: 'end'
        }
    }
]);
```

Each comparison scenario supplies its own complete assumptions. Results preserve input order and return the scenario ID/name, the original inputs, and the existing FIRE readiness result. IDs must be non-empty and unique; names must be non-empty. Invalid financial assumptions are rejected by the underlying calculator. The function does not rank scenarios or recommend an assumption set. This is a deterministic comparison, not a probability model or a guarantee.

### Required annual FIRE contribution

```typescript
import { calculateRequiredFireContribution } from '@pfo/calculators';

const required = calculateRequiredFireContribution({
    currentPortfolio: 1_000_000,
    yearsToRetirement: 10,
    expectedAnnualReturn: 0.07,
    annualInflationRate: 0.04,
    annualRetirementSpendingToday: 300_000,
    withdrawalRate: 0.04,
    contributionTiming: 'end'
});

console.log(required.requiredAnnualContribution);
```

The solver calculates the inflation-adjusted target corpus and solves for the constant nominal annual contribution that reaches it under the supplied return and contribution-timing assumptions. It returns both the required annual contribution and the existing FIRE readiness result. Contribution timing supports `beginning` and `end`, and defaults to `end`. If the current portfolio already meets the target, the required contribution is zero. If a shortfall remains and retirement is now (zero years remaining), it throws because future contributions cannot close that shortfall in this model.

This is deterministic scenario math, not a recommendation or guarantee. It excludes taxes, fees, volatility, sequence-of-returns risk, changing contributions, pension/benefit income, and longevity adjustments. The contribution is held constant in nominal terms; assumptions should be disclosed and tested for sensitivity.

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
import { calculateNetWorth } from '@pfo/calculators';
import { Currency, Money } from '@pfo/models';

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
import { Currency, Money } from '@pfo/models';

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
    FireReadiness.ts
    FireScenarioComparison.ts
    RequiredFireContribution.ts
    index.ts
tests/
    Cagr.test.ts
    CompoundGrowth.test.ts
    Xirr.test.ts
    NetWorth.test.ts
    AssetAllocation.test.ts
    FireReadiness.test.ts
    FireScenarioComparison.test.ts
    RequiredFireContribution.test.ts
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
