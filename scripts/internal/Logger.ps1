Set-StrictMode -Version Latest

$script:LogStatistics = @{
    Information = 0
    Success     = 0
    Warning     = 0
    Error       = 0
}

<#
.SYNOPSIS
Writes a formatted log message.
#>
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR')]
        [string]$Level,

        [Parameter(Mandatory)]
        [string]$Message
    )

    $timestamp = Get-Timestamp
    $text = "[{0}] [{1}] {2}" -f $timestamp, $Level, $Message

    switch ($Level) {

        'INFO' {
            Write-Host $text -ForegroundColor Cyan
            $script:LogStatistics.Information++
        }

        'SUCCESS' {
            Write-Host $text -ForegroundColor Green
            $script:LogStatistics.Success++
        }

        'WARNING' {
            Write-Warning $Message
            $script:LogStatistics.Warning++
        }

        'ERROR' {
            Write-Error $Message
            $script:LogStatistics.Error++
        }
    }
}

<#
.SYNOPSIS
Writes an informational message.
#>
function Write-Info {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    Write-Log -Level INFO -Message $Message
}

<#
.SYNOPSIS
Writes a success message.
#>
function Write-Success {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    Write-Log -Level SUCCESS -Message $Message
}

<#
.SYNOPSIS
Writes a warning message.
#>
function Write-WarningLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    Write-Log -Level WARNING -Message $Message
}

<#
.SYNOPSIS
Writes an error message.
#>
function Write-ErrorLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Message
    )

    Write-Log -Level ERROR -Message $Message
}

<#
.SYNOPSIS
Writes a section heading.
#>
function Write-Section {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Title
    )

    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor DarkGray
    Write-Host (" {0}" -f $Title) -ForegroundColor White
    Write-Host ("=" * 72) -ForegroundColor DarkGray
    Write-Host ""
}

<#
.SYNOPSIS
Displays execution statistics.
#>
function Show-LogSummary {
    [CmdletBinding()]
    param()

    Write-Section "Execution Summary"

    [PSCustomObject]@{
        Information = $script:LogStatistics.Information
        Success     = $script:LogStatistics.Success
        Warning     = $script:LogStatistics.Warning
        Error       = $script:LogStatistics.Error
    } | Format-Table -AutoSize
}