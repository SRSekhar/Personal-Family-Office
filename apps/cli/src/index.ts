#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { convertDashboardBackupToPortfolioInput, createReportHtmlFromInput, parseCanonicalUtcTimestamp } from './portfolio-input.js';

interface CreateCommand {
    readonly kind: 'create';
    readonly inputPath: string;
    readonly outputPath: string;
    readonly generatedAt: Date | undefined;
    readonly format: 'portfolio-input' | 'dashboard-backup';
    readonly asOfDate: Date | undefined;
    readonly force: boolean;
}

type CliCommand = CreateCommand | { readonly kind: 'help' };

const usage = `PFO OS local report CLI

Usage:
  pfo-report create --input <input.json> --output <report.html> [--format portfolio-input|dashboard-backup] [--as-of <UTC timestamp>] [--generated-at <UTC timestamp>] [--force]
  pfo-report --help

The portfolio-input format requires schemaVersion 1, an asOfDate, and explicit position selections.\nThe dashboard-backup format requires --as-of because export time is not a valuation date.
No network access, market data, currency conversion, database, or AI service is used.
Existing output files are not overwritten unless --force is supplied.`;

export function parseCliArguments(args: readonly string[]): CliCommand {
    if (args.length === 0 || args[0] === '--help' || args[0] === 'help' || args.includes('--help')) {
        return { kind: 'help' };
    }
    if (args[0] !== 'create') {
        throw new Error(`Unsupported command "${args[0] ?? '(missing)'}". Run pfo-report --help for usage.`);
    }

    const values = new Map<string, string>();
    let force = false;
    for (let index = 1; index < args.length; index += 1) {
        const flag = args[index] ?? '';
        if (flag === '--force') {
            if (force) {
                throw new Error('--force must not be repeated.');
            }
            force = true;
            continue;
        }
        if (flag !== '--input' && flag !== '--output' && flag !== '--generated-at' && flag !== '--format' && flag !== '--as-of') {
            throw new Error(`Unsupported option "${flag}". Run pfo-report --help for usage.`);
        }
        if (values.has(flag)) {
            throw new Error(`${flag} must not be repeated.`);
        }
        const value = args[index + 1];
        if (value === undefined || value.startsWith('--')) {
            throw new Error(`${flag} requires a value.`);
        }
        values.set(flag, value);
        index += 1;
    }

    const inputPath = values.get('--input');
    const outputPath = values.get('--output');
    if (!inputPath || !outputPath) {
        throw new Error('Both --input and --output are required.');
    }

    const generatedAtValue = values.get('--generated-at');
    const formatValue = values.get('--format') ?? 'portfolio-input';
    if (formatValue !== 'portfolio-input' && formatValue !== 'dashboard-backup') {
        throw new Error('--format must be portfolio-input or dashboard-backup.');
    }
    const asOfValue = values.get('--as-of');
    const asOfDate = asOfValue === undefined
        ? undefined
        : parseCanonicalUtcTimestamp(asOfValue, '--as-of');
    if (formatValue === 'dashboard-backup' && asOfDate === undefined) {
        throw new Error('--as-of is required with --format dashboard-backup; export time is not a valuation date.');
    }
    if (formatValue === 'portfolio-input' && asOfDate !== undefined) {
        throw new Error('--as-of is only supported with --format dashboard-backup; portfolio-input includes asOfDate.');
    }

    return {
        kind: 'create',
        inputPath,
        outputPath,
        generatedAt: generatedAtValue === undefined
            ? undefined
            : parseCanonicalUtcTimestamp(generatedAtValue, '--generated-at'),
        format: formatValue,
        asOfDate,
        force
    };
}

export async function writeReportFile(outputPath: string, html: string, force: boolean): Promise<void> {
    if (force) {
        const temporaryPath = join(dirname(outputPath), `.${basename(outputPath)}.${randomUUID()}.tmp`);
        try {
            await writeFile(temporaryPath, html, { encoding: 'utf8', flag: 'wx' });
            await rename(temporaryPath, outputPath);
        } catch (error) {
            await unlink(temporaryPath).catch(() => undefined);
            throw error;
        }
        return;
    }

    const handle = await open(outputPath, 'wx');
    try {
        await handle.writeFile(html, 'utf8');
        await handle.sync();
    } catch (error) {
        await handle.close();
        await unlink(outputPath).catch(() => undefined);
        throw error;
    }
    await handle.close();
}

export async function runCli(
    args: readonly string[],
    stdout: Pick<NodeJS.WriteStream, 'write'> = process.stdout,
    stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr
): Promise<number> {
    try {
        const command = parseCliArguments(args);
        if (command.kind === 'help') {
            stdout.write(`${usage}\n`);
            return 0;
        }

        const inputPath = resolve(command.inputPath);
        const outputPath = resolve(command.outputPath);
        if (inputPath === outputPath) {
            throw new Error('Input and output paths must be different.');
        }
        if (!['.html', '.htm'].includes(extname(outputPath).toLowerCase())) {
            throw new Error('Output path must end in .html or .htm.');
        }

        const outputDirectory = await stat(dirname(outputPath));
        if (!outputDirectory.isDirectory()) {
            throw new Error(`Output directory is not a directory: ${dirname(outputPath)}`);
        }

        const inputText = await readFile(inputPath, 'utf8');
        let payload: unknown;
        try {
            payload = JSON.parse(inputText) as unknown;
        } catch {
            throw new Error(`Input file is not valid JSON: ${inputPath}`);
        }

        let reportInput: unknown = payload;
        if (command.format === 'dashboard-backup') {
            if (!command.asOfDate) {
                throw new Error('--as-of is required with --format dashboard-backup; export time is not a valuation date.');
            }
            reportInput = convertDashboardBackupToPortfolioInput(payload, command.asOfDate);
        }
        const html = createReportHtmlFromInput(reportInput, command.generatedAt ?? new Date());
        await writeReportFile(outputPath, html, command.force);
        stdout.write(`Report written: ${outputPath}\n`);
        return 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stderr.write(`pfo-report: ${message}\n`);
        return 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    process.exitCode = await runCli(process.argv.slice(2));
}
