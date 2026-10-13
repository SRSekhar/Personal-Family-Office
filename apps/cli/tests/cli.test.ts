import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { convertDashboardBackupToPortfolioInput, createReportHtmlFromInput, parsePortfolioInput } from '../src/portfolio-input.js';
import { parseCliArguments, runCli, writeReportFile } from '../src/index.js';

const fixturePath = new URL('../examples/sample-portfolio.json', import.meta.url);
const sampleInput: unknown = JSON.parse(await readFile(fixturePath, 'utf8'));
const dashboardBackupInput: unknown = {
    schemaVersion: 1,
    currency: 'INR',
    exportedAt: '2026-10-13T12:00:00.000Z',
    records: [
        { id: 'sample-cash-id', name: 'Sample cash account', category: 'Cash', type: 'asset', value: 100000 },
        { id: 'sample-loan-id', name: 'Sample home loan', category: 'Loans', type: 'liability', value: 25000 }
    ]
};
const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
    const path = await mkdtemp(join(tmpdir(), 'pfo-cli-test-'));
    temporaryDirectories.push(path);
    return path;
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('parsePortfolioInput', () => {
    it('constructs the existing domain model from the versioned sample input', () => {
        const parsed = parsePortfolioInput(sampleInput);
        expect(parsed.portfolio.name).toBe('Fictional Sample Household');
        expect(parsed.currency).toBe('INR');
        expect(parsed.asOfDate.toISOString()).toBe('2026-10-13T00:00:00.000Z');
        expect(parsed.selections).toHaveLength(2);
    });

    it('rejects a record with a different currency instead of converting it', () => {
        const invalid = structuredClone(sampleInput) as {
            portfolio: { assets: Array<{ value: { currency: string } }> };
        };
        const firstAsset = invalid.portfolio.assets[0];
        if (!firstAsset) {
            throw new Error('Sample fixture must include one asset.');
        }
        firstAsset.value.currency = 'USD';
        expect(() => parsePortfolioInput(invalid)).toThrow('currency must match input.currency (INR)');
    });

    it('rejects unknown schema fields', () => {
        const invalid = { ...(sampleInput as object), unexpected: true };
        expect(() => parsePortfolioInput(invalid)).toThrow('unsupported field(s): unexpected');
    });

    it('rejects non-canonical valuation timestamps', () => {
        const invalid = { ...(sampleInput as Record<string, unknown>), asOfDate: '2026-10-13' };
        expect(() => parsePortfolioInput(invalid)).toThrow('canonical ISO-8601 UTC timestamp');
    });

    it('rejects duplicate canonical IDs before producing a report', () => {
        const invalid = structuredClone(sampleInput) as {
            selections: Array<{ source: string; sourceId: string; canonicalId: string; category: string }>;
        };
        const firstSelection = invalid.selections[0];
        const secondSelection = invalid.selections[1];
        if (!firstSelection || !secondSelection) {
            throw new Error('Sample fixture must include two selections.');
        }
        secondSelection.canonicalId = firstSelection.canonicalId;
        expect(() => createReportHtmlFromInput(invalid, new Date('2026-10-13T12:00:00.000Z')))
            .toThrow('Duplicate canonical position ID');
    });

    it('creates self-contained HTML from deterministic analysis', () => {
        const html = createReportHtmlFromInput(sampleInput, new Date('2026-10-13T12:00:00.000Z'));
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Fictional Sample Household');
        expect(html).toContain('Asset allocation by category');
        expect(html).not.toContain('<script');
        expect(html).not.toContain('http://');
        expect(html).not.toContain('https://');
    });
});

describe('dashboard backup conversion', () => {
    it('converts the dashboard export schema without treating export time as valuation time', () => {
        const asOfDate = new Date('2026-10-01T00:00:00.000Z');
        const converted = convertDashboardBackupToPortfolioInput(dashboardBackupInput, asOfDate);
        const parsed = parsePortfolioInput(converted);
        expect(parsed.portfolio.name).toBe('Imported Dashboard Backup');
        expect(parsed.asOfDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
        expect(parsed.selections.map((selection) => selection.category)).toEqual(['Cash', 'Loans']);
        const html = createReportHtmlFromInput(converted, new Date('2026-10-13T12:00:00.000Z'));
        expect(html).toContain('Imported Dashboard Backup');
        expect(html).toContain('Asset allocation by category');
    });

    it('rejects duplicate source IDs in a dashboard backup', () => {
        const invalid = structuredClone(dashboardBackupInput) as {
            records: Array<{ id: string; name: string; category: string; type: string; value: number }>;
        };
        const firstRecord = invalid.records[0];
        const secondRecord = invalid.records[1];
        if (!firstRecord || !secondRecord) {
            throw new Error('Dashboard backup fixture must include two records.');
        }
        secondRecord.id = firstRecord.id;
        expect(() => convertDashboardBackupToPortfolioInput(invalid, new Date('2026-10-01T00:00:00.000Z')))
            .toThrow('duplicate id');
    });

    it('rejects invalid dashboard backup records', () => {
        const invalid = {
            schemaVersion: 1,
            currency: 'INR',
            records: [{ name: 'Bad record', category: 'Cash', type: 'asset', value: -1 }]
        };
        expect(() => convertDashboardBackupToPortfolioInput(invalid, new Date('2026-10-01T00:00:00.000Z')))
            .toThrow('greater than or equal to zero');
    });
});

describe('parseCliArguments', () => {
    it('requires explicit input and output paths', () => {
        expect(() => parseCliArguments(['create', '--input', 'input.json']))
            .toThrow('Both --input and --output are required.');
    });

    it('rejects unknown options', () => {
        expect(() => parseCliArguments(['create', '--input', 'input.json', '--output', 'report.html', '--unknown']))
            .toThrow('Unsupported option "--unknown"');
    });

    it('requires an explicit valuation date for dashboard backup input', () => {
        expect(() => parseCliArguments([
            'create', '--input', 'backup.json', '--output', 'report.html', '--format', 'dashboard-backup'
        ])).toThrow('--as-of is required with --format dashboard-backup');
        const result = parseCliArguments([
            'create', '--input', 'backup.json', '--output', 'report.html',
            '--format', 'dashboard-backup', '--as-of', '2026-10-01T00:00:00.000Z'
        ]);
        expect(result.kind).toBe('create');
        if (result.kind === 'create') {
            expect(result.format).toBe('dashboard-backup');
            expect(result.asOfDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
        }
    });

    it('accepts an explicit generation timestamp and force flag', () => {
        const result = parseCliArguments([
            'create', '--input', 'input.json', '--output', 'report.html',
            '--generated-at', '2026-10-13T12:00:00.000Z', '--force'
        ]);
        expect(result.kind).toBe('create');
        if (result.kind === 'create') {
            expect(result.generatedAt?.toISOString()).toBe('2026-10-13T12:00:00.000Z');
            expect(result.force).toBe(true);
        }
    });
});

describe('runCli end-to-end', () => {
    it('reads a dashboard backup and requires the explicit valuation date', async () => {
        const directory = await createTemporaryDirectory();
        const inputPath = join(directory, 'dashboard-backup.json');
        const outputPath = join(directory, 'dashboard-report.html');
        await writeFile(inputPath, JSON.stringify(dashboardBackupInput), 'utf8');

        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stdoutText = '';
        let stderrText = '';
        stdout.on('data', (chunk: Buffer) => {
            stdoutText += chunk.toString('utf8');
        });
        stderr.on('data', (chunk: Buffer) => {
            stderrText += chunk.toString('utf8');
        });

        const exitCode = await runCli([
            'create',
            '--input', inputPath,
            '--output', outputPath,
            '--format', 'dashboard-backup',
            '--as-of', '2026-10-01T00:00:00.000Z',
            '--generated-at', '2026-10-13T12:00:00.000Z'
        ], stdout, stderr);

        expect(exitCode).toBe(0);
        expect(stdoutText).toContain('Report written:');
        expect(stderrText).toBe('');
        const html = await readFile(outputPath, 'utf8');
        expect(html).toContain('Imported Dashboard Backup');
        expect(html).toContain('Cash');
        expect(html).toContain('Asset allocation by category');
    });

    it('reads the versioned input and writes an offline HTML report', async () => {
        const directory = await createTemporaryDirectory();
        const inputPath = join(directory, 'portfolio.json');
        const outputPath = join(directory, 'portfolio-report.html');
        await writeFile(inputPath, JSON.stringify(sampleInput), 'utf8');

        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stdoutText = '';
        let stderrText = '';
        stdout.on('data', (chunk: Buffer) => {
            stdoutText += chunk.toString('utf8');
        });
        stderr.on('data', (chunk: Buffer) => {
            stderrText += chunk.toString('utf8');
        });

        const exitCode = await runCli([
            'create',
            '--input', inputPath,
            '--output', outputPath,
            '--generated-at', '2026-10-13T12:00:00.000Z'
        ], stdout, stderr);

        expect(exitCode).toBe(0);
        expect(stdoutText).toContain('Report written:');
        expect(stderrText).toBe('');
        const html = await readFile(outputPath, 'utf8');
        expect(html).toContain('Fictional Sample Household');
        expect(html).toContain('Asset allocation by category');
        expect(html).not.toContain('<script');
    });
});

describe('writeReportFile', () => {
    it('does not overwrite an existing file unless force is explicit', async () => {
        const directory = await createTemporaryDirectory();
        const path = join(directory, 'report.html');
        await writeReportFile(path, '<p>first</p>', false);
        await expect(writeReportFile(path, '<p>second</p>', false)).rejects.toMatchObject({ code: 'EEXIST' });
        await writeReportFile(path, '<p>second</p>', true);
        expect(await readFile(path, 'utf8')).toBe('<p>second</p>');
    });
});
