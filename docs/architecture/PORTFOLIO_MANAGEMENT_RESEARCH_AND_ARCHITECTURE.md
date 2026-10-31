# Portfolio Management — Architecture & Research Adoption

## Decision

PFO OS will evolve the existing portfolio analysis into a local-first investment portfolio management capability. The existing domain, dashboard, SQLite workspace, backup/restore, import/export, offline reports, and deterministic analytics remain the system of record and must retain backward compatibility.

This document records an architecture direction and research findings. It does not grant permission to copy third-party implementation code wholesale. Implementations must be original, with upstream attribution and license review before any code or substantial derived expression is reused.

## Research reviewed

- TauricResearch/TradingAgents (Apache-2.0): specialist analyst roles, evidence-grounded reports, bull/bear challenge, portfolio/risk manager separation, run provenance, point-in-time correctness, resumable workflows, and evaluation of past decisions.
- OpenBB (repository URL supplied redirects/normalizes to openbq-org/OpenBB): provider extensions around a stable core, typed results, API/MCP surfaces, and a modular provider registry.
- maybe-finance/maybe: archived/unmaintained personal-finance app; AGPL-3.0. Useful product patterns include financial account/holding/transaction views and self-hosted/local deployment concepts. Do not copy its code into this UNLICENSED repository without an explicit AGPL compatibility decision.
- vnpy: event-driven architecture, data manager/recorder, portfolio manager, risk manager, modular gateways and database adapters, and paper/simulation boundaries.
- Microsoft: supplied URL points to a GitHub organization rather than a specific repository. No single Microsoft codebase was selected or copied. Potentially relevant Microsoft projects should be named and license-reviewed before implementation.

## Patterns adopted for PFO

1. **Typed domain core** — instruments, accounts, lots/transactions, valuations, distributions, fees, positions, allocation policies, snapshots, and provenance are explicit domain concepts.
2. **Provider-neutral data boundary** — market-data providers implement a contract; analytics do not depend on a particular vendor. Manual valuation remains a first-class provider.
3. **Event/history-led accounting** — transactions are immutable business events; holdings/positions are derived projections. Corrections use reversal/adjustment records rather than silently rewriting history.
4. **Point-in-time research** — every external fact has source, observed/published time, fetched time, effective date, and data-quality status. Historical analysis must not consume information published after its as-of date.
5. **Deterministic analytics first** — XIRR, realised/unrealised P&L, holdings, allocation drift, and risk statistics are deterministic and testable. AI is optional and cannot change ledger values.
6. **Advisory separation** — independent fundamental, technical, news/macro, and portfolio-risk research modules may create evidence reports. A critic/bear-case step challenges claims. A final synthesis reports uncertainty and citations; it does not submit orders or claim investment advice.
7. **Run provenance and auditability** — persist analysis inputs, as-of timestamp, provider/source versions, configuration, model/provider identifiers, report, and errors. Resume/retry must be idempotent.
8. **Backtesting without look-ahead** — research features are evaluated on date grids with explicit entry/exit assumptions, regional/user-selected benchmark, costs, survivorship caveats, and walk-forward separation. No strategy is promoted on in-sample results alone.
9. **Paper-only execution boundary** — if simulation is later added, it is an isolated paper ledger. Live broker execution is out of scope absent explicit product and security approval.
10. **Risk controls as user policy** — user-configured limits only; surface exposure, concentration, liquidity/data gaps and policy breaches. No hidden default thresholds.

## Target module boundaries

- `@pfo/models`: versioned investment domain entities/value objects.
- `@pfo/portfolio` (proposed): ledger projection, position/lot accounting, corporate actions, allocation policy and portfolio snapshots.
- `@pfo/market-data` (proposed): provider contracts, manual price source, cached observations and provenance.
- `@pfo/analytics`: deterministic returns, performance attribution, allocation, risk and benchmark-relative analytics.
- `@pfo/research` (proposed): optional evidence collection and structured research workflow; no ledger writes.
- `@pfo/backtesting` (proposed): point-in-time evaluation and reproducible experiment runs.
- Dashboard and CLI: presentation/workflow adapters only.
- SQLite: local system of record, with versioned migrations and validated export/restore.

These are target boundaries, not permission to create unused packages prematurely. Introduce them when a cohesive, testable use case requires them.

## Migration and compatibility

- Preserve the existing schema-v4 workspace and all five collections until a reviewed schema migration is ready.
- New investment fields are optional during migration; legacy investment records must round-trip unchanged.
- Use a new explicit schema version for additive portfolio-ledger data. Migrate transactionally and retain rollback/recovery.
- Keep all financial data local by default. Provider calls are opt-in, disclose data sent, and never embed credentials in browser code or Git.
- No cloud database, auto-sync, live broker execution, automatic trades, AI-written ledger entries, or invented financial data.

## License and attribution guardrails

- TradingAgents advertises Apache-2.0; preserve license/NOTICE obligations if code is ever reused.
- Maybe advertises AGPL-3.0 and is archived. Do not integrate its source into PFO absent an explicit licensing decision.
- OpenBB and vnpy licenses must be inspected at the exact upstream revision and component before any code reuse.
- Microsoft is an organization URL, not a repository. Select a concrete repository before any implementation reuse.
- Prefer clean-room reimplementation of architectural ideas. Record source, commit, files inspected, license, and rationale in a third-party attribution register for any copied or adapted code.
- PFO's root package is currently UNLICENSED; clarify PFO distribution/license before copying third-party code.

## Phased delivery

1. Architecture and data-model ADR plus compatibility/migration plan.
2. Investment ledger domain: instrument, account, transaction, lot, cash flow, fees, dividends, corporate-action-ready event types.
3. Position projection and valuation history, including manual prices and source provenance.
4. Performance: cost basis, realised/unrealised P&L, XIRR, CAGR and cash-flow reconciliation.
5. Allocation targets, exposure, drift, and user-defined risk policies.
6. Typed provider contracts and first opt-in provider only after API documentation and credential/security review.
7. Research reports with source evidence, bull/bear review, point-in-time controls, reproducible runs and safe AI boundary.
8. Backtesting and paper portfolio as separately gated modules.

Every phase must preserve legacy functionality and include migration, restore, and synthetic browser acceptance coverage.

### Additional Microsoft research

The generic `github.com/microsoft` organization link was narrowed to **Microsoft Qlib** (`microsoft/qlib`), an AI-oriented quantitative investment platform. Its loose-coupled modules and full research workflow (data processing, model training, backtesting, portfolio analysis and execution) are relevant architectural patterns. PFO adopts modular research pipelines, point-in-time data handling, experiment reproducibility, and strict separation between signals, portfolio decisions and execution. Qlib's full ML platform is not being imported as a dependency; PFO remains TypeScript/Node and deterministic-first.

### Refined upstream source/license register

| Project | Repository inspected | License evidence | PFO treatment |
| --- | --- | --- | --- |
| TradingAgents | `TauricResearch/TradingAgents` | Apache-2.0 badge/GitHub metadata | Architecture only; specialist research, adversarial review, provenance and point-in-time controls. |
| OpenBB | `OpenBB-finance/OpenBB` resolves to `openbq-org/OpenBB` | Apache-2.0 stated in repository README | Architecture only; core + typed provider/router extension pattern. |
| Maybe | `maybe-finance/maybe` | AGPLv3 stated in README; repository archived | Product/UX pattern reference only; no source reuse without an explicit AGPL decision. |
| Microsoft Qlib | `microsoft/qlib` | License not independently reviewed in this pass | Architecture only; exact LICENSE review required before code reuse. |
| vn.py | `vnpy/vnpy` | MIT declared in `pyproject.toml` | Architecture only; modular adapters, event/data management, risk and paper-account boundaries. |

The project URL provided for Microsoft is an organization, not a single repository. Qlib was selected as the directly relevant quantitative-investment project, but no Microsoft source code was copied.
