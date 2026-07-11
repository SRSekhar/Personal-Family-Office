# @pfo/shared

## Overview

`@pfo/shared` contains reusable utilities shared across multiple PFO OS packages.

The package should remain domain-independent and contain only generic functionality.

---

## Responsibilities

- Utility functions
- Extension methods
- Constants
- Enumerations
- Helper classes
- Date and time utilities
- String utilities
- Collection utilities

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
pnpm --filter @pfo/shared build
```

Type Check

```bash
pnpm --filter @pfo/shared typecheck
```

Lint

```bash
pnpm --filter @pfo/shared lint
```

---

## Design Guidelines

- Keep the package framework-agnostic.
- Avoid business logic.
- Avoid financial domain models.
- Do not introduce circular dependencies.
- Prefer pure functions where practical.

---

## Status

Active Development