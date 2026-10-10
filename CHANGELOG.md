# Changelog

All notable changes to PFO OS will be documented in this file.

The project follows Semantic Versioning.

---

# Unreleased

## Added

- Configuration-driven PowerShell repository initializer with initialize, validate, doctor, and WhatIf modes.
- Safe path validation for configured repository paths.
- CI workflow for frozen dependency installation, bootstrap checks, lint, typecheck, build, and tests.
- Security policy and an initial public-repository exposure review.
- Deterministic CAGR calculator with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing and validation.

## Changed

- The legacy bootstrap.ps1 entry point delegates to the configured initializer.
- Root build and typecheck commands execute workspace dependencies in the correct order.
- Vitest configuration migrated from the deprecated workspace API to the projects configuration.
- The currency test filename now uses the TypeScript test extension.
- Git ignores root local financial data and generated reports.

## Validation status

The bootstrap PR passed the full CI workflow, including PowerShell initialization, validation, and doctor. The CAGR and compound-growth changes also passed their pull-request CI checks. A full historical secret scan and legal/licensing review remain outstanding.

---

# [0.1.0] - Repository Foundation (In Progress)

## Added

- GitHub repository
- Repository folder structure
- AI onboarding framework
- START_HERE.md
- AI Context
- AI Contract
- Project State
- Sprint Management
- Product Backlog
- Executive Decisions
- Glossary
- Prompt Library
- Initial README

## Changed

- Repository adopts GitHub Flow.
- Repository designated as the permanent source of truth.

## Remaining

- Explicit WhatIf regression coverage
- Full historical secret and sensitive-data scan
- Product-boundary and licensing decisions
