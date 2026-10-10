# @pfo/analytics

## Overview

`@pfo/analytics` composes existing domain models and deterministic calculators into higher-level financial analysis. It contains no UI, persistence, market-data acquisition, foreign-exchange service, or AI-generated decision logic.

## Implemented: explicit portfolio analysis

The initial analysis API calculates net worth and asset allocation from explicitly selected portfolio records.

```typescript
import { Identifier } from '@pfo/core';
import { analyzePortfolio } from '@pfo/analytics';
import {
    Asset,
    AssetType,
    Currency,
    Liability,
    LiabilityType,
    Money,
    Portfolio
} from '@pfo/models';

const portfolio = new Portfolio(
    Identifier.create('household'),
    'Household',
    [
        new Asset(
            Identifier.create('cash-account'),
            'Cash account',
            AssetType.Cash,
            new Money(100_000, Currency.INR)
        )
    ],
    [],
    [
        new Liability(
            Identifier.create('home-loan'),
            'Home loan',
            LiabilityType.HomeLoan,
            new Money(25_000, Currency.INR)
        )
    ],
    []
);

const result = analyzePortfolio({
    portfolio,
    currency: Currency.INR,
    selections: [
        {
            source: 'asset',
            sourceId: 'cash-account',
            canonicalId: 'cash-account',
            category: 'Cash'
        },
        {
            source: 'liability',
            sourceId: 'home-loan',
            canonicalId: 'home-loan',
            category: 'Loans'
        }
    ]
});

result.netWorth.netWorth.amount; // 75_000
result.assetAllocation.allocations; // Cash category, weight 1
```

### Why selection is explicit

The current domain model allows the same economic holding to appear as an `Asset`, `Investment`, or `Property`. Automatically aggregating every collection could silently double-count a holding. The caller therefore selects source records explicitly and supplies:

- `source` and `sourceId`: the domain collection and record to read.
- `canonicalId`: a stable identity for the real-world economic position.
- `category`: the reporting/allocation category.

The mapper rejects missing source records, duplicate source selections, and duplicate canonical IDs. Use the same canonical ID for records known to represent the same holding so the analysis fails rather than silently double-counting them. The caller remains responsible for selecting a complete and non-duplicated set of positions.

### Currency and valuation rules

All selected positions must already be valued in the requested currency. Mixed currencies are rejected; no FX rate is inferred or fetched. The analysis uses the values stored in the supplied domain entities and does not fetch current market prices.

## Planned responsibilities

- Cash-flow analysis
- Investment performance analysis
- Income and expense trends
- Goal progress analysis
- Financial health metrics
- Risk analysis and forecasting support, subject to explicit assumptions and validation

## Package Structure

```text
src/
    PortfolioPositionMapper.ts
    PortfolioAnalysis.ts
    index.ts
tests/
    PortfolioAnalysis.test.ts
```

## Development

```bash
pnpm --filter @pfo/analytics build
pnpm --filter @pfo/analytics typecheck
pnpm --filter @pfo/analytics lint
pnpm test
```

## Design Guidelines

- Analytics must be deterministic and side-effect free.
- Separate calculation logic from composition and mapping.
- Keep source selection, currency, and valuation assumptions explicit.
- Use immutable inputs and strongly typed results.
- Test missing data, duplicate records, mixed currencies, and boundary conditions.
- Do not provide investment recommendations without a separate, explainable, and appropriately reviewed design.
