import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createReportHtmlFromInput, parsePortfolioInput } from '../src/portfolio-input.js';
import { parseCliArguments, writeReportFile } from '../src/index.js';

const fixturePath = new URL('../examples/sample-portfolio.json', import.meta.url);
const sampleInput: unknown = JSON.parse(await readFile(fixturePath, 'utf8'));
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
        invalid.portfolio.assets[0]!.value.currency = 'USD';
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
        invalid.selections[1]!.canonicalId = invalid.selections[0]!.canonicalId;
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

describe('parseCliArguments', () => {
    it('requires explicit input and output paths', () => {
        expect(() => parseCliArguments(['create', '--input', 'input.json']))
            .toThrow('Both --input and --output are required.');
    });

    it('rejects unknown options', () => {
        expect(() => parseCliArguments(['create', '--input', 'input.json', '--output', 'report.html', '--unknown']))
            .toThrow('Unsupported option "--unknown"');
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
