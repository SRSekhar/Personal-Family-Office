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