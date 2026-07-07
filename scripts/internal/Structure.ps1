Set-StrictMode -Version Latest

<#
.SYNOPSIS
Locates the PFO OS repository root.

.DESCRIPTION
Walks up the directory tree until the repository root is found.
The repository root is identified by the presence of the required
repository marker files.
#>
function Find-RepositoryRoot {
    [CmdletBinding()]
    param(
        [string]$StartPath = (Get-Location).Path
    )

    $currentDirectory = Resolve-Path -LiteralPath $StartPath

    while ($true) {

        $repositoryRoot = $currentDirectory.Path

        $requiredMarkers = @(
            "pfo.json",
            "README.md",
            "VERSION",
            "START_HERE.md",
            ".ai",
            "scripts"
        )

        $isRepository = $true

        foreach ($marker in $requiredMarkers) {

            $markerPath = Join-Path `
                -Path $repositoryRoot `
                -ChildPath $marker

            if (-not (Test-Path -LiteralPath $markerPath)) {
                $isRepository = $false
                break
            }
        }

        if ($isRepository) {
            Write-Success "Repository root located."
            return $repositoryRoot
        }

        $parent = Split-Path `
            -Path $repositoryRoot `
            -Parent

        if ([string]::IsNullOrWhiteSpace($parent) -or
            $parent -eq $repositoryRoot) {

            break
        }

        $currentDirectory = Resolve-Path `
            -LiteralPath $parent
    }

    throw "Unable to locate the PFO OS repository root."
}

<#
.SYNOPSIS
Validates the repository root.
#>
function Test-RepositoryRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot
    )

    Write-Info "Validating repository root..."

    $requiredItems = @(
        "pfo.json",
        "README.md",
        "VERSION",
        "START_HERE.md",
        ".ai",
        "scripts"
    )

    foreach ($item in $requiredItems) {

        $path = Join-RepositoryPath `
            -RepositoryRoot $RepositoryRoot `
            -RelativePath $item

        if (-not (Test-PathExists -Path $path)) {
            throw "Repository validation failed. Missing '$item'."
        }
    }

    Write-Success "Repository validation completed."
}

<#
.SYNOPSIS
Returns repository information.
#>
function Get-RepositoryInformation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [pscustomobject]$Configuration
    )

    return [PSCustomObject]@{

        Name             = $Configuration.name
        Repository       = $Configuration.repository.name
        Version          = $Configuration.version

        Root             = $RepositoryRoot

        Status           = $Configuration.project.status

        Language         = $Configuration.architecture.language
        PackageManager   = $Configuration.architecture.packageManager

        Architecture     = ($Configuration.architecture.style -join ", ")

        RepositoryMemory = $Configuration.principles.repositoryIsMemory
        DataFirst        = $Configuration.principles.dataIsSourceOfTruth
    }
}

<#
.SYNOPSIS
Displays repository information.
#>
function Show-RepositoryInformation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Repository
    )

    Write-Section "Repository Information"

    $Repository | Format-List

    Write-Host ""
}

<#
.SYNOPSIS
Returns whether the current directory is inside a PFO repository.
#>
function Test-InsideRepository {
    [CmdletBinding()]
    param()

    try {

        $null = Find-RepositoryRoot

        return $true
    }
    catch {

        return $false
    }
}