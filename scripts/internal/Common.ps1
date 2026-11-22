Set-StrictMode -Version Latest

<#
.SYNOPSIS
Returns true when the supplied value is null, empty or whitespace.
#>
function Test-NullOrWhiteSpace {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string]$Value
    )

    return [string]::IsNullOrWhiteSpace($Value)
}

<#
.SYNOPSIS
Determines whether a path exists.
#>
function Test-PathExists {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return Test-Path -LiteralPath $Path
}

<#
.SYNOPSIS
Returns the current timestamp.
#>
function Get-Timestamp {
    [CmdletBinding()]
    param()

    return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

<#
.SYNOPSIS
Combines a repository root and relative path.
#>
function Join-RepositoryPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    return Join-Path -Path $RepositoryRoot -ChildPath $RelativePath
}

<#
.SYNOPSIS
Creates a directory only if it does not already exist.

.OUTPUTS
System.Boolean
#>
function New-DirectoryIfMissing {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (Test-PathExists -Path $Path) {
        return $false
    }

    if ($PSCmdlet.ShouldProcess($Path, "Create directory")) {
        New-Item `
            -ItemType Directory `
            -Path $Path `
            -Force | Out-Null
    }

    return $true
}

<#
.SYNOPSIS
Creates a file only if it does not already exist.

.OUTPUTS
System.Boolean
#>
function New-FileIfMissing {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (Test-PathExists -Path $Path) {
        return $false
    }

    if ($PSCmdlet.ShouldProcess($Path, "Create file")) {
        New-Item `
            -ItemType File `
            -Path $Path `
            -Force | Out-Null
    }

    return $true
}

<#
.SYNOPSIS
Reads and converts a JSON file into a PowerShell object.
#>
function Import-JsonFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (-not (Test-PathExists -Path $Path)) {
        throw "JSON file not found: $Path"
    }

    try {
        return Get-Content `
            -LiteralPath $Path `
            -Raw `
            -Encoding UTF8 |
            ConvertFrom-Json
    }
    catch {
        throw "Invalid JSON in '$Path'. $($_.Exception.Message)"
    }
}