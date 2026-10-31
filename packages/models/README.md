# @pfo/models

## Overview

`@pfo/models` contains the core domain models for PFO OS.

This package defines the canonical business entities shared across the platform. It should contain only domain objects and related types, without business logic or infrastructure concerns.

---

## Responsibilities

- Domain entities
- Value objects
- Enumerations
- Domain events
- Data transfer objects (DTOs)
- Request/Response contracts
- Validation types

---

## Package Structure

```
src/
    index.ts
```

---

## Loan domain model

`Loan` is a specialized `Liability`, so it can be included in the existing portfolio liability collection without changing the portfolio shape. It stores the loan type, original and outstanding principal, annual interest rate, monthly payment, start and maturity dates, and optional lender. Principal/payment amounts must use one currency; outstanding principal must be between zero and original principal; dates must be valid and maturity cannot precede origination. Updating the outstanding amount returns a new Loan and preserves the other terms.

The model deliberately does not calculate amortization schedules, infer interest accrual, or determine payoff dates. Those require a separate calculation contract.

## Development

Build

```bash
pnpm --filter @pfo/models build
```

Type Check

```bash
pnpm --filter @pfo/models typecheck
```

Lint

```bash
pnpm --filter @pfo/models lint
```

---

## Design Guidelines

- Models must remain framework-independent.
- Avoid infrastructure code.
- Avoid business services.
- Keep models immutable where practical.
- Use clear, descriptive naming.
- Prefer composition over inheritance.

---

## Status

Active Development
## Investment ledger domain

The investment ledger domain separates an investment account (custodian/account context), an investment instrument (the security or product), and immutable investment transactions (the investor-perspective cash and unit events). Instruments support optional symbol, exchange, and ISIN identifiers, so non-market-traded products such as provident-fund holdings remain valid.

Transactions use signed cash movements: purchases, fees, and taxes are negative; sales, dividends, and interest are positive. Purchase/sale quantities and unit prices are required and must reconcile to the cash amount within one paise-equivalent currency unit tolerance (0.01). Fees and taxes are separate ledger events and must not be embedded again in the trade cash amount. Non-trade events cannot carry units or unit prices.

These models are infrastructure-free and immutable. They do not fetch prices, calculate tax lots, infer valuations, or perform broker synchronization.
