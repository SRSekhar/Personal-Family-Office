# Project State

## Project

- **Name:** PFO OS
- **Full Name:** Personal Family Office Operating System
- **Version:** 0.1.0
- **Status:** Active Development

## Current Milestone

**M1 — Technical Foundation**  
Status: Complete — repository bootstrap and CI are implemented and validated. Public-release safety decisions remain open.

## Current Work

- **Epic:** FIRE Planner and Offline Report Workflow
- **Status:** The local-only FIRE planner (PR #139), three-scenario comparison UI (PR #141), and downloadable self-contained FIRE HTML reports (PR #142) are merged to `main`. Each PR's CI, full-history Secret Scan, and dashboard packaging passed before merge.
- The planner reuses the existing deterministic calculator APIs, keeps assumptions/results ephemeral, requires explicit annual assumptions, and disables planner controls on hosted non-loopback origins.
- Scenario comparison preserves entered order, shows the scenario assumptions, and does not rank or recommend scenarios.
- FIRE report export is explicit user action. Reports are script-free, self-contained HTML, validate report inputs/results, escape untrusted scenario names, and are generated locally without network submission.
- The dashboard's static artifact is packaged successfully by CI. PR #145 adds a session-only Goal Tracker for one target with progress, remaining amount, target date, and completion/overdue status; its calculator, dashboard integration, tests, and documentation passed PR CI, Secret Scan, and dashboard packaging before merge. Publishing remains blocked until the repository owner configures GitHub Pages in Settings → Pages with Source set to GitHub Actions.
- Customer demand remains unvalidated; no revenue or paid-pilot commitment is claimed.

## Foundation Verified

- Repository, GitHub Flow, AI onboarding, architecture, and project documentation established.
- Configuration-driven PowerShell bootstrap merged.
- CI uses a frozen pnpm lockfile.
- CI runs initialization, validation, doctor, WhatIf/no-overwrite/path-safety tests, lint, typecheck, build, and tests.
- Pull-request CI passed for the foundation and initial analytics capabilities.

## Implemented Calculator Capabilities

- CAGR calculation with input validation and edge-case tests.
- Annual compound-growth projection with explicit contribution timing, input validation, overflow checks, and tests.
- Deterministic FIRE-readiness scenario: projected investable portfolio, inflation-adjusted annual retirement spending, target corpus from an explicit withdrawal-rate assumption, and surplus/shortfall; assumptions and limitations are documented and tested.
- Deterministic FIRE scenario comparison: evaluates independently specified assumptions in caller-supplied order, preserves inputs/results, rejects blank/duplicate identifiers, and does not rank or recommend scenarios (PR #113).
- Required annual FIRE contribution solver: solves the constant nominal annual contribution needed to meet the inflation-adjusted target, returns zero when the current portfolio is sufficient, and rejects an unmet target with zero years remaining (PR #114).
- XIRR for dated cash flows using ACT/365 and bisection, with date/amount validation and explicit rejection of multi-sign-change cash-flow series.

These are mathematical utilities, not investment advice or guaranteed forecasts. XIRR currently supports cash-flow streams with exactly one sign change to avoid ambiguous roots.

## Next Deliverables

1. Complete remaining interactive browser review for FIRE scenario comparison and report controls, then perform a manual screen-reader audit and real browser-chrome 400% zoom review. Chromium smoke already covers FIRE calculations/reset, Goal Tracker progress/validation, report downloads, keyboard activation, and narrow viewport behavior.
2. Continue offline report checks for any remaining report types; the financial summary, single-scenario FIRE report, three-scenario comparison report, and monthly financial review have been opened from local file URLs with network access blocked in Chromium.
3. Run the planned 8–10 customer interviews and seek two paid-pilot commitments; record only anonymized evidence and do not infer demand from implementation completion.
4. Historical snapshot persistence, explicit valuation dates, multi-year trend/detail views, CSV export, schema v4 backup/restore, duplicate-date protection, and malformed-storage recovery are implemented. Preserve the no-fabricated-history and local-first constraints.
5. Manually review historical repository content and commit metadata for accidental secrets; finish software distribution/legal review and owner-side Pages configuration before release. These gates do not block safe local-first feature work.

## Blockers and Risks

- The GitHub repository is public; do not commit real financial data or private configuration.
- The repository does not yet have a valid open-source license.
- Historical repository content and commit metadata have not been fully scanned.
- The Anthropic application draft is prepared but has not been submitted.
- No revenue, customer demand, or product-market fit has been validated.
- The nine dependency-license inventory flags passed packed-tarball integrity, root-license-file, and upstream license-text hash checks in CI. Current manifests/lockfile indicate development/build/test-only dependency paths, but the final distribution artifact and legal disposition remain outstanding.
- GitHub Pages deployment is blocked by the repository-level Pages setting; the workflow token cannot create the site automatically.


## Latest Follow-up (2026-10-18)

- PR #139 merged the local-only FIRE planner after CI, dashboard packaging, and Secret Scan passed.
- PR #141 merged the ordered three-scenario comparison UI after CI, dashboard packaging, and Secret Scan passed.
- PR #142 merged validated, self-contained FIRE scenario HTML reports and explicit download actions after CI, dashboard packaging, and Secret Scan passed. Manual browser/accessibility verification remains open.
- PR #145 merged a deterministic goal-progress calculator and session-only Goal Tracker UI after CI, Secret Scan, and dashboard packaging passed. It does not persist goals or project returns.
- PR #147 merged static accessibility-contract regression checks for FIRE and Goal Tracker after CI, Secret Scan, and dashboard packaging passed. These assertions do not constitute interactive browser, keyboard, screen-reader, responsive, or 400% zoom verification.
- PR #149 clarified Goal Tracker progress-indicator accessible value text as a percentage of target, including above-target values. CI, Secret Scan, and dashboard packaging passed; actual screen-reader behavior remains unverified.
- Product priority remains complete user workflows and customer validation; autonomous engineering workflow work is intentionally deferred.

- PR #107 merged: hourly autonomous-development workflow committed; first end-to-end agent run is not yet verified.
- PR #108 merged: optional HCNSEC gateway authentication documented alongside Claude Code OAuth; live gateway authentication remains unverified.
- PR #109 merged: the autonomous agent receives read-only GitHub context, and the repository write token is only used by a post-agent publishing step. CI and full-history secret scanning passed before merge.
- PR #110 merged: deterministic FIRE-readiness calculator added to `@pfo/calculators`, with focused validation tests and documented assumptions. The broader FIRE planner remains unfinished.
- PR #112 merged: added native Claude Code file tools to the allowed-tools list, raised the turn budget from 25 to 40, fixed the missing-token diagnostic quoting, and removed a stray trailing quote from the allowed-tools argument. PR CI and secret scan passed.
- PR #113 merged: added tested deterministic FIRE scenario comparison with explicit assumptions and no automatic ranking/recommendation. Full CI and secret scan passed.
- PR #114 merged: added the required annual FIRE contribution solver with boundary/invalid-input tests and documented assumptions. Full CI and secret scan passed.
- HCNSEC and `PFO_AUTOMATION_TOKEN` are configured. The previous manual run authenticated and initialized the gateway but failed before publishing a PR due to agent tool/turn limits. PR #112 fixes those defects; the first end-to-end run on the corrected workflow remains unverified until a run publishes a valid PR and its CI passes.
- Product validation and paid-pilot evidence remain open. GitHub Pages setup and legal/distribution review remain release gates, not reasons to stop safe local-first product development.

## Last Updated

2026-10-18

- PR #116 added a main-push trigger, but its first run failed immediately with `Unsupported event type: push` before the agent executed. PR #117 removed that unsupported trigger and changed the schedule to twice hourly at minutes 17 and 47 UTC; PR CI and Secret Scan passed.
- End-to-end autonomous delivery remains unverified. The next scheduled/manual run must reach the agent, create a focused commit, publish a PR, and pass PR CI before the workflow is considered operational.


## Latest Follow-up (2026-10-25)

- PRs #304–#316 delivered historical snapshot requirements, validated snapshot model, local capture/table/trend/detail/CSV, schema v4 backup and rollback, duplicate-date protection, explicit removal, keyboard focus handling, and narrow-viewport checks.
- PRs #317–#321 added offline browser verification for the financial summary, FIRE reports, scenario comparison, monthly financial review, and HTML escaping of user-controlled goal/category text.
- PRs #322–#325 added keyboard removal coverage, duplicate-date capture rejection, malformed-history fail-closed behavior, and full-workspace backup recovery from malformed history.
- PR #326 added keyboard activation coverage for FIRE readiness and Goal Tracker calculations. CI and Secret Scan passed before merge for these PRs.
- Remaining release-readiness work includes manual screen-reader and real browser-chrome 400% zoom review, customer discovery, repository secret-history review, software distribution and licensing review, and owner-side GitHub Pages configuration.
