# PFO OS Autonomous Engineering

## Purpose

This workflow runs on GitHub-hosted infrastructure, independently of the Principal's computer. It is scheduled every six hours and can also be started manually from the repository's **Actions** tab.

Each run is limited to one active-sprint increment. It creates a branch, asks the coding agent to implement and test the change, opens a pull request, waits for both the repository CI and full-history secret scan, and merges only when both checks succeed. If validation fails or required checks are missing, it leaves the pull request open.

The workflow is deliberately not triggered by issue or pull-request comments; untrusted public content must not be able to invoke a write-capable agent.

## One-time GitHub setup required

The assistant cannot create or read repository Actions secrets. Add them in:

**Repository → Settings → Secrets and variables → Actions → New repository secret**

### 1. Model authentication — configure exactly one

Choose one of the following:

- `CLAUDE_CODE_OAUTH_TOKEN`: a Claude Code OAuth token from an eligible Claude plan. Anthropic documents `claude setup-token` as the setup method for supported Pro/Max accounts. Generate it on a trusted computer, then paste the token directly into GitHub Secrets. Never commit or send it in chat.
- `ANTHROPIC_API_KEY`: an Anthropic API key. API usage may incur separate charges; a Claude subscription does not automatically mean API usage is free.

The workflow prefers `ANTHROPIC_API_KEY` if both are present. Do not assume an application for a free program has been approved or that free API access exists.

Official setup guidance: https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md

### 2. Repository write token

Create a **fine-grained personal access token** scoped only to `SRSekhar/Personal-Family-Office`, and store it as `PFO_AUTOMATION_TOKEN`.

Grant only the permissions needed for this workflow:

- Contents: Read and write
- Pull requests: Read and write
- Actions: Read-only

The token is used to push the agent branch, create the pull request, read check results, and merge only after the required checks succeed. Do not use a classic token with broad access if a repository-scoped fine-grained token is available. Set an expiry and rotate it when needed.

GitHub documentation: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## Enable and verify

1. Add the model credential and `PFO_AUTOMATION_TOKEN` as Actions secrets.
2. Merge the workflow into `main`.
3. Open **Actions → PFO Autonomous Engineering → Run workflow** once.
4. Confirm that a run creates a focused PR, the CI and secret-scan checks start, and the PR is merged only after both report success.
5. If the workflow fails, inspect the run logs. Missing credentials, insufficient token permissions, branch protection, failed checks, model usage limits, and billing limits are not bypassed automatically.

## Security and operating limits

- The workflow runs at most one agent task per scheduled execution.
- The workflow never intentionally pushes directly to `main`.
- It must not change repository visibility, project licensing, financial data, legal positions, or the public/private product boundary.
- It must not fabricate customer interviews, revenue, validation results, or test results.
- The public repository must contain synthetic data only.
- The agent is restricted to repository files and a narrow set of test/status commands; this reduces but cannot eliminate agent risk.
- GitHub-hosted runs, model use, token quotas, and repository policy can still fail. This is scheduled automation, not an uninterrupted process or a guarantee that every task will succeed.
- Branch protection and repository rules remain authoritative. The workflow does not bypass them.
