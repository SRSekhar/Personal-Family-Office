# GitHub Pages Deployment

The dashboard is published by `.github/workflows/deploy-dashboard.yml` using GitHub Actions.

## One-time repository setup

GitHub Pages must be enabled for this repository before the workflow can publish. The workflow intentionally does not attempt to enable Pages automatically: GitHub's `GITHUB_TOKEN` does not have the repository administration permission required to create a Pages site.

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Save the setting.
5. Open **Actions → Deploy PFO OS Dashboard** and select **Run workflow** on `main`, or push a later change to `apps/dashboard/**` or this workflow.

## Expected validation

The workflow checks that the dashboard HTML, CSS, and JavaScript files exist, validates the JavaScript syntax, and rejects remote JavaScript/CSS references before uploading the static artifact. The deployment job publishes the artifact with the GitHub Pages deployment action.

If the Pages site has not been enabled, `actions/configure-pages` fails with an actionable message. This is a repository setting requirement, not an application build failure.

## Privacy boundary

The dashboard uses browser-local storage for workspace records. Keep real financial data out of the public repository, workflow logs, and committed artifacts. Do not treat GitHub Pages as private hosting for personal financial information.
