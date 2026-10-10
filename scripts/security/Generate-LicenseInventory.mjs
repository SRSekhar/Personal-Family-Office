#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const rootDirectory = process.cwd();

/**
 * Builds a Markdown inventory from the pnpm virtual store.
 * @param {string} pnpmStoreDirectory
 * @returns {Promise<string>}
 */
export async function generateLicenseInventory(pnpmStoreDirectory) {
    const snapshotEntries = await readdir(pnpmStoreDirectory, { withFileTypes: true });
    const packages = new Map();

    async function addPackage(packageJsonPath, packageDirectory) {
        let packageMetadata;

        try {
            packageMetadata = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                return;
            }
            throw new Error(`Unable to read package metadata at ${packageJsonPath}: ${String(error)}`, { cause: error });
        }

        if (typeof packageMetadata.name !== 'string' ||
            typeof packageMetadata.version !== 'string') {
            return;
        }

        const license = normalizeLicense(packageMetadata.license ?? packageMetadata.licenses);
        const key = `${packageMetadata.name}@${packageMetadata.version}`;
        const packagePath = relative(rootDirectory, packageDirectory).split('\\').join('/');

        if (!packages.has(key)) {
            packages.set(key, {
                name: packageMetadata.name,
                version: packageMetadata.version,
                license,
                path: packagePath
            });
        }
    }

    for (const snapshot of snapshotEntries) {
        if (!snapshot.isDirectory() || snapshot.name === 'node_modules') {
            continue;
        }

        const snapshotNodeModules = join(pnpmStoreDirectory, snapshot.name, 'node_modules');
        let entries;

        try {
            entries = await readdir(snapshotNodeModules, { withFileTypes: true });
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                continue;
            }
            throw error;
        }

        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === '.bin') {
                continue;
            }

            if (entry.name.startsWith('@')) {
                const scopeDirectory = join(snapshotNodeModules, entry.name);
                const scopedPackages = await readdir(scopeDirectory, { withFileTypes: true });

                for (const scopedPackage of scopedPackages) {
                    if (!scopedPackage.isDirectory()) {
                        continue;
                    }

                    await addPackage(
                        join(scopeDirectory, scopedPackage.name, 'package.json'),
                        join(snapshotNodeModules, entry.name, scopedPackage.name)
                    );
                }
            } else {
                await addPackage(
                    join(snapshotNodeModules, entry.name, 'package.json'),
                    join(snapshotNodeModules, entry.name)
                );
            }
        }
    }

    const rows = [...packages.values()].sort((left, right) => {
        const byName = left.name.localeCompare(right.name);
        return byName !== 0 ? byName : left.version.localeCompare(right.version);
    });

    const licenseCounts = new Map();
    for (const item of rows) {
        licenseCounts.set(item.license, (licenseCounts.get(item.license) ?? 0) + 1);
    }

    const summaryRows = [...licenseCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([license, count]) => `| ${escapeMarkdown(license)} | ${count} |`);

    const packageRows = rows.map((item) =>
        `| ${escapeMarkdown(item.name)} | ${escapeMarkdown(item.version)} | ${escapeMarkdown(item.license)} | ${escapeMarkdown(item.path)} |`
    );

    const unclearCount = rows.filter((item) =>
        item.license === 'UNKNOWN' ||
        item.license === 'UNLICENSED' ||
        item.license.startsWith('SEE LICENSE IN')
    ).length;

    return `# Third-Party Dependency License Inventory

Generated: ${new Date().toISOString()}

## Scope and limitations

This inventory reads package metadata from the installed pnpm dependency store, which is resolved from the repository lockfile in CI. It records each unique npm package name and version and the license metadata declared by that package.

This is **not a legal compatibility determination**. License metadata may be missing, incomplete, inaccurate, dual-licensed, or require a separate license/NOTICE file. This inventory does not include the repository's own license decision, GitHub Actions, Node.js, the pnpm executable, operating-system components, or non-npm assets. Review package license texts and notice obligations before redistribution or commercial release.

## Summary

- Unique third-party package versions: **${rows.length}**
- Packages with missing or review-required license metadata: **${unclearCount}**

| License metadata | Package versions |
| --- | ---: |
${summaryRows.join('\n')}

## Package inventory

| Package | Version | License metadata | Installed package path |
| --- | --- | --- | --- |
${packageRows.join('\n')}
`;
    

}

function normalizeLicense(value) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim().replaceAll(/\s+/g, ' ');
    }

    if (Array.isArray(value)) {
        const licenses = value.map(normalizeLicense).filter((license) => license !== 'UNKNOWN');
        return licenses.length > 0 ? licenses.join(' OR ') : 'UNKNOWN';
    }

    if (value && typeof value === 'object') {
        if (typeof value.type === 'string' && value.type.trim().length > 0) {
            return value.type.trim();
        }

        if (Array.isArray(value)) {
            return normalizeLicense(value);
        }
    }

    return 'UNKNOWN';
}

function escapeMarkdown(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function main() {
    const pnpmStoreDirectory = resolve(rootDirectory, 'node_modules/.pnpm');
    const outputIndex = process.argv.indexOf('--output');
    const outputPath = outputIndex >= 0
        ? resolve(rootDirectory, process.argv[outputIndex + 1] ?? '')
        : null;

    if (outputIndex >= 0 && !process.argv[outputIndex + 1]) {
        throw new Error('The --output option requires a file path.');
    }

    const markdown = await generateLicenseInventory(pnpmStoreDirectory);

    if (outputPath) {
        await writeFile(outputPath, markdown, 'utf8');
        process.stdout.write(`License inventory written to ${outputPath}\n`);
    } else {
        process.stdout.write(markdown);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => {
        process.stderr.write(`License inventory generation failed: ${String(error)}\n`);
        process.exitCode = 1;
    });
}
