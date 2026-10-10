# Dependency License Evidence Review

**Review date:** 2026-10-10  
**Status:** Evidence collected; legal/redistribution disposition remains open.  
**Source inventory:** [DEPENDENCY_LICENSE_INVENTORY.md](DEPENDENCY_LICENSE_INVENTORY.md), generated from the installed pnpm dependency store resolved by the lockfile.

## Purpose and limits

The inventory flags nine package versions: seven declaring `BlueOak-1.0.0` and two declaring `MPL-2.0`. This note records a first-pass comparison against version-tagged upstream package metadata and license files. It is not legal advice, does not decide license compatibility, and does not authorize publication, redistribution, or a change to this repository's license.

The installed dependency inventory alone does not establish whether each package is included in a future production bundle or redistributed by a released product. That packaging boundary must be checked separately before release.

## Package-by-package evidence

| Package/version | Inventory metadata | Versioned upstream evidence | Observations from the evidence | Current disposition |
| --- | --- | --- | --- | --- |
| `glob@13.0.6` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/node-glob/blob/v13.0.6/package.json) · [LICENSE.md](https://github.com/isaacs/node-glob/blob/v13.0.6/LICENSE.md) | The tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The license file includes a statement about packages under `src/` being licensed by their respective license files; verify the published artifact and scope of that statement rather than relying on the metadata field alone. | Manual review remains open |
| `lru-cache@11.5.3` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/node-lru-cache/blob/v11.5.3/package.json) · [LICENSE.md](https://github.com/isaacs/node-lru-cache/blob/v11.5.3/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The upstream repository tree also contains a benchmark license file; verify the published package contents and retain the applicable license notice. | Manual review remains open |
| `minimatch@10.2.6` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/minimatch/blob/v10.2.6/package.json) · [LICENSE.md](https://github.com/isaacs/minimatch/blob/v10.2.6/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The license text includes a notice provision requiring recipients to receive the license text or a link to the license. | Manual review remains open |
| `minipass@7.1.3` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/minipass/blob/v7.1.3/package.json) · [LICENSE.md](https://github.com/isaacs/minipass/blob/v7.1.3/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The license text includes a notice provision requiring recipients to receive the license text or a link to the license. | Manual review remains open |
| `package-json-from-dist@1.0.1` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/package-json-from-dist/blob/v1.0.1/package.json) · [LICENSE.md](https://github.com/isaacs/package-json-from-dist/blob/v1.0.1/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. Its license file has the same `src/` carve-out language noted for `glob`; verify the published artifact and applicable license scope. | Manual review remains open |
| `path-scurry@2.0.2` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/path-scurry/blob/v2.0.2/package.json) · [LICENSE.md](https://github.com/isaacs/path-scurry/blob/v2.0.2/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The license text includes a notice provision requiring recipients to receive the license text or a link to the license. | Manual review remains open |
| `rimraf@6.1.3` | BlueOak-1.0.0 | [package.json](https://github.com/isaacs/rimraf/blob/v6.1.3/package.json) · [LICENSE.md](https://github.com/isaacs/rimraf/blob/v6.1.3/LICENSE.md) | Tagged package metadata declares BlueOak-1.0.0 and publishes `dist`. The upstream repository tree includes a separate historical benchmark license; verify the published artifact and applicable notice set. | Manual review remains open |
| `lightningcss@1.33.0` | MPL-2.0 | [package.json](https://github.com/parcel-bundler/lightningcss/blob/v1.33.0/package.json) · [LICENSE](https://github.com/parcel-bundler/lightningcss/blob/v1.33.0/LICENSE) · [selectors/LICENSE](https://github.com/parcel-bundler/lightningcss/blob/v1.33.0/selectors/LICENSE) | Tagged package metadata declares MPL-2.0. Both the root license file and the selectors license file contain Mozilla Public License 2.0 text. Review applicable source/notice and distribution obligations for the actual artifact before redistribution. | Manual review remains open |
| `lightningcss-linux-x64-gnu@1.33.0` | MPL-2.0 | [Official npm package page](https://www.npmjs.com/package/lightningcss-linux-x64-gnu/v/1.33.0) reports MPL-2.0 and identifies it as the x86_64 Linux GNU build of lightningcss. The source repository evidence above is for `lightningcss@1.33.0`, not a direct inspection of this platform-specific package tarball. | The package metadata has been independently confirmed, but its exact packed contents and included notice/license files have not been inspected. Do not infer full clearance from the parent package's license file alone. | Manual review remains open; artifact check outstanding |

## What this review establishes

- The seven BlueOak-1.0.0 package versions' upstream tagged `package.json` files and license files were inspected.
- The upstream tagged `lightningcss@1.33.0` package metadata declares MPL-2.0, and the repository contains MPL-2.0 license text at the root and under `selectors/`.
- The official npm page for `lightningcss-linux-x64-gnu@1.33.0` also reports MPL-2.0; its exact packed contents and included notice/license files have not been independently inspected in this pass.
- Several BlueOak license texts contain an explicit notice provision. The inventory generator does not prove that required notices are present in a future PFO OS distribution.
- No conclusion is made that any license is compatible or incompatible with the eventual PFO OS license or business model.

## Remaining release actions

1. Inspect the exact npm tarballs or packed contents for all nine versions, including which license and notice files are actually distributed.
2. Confirm whether any of these packages or their code are shipped in production artifacts, as distinct from being used only by development/test tooling.
3. Inspect the packed contents and included notice/license files for `lightningcss-linux-x64-gnu@1.33.0`; its npm metadata already reports MPL-2.0.
4. Determine the required attribution/notice and source-availability steps for the intended distribution model with qualified legal review.
5. Record the final disposition only after the product boundary and PFO OS license are deliberately decided. Until then, all nine entries remain flagged for manual review.

**Guardrail:** Do not change `LICENSE.md`, `package.json` licensing metadata, repository visibility, or the public/private product boundary as part of this evidence-gathering task.
