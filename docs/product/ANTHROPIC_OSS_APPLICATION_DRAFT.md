# Claude for Open Source — Application Draft

**Status:** NOT SUBMITTED — eligibility track is not yet evidenced.  
**Project repository:** https://github.com/SRSekhar/Personal-Family-Office  
**Prepared:** 2026-10-13

This draft is deliberately transparent about the project's current stage and limited reach. PFO OS itself has no published license and must not be represented as OSI-licensed. The program's general criteria require the applicant to maintain or contribute to at least one OSI-licensed project and to qualify under an eligible maintainer or ecosystem-impact track. The application repository's own license status is not, by itself, the entire eligibility test.

The public profile also contains `skills-getting-started-with-github-copilot`, which has an MIT license, but it appears to be a tutorial-style repository. Do not assume that it satisfies the program's maintenance/contribution requirement without confirming the applicant's actual contribution and role. The current PFO OS repository does not demonstrate the published numeric maintainer thresholds (dependent repositories, package downloads, external contributors, external merged PRs, or OpenSSF score), and there is no evidence that the wider ecosystem meaningfully depends on PFO OS today. Therefore the application is not ready to submit as an eligible maintainer/ecosystem-impact project without additional truthful evidence. Do not invent or inflate metrics.

## Required identity fields (complete in the official form)

Application page: https://claude.com/contact-sales/claude-for-oss

- **First name:** Enter the name you want Anthropic to use; it is not inferred here.
- **Last name:** Enter your name; it is not inferred here.
- **Email:** Use the email associated with your Anthropic account if you already have one, as the form requests.
- **GitHub handle:** SRSekhar (confirm this is the account you will submit from).

These identity fields are intentionally not filled in or stored in this repository.

## Form field: GitHub Repository URL

https://github.com/SRSekhar/Personal-Family-Office

## Form field: Tell us about the project's reach and impact

PFO OS (Personal Family Office Operating System) is an early-stage TypeScript monorepo exploring an engineering-first platform for personal and family financial operations. It now includes deterministic financial calculations, portfolio analysis, a local-first browser dashboard, JSON backup import/export, a loopback-only local preview server, and a CLI that converts either a versioned portfolio input or a dashboard backup into a self-contained offline HTML report. The dashboard-backup workflow requires an explicit valuation date and preserves user categories without guessing investment/property subtypes. CI validates install, dependency inventory/audit, bootstrap safety, lint, typecheck, build, and tests; a scheduled full-history secret scan is also configured. These are early prototype capabilities, not a production financial application. Public adoption remains modest; I am not claiming substantial downstream usage, package downloads, or external contributors.

The problem I want to address is that personal and family-office workflows often combine fragmented records, opaque calculations, manually maintained reports, and AI-generated explanations that are difficult to audit. PFO OS is being designed around deterministic financial calculations, explicit domain models, reproducible reports, explainable analysis, data portability, and clear separation between private financial data and reusable software.

The current focus is to test whether the dashboard-to-report workflow solves a real user problem, while maintaining local-only data handling and reliable quality checks. The repository does not yet have an open-source license or validated customer demand. The missing PFO OS license means this repository cannot itself be presented as an OSI-licensed project, but a separate qualifying project may satisfy the program's general license criterion if the applicant genuinely maintains or contributes to it.

This remains a preparation draft. Before submission, verify the applicant's actual eligibility track using current, verifiable evidence (for example, external merged PRs, downstream dependencies, package downloads, external contributors, or an eligible ecosystem-impact case). Do not count PRs merged only into repositories the applicant owns as external contributions. If no track is supported by evidence, do not claim one.

## Form field: How will you use the subscription for your project?

I would use Claude Max 20x primarily through Claude Code to accelerate the work required to make PFO OS reliable and useful: architecture reviews, implementation of deterministic financial calculation modules, unit and property-based tests, CI and dependency hygiene, security and privacy reviews, contributor documentation, issue triage, and review of community contributions.

I will validate AI-generated changes with tests and human review. I will not put real personal financial records, credentials, or account data into public issues or repository fixtures. Before releasing reusable components, I will complete a repository/history and dependency review, establish an explicit license and contribution terms, and publish only functionality that is actually implemented and tested.

The goal is to use the additional capacity to ship a maintainable, transparent project and learn from real users—not to claim adoption, security guarantees, or commercial traction before they exist.

## Optional additional information

PFO OS is intended to become a sustainable product over time. I am evaluating an open-core model in which reusable, non-sensitive foundations may be made available under a deliberate license, while private personal records remain separate and any paid features or hosted services are clearly scoped. The product and revenue hypotheses are not yet validated. I will publish accurate progress and adoption metrics as they become available.

## Pre-submission checklist

- [ ] Confirm the repository URL and that the application is being submitted by the actual maintainer.
- [ ] Update the reach/impact statement only with current, verifiable data.
- [ ] Ensure no personal financial data or secrets are exposed in the public repository/history.
- [ ] Verify the general OSI-licensed-project requirement using a project the applicant genuinely maintains or contributes to; do not assume a tutorial fork alone qualifies.
- [ ] Verify at least one published Maintainer Track threshold or a truthful Ecosystem Impact Track basis; do not count self-owned-repository PRs as external contributions.
- [ ] Do not claim that PFO OS itself is open source until an appropriate license is published.
- [ ] Save the application confirmation and any subscription end date if accepted.
