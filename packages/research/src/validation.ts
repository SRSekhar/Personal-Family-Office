import { RESEARCH_DOMAINS, type ChallengeFinding, type ResearchClaim, type ResearchEvidence, type ResearchRunRequest, type SpecialistFinding } from './contracts.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DIGEST = /^[a-f0-9]{64}$/i;
const MAX_EVIDENCE = 500;
const MAX_EXCERPT = 2_000;

export function isIsoTimestamp(value: string): boolean {
    return ISO.test(value) && Number.isFinite(Date.parse(value));
}

function requireTimestamp(value: string, label: string): void {
    if (!isIsoTimestamp(value)) throw new RangeError(label + ' must be a UTC ISO-8601 timestamp.');
}

export function sanitizeEvidenceExcerpt(value: string): string {
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').slice(0, MAX_EXCERPT);
}

export function validateEvidence(evidence: readonly ResearchEvidence[], asOf: string): void {
    if (evidence.length > MAX_EVIDENCE) throw new RangeError('Research evidence exceeds the 500-item limit.');
    const ids = new Set<string>();
    for (const item of evidence) {
        if (!item.id.trim() || ids.has(item.id)) throw new RangeError('Evidence IDs must be non-empty and unique.');
        ids.add(item.id);
        if (!item.sourceName.trim() || !item.excerpt.trim()) throw new RangeError('Evidence source and excerpt are required.');
        let url: URL;
        try { url = new URL(item.sourceUrl); } catch { throw new RangeError('Evidence source URL must be valid HTTPS.'); }
        if (url.protocol !== 'https:') throw new RangeError('Evidence source URL must use HTTPS.');
        if (!DIGEST.test(item.contentDigest)) throw new RangeError('Evidence content digest must be a SHA-256 hex digest.');
        requireTimestamp(item.availableAt, 'Evidence availableAt');
        requireTimestamp(item.retrievedAt, 'Evidence retrievedAt');
        requireTimestamp(item.knownAtOrBefore, 'Evidence knownAtOrBefore');
        if (item.publishedAt) requireTimestamp(item.publishedAt, 'Evidence publishedAt');
        if (Date.parse(item.knownAtOrBefore) > Date.parse(asOf) || Date.parse(item.availableAt) > Date.parse(asOf)) {
            throw new RangeError('Evidence was not available at the requested research as-of time.');
        }
        if (item.publishedAt && Date.parse(item.publishedAt) > Date.parse(asOf)) {
            throw new RangeError('Evidence publication is later than the requested research as-of time.');
        }
        if (item.pointInTimeGuaranteed && Date.parse(item.knownAtOrBefore) > Date.parse(item.availableAt)) {
            throw new RangeError('Point-in-time evidence cutoff cannot follow its availability timestamp.');
        }
    }
}

export function validateResearchRequest(request: ResearchRunRequest): void {
    if (!request.idempotencyKey.trim() || request.idempotencyKey.length > 200) throw new RangeError('Idempotency key must contain 1–200 characters.');
    if (!request.subject.instrumentId.trim() || !request.subject.name.trim()) throw new RangeError('Research subject identity is required.');
    requireTimestamp(request.asOf, 'Research asOf');
    requireTimestamp(request.recordedAt, 'Research recordedAt');
    if (!request.domains.length || new Set(request.domains).size !== request.domains.length
        || request.domains.some((domain) => !RESEARCH_DOMAINS.includes(domain))) {
        throw new RangeError('Research domains must be a non-empty unique list of supported domains.');
    }
    if (!Number.isInteger(request.maxEvidenceAgeDays) || request.maxEvidenceAgeDays < 1 || request.maxEvidenceAgeDays > 3_650) {
        throw new RangeError('Maximum evidence age must be between 1 and 3650 days.');
    }
    for (const value of Object.values(request.model)) if (!value.trim()) throw new RangeError('Model and provider version metadata is required.');
    if (!request.promptVersion.trim()) throw new RangeError('Prompt version is required.');
    validateEvidence(request.evidence, request.asOf);
}

export function validateFinding(finding: SpecialistFinding, expectedDomain: string, evidenceIds: ReadonlySet<string>): void {
    if (finding.domain !== expectedDomain) throw new RangeError('Specialist returned a finding for the wrong research domain.');
    if (!finding.summary.trim()) throw new RangeError('Specialist summary must not be empty.');
    const claimIds = new Set<string>();
    for (const claim of finding.claims) {
        if (claim.domain !== finding.domain || !claim.id.trim() || claimIds.has(claim.id)) throw new RangeError('Research claim identity or domain is invalid.');
        claimIds.add(claim.id);
        validateClaim(claim, evidenceIds);
    }
    if (!finding.claims.length && !finding.unavailableReason?.trim()) throw new RangeError('An empty specialist result must explain why the domain is unavailable.');
}

function validateClaim(claim: ResearchClaim, evidenceIds: ReadonlySet<string>): void {
    if (!claim.statement.trim() || !Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
        throw new RangeError('Research claim text and confidence are invalid.');
    }
    if (!claim.evidenceIds.length || claim.evidenceIds.some((id) => !evidenceIds.has(id))) {
        throw new RangeError('Every factual research claim must cite supplied evidence IDs.');
    }
    if (claim.limitations.some((item) => !item.trim())) throw new RangeError('Claim limitations must be non-empty strings.');
}

export function validateChallenge(challenge: ChallengeFinding, stance: 'bullish' | 'bearish', claimIds: ReadonlySet<string>): void {
    if (challenge.stance !== stance || !challenge.summary.trim() || !Number.isFinite(challenge.confidence)
        || challenge.confidence < 0 || challenge.confidence > 1) throw new RangeError('Adversarial review output is invalid.');
    const all = [...challenge.challengedClaimIds, ...challenge.supportedClaimIds];
    if (all.some((id) => !claimIds.has(id)) || new Set(all).size !== all.length) {
        throw new RangeError('Adversarial review referenced unknown or duplicate claim IDs.');
    }
    if (challenge.missingEvidence.some((item) => !item.trim())) throw new RangeError('Missing-evidence descriptions must be non-empty.');
}
