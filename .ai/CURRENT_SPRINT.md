# Current Sprint

## Sprint

Sprint 2 — Analytics Engine

## Version

0.1.0

## Goal

Build a small set of deterministic, testable financial calculations with explicit units, assumptions, and edge-case handling.

## Current Status

CAGR, annual compound-growth projection, and XIRR are implemented and pass the full CI workflow. The next deliverables are net worth and asset allocation, after inspecting existing domain models and defining non-double-counting rules.

## Completed

- Repository foundation and CI quality gates
- PowerShell bootstrap, validation, doctor, WhatIf non-mutation, no-overwrite, and path-safety tests
- CAGR calculation and edge-case tests
- Annual compound-growth projection with contribution-timing tests
- XIRR solver with dated cash-flow validation, ACT/365 convention, bisection, and ambiguity rejection

## Next Deliverables

1. Inspect the existing financial entity models and identify authoritative asset/liability inputs.
2. Implement net-worth calculation without double-counting holdings represented in multiple categories.
3. Implement asset allocation with documented classification and valuation rules.
4. Add property-based or table-driven tests for boundary cases.
5. Complete a full history scan and resolve the license/product boundary before public release.

## Release-Safety Work Still Open

- Full history scan for secrets and sensitive data
- License and public/private product-boundary decision
- Anthropic application submission
- Customer discovery and paid-pilot validation
