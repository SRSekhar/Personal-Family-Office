Set-StrictMode -Version Latest

<#
.SYNOPSIS
Displays the PFO OS banner.

.DESCRIPTION
Renders the application banner using repository metadata.

.OUTPUTS
None
#>
function Show-Banner {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Configuration
    )

    $line = "=" * 72

    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    Write-Host (" {0}" -f $Configuration.fullName) -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
    Write-Host ""

    Write-Host ("Product           : {0}" -f $Configuration.name)
    Write-Host ("Version           : {0}" -f $Configuration.version)
    Write-Host ("Repository        : {0}" -f $Configuration.repository.name)
    Write-Host ("Status            : {0}" -f $Configuration.project.status)
    Write-Host ("Architecture      : {0}" -f ($Configuration.architecture.style -join ", "))
    Write-Host ("Language          : {0}" -f $Configuration.architecture.language)
    Write-Host ("Package Manager   : {0}" -f $Configuration.architecture.packageManager)

    Write-Host ""
}

<#
.SYNOPSIS
Displays the current operation.

.OUTPUTS
None
#>
function Show-Operation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Operation
    )

    Write-Section $Operation
}

<#
.SYNOPSIS
Displays the completion banner.

.OUTPUTS
None
#>
function Show-CompletionBanner {
    [CmdletBinding()]
    param()

    $line = "=" * 72

    Write-Host ""
    Write-Host $line -ForegroundColor Green
    Write-Host " Repository Bootstrap Completed Successfully" -ForegroundColor Green
    Write-Host $line -ForegroundColor Green
    Write-Host ""
}

<#
.SYNOPSIS
Displays the failure banner.

.OUTPUTS
None
#>
function Show-FailureBanner {
    [CmdletBinding()]
    param()

    $line = "=" * 72

    Write-Host ""
    Write-Host $line -ForegroundColor Red
    Write-Host " Repository Bootstrap Failed" -ForegroundColor Red
    Write-Host $line -ForegroundColor Red
    Write-Host ""
}