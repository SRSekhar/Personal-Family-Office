import { Identifier } from '@pfo/core';
import { analyzePortfolio, type PortfolioPositionSelection } from '@pfo/analytics';
import {
    Asset,
    AssetType,
    Currency,
    Investment,
    InvestmentType,
    Liability,
    LiabilityType,
    Money,
    Portfolio,
    Property,
    PropertyType
} from '@pfo/models';
import { createPortfolioReport, renderPortfolioReportHtml } from '@pfo/reports';

export interface ParsedPortfolioInput {
    readonly portfolio: Portfolio;
    readonly currency: Currency;
    readonly selections: readonly PortfolioPositionSelection[];
    readonly asOfDate: Date;
}

const portfolioPositionSources = ['asset', 'investment', 'property', 'liability'] as const;

export function parsePortfolioInput(payload: unknown): ParsedPortfolioInput {
    const root = asRecord(payload, 'input');
    assertOnlyKeys(root, ['schemaVersion', 'portfolio', 'currency', 'selections', 'asOfDate'], 'input');

    if (root['schemaVersion'] !== 1) {
        throw new Error('input.schemaVersion must be 1.');
    }

    const currency = parseEnum(root['currency'], Object.values(Currency), 'input.currency');
    const rawPortfolio = asRecord(root['portfolio'], 'input.portfolio');
    assertOnlyKeys(
        rawPortfolio,
        ['id', 'name', 'description', 'assets', 'investments', 'liabilities', 'properties'],
        'input.portfolio'
    );

    const assets = parseArray(rawPortfolio['assets'], 'input.portfolio.assets', (item, path) =>
        parseAsset(item, currency, path));
    const investments = parseArray(rawPortfolio['investments'], 'input.portfolio.investments', (item, path) =>
        parseInvestment(item, currency, path));
    const liabilities = parseArray(rawPortfolio['liabilities'], 'input.portfolio.liabilities', (item, path) =>
        parseLiability(item, currency, path));
    const properties = parseArray(rawPortfolio['properties'], 'input.portfolio.properties', (item, path) =>
        parseProperty(item, currency, path));

    assertUniqueIds(assets, 'input.portfolio.assets');
    assertUniqueIds(investments, 'input.portfolio.investments');
    assertUniqueIds(liabilities, 'input.portfolio.liabilities');
    assertUniqueIds(properties, 'input.portfolio.properties');

    const portfolio = new Portfolio(
        Identifier.create(requireString(rawPortfolio['id'], 'input.portfolio.id')),
        requireString(rawPortfolio['name'], 'input.portfolio.name'),
        assets,
        investments,
        liabilities,
        properties,
        optionalString(rawPortfolio, 'description', 'input.portfolio')
    );

    const selections = parseArray(root['selections'], 'input.selections', parseSelection);
    const asOfDate = parseCanonicalUtcTimestamp(root['asOfDate'], 'input.asOfDate');

    return { portfolio, currency, selections, asOfDate };
}

export function convertDashboardBackupToPortfolioInput(payload: unknown, asOfDate: Date): unknown {
    const root = asRecord(payload, 'backup');
    assertOnlyKeys(root, ['schemaVersion', 'currency', 'exportedAt', 'records'], 'backup');

    if (root['schemaVersion'] !== 1) {
        throw new Error('backup.schemaVersion must be 1.');
    }
    const currency = parseEnum(root['currency'], Object.values(Currency), 'backup.currency');
    if ('exportedAt' in root) {
        parseCanonicalUtcTimestamp(root['exportedAt'], 'backup.exportedAt');
    }
    if (!(asOfDate instanceof Date) || Number.isNaN(asOfDate.getTime())) {
        throw new Error('A valid valuation date is required for dashboard backups; export time is not treated as valuation time.');
    }

    const records = parseArray(root['records'], 'backup.records', parseDashboardBackupRecord);
    const seenRecordIds = new Set<string>();
    for (const record of records) {
        if (record.id !== undefined) {
            if (seenRecordIds.has(record.id)) {
                throw new Error(`backup.records contains duplicate id "${record.id}".`);
            }
            seenRecordIds.add(record.id);
        }
    }

    const assetRecords = records.filter((record) => record.type === 'asset');
    const liabilityRecords = records.filter((record) => record.type === 'liability');
    const assets = assetRecords.map((record, index) => ({
        id: `dashboard-asset-${String(index + 1).padStart(4, '0')}`,
        name: record.name,
        type: AssetType.Other,
        value: { amount: record.value, currency }
    }));
    const liabilities = liabilityRecords.map((record, index) => ({
        id: `dashboard-liability-${String(index + 1).padStart(4, '0')}`,
        name: record.name,
        type: LiabilityType.Other,
        outstandingAmount: { amount: record.value, currency }
    }));
    const selections = [
        ...assetRecords.map((record, index) => ({
            source: 'asset',
            sourceId: assets[index]!.id,
            canonicalId: assets[index]!.id,
            category: record.category
        })),
        ...liabilityRecords.map((record, index) => ({
            source: 'liability',
            sourceId: liabilities[index]!.id,
            canonicalId: liabilities[index]!.id,
            category: record.category
        }))
    ];

    return {
        schemaVersion: 1,
        currency,
        asOfDate: asOfDate.toISOString(),
        portfolio: {
            id: 'dashboard-backup',
            name: 'Imported Dashboard Backup',
            description: 'Converted from a local dashboard backup. Generic domain types are used; original categories are preserved.',
            assets,
            investments: [],
            liabilities,
            properties: []
        },
        selections
    };
}

export function parseCanonicalUtcTimestamp(value: unknown, path: string): Date {
    if (typeof value !== 'string') {
        throw new Error(`${path} must be a canonical ISO-8601 UTC timestamp.`);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || !value.endsWith('Z') || date.toISOString() !== value) {
        throw new Error(`${path} must be a canonical ISO-8601 UTC timestamp, for example 2026-10-13T00:00:00.000Z.`);
    }

    return date;
}

export function createReportHtmlFromInput(payload: unknown, generatedAt: Date = new Date()): string {
    const input = parsePortfolioInput(payload);
    const analysis = analyzePortfolio({
        portfolio: input.portfolio,
        currency: input.currency,
        selections: input.selections
    });
    const report = createPortfolioReport({
        analysis,
        asOfDate: input.asOfDate,
        generatedAt
    });

    return renderPortfolioReportHtml(report);
}

function parseAsset(value: unknown, currency: Currency, path: string): Asset {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['id', 'name', 'type', 'value', 'description'], path);
    return new Asset(
        Identifier.create(requireString(record['id'], `${path}.id`)),
        requireString(record['name'], `${path}.name`),
        parseEnum(record['type'], Object.values(AssetType), `${path}.type`),
        parseMoney(record['value'], currency, `${path}.value`),
        optionalString(record, 'description', path)
    );
}

function parseInvestment(value: unknown, currency: Currency, path: string): Investment {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['id', 'name', 'type', 'currentValue', 'description'], path);
    return new Investment(
        Identifier.create(requireString(record['id'], `${path}.id`)),
        requireString(record['name'], `${path}.name`),
        parseEnum(record['type'], Object.values(InvestmentType), `${path}.type`),
        parseMoney(record['currentValue'], currency, `${path}.currentValue`),
        optionalString(record, 'description', path)
    );
}

function parseLiability(value: unknown, currency: Currency, path: string): Liability {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['id', 'name', 'type', 'outstandingAmount', 'description'], path);
    return new Liability(
        Identifier.create(requireString(record['id'], `${path}.id`)),
        requireString(record['name'], `${path}.name`),
        parseEnum(record['type'], Object.values(LiabilityType), `${path}.type`),
        parseMoney(record['outstandingAmount'], currency, `${path}.outstandingAmount`),
        optionalString(record, 'description', path)
    );
}

function parseProperty(value: unknown, currency: Currency, path: string): Property {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['id', 'name', 'type', 'marketValue', 'description'], path);
    return new Property(
        Identifier.create(requireString(record['id'], `${path}.id`)),
        requireString(record['name'], `${path}.name`),
        parseEnum(record['type'], Object.values(PropertyType), `${path}.type`),
        parseMoney(record['marketValue'], currency, `${path}.marketValue`),
        optionalString(record, 'description', path)
    );
}

function parseMoney(value: unknown, expectedCurrency: Currency, path: string): Money {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['amount', 'currency'], path);
    const amount = requireNumber(record['amount'], `${path}.amount`);
    if (amount < 0) {
        throw new Error(`${path}.amount must be greater than or equal to zero.`);
    }

    const currency = parseEnum(record['currency'], Object.values(Currency), `${path}.currency`);
    if (currency !== expectedCurrency) {
        throw new Error(`${path}.currency must match input.currency (${expectedCurrency}); currency conversion is not performed.`);
    }

    return new Money(amount, currency);
}

interface DashboardBackupRecord {
    readonly id: string | undefined;
    readonly name: string;
    readonly category: string;
    readonly type: 'asset' | 'liability';
    readonly value: number;
}

function parseDashboardBackupRecord(value: unknown, path: string): DashboardBackupRecord {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['id', 'name', 'category', 'type', 'value'], path);
    const id = 'id' in record ? requireString(record['id'], `${path}.id`) : undefined;
    const amount = requireNumber(record['value'], `${path}.value`);
    if (amount < 0) {
        throw new Error(`${path}.value must be greater than or equal to zero.`);
    }
    const type = parseEnum(record['type'], ['asset', 'liability'] as const, `${path}.type`);

    return {
        id,
        name: requireString(record['name'], `${path}.name`),
        category: requireString(record['category'], `${path}.category`),
        type,
        value: amount
    };
}

function parseSelection(value: unknown, path: string): PortfolioPositionSelection {
    const record = asRecord(value, path);
    assertOnlyKeys(record, ['source', 'sourceId', 'canonicalId', 'category'], path);
    return {
        source: parseEnum(record['source'], portfolioPositionSources, `${path}.source`),
        sourceId: requireString(record['sourceId'], `${path}.sourceId`),
        canonicalId: requireString(record['canonicalId'], `${path}.canonicalId`),
        category: requireString(record['category'], `${path}.category`)
    };
}

function parseArray<T>(
    value: unknown,
    path: string,
    parser: (item: unknown, itemPath: string) => T
): T[] {
    if (!Array.isArray(value)) {
        throw new Error(`${path} must be an array.`);
    }

    return value.map((item: unknown, index: number) => parser(item, `${path}[${String(index)}]`));
}

function assertUniqueIds(items: ReadonlyArray<{ readonly id: Identifier }>, path: string): void {
    const seen = new Set<string>();
    for (const item of items) {
        const id = item.id.toString();
        if (seen.has(id)) {
            throw new Error(`${path} contains duplicate id "${id}".`);
        }
        seen.add(id);
    }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${path} must be an object.`);
    }
    return value as Record<string, unknown>;
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: readonly string[], path: string): void {
    const unexpected = Object.keys(record).filter((key) => !allowed.includes(key));
    if (unexpected.length > 0) {
        throw new Error(`${path} contains unsupported field(s): ${unexpected.join(', ')}.`);
    }
}

function requireString(value: unknown, path: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${path} must be a non-empty string.`);
    }
    return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string, path: string): string | undefined {
    if (!(key in record)) {
        return undefined;
    }
    if (typeof record[key] !== 'string') {
        throw new Error(`${path}.${key} must be a string when provided.`);
    }
    return record[key].trim();
}

function requireNumber(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${path} must be a finite number.`);
    }
    return value;
}

function parseEnum<T extends string>(value: unknown, values: readonly T[], path: string): T {
    if (typeof value !== 'string' || !values.includes(value as T)) {
        throw new Error(`${path} must be one of: ${values.join(', ')}.`);
    }
    return value as T;
}
