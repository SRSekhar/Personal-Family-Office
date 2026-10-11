# PFO OS Autonomous Engineering

## Selected operating mode: ChatGPT + GitHub integration

PFO OS engineering work is performed through the scheduled ChatGPT task and the available GitHub integration. This mode does **not** require an OpenAI API key, an Anthropic API key, a Claude OAuth token, or model-provider credentials stored in GitHub Actions.

The scheduled task checks the live repository, active sprint, open pull requests, and CI/security results; selects one small, sprint-aligned engineering increment; inspects existing implementation; and proposes a focused change. It should merge only after relevant CI and full-history secret scanning pass and the change is safe under the repository's existing rules. It must not invent APIs, models, financial data, customer evidence, product requirements, or legal conclusions.

The task runs periodically through ChatGPT; it is not a continuously running process and does not guarantee a change on every run. Do not claim work happened between runs. Repository changes, PRs, commits, and CI results are the evidence of actual progress.

## GitHub Actions responsibilities

GitHub Actions remains responsible for repository CI, tests, and security scanning. The separate API-dependent, GitHub-hosted autonomous coding workflow has been removed because the selected operating mode does not use provider APIs or model credentials. Do not reintroduce an API-dependent coding workflow unless the Principal explicitly changes this decision.

## Operating rules

- Inspect `.ai/AI_CONTEXT.md`, `.ai/PROJECT_STATE.md`, `.ai/CURRENT_SPRINT.md`, `.ai/HANDOFF.md`, open PRs, and recent CI results before selecting work.
- Work in small, independently reviewable increments aligned with the active sprint.
- Inspect existing code before making changes; preserve the repository's established architecture and merge method.
- Run and verify relevant checks. Never claim tests passed unless the results are visible and successful.
- Do not merge when required checks are missing or failing.
- Do not change repository visibility, project licensing, branch protections, or unresolved product/legal boundaries.
- Never commit secrets or real personal financial data. Public repository content must use synthetic data only.
- Do not fabricate customer interviews, revenue, demand validation, or legal clearance.
- Treat dependency license inventories as evidence, not as legal clearance.
- Do not submit external applications or contact customers without explicit authorization.

## Credentials and secret handling

No model-provider API credential is needed for this selected mode. Do not request or store one for the scheduled ChatGPT workflow. GitHub integration access is managed by the connected GitHub integration, not by placing a personal access token in repository files or this document. Never paste credentials into chat or commit them to the repository.

If an API key is ever exposed, revoke it in the provider's dashboard and do not reuse it.

## Verification

- In ChatGPT, confirm the **PFO OS Autonomous Engineering** scheduled task is enabled.
- In GitHub, review repository commits, pull requests, and CI/security checks to verify any reported work.
- If no change or PR exists, do not infer that an engineering increment was completed.
- If a run cannot access the repository or cannot complete a safe task, report the concrete blocker rather than fabricating progress.
