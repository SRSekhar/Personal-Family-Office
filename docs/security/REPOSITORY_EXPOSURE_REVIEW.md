# Public Repository Exposure Review

**Review date:** 2026-10-10  
**Scope:** Default-branch tree, selected repository metadata, project documentation, package metadata, and recent commit metadata.  
**Status:** Initial review only. This is not a complete secret scan, dependency audit, legal review, or history rewrite.

## Findings

### Repository visibility is public

GitHub reports this repository as public. Older documentation incorrectly says the repository is private, which could lead contributors to store private data in the wrong place.

**Action:** Align onboarding and machine-readable metadata with actual visibility. Do not commit real financial records or private configuration. This review does not change repository visibility.

### Installed dependencies were tracked

The default branch included a node_modules tree with 2,171 paths. This is generated installation output, not source code.

**Action:** Remove node_modules from the current branch tree and retain the existing ignore rule. Historical commits still contain old Git objects; this change does not rewrite history or guarantee a smaller Git object database.

### Licensing is not established

LICENSE.md is empty and package metadata says UNLICENSED. A public repository without an explicit license is not an open-source release.

**Action:** Do not describe the code as open source or publish packages under an assumed license. Select a license and contribution terms only after reviewing ownership, dependencies, and the public/private product boundary.

### Repository instructions were inconsistent

The README, onboarding guide, and pfo.json did not agree about visibility. Some descriptions could also be read as claims that planned capabilities have shipped.

**Action:** Clarify maturity, visibility, data-handling rules, and licensing status. Treat roadmap items as plans unless code and tests prove implementation.

### Historical commit metadata is public

Recent commit metadata includes an author email address. Commit metadata is public in this public repository.

**Action:** Configure a GitHub-provided noreply address for future commits if desired. Removing an address from existing history requires a separate history rewrite and coordination with clones; that is not included here.

## Checks performed

- Confirmed GitHub repository visibility and default branch through repository metadata.
- Enumerated the recursive default-branch tree and counted paths under node_modules.
- Checked selected root documentation, package metadata, workspace configuration, and recent commit metadata.
- Searched available indexed repository code for a small set of secret and personal-finance indicators. Search returned no matches, but indexing may be incomplete. This does **not** establish that the full repository or its history is free of sensitive information.

## Not yet performed

- Full historical secret scanning across every commit and blob.
- Dependency vulnerability and license inventory.
- Complete review of every source file, workflow, and test fixture.
- Review of third-party license and notice obligations.
- Formal legal review of ownership, licensing, contribution terms, trademarks, financial-services regulatory boundaries, or monetization.
- Private/public repository split or history rewrite.

## Release gate

Before publishing reusable components or inviting broad contributions:

1. Run a complete secret scan against the entire history.
2. Inspect all financial fixtures and reports; replace real data with synthetic data.
3. Consider removing generated dependencies from history with an explicit force-push and clone-migration plan.
4. Inventory dependency licenses and vulnerabilities.
5. Choose and apply an explicit license only after the product boundary is agreed.
6. Add CI gates for install, build, typecheck, lint, tests, and security checks.
7. Review privacy, disclaimers, and applicable legal obligations with qualified counsel.

## Conclusion

The current default branch has avoidable hygiene and documentation problems. This change addresses current-tree dependency tracking and corrects public-facing guidance. It is not a certification that the repository is safe to release or free of sensitive information.
