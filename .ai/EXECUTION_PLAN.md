# PFO OS Execution Plan

**Updated:** 2026-10-17  
**Purpose:** Turn the current repository into a coherent, testable local-first product before expanding scope. This plan is an execution contract, not a claim that planned work is complete.

## Product outcome

Deliver a usable local-first workflow that lets a household enter or import its own records privately, understand its financial position, run transparent deterministic FIRE scenarios, and export a reproducible offline report. Validate that real users value this workflow before investing in hosted services, AI advice, historical storage, or additional feature families.

## Delivery rules

- Work in small PRs. Merge only after relevant CI and full-history secret scanning pass.
- Never commit real household data, secrets, or private reports.
- Reuse domain/calculator packages; do not duplicate financial formulas in the dashboard.
- Keep the hosted/non-loopback dashboard sample-only and preserve loopback-only private workspace protections.
- Treat every calculation as a scenario under explicit assumptions, not a forecast, guarantee, or investment recommendation.
- No hosted deployment, license/visibility changes, external applications, or financial/legal decisions without the authorized owner.
- A green build proves engineering checks, not customer demand or production readiness.

## Workstreams and acceptance gates

### W0 — Stabilize the delivery pipeline (in progress)
1. Verify CI and full-history Secret Scan on every PR and main merge.
2. Verify the scheduled/manual autonomous workflow produces a branch and PR, not merely a successful credential preflight.
3. If an agent run fails, capture the failed step and correct the root cause in a separate PR; never expose secret values.
**Exit:** one successful end-to-end autonomous run with a valid focused PR and passing CI/security checks.

### W1 — Calculator correctness (active)
1. Close the zero-spending/extreme-inflation overflow edge case.
2. Retain immutable scenario assumptions and overflow boundary coverage.
3. Run the complete root test/build/typecheck/lint gates.
**Exit:** edge-case regressions merged and main CI/security checks green.

### W2 — FIRE planner requirements and UI (next product increment)
1. Keep ADR-0003 as the contract source. Validate the unresolved choices with a small set of intended users before implementation:
   - first release is a dedicated dashboard section or separate navigation page;
   - inputs remain temporary for the first release, with no automatic persistence;
   - first release uses annual nominal contributions only (monthly support is a separately scoped model);
   - initial workflow prioritizes a single scenario and required-contribution calculation; scenario comparison follows if user evidence supports it.
2. Record the validated choices in ADR-0003 before coding the UI. If user evidence is unavailable, present the choices for owner review rather than silently treating proposals as approved.
3. Implement accessible labeled inputs, visible assumptions, inline errors, result status and gap, and a required-contribution action by reusing existing calculator exports.
4. Add controller/UI tests for validation, success, error handling, keyboard operation, and privacy guard behavior. Check responsive layout and 400% zoom.
5. Keep all calculations local; no remote APIs, telemetry, market data, AI calls, or automatic persistence.
**Exit:** an end-to-end local FIRE workflow with deterministic tests and documented assumptions.

### W3 — End-to-end household report workflow
1. Exercise the local dashboard export → local CLI → offline HTML report flow using synthetic fixtures.
2. Verify malformed backups fail safely, currency mismatch is explicit, generated HTML is self-contained, and private data is not logged or committed.
3. Document exact commands and recovery steps.
**Exit:** repeatable tested workflow from local records to offline report.

### W4 — Validate customer value and commercial direction
1. Use the existing discovery playbook for 8–10 interviews.
2. Record anonymized findings only; distinguish observed behavior from opinions.
3. Seek two explicit paid-pilot commitments before prioritizing unrelated feature families or hosted infrastructure.
4. Update the roadmap based on evidence; no claims of revenue or demand until verified.
**Exit:** documented evidence and a go/no-go decision for a narrowly defined paid pilot.

### W5 — Release readiness (human gates)
1. Complete the dependency license/distribution review and decide the product boundary with qualified review.
2. Complete the repository sensitive-data exposure review.
3. Owner may enable GitHub Pages only after reviewing the sample-only hosted privacy boundary.
4. Define support, backup/recovery, and threat-model requirements before production claims.
**Exit:** all legal, privacy, deployment, and product-boundary gates explicitly resolved by the owner.

## Explicitly out of scope until separately approved

- Investment recommendations, trading, portfolio rebalancing, or claims of safe/guaranteed withdrawal rates.
- Monte Carlo/probabilistic projections without a separately reviewed methodology and validation plan.
- Automatic historical snapshots or choosing a persistence technology before ADR-0002 requirements are validated.
- AI analysis of real household records, external market-data integrations, hosted private financial records, or a public production launch.
- Changing repository visibility/licensing or submitting external applications.

## Current verified status

- Merged foundation includes deterministic FIRE readiness, ordered scenario comparison, and required annual contribution calculation.
- Dashboard local preview and offline report CLI exist; the complete FIRE planner UI is not implemented.
- CI and full-history secret scanning are required merge gates.
- Customer demand and paid-pilot commitments remain unvalidated.
- License/distribution disposition and the one-time Pages setting remain owner/release gates.
- The autonomous workflow must be verified end-to-end; credential preflight alone does not count.

## Next execution sequence

1. Finish and merge calculator edge-case fixes after CI and Secret Scan pass.
2. Reconcile remaining overlapping FIRE regression PRs and close superseded work.
3. Verify autonomous workflow delivery end-to-end.
4. Validate the FIRE planner choices from W2, then implement the smallest complete local-first UI.
5. Validate dashboard-to-report flow, then run customer discovery before expanding scope.
