# AI Context

## Purpose

This document is the primary onboarding guide for any AI assistant contributing to PFO OS.

Every AI session MUST begin by reading this document before making any design, documentation or code changes.

This repository—not previous conversations—is the permanent source of truth.

---

# Project

Name

PFO OS

Full Name

Personal Family Office Operating System

Repository

Personal-Family-Office

Current Version

0.1.0

Status

Active Development

---

# Vision

Build an enterprise-grade Personal Family Office Operating System that enables the Principal to preserve, grow, manage and review wealth through engineering discipline, automation and AI.

The platform should evolve over decades and remain maintainable regardless of which AI model or human contributor works on it.

---

# Mission

Create a financial operating system that:

- Is data-driven.
- Is AI-native.
- Is highly maintainable.
- Produces repeatable analysis.
- Documents every important financial decision.
- Generates reports automatically.
- Supports long-term financial independence.

---

# Core Principles

1. Repository is the Memory.
2. Data is the Source of Truth.
3. Reports are generated—not manually maintained.
4. Architecture before automation.
5. Principal first.
6. Long-term thinking over short-term optimization.
7. Every recommendation must be explainable.
8. Every significant decision is documented.
9. No assumptions.
10. Production quality only.

---

# Engineering Principles

- Clean Architecture
- Domain Driven Design (DDD)
- SOLID Principles
- Conventional Commits
- Semantic Versioning
- GitHub Flow
- Idempotent automation
- Documentation as code

---

# Repository Structure

The repository is organized into the following major areas.

apps/
Application entry points.

packages/
Reusable domain packages.

docs/
Project documentation.

data/
Financial source data.

reports/
Generated reports.

templates/
Document templates.

scripts/
Automation.

.ai/
AI onboarding and project state.

---

# Current Architecture

Presentation

↓

Application

↓

Domain

↓

Data

Business rules belong inside the Domain layer.

---

# Current Branch Strategy

main

Stable branch.

feature/*

Feature development.

---

# Current Sprint

Refer to:

.ai/CURRENT_SPRINT.md

---

# Project State

Refer to:

.ai/PROJECT_STATE.md

---

# Handoff

Refer to:

.ai/HANDOFF.md

---

# Before Starting Any Work

Every AI MUST:

1. Read START_HERE.md.
2. Read this document.
3. Read PROJECT_STATE.md.
4. Read CURRENT_SPRINT.md.
5. Read HANDOFF.md.
6. Review DECISIONS.md.
7. Continue only the current sprint.

---

# Before Finishing Any Work

Update:

- PROJECT_STATE.md
- HANDOFF.md

if project state has changed.

---

# Never

Never invent financial information.

Never fabricate repository structure.

Never overwrite user data.

Never violate established architecture without documenting the decision.

Never introduce unnecessary complexity.

---

This document is considered authoritative for AI onboarding.