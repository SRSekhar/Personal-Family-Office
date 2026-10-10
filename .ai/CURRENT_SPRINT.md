# Current Sprint

## Sprint

Sprint 2 — Analytics Engine

## Version

0.1.0

## Goal

Build a small set of deterministic, testable financial calculations with explicit units, assumptions, and edge-case handling.

## Current Status

CAGR, annual compound-growth projection, and XIRR are implemented and pass CI. Net worth and asset allocation have been added in PR #19 with tests; this branch requires a successful full CI run before merge.

## Completed

- Repository foundation and CI quality gates
- PowerShell bootstrap, validation, doctor, WhatIf non-mutation, no-overwrite, and path-safety tests
- CAGR calculation and edge-case tests
- Annual compound-growth projection with contribution-timing tests
- XIRR solver with dated cash-flow validation, ACT/365 convention, bisection, and ambiguity rejection
- Net worth totals for assets, liabilities, and net worth using canonical position IDs and explicit currency rules
- Asset allocation grouped by category with stable output ordering and validated weights

## Next Deliverables

1. Review PR #19 and require its full CI run to pass before merge.
2. Map existing domain entities to canonical financial positions at the application boundary.
3. Add a tested historical net-worth snapshot workflow once persistence/source-of-truth decisions are established.
4. Complete a full history scan and resolve the license/product boundary before public release.

## Release-Safety Work Still Open

- Full history scan for secrets and sensitive data
- License and public/private product-boundary decision
- Anthropic application submission
- Customer discovery and paid-pilot validation
