#!/usr/bin/env node

import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { WorkspaceDatabase, WorkspaceValidationError, resolveDatabasePath } from './workspace-database.mjs';

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
            const error = new Error('Request body exceeds the 10 MiB limit.');
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

export function createDashboardServer(rootDirectory = dashboardRoot, options = {}) {
    const root = realpathSync(resolve(rootDirectory));
    const database = options.databasePath ? new WorkspaceDatabase(options.databasePath) : null;
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
                    if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'payload')) {
                        sendJson(response, 400, { error: 'Request must include a complete workspace payload.' });
                        return;
                    }
                    sendJson(response, 200, database.saveWorkspace(body.payload));
                } catch (error) {
                    const status = error instanceof WorkspaceValidationError ? 400
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
    if (database) server.once('close', () => database.close());
    return server;
}

export function startDashboardServer(options = {}) {
    const port = options.port ?? parsePort();
    const rootDirectory = options.rootDirectory ?? dashboardRoot;
    const databasePath = options.databasePath ?? resolveDatabasePath();
    const output = options.output ?? process.stdout;
    const server = createDashboardServer(rootDirectory, { databasePath });

    server.on('error', (error) => {
        output.write(`PFO dashboard server failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
        output.write(`PFO dashboard: http://127.0.0.1:${port}/\nPress Ctrl+C to stop.\n`);
    });

    return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const server = startDashboardServer();
    const stop = () => {
        server.close(() => {
            process.exitCode = 0;
        });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}
