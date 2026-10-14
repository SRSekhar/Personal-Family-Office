# Session Handoff

## Repository

PFO OS — Personal Family Office Operating System

## Current State

The technical foundation, deterministic calculators, portfolio analysis, offline HTML report renderer, local-first dashboard, dashboard backup-currency guard, and local report CLI are merged to main. Dashboard action updates were merged in PRs #58, #62, and #64; PR #66 documents the required Pages setup. PR #67 added a reproducible CI check of all nine flagged npm tarballs: every packed tarball integrity matched `pnpm-lock.yaml`, and every tarball contained a root-level license file whose byte length and SHA-256 are recorded in `docs/security/DEPENDENCY_LICENSE_EVIDENCE_REVIEW.md`. Legal/distribution disposition remains open. The dashboard can now be previewed locally with `pnpm dashboard:serve` (loopback-only, no external data service). The hosted GitHub Pages demo still needs the repository's one-time setting configured (Settings → Pages → Source: GitHub Actions); workflow logs confirmed the `GITHUB_TOKEN` cannot create the Pages site automatically. PR #48 adds the interview guide for the revenue-validation experiment; no customer demand has been validated yet.



## Latest Follow-up (2026-10-14)

- PR #89 merged: dashboard record add/edit/delete/import now writes the candidate JSON to browser storage before updating in-memory records. Failed storage writes leave the previously saved state unchanged and display an explicit warning; focused persistence tests were added. Main-branch CI and full-history secret scan passed for the PR.
- PR #90 merged: corrected the dependency license evidence review's last-refresh date and clarified that CI inspected the exact `lightningcss-linux-x64-gnu@1.33.0` tarball's root `LICENSE` file. This is evidence of file presence/identity, not legal clearance.
- PR #88 merged: documented the Claude for Open Source eligibility evidence. The current evidence does not establish a qualifying threshold; the application remains unsubmitted and identity fields must not be inferred.
- Dashboard Actions upgrades are merged: `upload-pages-artifact@v5`, `configure-pages@v6`, and `deploy-pages@v5`. Hosted deployment remains blocked until a repository owner enables GitHub Pages under Settings → Pages → Source: GitHub Actions. The workflow token cannot create the Pages site automatically. Local preview remains available with `pnpm dashboard:serve`.

## Verified CI

The full GitHub Actions workflow passed with:
- Frozen pnpm install
- PowerShell initialization, validation, and doctor
- WhatIf non-mutation test
- Existing-file preservation test
- Unsafe-path rejection tests
- ESLint
- TypeScript typecheck
- Package build
- Vitest tests

The XIRR pull request passed the full workflow after addressing strict TypeScript indexed-access checks and an unused assignment.

## Implemented Capabilities

- Configuration-driven PowerShell initializer with initialize, validate, doctor, and WhatIf modes.
- Safe repository-relative path validation and no-overwrite behavior.
- Git ignore rules for root local financial data and generated reports.
- Local `@pfo/cli` host that validates versioned portfolio input or converts a dashboard JSON backup into a self-contained offline HTML report. Dashboard-backup mode requires an explicit `--as-of` valuation timestamp and preserves categories while mapping assets/liabilities to generic domain types.
- Deterministic CAGR calculation.
- Annual compound-growth projection with beginning/end contribution timing.
- XIRR for dated cash flows, using ACT/365 and bisection; multi-sign-change cash flows are rejected to avoid ambiguous results.

## Immediate Next Steps

1. Confirm the intended distribution artifact (source repository, compiled CLI, bundled app, or hosted product), then validate the actual artifact and map the Blue Oak/MPL obligations. Current manifests and lockfile point to development/build/test-only dependency paths, but legal disposition remains open.
2. If a hosted demo is desired, enable GitHub Pages once in repository Settings → Pages → Source: GitHub Actions, then rerun the dashboard deployment workflow and verify the live page. Local preview is already available via `pnpm dashboard:serve`.
3. Run customer-discovery interviews and paid-pilot validation using the now-demonstrable dashboard-backup-to-report workflow; do not treat prototype completion as demand validation. Define persistence/source-of-truth requirements before historical snapshots.
4. Run the 8–10 interview experiment using `docs/product/CUSTOMER_DISCOVERY_PLAYBOOK.md`; record only anonymized notes and evidence.
5. Keep licensing/product-boundary decisions explicit; do not change repository visibility or license automatically. The Claude for Open Source application remains unsubmitted.

## Important Constraints

- Never commit real personal financial data, statements, credentials, or private reports.
- Do not claim a full security audit has passed.
- Do not change repository visibility or publish a license without an explicit product-boundary decision.
- Do not claim the Anthropic application was submitted; the current document is a draft.
- Do not mark a task complete until tests or validation have actually run.
