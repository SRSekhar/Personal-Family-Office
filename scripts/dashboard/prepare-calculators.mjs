#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, 'packages/calculators/dist');
const destination = resolve(root, 'apps/dashboard/calculators-runtime');
const analyticsSource = resolve(root, 'packages/analytics/dist');
const analyticsDestination = resolve(root, 'apps/dashboard/analytics-runtime');
const reportSource = resolve(root, 'packages/reports/dist');
const reportDestination = resolve(root, 'apps/dashboard/reports-runtime');

await mkdir(destination, { recursive: true });
for (const name of ['CompoundGrowth.js', 'Cagr.js', 'FireReadiness.js', 'FireScenarioComparison.js', 'RequiredFireContribution.js', 'GoalProgress.js', 'ProgressiveTaxMath.js', 'LoanAmortizationMath.js', 'Xirr.js', 'InvestmentPerformanceMath.js']) {
    await copyFile(resolve(source, name), resolve(destination, name));
}
await mkdir(analyticsDestination, { recursive: true });
await copyFile(resolve(analyticsSource, 'RiskAnalysis.js'), resolve(analyticsDestination, 'RiskAnalysis.js'));
await copyFile(resolve(analyticsSource, 'DiversificationAnalysis.js'), resolve(analyticsDestination, 'DiversificationAnalysis.js'));
await mkdir(reportDestination, { recursive: true });
await copyFile(resolve(reportSource, 'FireScenarioReport.js'), resolve(reportDestination, 'FireScenarioReport.js'));
process.stdout.write('Prepared local calculator, analytics, and report modules.\n');
