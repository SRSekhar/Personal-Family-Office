# Session Handoff

## Latest development — Sprint 17 / IPM-08.1 design (in progress)

Branch: `feature/ipm-08-backtesting-contracts`, based on main integration commit `db739ff0d38fb0da965fd063de4560c54a85a9f6`.

Repository inspection completed for:
- `@pfo/market-data` historical bars, provider/source metadata, point-in-time request and provider capability ports.
- Investment instrument/transaction contracts, FIFO projection, cash-ledger reconciliation, manual valuation and bitemporal drawdown snapshots/calendars.
- Existing XIRR, flow-adjusted drawdown, performance reporting and research evidence contracts.

Drafted:
- `docs/architecture/ADR-IPM-08-BACKTESTING-ARCHITECTURE.md` — proposed package boundary, point-in-time dataset, bitemporal universe, explicit calendar, strategy information boundary, execution/cost proposal, corporate-action gates, simulated-ledger isolation and reproducibility.
- `docs/architecture/IPM-08-BACKTESTING-ACCEPTANCE.md` — dataset/time/universe/execution/corporate-action/accounting/isolation scenarios, including an independently calculated synthetic INR execution fixture.

**Important:** ADR status is Proposed. No typed implementation package, simulation engine, market-data provider, database migration, broker integration or real-ledger mutation has been introduced. Decisions still required include exchange/instrument scope, trading-calendar source, corporate-action semantics, fill/partial-fill policy, cost model, lot-size/tick-size and short/fractional-position policies. Do not guess these in code.

### Next task
Review the unresolved decision list in the ADR. Once the required decisions are accepted, implement the `@pfo/backtesting` typed contracts/validators and acceptance tests. Only then proceed to normalized historical CSV import.

---

