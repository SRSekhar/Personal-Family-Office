#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';

const packages = [
    ['glob', '13.0.6'],
    ['lru-cache', '11.5.3'],
    ['minimatch', '10.2.6'],
    ['minipass', '7.1.3'],
    ['package-json-from-dist', '1.0.1'],
    ['path-scurry', '2.0.2'],
    ['rimraf', '6.1.3'],
    ['lightningcss', '1.33.0'],
    ['lightningcss-linux-x64-gnu', '1.33.0']
];

const licenseNoticeFilename = /^(license|licence|notice|copying|copyright|patents)(?:[._ -].*)?$/i;

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        ...options
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status}): ${result.stderr || result.stdout}`);
    }

    return result.stdout;
}

function packMetadata(stdout) {
    const start = stdout.indexOf('[');
    if (start < 0) {
        throw new Error('npm pack did not return its expected JSON metadata.');
    }
    const parsed = JSON.parse(stdout.slice(start));
    if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0].filename !== 'string'
        || typeof parsed[0].integrity !== 'string') {
        throw new Error('npm pack returned incomplete metadata.');
    }
    return parsed[0];
}

function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}

function markdownCell(value) {
    return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

async function main() {
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex < 0 || !process.argv[outputIndex + 1]) {
        throw new Error('Usage: node scripts/security/Inspect-PackedLicenseArtifacts.mjs --output <path>');
    }

    const root = process.cwd();
    const outputPath = resolve(root, process.argv[outputIndex + 1]);
    const lockfile = await readFile(resolve(root, 'pnpm-lock.yaml'), 'utf8');
    const tempDirectory = await mkdtemp(join(tmpdir(), 'pfo-license-artifacts-'));
    const rows = [];
    const failures = [];

    try {
        for (const [name, version] of packages) {
            const spec = `${name}@${version}`;
            const packOutput = run('npm', [
                'pack', spec, '--ignore-scripts', '--json', '--pack-destination', tempDirectory
            ], { cwd: tempDirectory });
            const metadata = packMetadata(packOutput);
            const lockfileMatch = lockfile.includes(metadata.integrity);
            const tarballPath = join(tempDirectory, basename(metadata.filename));
            const files = run('tar', ['-tzf', tarballPath])
                .split(/\r?\n/)
                .filter(Boolean);
            const licensePaths = files.filter((path) => {
                if (!path.startsWith('package/')) return false;
                const relativePath = path.slice('package/'.length);
                return !relativePath.includes('/') && licenseNoticeFilename.test(relativePath);
            });

            const licenseFiles = [];
            for (const path of licensePaths) {
                const content = execFileSync('tar', ['-xOzf', tarballPath, path], { encoding: 'buffer' });
                const text = content.toString('utf8');
                licenseFiles.push({
                    name: path.slice('package/'.length),
                    bytes: content.byteLength,
                    sha256: sha256(content),
                    firstLine: text.split(/\r?\n/, 1)[0].trim().slice(0, 180)
                });
            }

            if (!lockfileMatch) {
                failures.push(`${spec}: packed integrity ${metadata.integrity} was not found in pnpm-lock.yaml`);
            }
            if (licenseFiles.length === 0) {
                failures.push(`${spec}: no root-level license/notice file found in the published tarball`);
            }

            rows.push({
                spec,
                filename: metadata.filename,
                integrity: metadata.integrity,
                lockfileMatch,
                fileCount: files.length,
                licenseFiles
            });
        }
    } finally {
        await rm(tempDirectory, { recursive: true, force: true });
    }

    const lines = [
        '# Packed Dependency License Artifact Evidence',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Scope',
        '',
        'This report inspects the exact npm tarballs returned for the nine pinned package versions flagged by the installed dependency inventory. It records the published tarball integrity, whether that integrity appears in the repository lockfile, root-level license/notice filenames, byte lengths, SHA-256 fingerprints, and first-line identifiers. The tarballs are packed with lifecycle scripts disabled. This is evidence collection, not a legal compatibility determination.',
        '',
        '| Package/version | Tarball integrity matches lockfile | Files in tarball | Root license/notice evidence |',
        '| --- | --- | ---: | --- |'
    ];

    for (const row of rows) {
        const files = row.licenseFiles.length
            ? row.licenseFiles.map((file) => `${file.name} (${file.bytes} bytes; SHA-256 ${file.sha256}; first line: ${file.firstLine || '(blank)'})`).join('<br>')
            : 'NONE FOUND';
        lines.push(`| ${row.spec} | ${row.lockfileMatch ? 'YES' : 'NO'} | ${row.fileCount} | ${markdownCell(files)} |`);
    }

    lines.push('', '## Failures', '');
    lines.push(...(failures.length ? failures.map((failure) => `- ${failure}`) : ['None detected by these mechanical checks.']));
    lines.push('', '## Limitations', '', '- Filename presence and hashes do not establish that a license is complete, applicable, compatible, or sufficient for redistribution.', '- The lockfile integrity comparison confirms that the tarball metadata fingerprint matches a value recorded in the lockfile; it does not decide the product distribution boundary.', '- Review complete license text and applicable attribution, notice, source-availability, and redistribution obligations before release.', '');

    await writeFile(outputPath, lines.join('\n'), 'utf8');
    process.stdout.write(`Inspected ${rows.length} pinned npm artifacts. Report: ${outputPath}\n`);
    for (const row of rows) {
        process.stdout.write(`${row.spec}: lockfile integrity ${row.lockfileMatch ? 'MATCH' : 'MISMATCH'}; root license files: ${row.licenseFiles.map((file) => `${file.name} [${file.bytes} bytes, sha256 ${file.sha256}]`).join('; ') || 'NONE FOUND'}\n`);
    }
    if (failures.length) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    process.stderr.write(`Packed license artifact inspection failed: ${String(error)}\n`);
    process.exitCode = 1;
});
