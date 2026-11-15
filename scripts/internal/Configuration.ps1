Set-StrictMode -Version Latest

function Get-PFOConfiguration {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $configurationPath = Join-RepositoryPath -RepositoryRoot $RepositoryRoot -RelativePath "pfo.json"
    Write-Info "Loading repository configuration..."
    $configuration = Import-JsonFile -Path $configurationPath
    Test-PFOConfiguration -Configuration $configuration
    Write-Success "Repository configuration loaded."
    return $configuration
}

function Get-RepositoryStructure {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $structurePath = Join-RepositoryPath -RepositoryRoot $RepositoryRoot -RelativePath "scripts/config/repository.structure.json"
    $structure = Import-JsonFile -Path $structurePath
    Test-RepositoryStructureConfiguration -Structure $structure -RepositoryRoot $RepositoryRoot
    Write-Success "Repository structure configuration loaded and validated."
    return $structure
}

function Test-PFOConfiguration {
    [CmdletBinding()]
    param([Parameter(Mandatory)][pscustomobject]$Configuration)

    foreach ($property in @("name", "fullName", "version", "repository", "architecture", "principles", "project")) {
        if ($null -eq $Configuration.PSObject.Properties[$property]) {
            throw "Missing required property '$property' in pfo.json."
        }
    }

    foreach ($path in @("repository.name", "architecture.style", "architecture.language", "architecture.packageManager", "project.status")) {
        $value = $Configuration
        foreach ($segment in $path.Split('.')) {
            if ($null -eq $value -or $null -eq $value.PSObject.Properties[$segment]) {
                throw "Missing required configuration value '$path' in pfo.json."
            }
            $value = $value.$segment
        }
        if ($null -eq $value -or ($value -is [string] -and [string]::IsNullOrWhiteSpace($value))) {
            throw "Configuration value '$path' in pfo.json cannot be empty."
        }
    }

    if ($Configuration.architecture.style -isnot [array] -or $Configuration.architecture.style.Count -eq 0) {
        throw "Configuration value 'architecture.style' must be a non-empty array."
    }
}

function Test-RepositoryStructureConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Structure,
        [Parameter(Mandatory)][string]$RepositoryRoot
    )

    foreach ($collectionName in @("directories", "files")) {
        $property = $Structure.PSObject.Properties[$collectionName]
        if ($null -eq $property -or $property.Value -isnot [array] -or $property.Value.Count -eq 0) {
            throw "repository.structure.json must contain a non-empty '$collectionName' array."
        }
        foreach ($entry in $property.Value) {
            if ($entry -isnot [string] -or [string]::IsNullOrWhiteSpace($entry)) {
                throw "Every entry in '$collectionName' must be a non-empty relative path string."
            }
        }
    }

    $allPaths = [System.Collections.Generic.List[string]]::new()
    $configuredPaths = @($Structure.directories) + @($Structure.files)
    foreach ($path in $configuredPaths) {
        $null = Resolve-RepositoryConfiguredPath -RepositoryRoot $RepositoryRoot -RelativePath $path
        $normalized = $path.Replace('\', '/')
        $comparison = if ($IsWindows) { [System.StringComparison]::OrdinalIgnoreCase } else { [System.StringComparison]::Ordinal }
        foreach ($existing in $allPaths) {
            if ($existing.Equals($normalized, $comparison)) { throw "Duplicate repository structure path: $path" }
        }
        $allPaths.Add($normalized)
    }

    $directorySet = @($Structure.directories | ForEach-Object { $_.Replace('\', '/') })
    $fileSet = @($Structure.files | ForEach-Object { $_.Replace('\', '/') })
    foreach ($path in $allPaths) {
        $segments = $path.Split('/')
        for ($index = 1; $index -lt $segments.Count; $index++) {
            $parent = ($segments[0..($index - 1)] -join '/')
            if ($fileSet -contains $parent) { throw "A configured file cannot be a parent of another configured path: $parent" }
        }
    }

    # Every nested configured path must have a directory parent that is either
    # explicitly configured or already present as a real directory.
    foreach ($configuredPath in $configuredPaths) {
        $segments = $configuredPath.Replace('\', '/').Split('/')
        if ($segments.Count -gt 1) {
            $parent = ($segments[0..($segments.Count - 2)] -join '/')
            if ($directorySet -notcontains $parent) {
                $parentPath = Join-Path -Path $RepositoryRoot -ChildPath $parent
                if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) {
                    throw "Parent directory for configured path '$configuredPath' must exist or be listed in directories: $parent"
                }
            }
        }
    }
}

function Get-RepositoryMetadata {
    [CmdletBinding()]
    param([Parameter(Mandatory)][pscustomobject]$Configuration)

    return [PSCustomObject]@{
        Name           = $Configuration.name
        Version        = $Configuration.version
        RepositoryName = $Configuration.repository.name
        Language       = $Configuration.architecture.language
        PackageManager = $Configuration.architecture.packageManager
        Status         = $Configuration.project.status
    }
}
