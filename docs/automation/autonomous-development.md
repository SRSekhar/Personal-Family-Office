# Autonomous Development

PFO OS can run one bounded engineering cycle every hour through GitHub Actions, independently of a local ChatGPT session.

## Workflow

- Workflow: `.github/workflows/autonomous-development.yml`
- Triggers: hourly at minute 17 and manual `workflow_dispatch`.
- Runtime: GitHub-hosted Ubuntu runner; a run is limited to 50 minutes.
- Output: focused feature branch and pull request; the agent does **not** merge pull requests.
- Safety: repository privacy, licensing, legal/distribution decisions, real financial data, credentials, and external settings are out of scope for automatic changes.
- Token isolation: the agent receives only the workflow's read-only GitHub token. The write-capable `PFO_AUTOMATION_TOKEN` is supplied only to a separate post-agent publish step, after the model/action has exited. Git checkout credentials are not persisted.
- PR title/body metadata is written to the runner's temporary directory, not committed into the repository.
- If no safe, actionable task is ready, the agent should report the blocker instead of manufacturing work.

## Authentication modes

Configure one AI authentication mode and the GitHub automation token under **Settings → Secrets and variables → Actions**.

### Option A — HCNSEC gateway (experimental)

1. Create a fresh API token in the HCNSEC provider console. Do not reuse a key posted in a chat, issue, or log; rotate any key that has been exposed.
2. Add repository secret `HCNSEC_API_KEY`.
3. Optionally add repository variable `PFO_GATEWAY_MODEL` with an exact model ID supported by the provider. The workflow defaults to `DeepSeek-V4-Pro` when this variable is absent.
4. The workflow configures the Claude Code action to use `https://api.hcnsec.cn` and a Bearer authorization header. It uses the gateway's documented Claude Code-compatible integration path.

**Important:** this integration has not yet been verified with a successful authenticated request or an autonomous workflow run. Treat the first manual run as an integration test. Check the workflow summary and logs for status/errors, verify the model supports the agent's tool-use needs, and review provider usage/quotas before relying on hourly execution. A third-party gateway receives the prompts and repository content needed for the run; never put private financial records, credentials, or other sensitive data in the repository or agent prompt.

### Option B — Claude Code OAuth

1. Generate the token locally with Claude Code's `claude setup-token` command, complete the browser authorization, and store the result as `CLAUDE_CODE_OAUTH_TOKEN`. Never commit it, place it in an issue/PR, or paste it into a chat.

### Required for either mode — GitHub automation token

Create a fine-grained personal access token scoped only to `SRSekhar/Personal-Family-Office`. Grant **Contents: Read and write**, **Pull requests: Read and write**, **Issues: Read and write**, and **Actions: Read-only**. Store it as `PFO_AUTOMATION_TOKEN`, set an expiry, and rotate it when required. The workflow does not expose this write token to the model's shell environment: a separate step uses it only after the agent exits to push the committed branch and create/update the pull request.

If both AI secrets are configured, the workflow selects HCNSEC gateway mode. The preflight checks for required secrets without printing their values. Until one AI secret and `PFO_AUTOMATION_TOKEN` are configured, scheduled/manual runs skip the agent and display setup instructions in the run summary.

## First run and monitoring

1. Commit the workflow through a reviewed pull request.
2. Configure the chosen AI secret and `PFO_AUTOMATION_TOKEN` in repository Actions secrets.
3. For HCNSEC, review the provider's privacy, quota, and model documentation, then use **Actions → PFO Autonomous Development → Run workflow** for the first integration test.
4. Review the run summary, resulting branch/PR, and normal CI checks. Confirm the token permissions allow PR checks to trigger.
5. If the run fails, inspect the sanitized error output and fix the cause before relying on recurring runs.

Scheduled GitHub Actions runs are best-effort and can be delayed under load; this is periodic automation, not a continuously running server. The agent runs at most once per hour, and the workflow concurrency group prevents overlapping cycles.

## Operating boundaries

- PRs remain open for review; no automatic merge.
- Never commit real financial data or credentials.
- No automatic repository visibility, license, legal/distribution, Pages, billing, or external service changes.
- Do not claim tests, deployments, customer demand, or revenue unless verified.
