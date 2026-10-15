import { describe, expect, it } from 'vitest';
import { isPrivateWorkspaceAllowed } from '../workspace-security.js';

describe('private workspace origin guard', () => {
    it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]', 'localhost.'])(
        'allows trusted loopback hostname %s',
        (hostname) => {
            expect(isPrivateWorkspaceAllowed(hostname)).toBe(true);
        }
    );

    it.each([
        'github.io',
        'sekhar.github.io',
        'example.com',
        '192.168.1.10',
        '',
        'localhost.example.com'
    ])('blocks non-loopback hostname %s', (hostname) => {
        expect(isPrivateWorkspaceAllowed(hostname)).toBe(false);
    });

    it('fails closed for non-string host values', () => {
        expect(isPrivateWorkspaceAllowed(undefined)).toBe(false);
        expect(isPrivateWorkspaceAllowed(null)).toBe(false);
    });
});
