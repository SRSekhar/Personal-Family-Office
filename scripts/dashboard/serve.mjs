#!/usr/bin/env node

import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';

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
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
};

export function parsePort(value = process.env['PFO_DASHBOARD_PORT']): number {
    if (value === undefined || value.trim() === '') {
        return 4173;
    }

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PFO_DASHBOARD_PORT must be an integer between 1 and 65535.');
    }

    return port;
}

export function createDashboardServer(rootDirectory = dashboardRoot) {
    const root = realpathSync(resolve(rootDirectory));

    return createServer(async (request, response) => {
        for (const [name, value] of Object.entries(securityHeaders)) {\n            response.setHeader(name, value);\n        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Method not allowed\n');
            return;
        }

        let pathname;
        try {
            pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
        } catch {
            response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : 'Bad request\n');
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
}

export function startDashboardServer(options = {}) {
    const port = options.port ?? parsePort();
    const rootDirectory = options.rootDirectory ?? dashboardRoot;
    const output = options.output ?? process.stdout;
    const server = createDashboardServer(rootDirectory);

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
