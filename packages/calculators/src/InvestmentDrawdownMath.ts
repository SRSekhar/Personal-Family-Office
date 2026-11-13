export type InvestmentDrawdownObservationKind = 'DailyClose' | 'ExternalFlowPre' | 'ExternalFlowPost';

export interface InvestmentDrawdownObservation {
    readonly id: string;
    readonly scopeId: string;
    readonly currency: string;
    readonly kind: InvestmentDrawdownObservationKind;
    readonly effectiveAt: string;
    readonly recordedAt: string;
    readonly portfolioValue: number;
    readonly complete: boolean;
    readonly unavailableReason?: string;
    readonly flowId?: string;
}

export interface InvestmentDrawdownExternalFlow {\n    readonly id: string;\n    readonly effectiveAt: string;\n    readonly recordedAt: string;\n}\n\nexport interface InvestmentDrawdownMathInput {
    readonly scopeId: string;
    readonly currency: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly recordedAtCutoff: string;
    readonly observations: readonly InvestmentDrawdownObservation[];\n    /** External flows independently selected from the authoritative cash/transaction ledgers. */\n    readonly externalFlows: readonly InvestmentDrawdownExternalFlow[];
}

export interface InvestmentDrawdownPoint {
    readonly effectiveAt: string;
    readonly observationId: string;
    readonly kind: InvestmentDrawdownObservationKind;
    readonly portfolioValue: number;
    readonly wealthIndex: number;
    /** Decimal fraction; -0.2 means a 20% drawdown. */
    readonly drawdown: number;
}

export interface InvestmentDrawdownMathResult {
    readonly status: 'available' | 'unavailable';
    readonly reason: string | null;
    readonly scopeId: string;
    readonly currency: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly recordedAtCutoff: string;
    readonly observationCount: number;
    readonly maximumDrawdown: number | null;
    readonly peakAt: string | null;
    readonly troughAt: string | null;
    readonly recoveryAt: string | null;
    readonly recovered: boolean;
    readonly points: readonly InvestmentDrawdownPoint[];
}

interface ObservationGroup {
    readonly effectiveAt: string;
    readonly daily?: InvestmentDrawdownObservation;
    readonly pre?: InvestmentDrawdownObservation;
    readonly post?: InvestmentDrawdownObservation;
}

function assertTimestamp(value: string, label: string): void {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString() !== value) {
        throw new RangeError(label + ' must be a canonical UTC ISO-8601 timestamp.');
    }
}

function unavailable(input: InvestmentDrawdownMathInput, reason: string, count = 0): InvestmentDrawdownMathResult {
    return {
        status: 'unavailable', reason, scopeId: input.scopeId, currency: input.currency,
        startAt: input.startAt, endAt: input.endAt, recordedAtCutoff: input.recordedAtCutoff,
        observationCount: count, maximumDrawdown: null, peakAt: null, troughAt: null,
        recoveryAt: null, recovered: false, points: []
    };
}

/**
 * Calculates a time-weighted, external-flow-adjusted wealth index and drawdown path.
 *
 * Each external flow must have a same-effective-time pre-flow and post-flow
 * portfolio valuation. The pre-flow value closes the preceding return segment;
 * the post-flow value becomes the next segment's denominator. The external flow
 * itself therefore changes NAV but does not create investment return.
 *
 * The caller must supply the complete observation schedule for the selected
 * window. This pure calculator validates supplied observations but cannot infer
 * whether an omitted daily snapshot should have existed.
 */
export function analyzeInvestmentDrawdownMath(input: InvestmentDrawdownMathInput): InvestmentDrawdownMathResult {
    if (!input || typeof input !== 'object') throw new TypeError('Drawdown input is required.');
    if (typeof input.scopeId !== 'string' || !input.scopeId.trim()) throw new TypeError('A portfolio scope ID is required.');
    if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/u.test(input.currency)) throw new TypeError('A three-letter currency code is required.');
    assertTimestamp(input.startAt, 'Analysis start');
    assertTimestamp(input.endAt, 'Analysis end');
    assertTimestamp(input.recordedAtCutoff, 'Recorded-at cutoff');
    if (input.startAt > input.endAt) throw new RangeError('Analysis start must not be after analysis end.');
    if (!Array.isArray(input.observations)) throw new TypeError('Drawdown observations must be an array.');\n    if (!Array.isArray(input.externalFlows)) throw new TypeError('Authoritative external flows must be an array.');\n\n    const flowIds = new Set<string>();\n    const expectedFlows = new Map<string, string>();\n    for (const raw of input.externalFlows as readonly unknown[]) {\n        if (!raw || typeof raw !== 'object') throw new TypeError('Every external flow must be an object.');\n        const flow = raw as InvestmentDrawdownExternalFlow;\n        if (typeof flow.id !== 'string' || !flow.id.trim() || flowIds.has(flow.id)) throw new RangeError('External flow IDs must be unique and non-empty.');\n        flowIds.add(flow.id);\n        assertTimestamp(flow.effectiveAt, 'External flow effectiveAt');\n        assertTimestamp(flow.recordedAt, 'External flow recordedAt');\n        if (flow.recordedAt <= input.recordedAtCutoff && flow.effectiveAt >= input.startAt && flow.effectiveAt <= input.endAt) expectedFlows.set(flow.id, flow.effectiveAt);\n    }

    const ids = new Set<string>();
    const eligible: InvestmentDrawdownObservation[] = [];
    for (const raw of input.observations as readonly unknown[]) {
        if (!raw || typeof raw !== 'object') throw new TypeError('Every drawdown observation must be an object.');
        const item = raw as InvestmentDrawdownObservation;
        if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new RangeError('Observation IDs must be unique and non-empty.');
        ids.add(item.id);
        if (item.scopeId !== input.scopeId || item.currency !== input.currency) throw new RangeError('Every observation must match the selected scope and currency.');
        if (!['DailyClose', 'ExternalFlowPre', 'ExternalFlowPost'].includes(item.kind)) throw new RangeError('Observation kind is unsupported.');
        assertTimestamp(item.effectiveAt, 'Observation effectiveAt');
        assertTimestamp(item.recordedAt, 'Observation recordedAt');
        if (typeof item.portfolioValue !== 'number' || !Number.isFinite(item.portfolioValue) || item.portfolioValue < 0) {
            throw new RangeError('Portfolio valuation must be a finite, non-negative amount.');
        }
        if (typeof item.complete !== 'boolean') throw new TypeError('Observation completeness must be explicit.');
        if (item.kind === 'DailyClose' && item.flowId !== undefined) throw new RangeError('Daily-close observations cannot reference an external flow.');
        if (item.kind !== 'DailyClose' && (typeof item.flowId !== 'string' || !item.flowId.trim())) {
            throw new RangeError('External-flow boundary observations require a flow ID.');
        }
        if (item.recordedAt <= input.recordedAtCutoff && item.effectiveAt >= input.startAt && item.effectiveAt <= input.endAt) eligible.push(item);
    }

    if (eligible.some((item) => !item.complete)) {
        const item = eligible.find((candidate) => !candidate.complete)!;
        return unavailable(input, item.unavailableReason?.trim() || 'One or more portfolio valuation observations are incomplete.', eligible.length);
    }

    const grouped = new Map<string, ObservationGroup>();
    for (const item of eligible) {
        const current = grouped.get(item.effectiveAt) ?? { effectiveAt: item.effectiveAt };
        if (item.kind === 'DailyClose') {
            if (current.daily || current.pre || current.post) throw new RangeError('A timestamp cannot contain both a daily close and a flow-boundary observation.');
            grouped.set(item.effectiveAt, { ...current, daily: item });
        } else {
            if (current.daily) throw new RangeError('A timestamp cannot contain both a daily close and a flow-boundary observation.');
            const sameFlow = [current.pre, current.post].filter(Boolean);
            if (sameFlow.some((candidate) => candidate!.flowId !== item.flowId)) {
                throw new RangeError('Only one external flow may be represented at an exact timestamp; sequence simultaneous flows explicitly.');
            }
            if (item.kind === 'ExternalFlowPre') {
                if (current.pre) throw new RangeError('An external flow can have only one pre-flow valuation.');
                grouped.set(item.effectiveAt, { ...current, pre: item });
            } else {
                if (current.post) throw new RangeError('An external flow can have only one post-flow valuation.');
                grouped.set(item.effectiveAt, { ...current, post: item });
            }
        }
    }

    const observedFlowIds = new Set<string>();\n    for (const group of grouped.values()) {\n        if (group.pre || group.post) observedFlowIds.add(group.pre?.flowId ?? group.post?.flowId!);\n    }\n    for (const [flowId, effectiveAt] of expectedFlows) {\n        if (!observedFlowIds.has(flowId)) return unavailable(input, 'An authoritative external flow is missing its paired valuation boundary observations.', eligible.length);\n        const group = [...grouped.values()].find((candidate) => candidate.pre?.flowId === flowId || candidate.post?.flowId === flowId);\n        if (group?.effectiveAt !== effectiveAt) throw new RangeError('Flow-boundary observations must match the authoritative external-flow effective timestamp.');\n    }\n    for (const flowId of observedFlowIds) {\n        if (!expectedFlows.has(flowId)) throw new RangeError('A flow-boundary observation does not match an eligible authoritative external flow.');\n    }\n\n    const groups = [...grouped.values()].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
    for (const group of groups) {
        if (!group.daily && (!group.pre || !group.post)) {
            return unavailable(input, 'An external flow is missing its paired pre-flow or post-flow valuation.', eligible.length);
        }
    }
    if (groups.length < 2) return unavailable(input, 'At least two distinct observation timestamps are required to calculate drawdown.', eligible.length);

    const first = groups[0]!;
    const initial = first.daily ?? first.post!;
    if (initial.portfolioValue <= 0) return unavailable(input, 'The initial portfolio valuation must be positive.', eligible.length);

    let previousPortfolioValue = initial.portfolioValue;
    let wealthIndex = 1;
    let runningPeak = 1;
    let runningPeakAt = initial.effectiveAt;
    let maximumDrawdown = 0;
    let maximumPeakAt = initial.effectiveAt;
    let maximumTroughAt = initial.effectiveAt;
    let recoveryAt: string | null = initial.effectiveAt;
    let recovered = true;
    const points: InvestmentDrawdownPoint[] = [{
        effectiveAt: initial.effectiveAt, observationId: initial.id, kind: initial.kind,
        portfolioValue: initial.portfolioValue, wealthIndex, drawdown: 0
    }];

    const appendPoint = (item: InvestmentDrawdownObservation): void => {
        const drawdown = wealthIndex / runningPeak - 1;
        if (wealthIndex > runningPeak) {
            runningPeak = wealthIndex;
            runningPeakAt = item.effectiveAt;
        }
        const currentDrawdown = wealthIndex / runningPeak - 1;
        points.push({
            effectiveAt: item.effectiveAt, observationId: item.id, kind: item.kind,
            portfolioValue: item.portfolioValue, wealthIndex, drawdown: currentDrawdown
        });
        if (currentDrawdown < maximumDrawdown) {
            maximumDrawdown = currentDrawdown;
            maximumPeakAt = runningPeakAt;
            maximumTroughAt = item.effectiveAt;
            recoveryAt = null;
            recovered = false;
        } else if (!recovered && maximumDrawdown < 0 && wealthIndex >= runningPeak
            && item.effectiveAt > maximumTroughAt) {
            recoveryAt = item.effectiveAt;
            recovered = true;
        }
        void drawdown;
    };

    for (let index = 1; index < groups.length; index += 1) {
        const group = groups[index]!;
        if (group.daily) {
            if (previousPortfolioValue <= 0) return unavailable(input, 'A zero portfolio value cannot be used as a return denominator.', eligible.length);
            wealthIndex *= group.daily.portfolioValue / previousPortfolioValue;
            if (!Number.isFinite(wealthIndex)) return unavailable(input, 'The chained wealth index exceeds the supported numeric range.', eligible.length);
            appendPoint(group.daily);
            previousPortfolioValue = group.daily.portfolioValue;
            continue;
        }
        const pre = group.pre!;
        const post = group.post!;
        if (previousPortfolioValue <= 0) return unavailable(input, 'A zero portfolio value cannot be used as a return denominator.', eligible.length);
        wealthIndex *= pre.portfolioValue / previousPortfolioValue;
        if (!Number.isFinite(wealthIndex)) return unavailable(input, 'The chained wealth index exceeds the supported numeric range.', eligible.length);
        appendPoint(pre);
        appendPoint(post);
        previousPortfolioValue = post.portfolioValue;
    }

    return {
        status: 'available', reason: null, scopeId: input.scopeId, currency: input.currency,
        startAt: initial.effectiveAt, endAt: groups[groups.length - 1]!.effectiveAt,
        recordedAtCutoff: input.recordedAtCutoff, observationCount: eligible.length,
        maximumDrawdown, peakAt: maximumPeakAt, troughAt: maximumTroughAt,
        recoveryAt, recovered, points
    };
}
