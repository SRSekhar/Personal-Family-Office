# ADR-0003: Deterministic FIRE planner input/output contract

- **Status:** Accepted for the first local-only planner increment
- **Date:** 2026-10-17
- **Scope:** Local-first FIRE scenario planning
- **Depends on:** Existing @pfo/calculators FIRE readiness, scenario comparison, and required annual contribution APIs

## Context

PFO OS now has deterministic calculators for FIRE readiness, comparing independently specified scenarios, and solving the annual contribution needed to reach a target corpus. The dashboard is a static, vanilla-JavaScript application that runs locally for private records; non-loopback hosted origins are sample-only. The existing dashboard record model does not distinguish liquid investable portfolio value from property, insurance, cash, or other asset categories with enough precision to safely infer a FIRE portfolio.

The first planner is a dedicated dashboard section. Inputs and results remain in memory only. The browser reuses the existing tested calculator implementation through locally built JavaScript ES modules; financial formulas are not duplicated and no remote code is introduced.

## Proposed input contract

Each calculation request must explicitly supply:

1. **Current investable portfolio:** non-negative finite amount, excluding illiquid assets unless the user explicitly intends to include them.
2. **Annual contribution:** non-negative finite amount, held constant in nominal terms by the current model.
3. **Years to retirement:** whole non-negative number of years.
4. **Expected nominal annual return:** finite decimal greater than -1; clearly labeled as a user assumption.
5. **Annual inflation:** finite non-negative decimal.
6. **Annual retirement spending in today's money:** non-negative finite amount.
7. **Initial withdrawal rate:** finite decimal greater than 0 and at most 1, labeled as a user assumption rather than a guaranteed safe rate.
8. **Contribution timing:** **beginning** or **end**, defaulting to **end** where omitted.
9. **Currency/unit:** all monetary inputs in one explicitly displayed currency and unit. The first dashboard experience may use INR because the existing dashboard formatter is INR-only; no foreign-exchange conversion is implied.

All assumptions must be visible before calculation. Inputs are not inferred from generic dashboard records, categories, net worth, or asset allocation.

## Proposed outputs

The planner should show:

- Projected portfolio at retirement under the supplied assumptions.
- Inflation-adjusted annual retirement spending at retirement.
- Target corpus implied by the withdrawal-rate assumption.
- Surplus or shortfall against the target.
- An explicit on-track/shortfall status, with the numeric gap visible.
- The required constant annual contribution for the same target, when requested.
- For comparisons, each scenario's name, complete assumptions, and results in caller-defined order.

The interface must not rank scenarios, select a preferred scenario, or present a result as personalized investment advice.

## Calculation and edge-case behavior

- Reuse the existing tested calculator package; do not duplicate financial formulas inside the dashboard controller.
- Reject invalid, non-finite, or out-of-range assumptions with a clear, accessible validation message.
- A current portfolio already meeting the target requires zero additional contribution in the required-contribution calculation.
- If the target is unmet and zero years remain, explain that future contributions cannot close the shortfall under this model.
- Preserve the distinction between annual nominal contributions and inflation-adjusted retirement spending.
- Keep deterministic scenario analysis separate from any future probability/Monte Carlo model.

## Privacy and storage boundary

- Calculation must run locally in the browser with no remote API, market-data feed, AI provider, telemetry, or network submission.
- The initial planner should not persist FIRE assumptions or results automatically. A later save/history feature requires a separate, explicit persistence decision and backup/recovery requirements.
- Do not infer or transmit personal financial data. Never add real household values to tests, examples, screenshots, or repository files.
- Hosted non-loopback dashboard origins remain sample-only; planner controls must not bypass the existing private-workspace guard.

## Accessibility and interaction requirements

- Use programmatically associated labels, semantic headings, and accessible inline error/status announcements.
- Support keyboard-only operation, visible focus, responsive layout, and 400% zoom without loss of content or functionality.
- Do not rely on color alone to communicate on-track versus shortfall status.
- Display the assumption set and limitations alongside the result, not only in separate documentation.

## Decisions for the first UI increment

- **Navigation:** dedicated FIRE Planner section in the existing dashboard.
- **Persistence:** assumptions and results remain ephemeral and are never automatically saved.
- **Contributions:** annual only; monthly modeling is deferred and no silent conversion is allowed.
- **Sequence:** single-scenario readiness and required annual contribution first, followed by scenario comparison.
- **Product priority:** deliver core product features before autonomous engineering workflow enhancements.

## Browser integration

- `@pfo/calculators` remains the source of truth. `scripts/dashboard/prepare-calculators.mjs` copies its compiled runtime modules into a generated dashboard directory; generated files are not hand-maintained or committed.
- `pnpm dashboard:serve` builds the calculator dependencies and prepares modules before starting the existing loopback-only server.
- The Pages packaging workflow builds the same modules into the static artifact. Hosted non-loopback planner controls are disabled; personal assumptions belong in the local-only workspace.
- Scenario comparison uses the existing tested comparison API, preserves user-entered order, displays scenario-specific assumptions, and does not rank or recommend scenarios.

## Guardrails

- This ADR records the accepted first-increment contract and browser integration boundary.
- Do not choose persistence, introduce a bundler, or alter the private/public boundary under this ADR.
- Do not add investment recommendations, return predictions, market data, or Monte Carlo analysis without a separately reviewed requirements and validation plan.
- Keep the feature local-first and test the existing loopback-only private workspace guard if UI routes or storage behavior change.
