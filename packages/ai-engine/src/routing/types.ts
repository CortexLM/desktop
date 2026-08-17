/**
 * Core types for two-tier (three-lane) model routing.
 *
 * Rationale: reading code dominates token spend in a typical agent session. Most
 * of those turns are mechanical and do not need a frontier model, so routing them
 * to a cheaper model saves real money. The size of that saving depends entirely
 * on the configured price table and the traffic mix; on realistically mixed
 * tokens the lane gap is around ~8x rather than the order-of-magnitude figures
 * often quoted.
 */

/** Price lane a task can be executed on, cheapest first. */
export type ModelTier = 'cheap' | 'mid' | 'expensive';

/** Ordered tiers, cheapest first. Used for escalation walks. */
export const TIER_ORDER: readonly ModelTier[] = ['cheap', 'mid', 'expensive'] as const;

/** Difficulty bucket produced by classification. */
export type TaskComplexity = 'simple' | 'medium' | 'complex';

/**
 * Known task kinds. Callers may pass a kind explicitly when the orchestrator
 * already knows what it is doing; otherwise the classifier infers from text.
 */
export type TaskKind =
  // simple / mechanical
  | 'file-read'
  | 'syntax-check'
  | 'formatting'
  | 'lint-fix'
  | 'doc-lookup'
  | 'symbol-rename'
  | 'commit-message'
  // medium
  | 'bug-fix'
  | 'small-feature'
  | 'test-write'
  | 'code-review'
  | 'doc-write'
  // complex
  | 'architecture'
  | 'refactor'
  | 'debug-complex'
  | 'migration'
  | 'reasoning'
  | 'security-audit';

/** A unit of work to be routed. */
export interface Task {
  /** Stable id, used for cost attribution. */
  id: string;
  /** Natural-language description / prompt for the task. */
  prompt: string;
  /** Explicit kind, when the caller knows it. */
  kind?: TaskKind;
  /** Number of files the task is expected to touch or read. */
  fileCount?: number;
  /** Estimated input size in tokens. */
  estimatedTokens?: number;
  /** Caller-asserted need for multi-step reasoning. Forces complexity up. */
  requiresReasoning?: boolean;
  /** Never route below this tier (e.g. user pinned quality). */
  minTier?: ModelTier;
  /** Never route above this tier (e.g. hard budget cap). */
  maxTier?: ModelTier;
  /** Free-form metadata, carried through to cost records. */
  metadata?: Record<string, unknown>;
}

/** Price per million tokens. */
export interface TierPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

/** Concrete model bound to a tier. */
export interface TierModel {
  tier: ModelTier;
  provider: string;
  model: string;
  displayName: string;
  contextWindow: number;
  pricing: TierPricing;
}

/** Result of routing a task. */
export interface ModelChoice {
  tier: ModelTier;
  provider: string;
  model: string;
  pricing: TierPricing;
  contextWindow: number;
  complexity: TaskComplexity;
  /** 0-1 confidence in the classification that produced this choice. */
  confidence: number;
  /** Human-readable explanation, surfaced in the UI for transparency. */
  reason: string;
  /** 1 for the first attempt, incremented on each escalation. */
  attempt: number;
  /** True when this choice came from escalating a cheaper failed attempt. */
  escalated: boolean;
}

/** Why a tier attempt failed. Drives the escalate-or-retry decision. */
export type FailureKind =
  /** Output was wrong, incomplete, or off-task. */
  | 'incorrect-output'
  /** Downstream validation (tests, typecheck, lint) rejected the output. */
  | 'validation-failed'
  /** Model refused or produced no usable answer. */
  | 'refusal'
  /** Output was truncated or the model gave up mid-task. */
  | 'incomplete'
  /** Input did not fit the tier's context window. */
  | 'context-overflow'
  /** Transient infrastructure problem: retry same tier, do not escalate. */
  | 'transient'
  /** Provider/auth/config problem: neither retry nor escalate helps. */
  | 'provider-error';

/** Report of a failed attempt, fed back into the router. */
export interface TaskFailure {
  kind: FailureKind;
  tier: ModelTier;
  /** Optional detail for logs. */
  message?: string;
}
