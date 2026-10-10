# Changelog

All notable changes to PFO OS will be documented in this file.

The project follows Semantic Versioning.

---

# Unreleased

## Added

- Configuration-driven PowerShell repository initializer with initialize, validate, doctor, and WhatIf modes.
- Safe path validation for configured repository paths.
- Ignore rules for local financial data and generated reports.

## Changed

- The legacy bootstrap.ps1 entry point delegates to the configured initializer.
- Repository structure validation includes the initializer entry point.
- Bootstrap documentation describes supported operations and safety boundaries.

## Validation status

The implementation has not yet been executed in a local PowerShell environment. CI or a clean-checkout validation is required before this change is considered complete.

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

- Bootstrap validation from a clean checkout
- Initial TypeScript package foundation
