Set-StrictMode -Version Latest

<#
.SYNOPSIS
Initializes the repository structure from repository.structure.json.

.DESCRIPTION
Validates all configured paths before making changes, creates missing directories
and files without overwriting existing content, and reports the operation result.
#>
function Initialize-RepositoryStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [pscustomobject]$Structure
    )

    $root = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $directorySeparator = [System.IO.Path]::DirectorySeparatorChar
    $rootPrefix = $root.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )) + $directorySeparator

    $directoryPaths = [System.Collections.Generic.List[object]]::new()
    $filePaths = [System.Collections.Generic.List[object]]::new()

    foreach ($relativePath in $Structure.directories) {
        $fullPath = Resolve-RepositoryConfiguredPath -RepositoryRoot $root -RelativePath $relativePath -RootPrefix $rootPrefix
        $directoryPaths.Add([PSCustomObject]@{ Relative = $relativePath; Full = $fullPath })
    }

    foreach ($relativePath in $Structure.files) {
        $fullPath = Resolve-RepositoryConfiguredPath -RepositoryRoot $root -RelativePath $relativePath -RootPrefix $rootPrefix
        $filePaths.Add([PSCustomObject]@{ Relative = $relativePath; Full = $fullPath })
    }

    $createdDirectories = 0
    $createdFiles = 0

    Write-Section "Initialize Repository Structure"

    foreach ($directory in $directoryPaths) {
        if (New-DirectoryIfMissing -Path $directory.Full) {
            $createdDirectories++
            Write-Success ("Directory created: {0}" -f $directory.Relative)
        }
    }

    foreach ($file in $filePaths) {
        if (New-FileIfMissing -Path $file.Full) {
            $createdFiles++
            Write-Success ("File created: {0}" -f $file.Relative)
        }
    }

    [PSCustomObject]@{
        CreatedDirectories = $createdDirectories
        CreatedFiles       = $createdFiles
        DirectoryCount     = $directoryPaths.Count
        FileCount          = $filePaths.Count
    }
}

<#
.SYNOPSIS
Resolves a configured relative path and rejects path traversal.
#>
function Resolve-RepositoryConfiguredPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [string]$RelativePath,

        [Parameter(Mandatory)]
        [string]$RootPrefix
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw "Repository structure contains an empty path."
    }

    $normalizedPath = $RelativePath.Replace('\', '/')

    if ($normalizedPath.StartsWith('/') -or
        $normalizedPath -match '^[A-Za-z]:' -or
        ($normalizedPath -split '/') -contains '..') {
        throw "Unsafe repository-relative path in configuration: $RelativePath"
    }

    $fullPath = [System.IO.Path]::GetFullPath(
        (Join-Path -Path $RepositoryRoot -ChildPath $normalizedPath)
    )

    if (-not $fullPath.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Configured path resolves outside the repository root: $RelativePath"
    }

    return $fullPath
}
