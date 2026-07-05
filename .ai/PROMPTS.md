# PFO OS Prompt Library

## Purpose

This document contains standardized prompts for AI assistants working on PFO OS.

Every implementation session should begin with one of these prompts.

---

# Continue Current Sprint

```
Continue PFO OS

Read:

START_HERE.md

Then read:

.ai/AI_CONTEXT.md
.ai/PROJECT_STATE.md
.ai/CURRENT_SPRINT.md
.ai/HANDOFF.md

Continue implementing the current sprint.

Before finishing:

- Update PROJECT_STATE.md if required.
- Update HANDOFF.md if required.
- Recommend the next logical task.
```

---

# Create New Feature

```
Continue PFO OS.

Current Branch:

feature/<feature-name>

Read the onboarding documents.

Implement only the requested feature.

Follow:

- Clean Architecture
- Domain Driven Design
- Conventional Commits
- Production quality

Do not redesign unrelated parts of the repository.
```

---

# Review Existing Code

```
Review the existing implementation.

Evaluate:

- Architecture
- Maintainability
- Naming
- SOLID
- DDD
- Technical Debt

Produce actionable recommendations only.
```

---

# Generate Documentation

```
Generate production-quality documentation.

Requirements:

- Enterprise standard
- No placeholders
- Consistent terminology
- Repository aligned
```

---

# Annual Portfolio Review

```
Review the Principal's portfolio.

Provide:

- Executive Summary
- Portfolio Health
- Risk Analysis
- Diversification
- Opportunities
- Recommended Actions
```

---

# Repository Rules

Every prompt assumes the repository is the permanent source of truth.