[CmdletBinding()]
param(
    [switch]$Validate,
    [switch]$Doctor,
    [string]$RepositoryRoot,
    [switch]$WhatIf,
    [switch]$Confirm
)

$entryPoint = Join-Path -Path $PSScriptRoot -ChildPath "scripts/build/Initialize-PFO.ps1"

if (-not (Test-Path -LiteralPath $entryPoint -PathType Leaf)) {
    Write-Error "PFO bootstrap entry point not found: $entryPoint"
    exit 1
}

$forwardedArguments = @{}

if ($Validate) { $forwardedArguments["Validate"] = $true }
if ($Doctor) { $forwardedArguments["Doctor"] = $true }
if (-not [string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $forwardedArguments["RepositoryRoot"] = $RepositoryRoot
}
if ($WhatIf) { $forwardedArguments["WhatIf"] = $true }
if ($Confirm) { $forwardedArguments["Confirm"] = $true }

& $entryPoint @forwardedArguments
