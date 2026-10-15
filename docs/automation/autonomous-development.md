# Autonomous Development

PFO OS can run one bounded engineering cycle every hour through GitHub Actions, independently of a local ChatGPT session.

## Workflow

- Workflow: `.github/workflows/autonomous-development.yml`
- Triggers: hourly at minute 17 and manual `workflow_dispatch`.
- Runtime: GitHub-hosted Ubuntu runner; a run is limited to 50 minutes.
- Authentication: Claude Code OAuth token from a supported Claude Pro/Max subscription, plus a scoped GitHub token.
- Output: focused feature branch and pull request; the agent does **not** merge pull requests.
- Safety: repository privacy, licensing, legal/distribution decisions, real financial data, credentials, and external settings are out of scope for automatic changes.
- If no safe, actionable task is ready, the agent should report the blocker instead of manufacturing work.

## One-time setup

In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:

1. `CLAUDE_CODE_OAUTH_TOKEN`: Generate locally with Claude Code's `claude setup-token` command, complete the browser authorization, and paste the resulting token directly into GitHub Secrets. Never commit it, place it in an issue/PR, or paste it into this chat.
2. `PFO_AUTOMATION_TOKEN`: Create a fine-grained personal access token scoped only to `SRSekhar/Personal-Family-Office`. Grant **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write**, and **Actions: Read-only**. Set an expiry and rotate it when required. The token is used only as a GitHub Actions secret.

The workflow checks whether both secrets exist without printing their values. Until both are configured, scheduled/manual runs will skip the agent and display setup instructions in the run summary.

## First run and monitoring

1. Commit this workflow to `main` through a reviewed pull request.
2. Configure both secrets.
3. Open **Actions → PFO Autonomous Development → Run workflow** to trigger a first run.
4. Review the run summary, resulting branch/PR, and normal CI checks. Confirm the token permissions allow the PR checks to trigger.
5. If the run fails, inspect its logs and fix the cause before relying on recurring runs.

Scheduled GitHub Actions runs are best-effort and can be delayed under load; this is periodic automation, not a continuously running server. The agent runs at most once per hour, and the workflow concurrency group prevents overlapping cycles.

## Operating boundaries

- PRs remain open for review; no automatic merge.
- Never commit real financial data or credentials.
- No automatic repository visibility, license, legal/distribution, Pages, billing, or external service changes.
- Do not claim tests, deployments, customer demand, or revenue unless verified.
