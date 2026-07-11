# @pfo/core

## Overview

`@pfo/core` contains the foundational infrastructure shared across the PFO OS platform.

This package provides common services, abstractions and utilities used by all applications and packages.

---

## Responsibilities

- Core abstractions
- Dependency injection
- Configuration
- Logging
- Exceptions
- Result types
- Common utilities
- Base interfaces

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
pnpm --filter @pfo/core build
```

Type Check

```bash
pnpm --filter @pfo/core typecheck
```

Lint

```bash
pnpm --filter @pfo/core lint
```

---

## Dependencies

This package should have minimal external dependencies.

Higher-level packages may depend on `@pfo/core`, but `@pfo/core` should not depend on application-specific packages.

---

## Status

Active Development