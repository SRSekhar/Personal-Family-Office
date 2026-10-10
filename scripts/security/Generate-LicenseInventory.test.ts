import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
});
