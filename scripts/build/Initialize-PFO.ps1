[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Validate,
    [switch]$Doctor,
    [string]$RepositoryRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    if ($Validate -and $Doctor) {
        throw "Choose either -Validate or -Doctor, not both."
    }

    $scriptRepositoryRoot = [System.IO.Path]::GetFullPath(
        (Join-Path -Path $PSScriptRoot -ChildPath "../..")
    )

    $modulePaths = @(
        "Common.ps1",
        "Logger.ps1",
        "Configuration.ps1",
        "Repository.ps1",
        "Structure.ps1",
        "Validation.ps1",
        "Banner.ps1"
    )

    foreach ($moduleName in $modulePaths) {
        $modulePath = Join-Path -Path $scriptRepositoryRoot -ChildPath ("scripts/internal/{0}" -f $moduleName)

        if (-not (Test-Path -LiteralPath $modulePath -PathType Leaf)) {
            throw "Required bootstrap module was not found: $modulePath"
        }

        . $modulePath
    }

    $rootCandidate = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
        $scriptRepositoryRoot
    }
    else {
        [System.IO.Path]::GetFullPath($RepositoryRoot)
    }

    $resolvedRepositoryRoot = Find-RepositoryRoot -StartPath $rootCandidate
    $configuration = Get-PFOConfiguration -RepositoryRoot $resolvedRepositoryRoot
    $structure = Get-RepositoryStructure -RepositoryRoot $resolvedRepositoryRoot

    Show-Banner -Configuration $configuration

    if ($Validate) {
        Show-Operation -Operation "Validate Repository"
        Test-RepositoryRoot -RepositoryRoot $resolvedRepositoryRoot
        $validationResult = Test-RepositoryStructure -RepositoryRoot $resolvedRepositoryRoot -Structure $structure
        Show-ValidationSummary -ValidationResult $validationResult

        if (-not $validationResult.IsValid) {
            throw "Repository validation failed. Review the missing paths listed above."
        }

        Write-Success "Repository validation passed."
        exit 0
    }

    if ($Doctor) {
        Show-Operation -Operation "Repository Doctor"
        Test-RepositoryRoot -RepositoryRoot $resolvedRepositoryRoot
        $validationResult = Test-RepositoryStructure -RepositoryRoot $resolvedRepositoryRoot -Structure $structure
        Invoke-RepositoryDoctor -ValidationResult $validationResult
        Show-ValidationSummary -ValidationResult $validationResult

        if (-not $validationResult.IsValid) {
            throw "Repository doctor found missing paths. Run the bootstrap operation to create configured paths."
        }

        Write-Success "Repository doctor found no missing configured paths."
        exit 0
    }

    Show-Operation -Operation "Initialize Repository"
    $initializationResult = Initialize-RepositoryStructure -RepositoryRoot $resolvedRepositoryRoot -Structure $structure
    $initializationResult | Format-List

    if ($WhatIfPreference) {
        Write-WarningLog "WhatIf mode is active. Post-initialization validation was skipped because changes were not applied."
        exit 0
    }

    Test-RepositoryRoot -RepositoryRoot $resolvedRepositoryRoot
    $validationResult = Test-RepositoryStructure -RepositoryRoot $resolvedRepositoryRoot -Structure $structure
    Show-ValidationSummary -ValidationResult $validationResult

    if (-not $validationResult.IsValid) {
        throw "Bootstrap finished but repository validation failed."
    }

    Show-CompletionBanner
    Show-RepositoryInformation -Repository (Get-RepositoryInformation -RepositoryRoot $resolvedRepositoryRoot -Configuration $configuration)
    Show-LogSummary
    exit 0
}
catch {
    Show-FailureBanner
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
