Set-StrictMode -Version Latest

<#
.SYNOPSIS
Loads the repository configuration (pfo.json).
#>
function Get-PFOConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot
    )

    $configurationPath = Join-RepositoryPath `
        -RepositoryRoot $RepositoryRoot `
        -RelativePath "pfo.json"

    Write-Info "Loading repository configuration..."

    $configuration = Import-JsonFile -Path $configurationPath

    Test-PFOConfiguration `
        -Configuration $configuration

    Write-Success "Repository configuration loaded."

    return $configuration
}

<#
.SYNOPSIS
Loads the repository structure configuration.
#>
function Get-RepositoryStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot
    )

    $structurePath = Join-RepositoryPath `
        -RepositoryRoot $RepositoryRoot `
        -RelativePath "scripts/config/repository.structure.json"

    Write-Info "Loading repository structure..."

    $structure = Import-JsonFile -Path $structurePath

    Test-RepositoryStructureConfiguration `
        -Structure $structure

    Write-Success "Repository structure loaded."

    return $structure
}

<#
.SYNOPSIS
Validates pfo.json.
#>
function Test-PFOConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Configuration
    )

    $requiredProperties = @(
        "name",
        "version",
        "repository",
        "architecture",
        "principles",
        "project"
    )

    foreach ($property in $requiredProperties) {

        if (-not $Configuration.PSObject.Properties.Match($property).Count) {
            throw "Missing required property '$property' in pfo.json."
        }
    }

    Write-Success "Repository configuration validation passed."
}

<#
.SYNOPSIS
Validates repository.structure.json.
#>
function Test-RepositoryStructureConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Structure
    )

    if (-not $Structure.PSObject.Properties.Match("directories").Count) {
        throw "repository.structure.json is missing the 'directories' collection."
    }

    if (-not $Structure.PSObject.Properties.Match("files").Count) {
        throw "repository.structure.json is missing the 'files' collection."
    }

    if ($Structure.directories.Count -eq 0) {
        throw "The 'directories' collection is empty."
    }

    if ($Structure.files.Count -eq 0) {
        throw "The 'files' collection is empty."
    }

    Write-Success "Repository structure configuration validation passed."
}

<#
.SYNOPSIS
Returns repository metadata used throughout the bootstrap process.
#>
function Get-RepositoryMetadata {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Configuration
    )

    return [PSCustomObject]@{
        Name           = $Configuration.name
        Version        = $Configuration.version
        RepositoryName = $Configuration.repository.name
        Language       = $Configuration.architecture.language
        PackageManager = $Configuration.architecture.packageManager
        Status         = $Configuration.project.status
    }
}