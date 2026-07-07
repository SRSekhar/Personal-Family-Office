# Repository Bootstrap Framework

## Overview

The Repository Bootstrap Framework initializes and validates the PFO OS repository.

It is designed to be:

- Idempotent
- Safe to rerun
- Configuration-driven
- Modular
- Extensible

---

## Entry Point

```
scripts/build/Initialize-PFO.ps1
```

---

## Supported Operations

### Initialize Repository

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1
```

Creates any missing repository folders and files.

---

### Validate Repository

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -Validate
```

Validates the repository structure against the configured definition.

---

### Repository Doctor

```powershell
pwsh ./scripts/build/Initialize-PFO.ps1 -Doctor
```

Displays repository health information and reports missing items.

---

## Configuration

Repository structure is defined in:

```
scripts/config/repository.structure.json
```

No repository paths are hardcoded in the bootstrap process.

---

## Internal Modules

```
scripts/internal/
```

- Common.ps1
- Logger.ps1
- Banner.ps1
- Configuration.ps1
- Repository.ps1
- Structure.ps1
- Validation.ps1

---

## Design Principles

- Single Responsibility
- Modular Design
- Configuration over Code
- Idempotent Execution
- Production Quality

---

## Future Enhancements

- PowerShell module packaging
- PSScriptAnalyzer integration
- Automated repair mode
- Structured log output
- Repository upgrade support