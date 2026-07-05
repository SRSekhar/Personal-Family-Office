Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Personal Family Office Bootstrap v1.0"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$folders = @(
    ".github/workflows",

    "apps/dashboard",
    "apps/report-generator",
    "apps/website",

    "packages/core",
    "packages/models",
    "packages/shared",
    "packages/calculators",
    "packages/analytics",
    "packages/charts",
    "packages/prompts",

    "docs/governance",
    "docs/financial-statements",
    "docs/investment-analysis",
    "docs/fire",
    "docs/insurance",
    "docs/real-estate",
    "docs/tax",
    "docs/annual-reviews",
    "docs/meeting-minutes",
    "docs/decisions",

    "data/assets",
    "data/liabilities",
    "data/investments",
    "data/properties",
    "data/insurance",
    "data/income",
    "data/expenses",
    "data/goals",
    "data/snapshots",

    "dashboard",

    "reports/2026",
    "reports/2027",

    "templates/annual-review",
    "templates/investment",
    "templates/insurance",
    "templates/property",

    "prompts/chatgpt",
    "prompts/claude",
    "prompts/gemini",
    "prompts/perplexity",

    "scripts/build",
    "scripts/importers",
    "scripts/exporters",
    "scripts/utils",

    "releases",

    "archive"
)

foreach ($folder in $folders)
{
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$files = @(
    "README.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "ARCHITECTURE.md",
    "LICENSE.md",
    ".gitignore",
    ".editorconfig",
    "pnpm-workspace.yaml",
    "package.json",
    "tsconfig.base.json"
)

foreach ($file in $files)
{
    if (!(Test-Path $file))
    {
        New-Item -ItemType File $file | Out-Null
    }
}

Write-Host ""
Write-Host "Repository initialized successfully." -ForegroundColor Green
Write-Host ""