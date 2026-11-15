Set-StrictMode -Version Latest

function Find-RepositoryRoot {
    [CmdletBinding()]
    param([string]$StartPath = (Get-Location).Path)

    if (-not (Test-Path -LiteralPath $StartPath)) { throw "Repository search path does not exist: $StartPath" }
    $resolvedStart = Resolve-Path -LiteralPath $StartPath
    $currentPath = $resolvedStart.Path
    if (Test-Path -LiteralPath $currentPath -PathType Leaf) { $currentPath = Split-Path -Path $currentPath -Parent }

    while ($true) {
        $requiredMarkers = @{
            "pfo.json" = "Leaf"
            "README.md" = "Leaf"
            "VERSION" = "Leaf"
            "START_HERE.md" = "Leaf"
            ".ai" = "Container"
            "scripts" = "Container"
        }
        $isRepository = $true
        foreach ($marker in $requiredMarkers.Keys) {
            $markerPath = Join-Path -Path $currentPath -ChildPath $marker
            $expected = $requiredMarkers[$marker]
            if ($expected -eq "Leaf" -and -not (Test-Path -LiteralPath $markerPath -PathType Leaf)) { $isRepository = $false; break }
            if ($expected -eq "Container" -and -not (Test-Path -LiteralPath $markerPath -PathType Container)) { $isRepository = $false; break }
        }
        if ($isRepository) {
            Write-Success "Repository root located."
            return [System.IO.Path]::GetFullPath($currentPath)
        }
        $parent = Split-Path -Path $currentPath -Parent
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $currentPath) { break }
        $currentPath = $parent
    }
    throw "Unable to locate the PFO OS repository root from '$StartPath'."
}

function Test-RepositoryRoot {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    Write-Info "Validating repository root..."
    $requiredItems = @{
        "pfo.json" = "Leaf"; "README.md" = "Leaf"; "VERSION" = "Leaf"
        "START_HERE.md" = "Leaf"; ".ai" = "Container"; "scripts" = "Container"
    }
    foreach ($item in $requiredItems.Keys) {
        $path = Join-RepositoryPath -RepositoryRoot $RepositoryRoot -RelativePath $item
        $expected = $requiredItems[$item]
        $pathType = if ($expected -eq "Leaf") { "Leaf" } else { "Container" }
        if (-not (Test-Path -LiteralPath $path -PathType $pathType)) {
            throw "Repository validation failed. Missing or invalid '$item' (expected $expected)."
        }
    }
    Write-Success "Repository root validation completed."
}

function Get-RepositoryInformation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][pscustomobject]$Configuration
    )
    return [PSCustomObject]@{
        Name = $Configuration.name
        Repository = $Configuration.repository.name
        Version = $Configuration.version
        Root = $RepositoryRoot
        Status = $Configuration.project.status
        Language = $Configuration.architecture.language
        PackageManager = $Configuration.architecture.packageManager
        Architecture = ($Configuration.architecture.style -join ", ")
        RepositoryMemory = $Configuration.principles.repositoryIsMemory
        DataFirst = $Configuration.principles.dataIsSourceOfTruth
    }
}

function Show-RepositoryInformation {
    [CmdletBinding()]
    param([Parameter(Mandatory)][pscustomobject]$Repository)
    Write-Section "Repository Information"
    $Repository | Format-List
    Write-Host ""
}

function Test-InsideRepository {
    [CmdletBinding()]
    param()
    try { $null = Find-RepositoryRoot; return $true }
    catch { return $false }
}
