[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath "../.."))
$initializer = Join-Path -Path $repositoryRoot -ChildPath "scripts/build/Initialize-PFO.ps1"
$structureModule = Join-Path -Path $repositoryRoot -ChildPath "scripts/internal/Structure.ps1"
$archivePath = Join-Path -Path $repositoryRoot -ChildPath "archive"
$versionPath = Join-Path -Path $repositoryRoot -ChildPath "VERSION"

if (-not (Test-Path -LiteralPath $initializer -PathType Leaf)) {
    throw "Bootstrap initializer not found: $initializer"
}

if (-not (Test-Path -LiteralPath $versionPath -PathType Leaf)) {
    throw "Repository version file not found: $versionPath"
}

# Use an empty configured directory to prove WhatIf does not create it.
if (Test-Path -LiteralPath $archivePath -PathType Container) {
    $archiveContents = @(Get-ChildItem -LiteralPath $archivePath -Force)
    if ($archiveContents.Count -gt 0) {
        throw "Safety test requires the archive directory to be empty."
    }

    Remove-Item -LiteralPath $archivePath -Force
}

try {
    & pwsh -NoProfile -File $initializer -WhatIf
    if ($LASTEXITCODE -ne 0) {
        throw "Bootstrap WhatIf execution failed with exit code $LASTEXITCODE."
    }

    if (Test-Path -LiteralPath $archivePath) {
        throw "WhatIf unexpectedly created the archive directory."
    }
}
finally {
    if (-not (Test-Path -LiteralPath $archivePath -PathType Container)) {
        New-Item -ItemType Directory -Path $archivePath | Out-Null
    }
}

# Verify a normal initialization never overwrites an existing file.
$versionBefore = [System.IO.File]::ReadAllText($versionPath)
& pwsh -NoProfile -File $initializer
if ($LASTEXITCODE -ne 0) {
    throw "Bootstrap initialization failed with exit code $LASTEXITCODE."
}

$versionAfter = [System.IO.File]::ReadAllText($versionPath)
if ($versionBefore -cne $versionAfter) {
    throw "Bootstrap unexpectedly modified the existing VERSION file."
}

# Verify configured paths cannot escape the repository root.
. $structureModule

$rootPrefix = $repositoryRoot.TrimEnd([char[]]@(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
)) + [System.IO.Path]::DirectorySeparatorChar

foreach ($unsafePath in @("../outside", "/tmp/outside", "C:/outside")) {
    $wasRejected = $false

    try {
        Resolve-RepositoryConfiguredPath -RepositoryRoot $repositoryRoot -RelativePath $unsafePath -RootPrefix $rootPrefix | Out-Null
    }
    catch {
        $wasRejected = $true
    }

    if (-not $wasRejected) {
        throw "Unsafe configured path was not rejected: $unsafePath"
    }
}

Write-Host "Bootstrap safety checks passed." -ForegroundColor Green
