Set-StrictMode -Version Latest

function Test-RepositoryStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][pscustomobject]$Structure
    )

    Write-Section "Repository Validation"
    $missingDirectories = [System.Collections.Generic.List[string]]::new()
    $missingFiles = [System.Collections.Generic.List[string]]::new()
    $invalidPaths = [System.Collections.Generic.List[string]]::new()

    foreach ($directory in $Structure.directories) {
        try {
            $path = Resolve-RepositoryConfiguredPath -RepositoryRoot $RepositoryRoot -RelativePath $directory
            if (Test-RepositoryPathType -Path $path -ExpectedType Directory) { Write-Info "Directory OK : $directory" }
            else { Write-WarningLog "Missing directory : $directory"; $missingDirectories.Add($directory) }
        }
        catch {
            $invalidPaths.Add(("{0}: {1}" -f $directory, $_.Exception.Message))
            Write-WarningLog ("Invalid directory path: {0}" -f $directory)
        }
    }

    foreach ($file in $Structure.files) {
        try {
            $path = Resolve-RepositoryConfiguredPath -RepositoryRoot $RepositoryRoot -RelativePath $file
            if (Test-RepositoryPathType -Path $path -ExpectedType File) { Write-Info "File OK : $file" }
            else { Write-WarningLog "Missing file : $file"; $missingFiles.Add($file) }
        }
        catch {
            $invalidPaths.Add(("{0}: {1}" -f $file, $_.Exception.Message))
            Write-WarningLog ("Invalid file path: {0}" -f $file)
        }
    }

    return [PSCustomObject]@{
        IsValid = ($missingDirectories.Count -eq 0 -and $missingFiles.Count -eq 0 -and $invalidPaths.Count -eq 0)
        MissingDirectories = $missingDirectories
        MissingFiles = $missingFiles
        InvalidPaths = $invalidPaths
        DirectoryCount = $Structure.directories.Count
        FileCount = $Structure.files.Count
    }
}

function Invoke-RepositoryDoctor {
    [CmdletBinding()]
    param([Parameter(Mandatory)][pscustomobject]$ValidationResult)

    Write-Section "Repository Doctor"
    if ($ValidationResult.IsValid) { Write-Success "Repository health check passed."; return }
    foreach ($directory in $ValidationResult.MissingDirectories) {
        Write-Host ("Missing directory: {0}" -f $directory) -ForegroundColor Yellow
    }
    foreach ($file in $ValidationResult.MissingFiles) {
        Write-Host ("Missing file: {0}" -f $file) -ForegroundColor Yellow
    }
    foreach ($invalid in $ValidationResult.InvalidPaths) {
        Write-Host ("Invalid path: {0}" -f $invalid) -ForegroundColor Red
    }
    Write-WarningLog "Repository validation completed with issues."
}

function Show-ValidationSummary {
    [CmdletBinding()]
    param([Parameter(Mandatory)][pscustomobject]$ValidationResult)

    Write-Section "Validation Summary"
    Write-Host ("Repository Valid      : {0}" -f $ValidationResult.IsValid)
    Write-Host ("Directories Checked   : {0}" -f $ValidationResult.DirectoryCount)
    Write-Host ("Files Checked         : {0}" -f $ValidationResult.FileCount)
    Write-Host ("Missing Directories   : {0}" -f $ValidationResult.MissingDirectories.Count)
    Write-Host ("Missing Files         : {0}" -f $ValidationResult.MissingFiles.Count)
    Write-Host ("Invalid Paths         : {0}" -f $ValidationResult.InvalidPaths.Count)
    Write-Host ""
}
