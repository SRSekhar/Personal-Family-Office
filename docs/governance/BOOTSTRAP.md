# Repository Bootstrap Framework

## Purpose

The repository bootstrap framework creates missing configured paths without overwriting existing files, validates repository structure, and reports basic repository health.

The implementation is configuration-driven and designed to be idempotent. It validates configured relative paths before creating them and rejects paths that attempt to escape the repository root.

## Entry point

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1
```

The legacy root-level bootstrap.ps1 script delegates to the same entry point.

## Supported operations

### Initialize

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1
```

Creates missing directories and files defined in scripts/config/repository.structure.json. Existing files are not overwritten.

### Validate

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -Validate
```

Checks required repository markers and configured paths. Returns a non-zero process exit code when validation fails.

### Doctor

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -Doctor
```

Reports missing configured paths without creating them. Returns a non-zero process exit code when missing paths are detected.

### Preview changes

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -WhatIf
```

Uses PowerShell WhatIf support to preview creation operations. Post-initialization validation is skipped because the preview does not apply changes.

### Target a repository root

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -Validate -RepositoryRoot "C:\work\Personal-Family-Office"
```

The target must already contain the PFO repository marker files. The script and its internal modules must be present in the invoking checkout.

## Configuration

Repository structure is defined in scripts/config/repository.structure.json. Do not duplicate the list of paths inside the entry point.

## Internal modules

- Common.ps1 — path and file helpers.
- Logger.ps1 — structured console output and operation counts.
- Configuration.ps1 — configuration loading and validation.
- Repository.ps1 — repository root and metadata helpers.
- Structure.ps1 — safe creation of configured directories and files.
- Validation.ps1 — repository structure checks and doctor output.
- Banner.ps1 — console presentation.

## Safety

- Existing files are never overwritten.
- Absolute paths, drive-qualified paths, and parent-directory traversal are rejected in the structure configuration.
- The repository's .gitignore excludes the local data and reports directories so real financial records and generated reports are not accidentally committed.
- Run validation after initialization and review Git status before committing any generated files.

## Current limitations

The bootstrap framework validates repository structure only. It does not validate dependencies, build TypeScript packages, run tests, scan secrets, or certify security. Those checks belong in CI and dedicated security tooling.
