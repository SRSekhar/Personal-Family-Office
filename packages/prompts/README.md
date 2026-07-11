# @pfo/prompts

## Overview

`@pfo/prompts` contains the reusable prompt library for PFO OS.

This package centralizes prompt templates used by AI providers, ensuring consistency, versioning and maintainability across the platform.

---

## Responsibilities

- System prompts
- User prompts
- Prompt templates
- Prompt builders
- Prompt versioning
- Prompt validation
- Prompt metadata
- AI provider abstractions

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
pnpm --filter @pfo/prompts build
```

Type Check

```bash
pnpm --filter @pfo/prompts typecheck
```

Lint

```bash
pnpm --filter @pfo/prompts lint
```

---

## Design Guidelines

- Prompts should be deterministic where possible.
- Separate prompt content from application logic.
- Store reusable prompts instead of duplicating text.
- Version prompts when behavior changes.
- Keep prompts provider-agnostic unless provider-specific features are required.
- Document the purpose and expected output of each prompt.

---

## Future Scope

Examples of prompt categories:

- Financial Analysis
- Portfolio Review
- Goal Planning
- Tax Analysis
- Insurance Review
- Investment Research
- Executive Reporting
- Data Quality Validation

---

## Status

Active Development