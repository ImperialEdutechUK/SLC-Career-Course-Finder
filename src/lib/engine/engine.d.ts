/**
 * Type surface for the unmodified reference engine (reference-engine v0.2.0).
 * Declaring the contract here keeps the JavaScript module byte-identical to the
 * supplied reference implementation.
 */
export declare const ENGINE_VERSION: string;
export declare const WEIGHTS: Readonly<{
  category: number; goal: number; experience: number; workload: number; budget: number;
}>;
export declare const GENERAL_GOALS: readonly string[];

export declare function validateRule(rule: unknown): string[];
export declare function evaluateRule(
  rule: unknown,
  facts?: Record<string, unknown>
): { result: 'met' | 'not_met' | 'unknown'; checks: unknown[] };
export declare function evaluateEligibility(
  course: unknown,
  facts?: Record<string, unknown>
): { status: string; reason: string; checks: unknown[] };
export declare function recommend(
  request?: unknown,
  catalog?: unknown[],
  options?: unknown
): unknown;
