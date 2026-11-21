Set-StrictMode -Version Latest

function Test-NullOrWhiteSpace {
    [CmdletBinding()]
    param([AllowNull()][string]$Value)
    return [string]::IsNullOrWhiteSpace($Value)
}

function Test-PathExists {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    return Test-Path -LiteralPath $Path
}

function Get-Timestamp {
    [CmdletBinding()]
    param()
    return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

function Join-RepositoryPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][string]$RelativePath
    )
    return Join-Path -Path $RepositoryRoot -ChildPath $RelativePath
}

function New-DirectoryIfMissing {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if (-not $item.PSIsContainer) { throw "Cannot create directory because a file already exists at: $Path" }
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to use a symbolic link or reparse point as a repository directory: $Path"
        }
        return $false
    }

    if ($PSCmdlet.ShouldProcess($Path, "Create directory")) {
        try { [System.IO.Directory]::CreateDirectory($Path) | Out-Null }
        catch {
            if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw }
        }
    }
    return $true
}

function New-FileIfMissing {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.PSIsContainer) { throw "Cannot create file because a directory already exists at: $Path" }
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to use a symbolic link or reparse point as a repository file: $Path"
        }
        return $false
    }

    if (-not $PSCmdlet.ShouldProcess($Path, "Create file")) {
        return $true
    }

    $stream = $null
    try {
        # CreateNew is atomic and cannot truncate a file created by another process.
        $stream = [System.IO.File]::Open(
            $Path, [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read
        )
        return $true
    }
    catch [System.IO.IOException] {
        if (Test-Path -LiteralPath $Path -PathType Leaf) { return $false }
        throw
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Import-JsonFile {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "JSON file not found or is not a file: $Path"
    }
    try {
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Invalid JSON in '$Path'. $($_.Exception.Message)"
    }
}
