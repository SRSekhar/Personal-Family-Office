# PFO OS — Open-Core and Monetization Strategy (Proposal)

**Status:** Proposed — not yet approved  
**Scope:** Product, licensing, monetization, and public-release direction  
**Repository:** Personal-Family-Office  
**Version:** 0.1.0

## 1. Objective

Develop PFO OS into a sustainable product while preserving a useful open-source foundation and keeping the Principal's personal financial information private.

This document is a proposal, not a declaration that the project is already open source, production-ready, or commercially validated. No license or repository-visibility changes should be made solely to pursue a grant or subscription.

## 2. Recommended product model

Use an **open-core strategy**, subject to a deliberate license decision and a security review.

### Public project: PFO Framework

Create a separate public repository for reusable, non-sensitive software. Potential components include:

- Financial domain models and interfaces.
- Deterministic financial calculators and portfolio analytics.
- Import/export abstractions and synthetic sample data.
- Report-generation foundations.
- Test suites, developer tooling, and documentation.
- Provider interfaces for optional AI integrations.

Only publish capabilities that actually exist, have been reviewed, and can be maintained. Synthetic examples must not contain real personal or account data.

### Private product: Personal Family Office

Keep the Principal's personal application, actual financial records, account information, personal configuration, and generated personal reports in a private repository and private storage. The public framework must not depend on private data or require access to private repository contents.

The current repository is public on GitHub, so this separation must be planned and audited before any private information or proprietary material is introduced. Do not assume that removing a file from the latest commit removes it from Git history.

## 3. Potential revenue streams

Validate demand before investing heavily in any paid offering.

1. **Hosted subscription (future):** A hosted personal-finance workspace with secure storage, backups, import workflows, scheduled reports, and multi-device access.
2. **Paid Pro capabilities (future):** Optional premium integrations, advanced reporting, automated data imports, and higher-volume workflows, provided the open-source license and product architecture support this split.
3. **Professional services (near term):** Paid setup, customization, data migration, and implementation assistance for users who need help.
4. **Commercial support (future):** Documentation support, priority issue handling, and maintenance agreements for teams or advisers.
5. **Sponsorships and donations:** Community support once the project has a public, useful release and a transparent roadmap.

These are hypotheses, not validated revenue. Do not advertise features, security guarantees, or service levels until they are implemented and supported.

## 4. Licensing principles

Choose the license only after deciding which code is public and what commercial reuse is acceptable.

- **MIT:** Simple permissive licensing; commercial users can generally reuse the code under its terms.
- **Apache-2.0:** Permissive licensing with express patent provisions.
- If proprietary modules are planned, define a clear boundary between the open-source core and separately licensed services/modules. Have the proposed arrangement reviewed before release.

Do not add an open-source license merely to improve the odds of receiving a subscription. Confirm that the project owner has rights to all code, assets, and dependencies being released. The license must be consistent across the repository's LICENSE file, package metadata, and documentation.

## 5. Claude for Open Source application

The Claude for Open Source program offers eligible contributors six months of Claude Max 20x. Its published examples include maintainers with substantial downstream usage, recognized core contributors, contributors with 100+ merged PRs to repositories they do not own in the last 12 months, repositories with 20+ unique external contributors in the last 12 months, and qualifying critical infrastructure.

A public repository or a newly added license does not, by itself, establish eligibility. Apply only with accurate claims about the project's reach, development activity, and impact. If the project does not meet a listed threshold, explain its genuine value and current stage without claiming adoption or contribution metrics that are not supported.

Use Claude Code for concrete project work such as architecture reviews, implementation, tests, documentation, security review, and contributor onboarding. The subscription is a development aid, not a revenue model or guaranteed program outcome.

## 6. Release and security gates

Before publishing a framework release or changing licensing:

- Review the complete tracked-file list and Git history for personal financial data, secrets, credentials, proprietary material, and third-party code.
- Rotate any exposed secret first; remove sensitive history when necessary and plan for the effects of history rewriting.
- Stop tracking generated dependencies such as `node_modules/`; keep the package manifest and lockfile instead.
- Verify a clean checkout, install, lint, build, and tests.
- Add a clear README, contribution guide, security-reporting instructions, and license.
- Use synthetic data in examples and automated tests.
- Document what is implemented, in progress, and planned.
- Review privacy, security, and any legal/regulatory implications before offering a hosted financial product or investment-related recommendations.

Do not publish the Principal's actual holdings, statements, account identifiers, personal reports, or credentials.

## 7. Suggested sequence

1. Audit the current repository, including tracked dependencies and history.
2. Identify reusable code versus personal application/data boundaries.
3. Decide whether to create a separate public framework repository; do not convert the existing repository blindly.
4. Select and apply a license only to the intended public code.
5. Add clean installation and quality checks, then validate from a fresh clone.
6. Publish a small, working release with synthetic examples and an honest roadmap.
7. Gather genuine user feedback and validate a revenue hypothesis before building paid features.
8. Apply to the Claude for Open Source program with accurate project and contribution details.

## 8. Decisions required

- [ ] Approve or revise the public-framework/private-application split.
- [ ] Choose the intended license after reviewing commercial reuse goals.
- [ ] Identify the first working capability suitable for a public release.
- [ ] Choose one initial revenue hypothesis to validate before building multiple paid tiers.
- [ ] Complete a privacy, secret, and repository-history audit.

Until these decisions and release gates are completed, treat the open-core model as a proposal and do not change the existing repository's license or visibility.
