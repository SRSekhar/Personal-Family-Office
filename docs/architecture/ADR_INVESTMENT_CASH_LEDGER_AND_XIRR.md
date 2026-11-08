# ADR — Investment Cash Ledger, Reconciliation and Portfolio XIRR

- Status: Proposed implementation contract
- Date: 2026-11-01
- Workstream: IPM-04 follow-on
- Depends on: schema-v5 investment workspace (PR #425) and FIFO portfolio projection (PR #426)

## Context

The current investment transaction ledger is instrument-centric. Each transaction requires an investment account and instrument, and its signed `cashAmount` is negative for purchases, fees and taxes and positive for sales, dividends and interest. This supports FIFO positions, but it does not identify a cash sub-account, record external funding/withdrawals, or represent transfers between investment accounts.

A sale is a positive cash movement inside a brokerage account; it is not automatically money withdrawn by the investor. Likewise, a purchase is a negative cash movement inside the brokerage account; it is not automatically a new investor contribution. Treating trade cash movements as XIRR external flows would double-count portfolio activity and produce incorrect returns.

## Decision — accounting boundaries

### 1. Separate cash ledger, linked to existing investment accounts

Introduce a typed `InvestmentCashAccount` as a cash sub-account belonging to one existing `InvestmentAccount`.

- Required identity: stable ID, owning investmentAccountId, name/label, currency, createdAt/recordedAt.
- Currency must equal the owning investment account currency. One cash account cannot hold multiple currencies; FX is not supported.
- Multiple cash sub-accounts may exist under an investment account only when their real-world identity is distinct and explicitly recorded. Do not synthesize one from an investment account merely because the account exists.
- Investment transactions may optionally reference an investmentCashAccountId. If absent, their position accounting remains valid, but cash reconciliation for that event/account is incomplete and must be reported as unavailable/incomplete rather than guessed.

### 2. Cash movements and sign convention

Cash movement amount is always expressed from the cash-account balance perspective:

- Positive: cash increases in that cash account.
- Negative: cash decreases in that cash account.

The existing investment transaction cashAmount already follows this account-balance convention: Purchase negative; Sale positive; Dividend/Interest positive; Fee/Tax negative. Preserve those amounts and, when a cash-account link is present, project exactly one corresponding cash movement. Do not create a second editable copy of a trade's settlement amount.

Introduce a separate immutable `InvestmentCashMovement` for events that are not instrument transactions:

- `ExternalContribution`: positive cash movement into the investment cash account, linked to an explicit external source/reference where supplied.
- `ExternalWithdrawal`: negative cash movement out of the investment cash account, linked to an explicit external destination/reference where supplied.
- `OpeningBalance`: signed opening cash balance at a clearly stated effective timestamp, entered only from an explicit statement/balance source.
- `Transfer`: represented by one atomic transfer record with source cash account, destination cash account, positive amount, currency, effectiveAt, recordedAt and stable external/idempotency reference. The projection emits a negative source leg and equal positive destination leg. Both accounts must use the same currency. A transfer must never be represented as an external contribution or withdrawal at portfolio scope.
- No generic balancing plug or silent adjustment event. Corrections use explicit reversal/correction records with reason, original event reference, effectiveAt and recordedAt; immutable history is retained.

Cash movements linked to an instrument transaction are derived from that transaction, not duplicated as separately editable records. Each source event must contribute at most once to a cash account projection.

### 3. Reconciliation and statement evidence

Introduce immutable `InvestmentCashStatement` observations containing cashAccountId, statement period (start/end), statement closing balance, currency, statementAsOf, recordedAt, source name and optional external reference.

Reconciliation must:
- Start from an explicit opening-balance event or statement baseline; never assume zero.
- Sum only cash movements effective on or before statementAsOf and recorded into the system by the selected recordedAt/as-of cutoff.
- Compare computed ledger balance with the statement closing balance.
- Show expected balance, statement balance, signed difference, event count, unmatched/missing-link count and the coverage period.
- Mark the result `incomplete` when opening balance or any in-scope cash movement is missing/unlinked, `reconciled` only when complete and within currency minor-unit tolerance, and `difference` when complete but unequal.
- Never create a balancing entry or silently rewrite history to force a match.
- Preserve both effective and recorded timestamps so a later backfill cannot rewrite a historical as-of result.

### 4. Portfolio XIRR — external investor flows only

XIRR is calculated separately per currency. Never combine unlike currencies and never convert them without an explicit, point-in-time FX feature.

- External contribution: investor-perspective cash flow is negative; derive as the negative of the positive cash-account movement.
- External withdrawal: investor-perspective cash flow is positive; derive as the negative of the negative cash-account movement.
- Internal transfers: excluded from portfolio-level XIRR. If calculating a sub-portfolio/account return, transfers crossing its boundary are classified as contribution/withdrawal for that explicitly selected boundary and must be netted at the encompassing portfolio level.
- Purchases, sales, dividends, interest, fees and taxes are internal portfolio events and are not investor external flows. Their value is reflected through cash and instrument positions.
- Terminal value at the selected as-of date is the sum of explicitly valued open positions plus reconciled cash balances, by currency. Do not include stale/missing/unreconciled cash as though it were confirmed value.
- If any required open position valuation or cash balance is missing/incomplete, return an explicit unavailable result with reasons; do not emit a partial XIRR.
- Use the existing deterministic `calculateXirr` implementation and its single-sign-change ambiguity guard. Do not introduce a second XIRR solver.
- Report cash-flow count, first/last dates, gross contributions, withdrawals, terminal value, net gain and annualized money-weighted return. Clearly distinguish realised/unrealised P&L from money-weighted return.

### 5. Corrections, duplicates and idempotency

- Cash events and transfer records are immutable. Corrections are append-only reversals/replacements with references to the original.
- Stable IDs and unique external references are enforced where the provider/statement supplies them; duplicate imports must be idempotent.
- A transfer is one aggregate event, not two independently editable legs; validation rejects same-account, cross-currency, non-positive, or unbalanced transfer data.
- Conflicting backdated entries retain their original recordedAt and are excluded from earlier point-in-time results.
- Statement observations are immutable. A corrected statement is a new observation linked to the superseded statement, not an overwrite.

## Proposed schema-v6 collections

Additive collections, retaining all schema-v5 data and backup compatibility:

1. `investmentCashAccounts`
2. `investmentCashMovements` — external contributions/withdrawals and opening-balance events; linked instrument events are projected, not duplicated.
3. `investmentCashTransfers` — atomic same-currency transfers.
4. `investmentCashStatements` — immutable statement closing-balance observations.

Schema-v6 migration must use the established transactional migration and pre-migration recovery-artifact pattern. Existing investment transactions remain byte-for-byte equivalent where possible; new cash-account links are optional during migration. A migrated v5 workspace has no inferred opening cash balances, no inferred external contributions/withdrawals and no automatic cash-account records. Its cash reconciliation and portfolio XIRR are therefore explicitly unavailable until the user records sufficient source data.

## Required acceptance matrix

- Opening balance and subsequent purchase/sale/dividend/interest/fee/tax movements reconcile to a known statement.
- Explicit external contribution and withdrawal have correct XIRR signs.
- Purchase and sale never appear as investor external flows.
- Reinvested dividends remain internal; cash dividends increase cash and terminal value without double-counting.
- Same-currency internal transfer debits one account and credits another; portfolio aggregate net is zero.
- Cross-currency transfer is rejected until FX is explicitly designed.
- Missing opening balance, unlinked investment event, missing statement, stale cash statement and incomplete valuation all produce unavailable/incomplete states, never a guessed zero.
- Duplicate imports are idempotent; reversal/correction preserves prior as-of results.
- Backdated event recorded after an as-of date does not alter that historical result.
- Multi-account portfolio XIRR nets internal transfers and is consistent with a consolidated cash-flow series.
- Multiple currencies produce independent results.
- Negative returns, zero terminal value, no contributions, one-date series, and ambiguous multiple-sign-change series are handled explicitly by the existing XIRR solver.
- SQLite v5-to-v6 migration rollback/recovery, backup export/import and browser workflows use synthetic fixtures only.

## Explicit non-goals

No live broker/bank integration, automatic statement scraping, FX conversion, tax-lot methodology beyond the existing FIFO projection, corporate-action processing, AI-generated entries, automatic balancing, or trade/order execution is included in this decision.
