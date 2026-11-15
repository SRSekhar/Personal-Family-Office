import { describe, expect, it } from 'vitest';
import { sanitizeEvidenceExcerpt, validateEvidence, validateResearchRequest } from '../src/validation.js';
import type { ResearchRunRequest } from '../src/contracts.js';

const base: ResearchRunRequest = {
    idempotencyKey: 'x',
    subject: { instrumentId: 'i-1', name: 'Example' },
    asOf: '2026-01-02T00:00:00Z',
    recordedAt: '2026-01-02T00:00:00Z',
    domains: ['technicals'],
    evidence: [{
        id: 'e1',
        sourceName: 'Source',
        sourceUrl: 'https://example.test',
        sourceKind: 'other',
        availableAt: '2026-01-01T00:00:00Z',
        retrievedAt: '2026-01-01T01:00:00Z',
        knownAtOrBefore: '2026-01-01T00:00:00Z',
        contentDigest: 'b'.repeat(64),
        excerpt: 'text',
        pointInTimeGuaranteed: false
    }],
    model: { providerId: 'p', providerName: 'P', modelId: 'm', modelVersion: '1', adapterVersion: '1' },
    promptVersion: 'v1',
    maxEvidenceAgeDays: 30
};

const evidenceItem = base.evidence[0];
if (!evidenceItem) {
    throw new Error('Validation fixture evidence is missing.');
}

describe('research request validation', () => {
    it('accepts a valid request', () => {
        expect(() => validateResearchRequest(base)).not.toThrow();
    });

    it('rejects non-HTTPS sources and duplicate evidence IDs', () => {
        expect(() => {
            validateEvidence([{ ...evidenceItem, sourceUrl: 'http://example.test' }, evidenceItem], base.asOf);
        }).toThrow(/HTTPS/);
        expect(() => {
            validateEvidence([evidenceItem, evidenceItem], base.asOf);
        }).toThrow(/unique/);
    });

    it('removes control characters and caps untrusted excerpts', () => {
        const excerpt = 'hello' + String.fromCharCode(0) + 'world';
        expect(sanitizeEvidenceExcerpt(excerpt)).toBe('hello world');
        expect(sanitizeEvidenceExcerpt('x'.repeat(2500))).toHaveLength(2000);
    });

    it('rejects future evidence even when retrieved earlier', () => {
        expect(() => {
            validateEvidence([{ ...evidenceItem, availableAt: '2026-01-03T00:00:00Z' }], base.asOf);
        }).toThrow(/not available/);
    });
});
