import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDashboardServer, parsePort } from './serve.mjs';

const temporaryDirectories = [];
const servers = [];

async function createRoot() {
    const directory = await mkdtemp(join(tmpdir(), 'pfo-dashboard-test-'));
    temporaryDirectories.push(directory);
    const root = join(directory, 'public');
    await mkdir(root);
    await writeFile(join(root, 'index.html'), '<!doctype html><title>Local PFO</title>', 'utf8');
    await writeFile(join(root, 'app.js'), 'export const localOnly = true;', 'utf8');
    await writeFile(join(directory, 'secret.txt'), 'outside the dashboard root', 'utf8');
    return root;
}

async function startServer(root) {
    const server = createDashboardServer(root);
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Test server did not bind to a TCP port.');
    }
    return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
    await Promise.all(temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true })));
});

describe('local dashboard preview server', () => {
    it('serves the dashboard root with restrictive security headers', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
        expect(response.headers.get('content-security-policy')).toContain("style-src 'self' 'unsafe-inline'");
        expect(await response.text()).toContain('Local PFO');
    });

    it('serves JavaScript with the correct MIME type and supports HEAD', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/app.js`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/javascript');
        expect(await response.text()).toContain('localOnly');

        const head = await fetch(`${origin}/app.js`, { method: 'HEAD' });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe('');
    });

    it('rejects methods other than GET and HEAD', async () => {
        const origin = await startServer(await createRoot());
        const response = await fetch(`${origin}/`, { method: 'POST' });
        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toBe('GET, HEAD');
    });

    it('does not serve files outside the dashboard root or unknown extensions', async () => {
        const origin = await startServer(await createRoot());
        const traversal = await fetch(`${origin}/..%2fsecret.txt`);
        expect(traversal.status).toBe(404);

        const unsupported = await fetch(`${origin}/secret.txt`);
        expect(unsupported.status).toBe(404);
    });

    it('validates the configured port', () => {
        expect(parsePort(undefined)).toBe(4173);
        expect(parsePort('8080')).toBe(8080);
        expect(() => parsePort('0')).toThrow('between 1 and 65535');
        expect(() => parsePort('not-a-port')).toThrow('between 1 and 65535');
    });
});
