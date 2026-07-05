# PFO OS Architecture

## Purpose

This document defines the architecture of PFO OS.

It serves as the authoritative reference for all contributors and AI assistants.

---

# Architectural Goals

- Maintainable
- Modular
- Testable
- AI-native
- Long-lived
- Extensible

---

# Architectural Principles

- Clean Architecture
- Domain Driven Design (DDD)
- SOLID Principles
- Separation of Concerns
- Single Source of Truth
- Composition over Inheritance
- Convention over Configuration

---

# High-Level Architecture

```
Presentation
      │
Application
      │
Domain
      │
Infrastructure
      │
Data
```

Dependencies always point downward.

Business rules never depend on presentation technologies.

---

# Repository Structure

```
apps/
packages/
docs/
data/
reports/
scripts/
templates/
.ai/
```

---

# Layer Responsibilities

## Presentation

Responsible for user interaction.

Examples:

- Dashboard
- Reports
- CLI

---

## Application

Coordinates workflows.

Contains:

- Report Generation
- Analytics
- Recommendation Services
- Import/Export

---

## Domain

Contains business logic.

Examples:

- Investment
- Portfolio
- Property
- Insurance
- Goal
- Loan

No UI code.

No infrastructure code.

---

## Infrastructure

Technical implementations.

Examples:

- File IO
- JSON Storage
- PDF Generation
- Excel Export

---

## Data

Persistent repository data.

Examples:

- JSON
- Markdown
- Images

---

# Engineering Standards

- TypeScript only
- pnpm workspaces
- Conventional Commits
- Semantic Versioning
- GitHub Flow

---

# AI Principles

AI assists development.

The repository remains the permanent source of truth.

AI never replaces documented architecture.

---

# Future Architecture

Planned packages:

```
packages/
    core
    analytics
    calculators
    recommendations
    reporting
    shared
    models
```

---

# Revision History

| Version | Description |
|----------|-------------|
| 0.1.0 | Initial Architecture |