## 2026-11-21 — IPM-08.1 historical OHLCV CSV ingestion

- Added strict offline PFO-native OHLCV dataset CSV import to @pfo/backtesting, with explicit instrument/provenance/coverage metadata, source-artifact and normalized SHA-256 digests, preserved unknown availability, and fail-closed row/calendar validation.
- CI #2056 passed (102 test files / 945 tests, lint, typecheck, build and Chromium smoke); Secret Scan #1851 passed on head 05731ffa7f758195aa96da679d05a307d3982180.
- No provider, persistence, schema migration, UI, simulator, broker or real-ledger behavior was added. IPM-08 ADR remains Proposed.

# Changelog

All notable changes to PFO OS will be documented in this file.

The project follows Semantic Versioning.

---

# Unreleased

- IPM-08.1 architecture proposal: added a proposed point-in-time backtesting ADR and acceptance contract covering immutable historical data provenance, bitemporal universe membership, explicit trading calendars, strategy information boundaries, execution/cost assumptions, corporate-action gates, simulated-ledger isolation and reproducibility. Added the initial `@pfo/backtesting` contract/validation package with no simulation engine. No provider adapter, schema migration or live trading is included; unresolved execution/data/accounting decisions remain gates. CI #2045 passed (101 test files / 934 tests, lint, typecheck, build and both browser smoke workflows); Secret Scan #1839 passed on `8a8e7c481459860715c253f68f213e9dabef7015`.

- 2026-11-15: Sequentially merged PRs #453–#457 into main. Integrated workspace schema v13 / 20 collections, flow-adjusted drawdown, performance review and period comparison, statement reconciliation, provider-neutral market-data contracts, evidence-grounded research, and complete intermediate SQLite migration-recovery artifact coverage. PR-head CI and Secret Scan passed for each; final main CI #2025 and Secret Scan #1819 passed on closeout head `db739ff0d38fb0da965fd063de4560c54a85a9f6`.

## Added

- IPM-07 evidence-grounded research and AI review: new `@pfo/research` package with four specialist capability ports, source/evidence provenance and SHA-256 digests, strict claim citations, as-of/recorded-at cutoffs, independent bullish/bearish challenge, injection-aware prompt envelopes, stale/point-in-time warnings, model/provider/adapter/prompt version tracking, explicit-path local JSON persistence, idempotency and resume. No LLM provider or outbound calls, no household data transmission, and no ledger/valuation/price-target/order mutation. Local JSON is not encrypted. Merged into main via PR #457 on 2026-11-15. Verified head `88338ede3d0d64b8454c3fe979e76bd584020fa7`: CI #2011 (100 files / 922 tests, lint, typecheck, build and both Chromium browser smoke workflows) and Secret Scan #1805 passed on 2026-11-15. Vendor-specific adapters and end-user UI remain gated.


- IPM-06 provider-neutral market-data boundary: new `@pfo/market-data` package with separate identity, quote, historical-bar, fundamentals and corporate-action ports; normalized source/licensing/timezone/delay/freshness/coverage/adjustment/point-in-time metadata; capability conformance validation; explicit bounded timeout/retry/cache policy; cancellation and sanitized errors. No provider, SDK, endpoint, credential, outbound call, persistence or automatic valuation import is included. Verified on head `6b136b4e4e27f92209a2005df6c143ae29e6048d`: CI #2006 (98 files / 912 tests) and Secret Scan #1800 passed on 2026-11-15. Merged into main via PR #456 on 2026-11-15.

- IPM-05 Option B statement reconciliation implementation: immutable normalized transaction/holdings evidence, conservative transaction matching, FIFO quantity comparison, private JSON evidence import and formula-safe CSV reconciliation export. Adds schema-v13 backup/SQLite persistence and transactional v12→v13 migration with a protected recovery artifact. Verified on code head dc9a66c30296a9e0e001f5b295f95482fa163d17: CI #2000 (95 files / 900 tests), Secret Scan #1794 and dashboard packaging #1236 passed on 2026-11-15. Merged into main via PR #455 on 2026-11-15.


- Historical investment period comparison: explicit user-entered UTC windows are independently analyzed through the existing flow-adjusted drawdown series; comparison derives only wealth-index endpoint returns and reuses drawdown/recovery metrics. Private standalone HTML and formula-safe CSV include peak/trough/recovery timestamps, observed coverage, snapshot completeness evidence, limitations, persisted calendar provenance, overlap flags and unavailable reasons. Source signatures block stale exports; no schema migration, FX, external prices or inferred observations. PR #454 was merged into main on 2026-11-15; final implementation head `01131e7c3f36901aeabd5ffe8f0673cec08c3d05` passed CI #1980, Secret Scan #1774 and dashboard packaging #1216 on 2026-11-15.

- Private investment portfolio performance review exports: standalone HTML and spreadsheet-safe CSV reuse the existing FIFO position/P&L projection and ledger-backed per-currency XIRR; include currency-separated totals, valuation provenance, explicit as-of/recorded-at cutoff, and unavailable states for missing open-position valuations. Exports are private-only, with no FX conversion, new formula or schema change. PR #454 was merged into main on 2026-11-15; CI #1900, Secret Scan #1694 and dashboard packaging #1136 passed on code head ec32db25dd22c822965727e8648b7092f87b7c5c.

- Auditable flow-adjusted investment drawdown: Option B chain-linked calculator, ledger-derived snapshot completeness and external-flow taxonomy, immutable daily-close calendar authoring and as-of series selection, private manual valuation capture, paired pre-flow/post-flow capture tied to authoritative cash-ledger flows, independent hand-calculated acceptance across corrections/flows/transfers/fees/taxes/closed positions/missing closes, and private descriptive HTML/CSV reports with observed coverage and completeness evidence. SQLite schema v12 (19 collections), protected v11→v12 recovery, JSON/SQLite backup compatibility and demo/private report isolation are verified. PR #453 was merged into main on 2026-11-15; in-kind flows and corporate actions remain deferred pending a separate ledger-model decision. Latest verified head `06b0c14bdef50f8550a92e67167a0e00bdd68b2c` passed CI #1889, Secret Scan #1683 and dashboard packaging #1125.

- User-configured investment exposure limits over weighted look-through classifications: immutable bitemporal policy versions, explicit user maximum percentages and > / >= comparators, complete-data evaluation, private-workspace authoring, SQLite schema v10, 17-collection backup/restore and v9→v10 migration with pre-migration recovery artifact (PR #452 merged 2026-11-13; CI, Chromium smoke, dashboard packaging and Secret Scan passed).
- User-defined weighted multi-group investment exposure classifications with provenance, bitemporal history and complete look-through aggregation (PR #450 merged).
- Investment exposure-classification decision ADR comparing single-group assignment and weighted multi-group look-through, and defining the data-contract decisions required before implementation (PR #449; CI and Secret Scan passed).
- Customer discovery playbook with a non-leading interview script, anonymized evidence template, privacy guardrails, and explicit paid-pilot decision thresholds.

- Configuration-driven PowerShell repository initializer with initialize, validate, doctor, and WhatIf modes.
- Safe path validation for configured repository paths.
- CI workflow for frozen dependency installation, bootstrap checks, lint, typecheck, build, and tests.
- PowerShell regression tests for WhatIf non-mutation, existing-file preservation, and unsafe path rejection.
- Security policy and an initial public-repository exposure review.
- High-severity dependency vulnerability auditing in CI; patched pnpm and test-runner dependencies, refreshed the lockfile, and confirmed the audit reports no known vulnerabilities.
- Dependency license inventory generator and CI artifact for 152 npm package versions; 9 entries remain flagged for manual review after PR #35 merged. The inventory is not a legal compatibility determination.
- Full-history Gitleaks scanning in CI, scheduled weekly and on pull requests.
- Weekly Dependabot updates for workspace dependencies and GitHub Actions.
- GitHub Actions pinned to immutable commit SHAs in the CI workflow.
- Deterministic CAGR calculator with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing and validation.
- XIRR calculator for irregularly dated cash flows using ACT/365 and bisection, with explicit rejection of ambiguous multi-sign-change streams.
- Net-worth calculator with canonical financial position validation and no implicit currency conversion.
- Asset-allocation calculator with category aggregation, deterministic ordering, and validated weights.
- Portfolio analysis composition and explicit source-record mapping (merged after CI and full-history secret scan passed).
- Versioned portfolio report model and self-contained offline HTML renderer, with canonical UTC timestamp checks, net-worth consistency validation, defensive top-level/allocation payload validation, and allocation value/weight reconciliation (PRs #33, #36, #38–#40, #43).
- First-pass upstream evidence review for all nine flagged dependency-license entries (PR #42).
- CI dependency inventory now records root-level license/notice filenames and found a root-level license file for each of the nine flagged versions (PR #45–#46); file-content review and final legal/redistribution disposition remain open.
- Serialized report currency-code validation prevents malformed values from reaching the formatter (PR #47).
- Report dates use semantic HTML time elements; nested monetary currencies and analysis allocation totals are checked before report serialization (PRs #50–#52).
- Customer discovery playbook operationalizes the existing revenue-validation experiment without claiming demand or paid-pilot commitments (PR #48).

## Changed

- The legacy bootstrap.ps1 entry point delegates to the configured initializer.
- Root build and typecheck commands execute workspace dependencies in the correct order.
- Vitest configuration migrated from the deprecated workspace API to the projects configuration.
- The currency test filename now uses the TypeScript test extension.
- Git ignores root local financial data and generated reports.

## Validation status

The full CI workflow and full-history Gitleaks scan passed on main after PR #39 (merge commit 81d39c0d7617fd1b5b51933d406f813e323dc08b). The automated dependency audit reported no known vulnerabilities at the configured high-severity threshold in that run. Nine dependency-license entries still require manual review; a separate personal-data review and project licensing/product-boundary decision remain outstanding. PR #40 merged at `fd5a90f10f386cbdd63c34221d069b3f932451be` after CI and full-history secret scanning passed. PR #43's CI and full-history secret scan passed before merge at `8a39612d5ac1696fdb7390a9f65506c520363320`.

---

# [0.1.0] — Repository Foundation (Technical foundation complete; release gates remain)

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

- Ongoing full-history secret scan and separate personal-data review
- Product-boundary and licensing decisions
- First validated user/revenue hypothesis
