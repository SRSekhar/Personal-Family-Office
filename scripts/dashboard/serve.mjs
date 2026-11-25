#!/usr/bin/env node

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { realpathSync } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { WorkspaceConflictError, WorkspaceDatabase, WorkspaceValidationError, resolveDatabasePath } from './workspace-database.mjs';

const dashboardRoot = realpathSync(new URL('../../apps/dashboard/', import.meta.url));

const contentTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml']
]);

const securityHeaders = {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
};

export function parsePort(value = process.env['PFO_DASHBOARD_PORT']) {
    if (value === undefined || value.trim() === '') {
        return 4173;
    }

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PFO_DASHBOARD_PORT must be an integer between 1 and 65535.');
    }

    return port;
}

function sendJson(response, status, value) {
    const body = JSON.stringify(value);
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    response.end(body);
}

function isLoopbackHostname(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isSafeLocalApiRequest(request) {
    const hostHeader = request.headers.host;
    if (typeof hostHeader !== 'string') return false;
    let host;
    try { host = new URL('http://' + hostHeader); } catch { return false; }
    if (!isLoopbackHostname(host.hostname)) return false;
    const origin = request.headers.origin;
    if (origin !== undefined) {
        try {
            const parsedOrigin = new URL(origin);
            if (!['http:', 'https:'].includes(parsedOrigin.protocol)
                || !isLoopbackHostname(parsedOrigin.hostname)
                || parsedOrigin.host !== host.host) return false;
        } catch { return false; }
    }
    return request.headers['sec-fetch-site'] !== 'cross-site';
}

async function readJsonRequest(request, limit = 10 * 1024 * 1024) {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
        length += chunk.length;
        if (length > limit) {
            const error = new Error(`Request body exceeds the ${Math.ceil(limit/(1024*1024))} MiB limit.`);
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        const error = new Error('Request body must contain valid JSON.');
        error.statusCode = 400;
        throw error;
    }
}

const BACKTEST_IMPORT_BODY_LIMIT = Math.ceil((64 * 1024 * 1024) * 4 / 3) + 1024 * 1024;
function decodeCanonicalBase64(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil((64 * 1024 * 1024) * 4 / 3)
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) throw new Error('CSV must be canonical base64 and at most 64 MiB.');
    const bytes = Buffer.from(value, 'base64');
    if (!bytes.byteLength || bytes.byteLength > 64 * 1024 * 1024 || bytes.toString('base64') !== value) throw new Error('CSV upload is empty, oversized, or not canonical base64.');
    return bytes;
}
const BACKTEST_BACKUP_ID = /^backup-[0-9]{13}-[0-9a-f-]{36}$/u;
async function listManagedBackups(directory) {
    if (!directory) return [];
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
    const backups = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !BACKTEST_BACKUP_ID.test(entry.name)) continue;
        try {
            const manifestPath = join(directory, entry.name, 'manifest.json');
            const details = await stat(manifestPath);
            if (!details.isFile() || details.size > 16 * 1024 * 1024) continue;
            const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
            if (manifest.format !== 'PFO-BACKTEST-BACKUP' || manifest.formatVersion !== 1 || typeof manifest.createdAt !== 'string' || !Array.isArray(manifest.datasetVersions) || !Array.isArray(manifest.artifacts)) continue;
            backups.push({ id: entry.name, createdAt: manifest.createdAt, datasetVersions: manifest.datasetVersions.length, artifacts: manifest.artifacts.length });
        } catch { /* Incomplete or malformed bundles are not offered as restore candidates. */ }
    }
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createDashboardServer(rootDirectory = dashboardRoot, options = {}) {
    const root = realpathSync(resolve(rootDirectory));
    const database = options.databasePath ? new WorkspaceDatabase(options.databasePath) : null;
    let backtestWorkspace = options.backtestWorkspace ?? null;
    const backtestBackupDirectory = options.backtestBackupDirectory ?? null;
    const createBacktestBackup = options.createBacktestBackup ?? ((destination) => backtestWorkspace.createBackup(destination));
    const restoreBacktestBackup = options.restoreBacktestBackup ?? null;
    const server = createServer(async (request, response) => {
        for (const [name, value] of Object.entries(securityHeaders)) {
            response.setHeader(name, value);
        }

        let pathname;
        try {
            pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
        } catch {
            response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Bad request\n');
            return;
        }

        if (pathname.startsWith('/api/v1/backtesting/')) {
            if (!backtestWorkspace) { sendJson(response, 503, { error: 'Backtesting storage is not explicitly enabled.' }); return; }
            if (!isSafeLocalApiRequest(request)) { sendJson(response, 403, { error: 'Backtesting API accepts requests only from this local dashboard origin.' }); return; }
            if (pathname === '/api/v1/backtesting/datasets' && request.method === 'GET') {
                try { sendJson(response, 200, { datasets: backtestWorkspace.listDatasets() }); }
                catch { sendJson(response, 500, { error: 'Datasets could not be listed.' }); }
                return;
            }
            if (pathname === '/api/v1/backtesting/integrity' && request.method === 'GET') {
                try { const result = await backtestWorkspace.checkIntegrity(); sendJson(response, result.ok ? 200 : 500, result); }
                catch { sendJson(response, 500, { error: 'Integrity check could not complete.' }); }
                return;
            }
            if (pathname === '/api/v1/backtesting/import' && request.method === 'POST') {
                if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { sendJson(response, 415, { error: 'Content-Type must be application/json.' }); return; }
                try {
                    const body = await readJsonRequest(request, BACKTEST_IMPORT_BODY_LIMIT);
                    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'csvBase64,metadata'
                        || !body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
                        sendJson(response, 400, { error: 'Request must contain only csvBase64 and explicit metadata fields.' }); return;
                    }
                    sendJson(response, 201, { dataset: await backtestWorkspace.importCsv(decodeCanonicalBase64(body.csvBase64), body.metadata) });
                } catch (error) {
                    sendJson(response, Number.isInteger(error?.statusCode) ? error.statusCode : 400, { error: error instanceof Error ? error.message : 'CSV import failed validation.' });
                }
                return;
            }
            if (pathname === '/api/v1/backtesting/backups' && request.method === 'GET') {
                try { sendJson(response, 200, { backups: await listManagedBackups(backtestBackupDirectory) }); }
                catch { sendJson(response, 500, { error: 'Managed backup catalog could not be read.' }); }
                return;
            }
            if (pathname === '/api/v1/backtesting/backup' && request.method === 'POST') {
                if (!backtestBackupDirectory) { sendJson(response, 503, { error: 'Managed backup storage is not configured.' }); return; }
                if (!isAbsolute(backtestBackupDirectory)) { sendJson(response, 500, { error: 'Managed backup directory must be absolute.' }); return; }
                try {
                    const id = 'backup-' + Date.now() + '-' + randomUUID();
                    const result = await createBacktestBackup(join(backtestBackupDirectory, id));
                    sendJson(response, 201, { backup: { id, createdAt: new Date().toISOString(), datasetVersions: result.datasetVersions, artifacts: result.artifacts, artifactBytes: result.artifactBytes, catalogSha256: result.catalogSha256 } });
                } catch { sendJson(response, 500, { error: 'A verified, non-overwriting historical dataset backup could not be created.' }); }
                return;
            }
            if (pathname === '/api/v1/backtesting/restore' && request.method === 'POST') {
                if (!backtestBackupDirectory || !restoreBacktestBackup) { sendJson(response, 503, { error: 'Safe managed restore is not configured.' }); return; }
                try {
                    const body = await readJsonRequest(request, 16 * 1024);
                    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).join(',') !== 'backupId' || typeof body.backupId !== 'string' || !BACKTEST_BACKUP_ID.test(body.backupId)) {
                        sendJson(response, 400, { error: 'Restore requires one valid managed backup ID.' }); return;
                    }
                    const available = await listManagedBackups(backtestBackupDirectory);
                    if (!available.some((item) => item.id === body.backupId)) { sendJson(response, 404, { error: 'Managed backup was not found or is incomplete.' }); return; }
                    const restored = await restoreBacktestBackup(body.backupId);
                    sendJson(response, 201, { restore: restored });
                } catch { sendJson(response, 400, { error: 'Backup validation or non-overwriting restore failed. Existing datasets were not overwritten.' }); }
                return;
            }
            sendJson(response, 404, { error: 'Unknown local backtesting endpoint.' }); return;
        }

        if (pathname.startsWith('/api/v1/')) {
            if (!database) {
                sendJson(response, 503, { error: 'SQLite database support is not configured for this server instance.' });
                return;
            }
            if (!isSafeLocalApiRequest(request)) {
                sendJson(response, 403, { error: 'Database API accepts requests only from this local dashboard origin.' });
                return;
            }
            if (pathname === '/api/v1/database/status' && request.method === 'GET') {
                sendJson(response, 200, database.getStatus());
                return;
            }
            if (pathname === '/api/v1/database/integrity' && request.method === 'GET') {
                try {
                    const result = database.checkIntegrity();
                    sendJson(response, result.ok ? 200 : 500, result);
                } catch {
                    sendJson(response, 500, { ok: false, messages: ['SQLite integrity check could not complete.'] });
                }
                return;
            }
            if (pathname === '/api/v1/database/backup' && request.method === 'POST') {
                try {
                    sendJson(response, 201, await database.createOnlineBackup());
                } catch {
                    sendJson(response, 500, { error: 'A verified online SQLite backup could not be created. The committed workspace was not modified.' });
                }
                return;
            }
            if (pathname === '/api/v1/workspace' && request.method === 'GET') {
                try {
                    const workspace = database.getWorkspace();
                    if (!workspace) {
                        sendJson(response, 404, { error: 'No workspace has been saved to the local SQLite database yet.' });
                        return;
                    }
                    sendJson(response, 200, workspace);
                } catch {
                    sendJson(response, 500, { error: 'The saved database workspace could not be validated. No database data was changed.' });
                }
                return;
            }
            if (pathname === '/api/v1/workspace' && request.method === 'PUT') {
                if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
                    sendJson(response, 415, { error: 'Content-Type must be application/json.' });
                    return;
                }
                try {
                    const body = await readJsonRequest(request);
                    if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'payload')
                        || !Object.hasOwn(body, 'expectedUpdatedAt')
                        || !(body.expectedUpdatedAt === null || (typeof body.expectedUpdatedAt === 'string' && Number.isFinite(Date.parse(body.expectedUpdatedAt))))) {
                        sendJson(response, 400, { error: 'Request must include a complete workspace payload and its last-read database timestamp (or null when no snapshot exists).' });
                        return;
                    }
                    sendJson(response, 200, database.saveWorkspace(body.payload, body.expectedUpdatedAt));
                } catch (error) {
                    const status = error instanceof WorkspaceConflictError ? 409
                        : error instanceof WorkspaceValidationError ? 400
                            : Number.isInteger(error?.statusCode) ? error.statusCode : 500;
                    sendJson(response, status, {
                        error: status === 500
                            ? 'The workspace could not be saved to SQLite. The previous database snapshot was preserved.'
                            : error instanceof Error ? error.message : 'The workspace request is invalid.'
                    });
                }
                return;
            }
            sendJson(response, 404, { error: 'Unknown local database endpoint.' });
            return;
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Method not allowed\n');
            return;
        }

        const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const requestedPath = resolve(root, relativePath);
        if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
            return;
        }

        const segments = relativePath.split(/[\\/]+/);
        if (segments.some((segment) => segment.startsWith('.'))) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
            return;
        }

        const contentType = contentTypes.get(extname(requestedPath).toLowerCase());
        if (!contentType) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
            return;
        }

        try {
            const actualPath = await realpath(requestedPath);
            if (actualPath !== root && !actualPath.startsWith(`${root}${sep}`)) {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
                return;
            }

            const metadata = await stat(actualPath);
            if (!metadata.isFile()) {
                response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end(request.method === 'HEAD' ? undefined : 'Not found\n');
                return;
            }

            const body = await readFile(actualPath);
            response.writeHead(200, {
                'Content-Length': body.byteLength,
                'Content-Type': contentType
            });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            const status = code === 'ENOENT' || code === 'ENOTDIR' ? 404 : 500;
            response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : status === 404 ? 'Not found\n' : 'Internal server error\n');
        }
    });
    if (database || backtestWorkspace) server.once('close', () => { database?.close(); backtestWorkspace?.close(); });
    return server;
}

export async function startDashboardServer(options = {}) {
    const port = options.port ?? parsePort();
    const rootDirectory = options.rootDirectory ?? dashboardRoot;
    const databasePath = options.databasePath ?? resolveDatabasePath();
    const output = options.output ?? process.stdout;
    let backtestWorkspace = options.backtestWorkspace ?? null;
    let backtestBackupDirectory = options.backtestBackupDirectory ?? null;
    let createBacktestBackup = options.createBacktestBackup ?? null;
    let restoreBacktestBackup = options.restoreBacktestBackup ?? null;
    if (!backtestWorkspace && process.env['PFO_BACKTESTING_ENABLED'] === 'true') {
        const { BacktestDatasetWorkspace, resolveBacktestStoragePaths } = await import('../../packages/backtesting/dist/index.js');
        const storagePaths = resolveBacktestStoragePaths();
        backtestWorkspace = BacktestDatasetWorkspace.open();
        const configuredBackupDirectory = process.env['PFO_BACKTEST_BACKUP_DIRECTORY'];
        if (configuredBackupDirectory !== undefined && !isAbsolute(configuredBackupDirectory)) { backtestWorkspace.close(); throw new Error('PFO_BACKTEST_BACKUP_DIRECTORY must be an absolute path.'); }
        backtestBackupDirectory = backtestBackupDirectory ?? configuredBackupDirectory ?? join(dirname(storagePaths.artifactDirectory), 'backtesting-backups');
        createBacktestBackup = createBacktestBackup ?? ((destination) => backtestWorkspace.createBackup(destination));
        restoreBacktestBackup = restoreBacktestBackup ?? (async (backupId) => {
            const generationId = randomUUID();
            const catalogPath = join(dirname(storagePaths.catalogPath), '..', 'backtesting-catalog-restores', generationId, 'catalog.sqlite');
            const artifactDirectory = join(dirname(storagePaths.artifactDirectory), 'backtesting-artifact-restores', generationId);
            const restored = await BacktestDatasetWorkspace.restoreBackup(join(backtestBackupDirectory, backupId), { env: { ...process.env, PFO_BACKTEST_CATALOG_PATH: catalogPath, PFO_BACKTEST_ARTIFACT_DIRECTORY: artifactDirectory } });
            try { const integrity = await restored.checkIntegrity(); if (!integrity.ok) throw new Error('Restored candidate failed its final integrity check.'); } finally { restored.close(); }
            const quotePowerShell = (value) => "'" + value.replaceAll("'", "''") + "'";
            const quoteBash = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
            return { backupId, catalogPath, artifactDirectory, verified: true,
                powershell: '$env:PFO_BACKTEST_CATALOG_PATH = ' + quotePowerShell(catalogPath) + '; $env:PFO_BACKTEST_ARTIFACT_DIRECTORY = ' + quotePowerShell(artifactDirectory) + '; $env:PFO_BACKTESTING_ENABLED = "true"; pnpm dashboard:serve',
                bash: 'export PFO_BACKTEST_CATALOG_PATH=' + quoteBash(catalogPath) + ' PFO_BACKTEST_ARTIFACT_DIRECTORY=' + quoteBash(artifactDirectory) + ' PFO_BACKTESTING_ENABLED=true && pnpm dashboard:serve' };
        });
    }
    const server = createDashboardServer(rootDirectory, { databasePath, backtestWorkspace, backtestBackupDirectory, createBacktestBackup, restoreBacktestBackup });

    server.on('error', (error) => {
        output.write(`PFO dashboard server failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
        output.write(`PFO dashboard: http://127.0.0.1:${port}/\nBacktesting dataset storage: ${backtestWorkspace ? 'enabled' : 'disabled'}\nPress Ctrl+C to stop.\n`);
    });

    return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const server = await startDashboardServer();
    const stop = () => {
        server.close(() => {
            process.exitCode = 0;
        });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}
