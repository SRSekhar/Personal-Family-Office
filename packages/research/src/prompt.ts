import type { ChallengeInput, SpecialistInput } from './contracts.js';

/** A structured prompt envelope. Evidence text is data, not executable instruction. */
export function createSpecialistEnvelope(input: SpecialistInput): string {
    return JSON.stringify({
        role: 'investment-research-specialist',
        domain: input.domain,
        subject: input.subject,
        asOf: input.asOf,
        policy: input.instruction,
        evidence: input.evidence.map((item) => ({
            id: item.id,
            sourceName: item.sourceName,
            sourceUrl: item.sourceUrl,
            publishedAt: item.publishedAt ?? null,
            availableAt: item.availableAt,
            contentDigest: item.contentDigest,
            untrustedExcerpt: item.excerpt
        }))
    });
}

/** Bull/bear challenges receive identical evidence and claims with opposite explicit stances. */
export function createChallengeEnvelope(input: ChallengeInput): string {
    return JSON.stringify({
        role: 'adversarial-investment-reviewer',
        stance: input.stance,
        subject: input.subject,
        asOf: input.asOf,
        policy: input.instruction,
        findings: input.findings,
        evidence: input.evidence.map((item) => ({
            id: item.id,
            sourceName: item.sourceName,
            sourceUrl: item.sourceUrl,
            availableAt: item.availableAt,
            contentDigest: item.contentDigest,
            untrustedExcerpt: item.excerpt
        }))
    });
}
