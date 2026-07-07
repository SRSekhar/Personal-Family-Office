Set-StrictMode -Version Latest

<#
.SYNOPSIS
Validates the repository structure.

.DESCRIPTION
Checks that all configured directories and files exist.

.OUTPUTS
PSCustomObject
#>
function Test-RepositoryStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory)]
        [pscustomobject]$Structure
    )

    Write-Section "Repository Validation"

    $missingDirectories = [System.Collections.Generic.List[string]]::new()
    $missingFiles = [System.Collections.Generic.List[string]]::new()

    foreach ($directory in $Structure.directories) {

        $path = Join-RepositoryPath `
            -RepositoryRoot $RepositoryRoot `
            -RelativePath $directory

        if (Test-PathExists -Path $path) {
            Write-Info "Directory OK : $directory"
        }
        else {
            Write-WarningLog "Missing directory : $directory"
            $missingDirectories.Add($directory)
        }
    }

    foreach ($file in $Structure.files) {

        $path = Join-RepositoryPath `
            -RepositoryRoot $RepositoryRoot `
            -RelativePath $file

        if (Test-PathExists -Path $path) {
            Write-Info "File OK : $file"
        }
        else {
            Write-WarningLog "Missing file : $file"
            $missingFiles.Add($file)
        }
    }

    return [PSCustomObject]@{
        IsValid             = ($missingDirectories.Count -eq 0 -and $missingFiles.Count -eq 0)
        MissingDirectories  = $missingDirectories
        MissingFiles        = $missingFiles
        DirectoryCount      = $Structure.directories.Count
        FileCount           = $Structure.files.Count
    }
}

<#
.SYNOPSIS
Runs repository diagnostics.

.DESCRIPTION
Displays repository health and recommends corrective actions.

.OUTPUTS
None
#>
function Invoke-RepositoryDoctor {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$ValidationResult
    )

    Write-Section "Repository Doctor"

    if ($ValidationResult.IsValid) {

        Write-Success "Repository health check passed."
        return
    }

    if ($ValidationResult.MissingDirectories.Count -gt 0) {

        Write-Host ""
        Write-Host "Missing Directories" -ForegroundColor Yellow
        Write-Host "-------------------" -ForegroundColor Yellow

        foreach ($directory in $ValidationResult.MissingDirectories) {
            Write-Host (" - {0}" -f $directory)
        }
    }

    if ($ValidationResult.MissingFiles.Count -gt 0) {

        Write-Host ""
        Write-Host "Missing Files" -ForegroundColor Yellow
        Write-Host "-------------" -ForegroundColor Yellow

        foreach ($file in $ValidationResult.MissingFiles) {
            Write-Host (" - {0}" -f $file)
        }
    }

    Write-Host ""
    Write-WarningLog "Repository validation completed with issues."
}

<#
.SYNOPSIS
Displays validation results.

.OUTPUTS
None
#>
function Show-ValidationSummary {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$ValidationResult
    )

    Write-Section "Validation Summary"

    Write-Host ("Repository Valid      : {0}" -f $ValidationResult.IsValid)
    Write-Host ("Directories Checked   : {0}" -f $ValidationResult.DirectoryCount)
    Write-Host ("Files Checked         : {0}" -f $ValidationResult.FileCount)
    Write-Host ("Missing Directories   : {0}" -f $ValidationResult.MissingDirectories.Count)
    Write-Host ("Missing Files         : {0}" -f $ValidationResult.MissingFiles.Count)

    Write-Host ""
}