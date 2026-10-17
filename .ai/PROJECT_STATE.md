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

- **Epic:** Report Engine / Release Safety
- **Status:** Deterministic calculators, portfolio analysis, the offline HTML report renderer, and the local report CLI are merged. Report validation enforces malformed-payload, currency-code, nested monetary currency, net-worth, analysis-total, and allocation-reconciliation invariants, and exposes canonical timestamps through semantic HTML time elements. The dashboard has currency-validated backup import and atomic record persistence: add/edit/delete/import only commit in-memory changes after browser storage accepts the write. PR #95 additionally fails closed on malformed or invalid saved records, rejects duplicate IDs, blocks edits/exports when stored data cannot be read, and allows recovery through a validated backup import; focused read/write tests passed CI. The dashboard private workspace is restricted to loopback hostnames (`localhost`, `127.0.0.1`, IPv6 loopback); every non-loopback origin remains sample-only and blocks private-workspace entry/import. PR #104 adds a tested host-allowlist helper to prevent a future custom domain or alternate hosted origin from accidentally enabling personal-record storage. PR #98 moves dashboard file/syntax/privacy-guard validation before Pages setup and runs that validation on pull requests; publishing still requires the one-time repository Pages setting. PR #100 adds `apps/dashboard/tests/**/*.test.js` to the root Vitest projects; the first run exposed and corrected an invalid test fixture, and the corrected PR CI passed all 185 tests across 27 files. PR #102 adds explicit confirmation before replacing existing records during backup import and a recovery-specific confirmation when saved data cannot be read. PR #104 further restricts private workspace access to loopback hostnames only and adds focused allowlist tests; all other origins remain sample-only. PR #105 adds static-integrity tests for duplicate/missing HTML IDs, controller selectors, local entry assets, and relative module imports; the dashboard deployment workflow's privacy guard check was updated to validate the new helper. PR #105 CI, full-history secret scan, and pull-request dashboard packaging passed before merge. The dashboard's local preview is loopback-only (`pnpm dashboard:serve`); hosted deployment remains blocked until GitHub Pages is enabled in Settings → Pages with Source set to GitHub Actions. The three GitHub Pages action upgrades are merged. All nine flagged dependency versions passed packed-tarball integrity and root-license-file checks, with license fingerprints recorded; legal/distribution disposition remains open. ADR-0002 documents historical snapshot requirements and compares storage options without selecting a technology. Customer discovery and paid demand remain unvalidated. The Claude for Open Source draft is unsubmitted; a public GitHub search found 64 merged PRs in the last 12 months, all in the applicant-owned repository, and did not establish the external-PR eligibility route.

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

1. Review proposed ADR-0003, resolve the listed FIRE planner input/output and interaction questions with user evidence, then implement the local-first UI using the existing readiness, scenario-comparison, and required-contribution calculators. Keep assumptions visible and deterministic calculations separate from any future probabilistic analysis.
2. Validate the local dashboard-to-report workflow with prospective users and seek two paid-pilot commitments before expanding scope. Define persistence/source-of-truth requirements before historical snapshot storage.
3. Execute the documented 8–10 interview customer-discovery experiment and record only anonymized evidence; do not treat prototype completion as evidence of demand.
4. Keep licensing, distribution-artifact, and public/private-boundary questions as release gates before distributing or hosting the product. Do not change repository visibility or licensing automatically; these gates should not block safe local-first product work.

## Blockers and Risks

- The GitHub repository is public; do not commit real financial data or private configuration.
- The repository does not yet have a valid open-source license.
- Historical repository content and commit metadata have not been fully scanned.
- The Anthropic application draft is prepared but has not been submitted.
- No revenue, customer demand, or product-market fit has been validated.
- The nine dependency-license inventory flags passed packed-tarball integrity, root-license-file, and upstream license-text hash checks in CI. Current manifests/lockfile indicate development/build/test-only dependency paths, but the final distribution artifact and legal disposition remain outstanding.
- GitHub Pages deployment is blocked by the repository-level Pages setting; the workflow token cannot create the site automatically.


## Latest Follow-up (2026-10-17)

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

2026-10-17
