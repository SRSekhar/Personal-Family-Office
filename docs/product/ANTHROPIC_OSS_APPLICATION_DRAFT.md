# Claude for Open Source — Application Draft

**Status:** NOT SUBMITTED — eligibility blocker remains open.  
**Project repository:** https://github.com/SRSekhar/Personal-Family-Office  
**Prepared:** 2026-10-10

This draft is deliberately transparent about the project's current stage and limited reach. Do not submit an application representing PFO OS as an OSI-licensed open-source project until a valid license is chosen and published, or another qualifying project is identified. The license decision must follow ownership, dependency, and product-boundary review.

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

PFO OS (Personal Family Office Operating System) is an early-stage TypeScript monorepo exploring an engineering-first, AI-assisted platform for personal and family financial operations. It now includes domain models and tested deterministic calculations for CAGR, compound-growth scenarios, XIRR, net worth, and asset allocation, plus explicit portfolio-record mapping that rejects duplicate canonical positions rather than silently double-counting. The project uses CI for install, bootstrap safety, lint, typecheck, build, and tests, and a scheduled full-history Gitleaks workflow. These are early engineering capabilities, not a production financial application. Public adoption remains modest; I am not claiming substantial downstream usage, package downloads, or external contributors.

The problem I want to address is that personal and family-office workflows often combine fragmented records, opaque calculations, manually maintained reports, and AI-generated explanations that are difficult to audit. PFO OS is being designed around deterministic financial calculations, explicit domain models, reproducible reports, explainable analysis, data portability, and clear separation between private financial data and reusable software.

The current focus is to establish reliable engineering foundations, automated quality checks, privacy safeguards, and a small useful capability that can be tested by real users. The public repository still does not have a valid open-source license. That is a concrete eligibility blocker for presenting this repository as an OSI-licensed project; the license and public/private product boundary remain unresolved. I will not claim that this requirement is met.

I understand the program's published examples generally describe projects with established ecosystem reach. This is a preparation draft only; I am not submitting it while the licensing eligibility blocker remains unresolved. If eligibility is established, the application will describe the project's early stage and limited reach without claiming thresholds it has not demonstrated.

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
- [ ] Resolve the OSI-license eligibility blocker: publish a deliberate, legally reviewed license for this project or identify another genuinely qualifying project.
- [ ] Do not claim that the project is open source until an appropriate license is published.
- [ ] Save the application confirmation and any subscription end date if accepted.
