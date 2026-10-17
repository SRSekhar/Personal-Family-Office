import { calculateFireReadiness, type FireReadinessInput, type FireReadinessResult } from './FireReadiness.js';

/**
 * A named, explicit set of assumptions for comparing deterministic FIRE scenarios.
 * Each scenario is evaluated independently; no assumptions are inferred or shared.
 */
export interface FireReadinessScenario {
    /** Stable identifier unique within one comparison request. */
    readonly id: string;
    /** Human-readable scenario name, such as "Conservative" or "Base case". */
    readonly name: string;
    /** Complete assumptions for this scenario. */
    readonly input: FireReadinessInput;
}

/** The scenario's original assumptions alongside its deterministic result. */
export interface FireReadinessScenarioResult {
    readonly id: string;
    readonly name: string;
    readonly input: FireReadinessInput;
    readonly result: FireReadinessResult;
}

/**
 * Evaluates a collection of independently specified FIRE scenarios.
 *
 * Results preserve input order and include each scenario's original assumptions
 * so callers can present a transparent comparison. This function does not rank
 * scenarios or designate one as recommended.
 *
 * @throws RangeError when an ID/name is blank, an ID is duplicated, or any
 * scenario contains invalid assumptions.
 */
export function compareFireReadinessScenarios(
    scenarios: readonly FireReadinessScenario[]
): FireReadinessScenarioResult[] {
    const seenIds = new Set<string>();

    return scenarios.map((scenario) => {
        if (typeof scenario.id !== 'string' || scenario.id.trim().length === 0) {
            throw new RangeError('Each FIRE scenario must have a non-empty ID.');
        }

        if (typeof scenario.name !== 'string' || scenario.name.trim().length === 0) {
            throw new RangeError('Each FIRE scenario must have a non-empty name.');
        }

        if (seenIds.has(scenario.id)) {
            throw new RangeError(`Duplicate FIRE scenario ID: ${scenario.id}.`);
        }
        seenIds.add(scenario.id);

        // Capture a snapshot so later caller mutations cannot make the
        // recorded assumptions disagree with the already-calculated result.
        const input: FireReadinessInput = { ...scenario.input };

        return {
            id: scenario.id,
            name: scenario.name,
            input,
            result: calculateFireReadiness(input)
        };
    });
}
