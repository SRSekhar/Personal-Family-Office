Set-StrictMode -Version Latest

function Get-RepositoryPathComparison {
    if ($IsWindows) { return [System.StringComparison]::OrdinalIgnoreCase }
    return [System.StringComparison]::Ordinal
}

function Resolve-RepositoryConfiguredPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) { throw "Repository structure contains an empty path." }

    $normalizedPath = $RelativePath.Replace('\', '/')
    $segments = $normalizedPath.Split('/')
    $invalidSegments = @($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' })
    if ($normalizedPath.StartsWith('/') -or $normalizedPath -match '^[A-Za-z]:' -or
        $normalizedPath.Contains(':') -or $invalidSegments.Count -gt 0) {
        throw "Unsafe repository-relative path in configuration: $RelativePath"
    }

    $root = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $rootWithoutEndingSeparator = $root.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar
    ))
    if ([string]::IsNullOrEmpty($rootWithoutEndingSeparator)) {
        $rootWithoutEndingSeparator = [System.IO.Path]::GetPathRoot($root)
    }

    $rootPrefix = $rootWithoutEndingSeparator
    if (-not $rootPrefix.EndsWith([string][System.IO.Path]::DirectorySeparatorChar) -and
        -not $rootPrefix.EndsWith([string][System.IO.Path]::AltDirectorySeparatorChar)) {
        $rootPrefix += [System.IO.Path]::DirectorySeparatorChar
    }

    $platformPath = $normalizedPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path -Path $root -ChildPath $platformPath))
    $comparison = Get-RepositoryPathComparison
    if (-not $fullPath.Equals($rootWithoutEndingSeparator, $comparison) -and
        -not $fullPath.StartsWith($rootPrefix, $comparison)) {
        throw "Configured path resolves outside the repository root: $RelativePath"
    }

    # Lexical containment is insufficient when an existing link redirects a path.
    $currentPath = $rootWithoutEndingSeparator
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $currentPath = Join-Path -Path $currentPath -ChildPath $segments[$index]
        $item = Get-Item -LiteralPath $currentPath -Force -ErrorAction SilentlyContinue
        if ($null -ne $item) {
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Configured path traverses a symbolic link or reparse point: $RelativePath"
            }
            if ($index -lt ($segments.Count - 1) -and -not $item.PSIsContainer) {
                throw "A parent component of configured path is not a directory: $currentPath"
            }
        }
    }

    return $fullPath
}

function Test-RepositoryPathType {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][ValidateSet('Directory', 'File')][string]$ExpectedType
    )
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return $false }

    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Configured repository path is a symbolic link or reparse point: $Path"
    }
    if ($ExpectedType -eq 'Directory' -and -not $item.PSIsContainer) {
        throw "Expected a directory but found a file: $Path"
    }
    if ($ExpectedType -eq 'File' -and $item.PSIsContainer) {
        throw "Expected a file but found a directory: $Path"
    }
    return $true
}

function Initialize-RepositoryStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][pscustomobject]$Structure
    )

    $root = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $directoryPaths = [System.Collections.Generic.List[object]]::new()
    $filePaths = [System.Collections.Generic.List[object]]::new()

    # Resolve and type-check the entire plan before making the first change.
    foreach ($relativePath in $Structure.directories) {
        $fullPath = Resolve-RepositoryConfiguredPath -RepositoryRoot $root -RelativePath $relativePath
        $exists = Test-RepositoryPathType -Path $fullPath -ExpectedType Directory
        $directoryPaths.Add([PSCustomObject]@{ Relative = $relativePath; Full = $fullPath; Exists = $exists })
    }
    foreach ($relativePath in $Structure.files) {
        $fullPath = Resolve-RepositoryConfiguredPath -RepositoryRoot $root -RelativePath $relativePath
        $exists = Test-RepositoryPathType -Path $fullPath -ExpectedType File
        $filePaths.Add([PSCustomObject]@{ Relative = $relativePath; Full = $fullPath; Exists = $exists })
    }

    $createdDirectories = 0
    $createdFiles = 0
    Write-Section "Initialize Repository Structure"

    foreach ($directory in $directoryPaths) {
        if (-not $directory.Exists -and (New-DirectoryIfMissing -Path $directory.Full)) {
            $createdDirectories++
            Write-Success ("Directory prepared: {0}" -f $directory.Relative)
        }
    }
    foreach ($file in $filePaths) {
        if (-not $file.Exists -and (New-FileIfMissing -Path $file.Full)) {
            $createdFiles++
            Write-Success ("File prepared: {0}" -f $file.Relative)
        }
    }

    $plannedDirectories = if ($WhatIfPreference) { $createdDirectories } else { 0 }
    $plannedFiles = if ($WhatIfPreference) { $createdFiles } else { 0 }
    $actualCreatedDirectories = if ($WhatIfPreference) { 0 } else { $createdDirectories }
    $actualCreatedFiles = if ($WhatIfPreference) { 0 } else { $createdFiles }

    [PSCustomObject]@{
        CreatedDirectories = $actualCreatedDirectories
        CreatedFiles       = $actualCreatedFiles
        PlannedDirectories = $plannedDirectories
        PlannedFiles       = $plannedFiles
        DirectoryCount     = $directoryPaths.Count
        FileCount          = $filePaths.Count
    }
}
