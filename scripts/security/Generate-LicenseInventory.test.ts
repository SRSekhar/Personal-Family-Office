import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateLicenseInventory } from './Generate-LicenseInventory.mjs';

async function addPackage(
    pnpmStore: string,
    snapshotName: string,
    packagePath: string,
    metadata: Record<string, unknown>
): Promise<void> {
    const packageDirectory = join(pnpmStore, snapshotName, 'node_modules', packagePath);
    await mkdir(packageDirectory, { recursive: true });
    await writeFile(join(packageDirectory, 'package.json'), JSON.stringify(metadata), 'utf8');
}

describe('generateLicenseInventory', () => {
    it('lists unique packages, normalizes license metadata, and flags unknown licenses', async () => {
        const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-license-inventory-'));
        const pnpmStore = join(temporaryDirectory, 'node_modules', '.pnpm');

        try {
            await mkdir(pnpmStore, { recursive: true });
            await addPackage(pnpmStore, 'alpha@1.0.0', 'alpha', {
                name: 'alpha',
                version: '1.0.0',
                license: 'MIT'
            });
            await addPackage(pnpmStore, 'alpha@1.0.0_peer', 'alpha', {
                name: 'alpha',
                version: '1.0.0',
                license: 'MIT'
            });
            await addPackage(pnpmStore, '@scope+beta@2.0.0', '@scope/beta', {
                name: '@scope/beta',
                version: '2.0.0',
                license: { type: 'Apache-2.0' }
            });
            await addPackage(pnpmStore, 'gamma@3.0.0', 'gamma', {
                name: 'gamma',
                version: '3.0.0'
            });

            const report = await generateLicenseInventory(pnpmStore);

            expect(report).toContain('Unique third-party package versions: **3**');
            expect(report).toContain('| alpha | 1.0.0 | MIT |');
            expect(report).toContain('| @scope/beta | 2.0.0 | Apache-2.0 |');
            expect(report).toContain('| gamma | 3.0.0 | UNKNOWN |');
            expect(report).toContain('Package versions requiring manual license review: **1**');
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
    });

    it('reads package metadata through regular and scoped pnpm symlinks', async () => {
        const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-license-inventory-'));
        const pnpmStore = join(temporaryDirectory, 'node_modules', '.pnpm');
        const regularTarget = join(temporaryDirectory, 'package-targets', 'regular');
        const scopedTarget = join(temporaryDirectory, 'package-targets', 'scoped');
        const regularLink = join(pnpmStore, 'regular@1.2.3', 'node_modules', 'regular');
        const scopedLink = join(pnpmStore, 'scoped@2.3.4', 'node_modules', '@scope', 'scoped');
        const linkType = process.platform === 'win32' ? 'junction' : 'dir';

        try {
            await mkdir(join(pnpmStore, 'regular@1.2.3', 'node_modules'), { recursive: true });
            await mkdir(join(pnpmStore, 'scoped@2.3.4', 'node_modules', '@scope'), { recursive: true });
            await mkdir(regularTarget, { recursive: true });
            await mkdir(scopedTarget, { recursive: true });
            await writeFile(join(regularTarget, 'package.json'), JSON.stringify({
                name: 'regular',
                version: '1.2.3',
                license: 'MIT'
            }), 'utf8');
            await writeFile(join(scopedTarget, 'package.json'), JSON.stringify({
                name: '@scope/scoped',
                version: '2.3.4',
                license: 'ISC'
            }), 'utf8');
            await symlink(regularTarget, regularLink, linkType);
            await symlink(scopedTarget, scopedLink, linkType);

            const report = await generateLicenseInventory(pnpmStore);

            expect(report).toContain('Unique third-party package versions: **2**');
            expect(report).toContain('| regular | 1.2.3 | MIT |');
            expect(report).toContain('| @scope/scoped | 2.3.4 | ISC |');
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
    });

    it('flags conflicting license metadata for the same package version', async () => {
        const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-license-inventory-'));
        const pnpmStore = join(temporaryDirectory, 'node_modules', '.pnpm');

        try {
            await mkdir(pnpmStore, { recursive: true });
            await addPackage(pnpmStore, 'delta@1.0.0_peerA', 'delta', {
                name: 'delta',
                version: '1.0.0',
                license: 'MIT'
            });
            await addPackage(pnpmStore, 'delta@1.0.0_peerB', 'delta', {
                name: 'delta',
                version: '1.0.0',
                license: 'BlueOak-1.0.0'
            });

            const report = await generateLicenseInventory(pnpmStore);

            expect(report).toContain('Unique third-party package versions: **1**');
            expect(report).toContain('CONFLICTING LICENSE METADATA: BlueOak-1.0.0 / MIT');
            expect(report).toContain('Package versions requiring manual license review: **1**');
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
    });

    it('fails with the package path when package metadata is malformed', async () => {
        const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-license-inventory-'));
        const pnpmStore = join(temporaryDirectory, 'node_modules', '.pnpm');
        const packageJsonPath = join(pnpmStore, 'broken@1.0.0', 'node_modules', 'broken', 'package.json');

        try {
            await mkdir(join(pnpmStore, 'broken@1.0.0', 'node_modules', 'broken'), { recursive: true });
            await writeFile(packageJsonPath, '{"name": "broken",', 'utf8');

            await expect(generateLicenseInventory(pnpmStore))
                .rejects.toThrow(`Unable to read package metadata at ${packageJsonPath}`);
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
    });

});
