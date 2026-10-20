#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, 'packages/calculators/dist');
const destination = resolve(root, 'apps/dashboard/calculators-runtime');
const reportSource = resolve(root, 'packages/reports/dist');
const reportDestination = resolve(root, 'apps/dashboard/reports-runtime');

await mkdir(destination, { recursive: true });
for (const name of ['CompoundGrowth.js', 'FireReadiness.js', 'FireScenarioComparison.js', 'RequiredFireContribution.js', 'GoalProgress.js', 'LoanAmortizationCore.js']) {
    await copyFile(resolve(source, name), resolve(destination, name));
}
await mkdir(reportDestination, { recursive: true });
await copyFile(resolve(reportSource, 'FireScenarioReport.js'), resolve(reportDestination, 'FireScenarioReport.js'));
process.stdout.write('Prepared local FIRE calculator and report modules.\n');
