[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath "../.."))
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pfo-bootstrap-test-" + [guid]::NewGuid().ToString("N"))
$fixtureRoot = Join-Path $temporaryRoot "repository"
$outsideRoot = Join-Path $temporaryRoot "outside"
$fixtureScripts = Join-Path $fixtureRoot "scripts"
$initializerSource = Join-Path $repositoryRoot "scripts/build/Initialize-PFO.ps1"

function Invoke-FixtureBootstrap {
    param([string[]]$Arguments = @())
    & pwsh -NoLogo -NoProfile -File (Join-Path $fixtureScripts "build/Initialize-PFO.ps1") @Arguments | Out-Host
    return $LASTEXITCODE
}

function Set-FixtureStructure {
    param([string[]]$Directories, [string[]]$Files)
    $configuration = [ordered]@{
        version = "1.0.0"
        description = "Isolated bootstrap safety fixture"
        directories = $Directories
        files = $Files
    }
    $configurationPath = Join-Path $fixtureScripts "config/repository.structure.json"
    $configuration | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configurationPath -Encoding utf8
}

try {
    New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $outsideRoot -Force | Out-Null
    foreach ($directory in @("scripts/build", "scripts/internal", "scripts/config", ".ai")) {
        New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $directory) -Force | Out-Null
    }
    Copy-Item -LiteralPath $initializerSource -Destination (Join-Path $fixtureScripts "build/Initialize-PFO.ps1")
    Copy-Item -Path (Join-Path $repositoryRoot "scripts/internal/*.ps1") -Destination (Join-Path $fixtureScripts "internal")
    foreach ($marker in @("README.md", "VERSION", "START_HERE.md")) {
        Set-Content -LiteralPath (Join-Path $fixtureRoot $marker) -Value "fixture" -Encoding utf8
    }

    $pfoConfiguration = [ordered]@{
        name = "PFO OS"
        fullName = "Personal Family Office Operating System"
        version = "0.1.0"
        repository = @{ name = "Personal-Family-Office" }
        architecture = @{ style = @("Clean Architecture", "Domain Driven Design"); language = "PowerShell"; packageManager = "pnpm" }
        principles = @{ repositoryIsMemory = $true; dataIsSourceOfTruth = $true }
        project = @{ status = "Test Fixture" }
    }
    $pfoConfiguration | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $fixtureRoot "pfo.json") -Encoding utf8
    Set-FixtureStructure -Directories @("bootstrap-created", "bootstrap-created/nested") -Files @("bootstrap-created/nested/new.txt")
    $newFile = Join-Path $fixtureRoot "bootstrap-created/nested/new.txt"

    if ((Invoke-FixtureBootstrap -Arguments @("-WhatIf")) -ne 0) { throw "WhatIf execution failed." }
    if (Test-Path -LiteralPath (Join-Path $fixtureRoot "bootstrap-created")) { throw "WhatIf unexpectedly created a directory." }

    if ((Invoke-FixtureBootstrap) -ne 0) { throw "Normal initialization failed." }
    if (-not (Test-Path -LiteralPath $newFile -PathType Leaf)) { throw "Initialization did not create the configured file." }

    Set-Content -LiteralPath $newFile -Value "user-owned-content" -NoNewline
    if ((Invoke-FixtureBootstrap) -ne 0) { throw "Idempotent initialization failed." }
    if ([System.IO.File]::ReadAllText($newFile) -cne "user-owned-content") { throw "Initialization overwrote existing user content." }

    if ((Invoke-FixtureBootstrap -Arguments @("-Validate")) -ne 0) { throw "Validate mode failed for a complete fixture." }
    if ((Invoke-FixtureBootstrap -Arguments @("-Doctor")) -ne 0) { throw "Doctor mode failed for a healthy fixture." }
    if ((Invoke-FixtureBootstrap -Arguments @("-Validate", "-Doctor")) -eq 0) {
        throw "Bootstrap accepted mutually exclusive Validate and Doctor modes."
    }

    Remove-Item -LiteralPath $newFile -Force
    New-Item -ItemType Directory -Path $newFile | Out-Null
    if ((Invoke-FixtureBootstrap -Arguments @("-Validate")) -eq 0) {
        throw "Validate mode accepted a directory where a file is required."
    }
    Remove-Item -LiteralPath $newFile -Force
    Set-Content -LiteralPath $newFile -Value "restored" -NoNewline

    # A file blocking a configured directory path must fail before creating siblings.
    Set-FixtureStructure -Directories @("blocked", "blocked/child", "must-not-be-created") -Files @("bootstrap-created/nested/new.txt")
    Set-Content -LiteralPath (Join-Path $fixtureRoot "blocked") -Value "not-a-directory"
    if ((Invoke-FixtureBootstrap) -eq 0) { throw "Bootstrap accepted a file as a configured directory." }
    if (Test-Path -LiteralPath (Join-Path $fixtureRoot "must-not-be-created")) {
        throw "Bootstrap mutated the repository before completing path pre-validation."
    }
    Remove-Item -LiteralPath (Join-Path $fixtureRoot "blocked") -Force

    Set-FixtureStructure -Directories @("../outside/should-not-exist") -Files @("bootstrap-created/nested/new.txt")
    if ((Invoke-FixtureBootstrap) -eq 0) { throw "Bootstrap accepted a parent-directory traversal path." }
    if (Test-Path -LiteralPath (Join-Path $outsideRoot "should-not-exist")) {
        throw "Unsafe path validation created content outside the repository."
    }

    $linkPath = Join-Path $fixtureRoot "escape"
    $linkCreated = $false
    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $outsideRoot -ErrorAction Stop | Out-Null
        $linkCreated = $true
    }
    catch { Write-Warning "Symbolic-link test skipped because the runner does not permit link creation." }

    if ($linkCreated) {
        Set-FixtureStructure -Directories @("escape/redirected") -Files @("escape/redirected/created.txt")
        if ((Invoke-FixtureBootstrap) -eq 0) { throw "Bootstrap followed a symbolic link outside the repository." }
        if (Test-Path -LiteralPath (Join-Path $outsideRoot "redirected")) {
            throw "Symbolic-link path validation created content outside the repository."
        }
    }

    Write-Host "Bootstrap safety checks passed." -ForegroundColor Green
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
}
