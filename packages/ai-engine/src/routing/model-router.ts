/**
 * ModelRouter - two-tier (three-lane) model routing.
 *
 * Usage:
 *   const router = new ModelRouter();
 *   const choice = router.route({ id: 't1', prompt: 'format this file' });
 *   // -> cheap lane (Gemini 3.7 Flash)
 *
 * Or let the router drive escalation and cost accounting:
 *   const result = await router.execute(task, async (choice) => {
 *     const res = await registry.getProvider(choice.provider)!.chat(messages, { model: choice.model });
 *     return { success: validate(res), value: res, usage: res.usage };
 *   });
 */

import { classifyTask, tierForComplexity } from './task-classifier';
import type { Classification } from './task-classifier';
import { CostTracker } from './cost-tracker';
import type { CostReport, CostSummary, TokenUsage } from './cost-tracker';
import { EscalationLearner } from './escalation';
import type { EscalationLearnerConfig } from './escalation';
import { clampTier, nextTier, resolveTierModels, tierIndex } from './model-tiers';
import type { FailureKind, ModelChoice, ModelTier, Task, TierModel, TierPricing } from './types';
import { TIER_ORDER } from './types';

export interface ModelRouterConfig {
  /** Override the model bound to any lane, or its pricing. */
  tiers?: Partial<Record<ModelTier, Partial<TierModel>>>;
  /** Never route below this lane. */
  minTier?: ModelTier;
  /** Never route above this lane. */
  maxTier?: ModelTier;
  /** Escalation learner tuning. */
  learning?: EscalationLearnerConfig;
  /** Disable the learned start-tier shift, using pure classification. */
  disableLearning?: boolean;
  /**
   * Fraction of tasks that probe one lane below their classified tier, to find
   * out whether the cheaper lane can cope. Defaults to 0.05.
   *
   * Without this the router can only ever learn to move *up*: it never sends a
   * "complex" task to the cheap lane, so it never learns that some of them would
   * have been fine there. Exploration is self-limiting — it stops once the
   * cheaper lane has enough samples — so the overhead is a one-off sampling cost
   * per task kind, not a permanent tax.
   *
   * Selection is a hash of the task id, not a coin flip, so `route` stays
   * deterministic: routing the same task twice always gives the same lane. Set
   * to 0 to disable exploration entirely.
   */
  explorationRate?: number;
  /**
   * Confidence below which the router adds a safety margin by starting one lane
   * higher than classification suggests. Defaults to 0.4.
   */
  lowConfidenceThreshold?: number;
  /** Retries allowed on the same lane for transient failures. Defaults to 1. */
  transientRetries?: number;
  /** Pricing to compare against in cost reports. Defaults to the expensive lane. */
  baselinePricing?: TierPricing;
}

/** Result of one executor invocation. */
export interface AttemptResult<T> {
  success: boolean;
  /** Payload on success. */
  value?: T;
  /** Tokens consumed by this attempt. Required for cost accounting. */
  usage: TokenUsage;
  /** Why it failed. Defaults to `incorrect-output` when `success` is false. */
  failureKind?: FailureKind;
  /** Optional detail for logs. */
  message?: string;
}

/** Outcome of a routed execution, including every attempt made. */
export interface RoutedResult<T> {
  success: boolean;
  value?: T;
  /** The choice that produced the final outcome. */
  choice: ModelChoice;
  /** Every choice tried, in order. */
  attempts: ModelChoice[];
  /** Actual USD spend across all attempts. */
  cost: number;
  /** USD the same token usage would have cost unrouted. */
  baselineCost: number;
  /** Failure kind of the last attempt, when unsuccessful. */
  failureKind?: FailureKind;
}

const DEFAULT_LOW_CONFIDENCE = 0.4;
const DEFAULT_EXPLORATION_RATE = 0.05;

/**
 * FNV-1a plus an avalanche finaliser, mapped to [0, 1). Used to sample a stable
 * share of task ids without a random source, which keeps `route` a pure function
 * of its input.
 *
 * The finaliser is not optional. FNV-1a alone is well distributed across
 * unrelated strings but barely moves for near-identical ones, so sequential ids
 * ("task-1", "task-2", ...) land in a narrow band — measured at 0.52-0.57, which
 * means a 5% sample rate never fires. Sequential ids are the common case here.
 */
function hashToUnitInterval(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // MurmurHash3 finaliser: spreads small input differences across all bits.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 0x100000000;
}

export class ModelRouter {
  private readonly models: Record<ModelTier, TierModel>;
  private readonly minTier: ModelTier;
  private readonly maxTier: ModelTier;
  private readonly learner: EscalationLearner;
  private readonly tracker: CostTracker;
  private readonly learningEnabled: boolean;
  private readonly lowConfidenceThreshold: number;
  private readonly transientRetries: number;
  private readonly explorationRate: number;
  /** Classification cache, keyed by task id, so escalation reuses the verdict. */
  private readonly classifications = new Map<string, Classification>();

  constructor(config: ModelRouterConfig = {}) {
    this.models = resolveTierModels(config.tiers);
    this.minTier = config.minTier ?? 'cheap';
    this.maxTier = config.maxTier ?? 'expensive';
    this.learner = new EscalationLearner(config.learning);
    this.tracker = new CostTracker(this.models, config.baselinePricing);
    this.learningEnabled = !config.disableLearning;
    this.lowConfidenceThreshold = config.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE;
    this.transientRetries = Math.max(0, config.transientRetries ?? 1);
    this.explorationRate = Math.min(1, Math.max(0, config.explorationRate ?? DEFAULT_EXPLORATION_RATE));
  }

  /** The configured lane -> model table. */
  getTierModels(): Record<ModelTier, TierModel> {
    return this.models;
  }

  /** Underlying learner, for persistence via `export`/`import`. */
  getLearner(): EscalationLearner {
    return this.learner;
  }

  /** Underlying cost tracker. */
  getCostTracker(): CostTracker {
    return this.tracker;
  }

  /**
   * Pick a lane for a task. Deterministic given the task and current learned
   * state; does not mutate cost or learning statistics.
   */
  route(task: Task): ModelChoice {
    const classification = this.classify(task);
    const reasons: string[] = [...classification.signals];

    const baseline = tierForComplexity(classification.complexity);
    let tier = baseline;

    // Low-confidence guard: an unrecognised task starting on the cheap lane is
    // a coin flip, and a wasted cheap attempt plus escalation costs more than
    // starting one lane up.
    if (classification.confidence < this.lowConfidenceThreshold) {
      const safer = nextTier(tier);
      if (safer) {
        tier = safer;
        reasons.push(`low confidence (${classification.confidence.toFixed(2)}) -> start at ${tier}`);
      }
    }

    const window = this.tierWindow(task);

    // Learned adjustment from observed success rates.
    if (this.learningEnabled) {
      const recommendation = this.learner.recommendStartTier(
        tier,
        this.models,
        classification.kind,
        classification.complexity,
        window.min,
        window.max
      );
      if (recommendation.tier !== tier && recommendation.reason) {
        tier = recommendation.tier;
        reasons.push(recommendation.reason);
      }

      // Probe the lane below to find out whether it can cope. Only worth doing
      // while that lane is still unmeasured for this task kind.
      const probe = this.explorationProbe(task, tier, classification, window);
      if (probe) {
        tier = probe;
        reasons.push(`exploring ${probe} to measure whether it can handle this task kind`);
      }
    }

    // Caller and router bounds.
    const bounded = clampTier(tier, window.min, window.max);
    if (bounded !== tier) {
      reasons.push(`clamped to ${bounded} by tier bounds`);
      tier = bounded;
    }

    // Context-window fit. The cheap lane has the largest window here, so a very
    // large task may only fit on a cheaper lane.
    const fitted = this.fitContext(tier, task, window);
    if (fitted.tier !== tier) {
      reasons.push(fitted.reason);
      tier = fitted.tier;
    }

    return this.buildChoice(tier, classification, reasons.join('; '), 1, false);
  }

  /**
   * Next lane to try after a failure, or `undefined` when escalation is not
   * warranted (fatal error, already at the top, or escalation budget spent).
   */
  escalate(task: Task, previous: ModelChoice, failureKind: FailureKind): ModelChoice | undefined {
    if (!this.learner.shouldEscalate(failureKind)) {
      return undefined;
    }

    const escalationsSoFar = previous.attempt - 1;
    if (escalationsSoFar >= this.learner.maxEscalations) {
      return undefined;
    }

    const window = this.tierWindow(task);
    const candidate = nextTier(previous.tier);
    if (!candidate || tierIndex(candidate) > tierIndex(window.max)) {
      return undefined;
    }

    const classification = this.classify(task);

    // Context overflow on a smaller-window lane cannot be fixed by moving to an
    // even smaller window.
    if (failureKind === 'context-overflow') {
      const fits = this.firstFittingTier(task, candidate, window.max);
      if (!fits) return undefined;
      return this.buildChoice(
        fits,
        classification,
        `escalated from ${previous.tier} after context overflow; ${fits} fits the estimated input`,
        previous.attempt + 1,
        true
      );
    }

    return this.buildChoice(
      candidate,
      classification,
      `escalated from ${previous.tier} after ${failureKind}`,
      previous.attempt + 1,
      true
    );
  }

  /**
   * Record the outcome of an attempt. Updates both the learner and the cost
   * ledger. Call this for every attempt, successful or not.
   */
  recordOutcome(
    task: Task,
    choice: ModelChoice,
    outcome: { succeeded: boolean; usage: TokenUsage; failureKind?: FailureKind }
  ): void {
    const classification = this.classify(task);

    // Infrastructure failures say nothing about model capability.
    const isCapabilitySignal =
      outcome.succeeded ||
      (outcome.failureKind !== 'transient' && outcome.failureKind !== 'provider-error');

    if (isCapabilitySignal) {
      this.learner.record({
        tier: choice.tier,
        succeeded: outcome.succeeded,
        kind: classification.kind,
        complexity: classification.complexity,
        failureKind: outcome.failureKind,
      });
    }

    this.tracker.record({
      taskId: task.id,
      tier: choice.tier,
      provider: choice.provider,
      model: choice.model,
      pricing: choice.pricing,
      kind: classification.kind,
      complexity: classification.complexity,
      attempt: choice.attempt,
      escalated: choice.escalated,
      succeeded: outcome.succeeded,
      usage: outcome.usage,
    });
  }

  /**
   * Route, execute, and escalate automatically.
   *
   * `executor` runs the task on the given lane and reports success plus token
   * usage. Transient failures are retried on the same lane; capability failures
   * escalate; fatal provider errors stop immediately.
   */
  async execute<T>(
    task: Task,
    executor: (choice: ModelChoice) => Promise<AttemptResult<T>>
  ): Promise<RoutedResult<T>> {
    const attempts: ModelChoice[] = [];
    let choice = this.route(task);
    let transientRetriesLeft = this.transientRetries;
    let cost = 0;
    let baselineCost = 0;
    let lastFailure: FailureKind | undefined;

    // Bounded: every iteration either succeeds, escalates (at most
    // maxEscalations times), consumes a transient retry, or returns.
    for (;;) {
      attempts.push(choice);
      const result = await executor(choice);
      const failureKind: FailureKind | undefined = result.success
        ? undefined
        : (result.failureKind ?? 'incorrect-output');

      this.recordOutcome(task, choice, {
        succeeded: result.success,
        usage: result.usage,
        failureKind,
      });

      const records = this.tracker.getRecords();
      const record = records[records.length - 1];
      if (record) {
        cost += record.cost;
        baselineCost += record.baselineCost;
      }

      if (result.success) {
        return { success: true, value: result.value, choice, attempts, cost, baselineCost };
      }

      lastFailure = failureKind;

      // Fatal: config/auth problems are not solved by another model.
      if (failureKind === 'provider-error') {
        break;
      }

      // Transient: same lane, if budget remains.
      if (failureKind && this.learner.shouldRetrySameTier(failureKind) && transientRetriesLeft > 0) {
        transientRetriesLeft -= 1;
        continue;
      }

      const escalated = failureKind ? this.escalate(task, choice, failureKind) : undefined;
      if (!escalated) {
        break;
      }
      choice = escalated;
    }

    return {
      success: false,
      choice,
      attempts,
      cost,
      baselineCost,
      failureKind: lastFailure,
    };
  }

  /** Aggregate cost figures. */
  getCostSummary(): CostSummary {
    return this.tracker.getSummary();
  }

  /** Cost report sliced by kind, complexity, and tier. */
  getCostReport(): CostReport {
    return this.tracker.getReport();
  }

  /** Human-readable cost report. */
  formatCostReport(): string {
    return this.tracker.formatReport();
  }

  /** Clear cost records, learned statistics, and cached classifications. */
  reset(): void {
    this.tracker.reset();
    this.learner.reset();
    this.classifications.clear();
  }

  // --- internals ---

  private classify(task: Task): Classification {
    const cached = this.classifications.get(task.id);
    if (cached) return cached;

    const classification = classifyTask(task);
    this.classifications.set(task.id, classification);
    return classification;
  }

  /**
   * Decide whether to probe one lane below `tier`, returning that lane if so.
   *
   * Skipped when exploration is off, when the task is already at the floor of
   * its window, when the lane below is already measured (nothing left to
   * learn), or when classification was too unsure to risk it — a low-confidence
   * task already received a safety bump, and probing down would undo it.
   */
  private explorationProbe(
    task: Task,
    tier: ModelTier,
    classification: Classification,
    window: { min: ModelTier; max: ModelTier }
  ): ModelTier | undefined {
    if (this.explorationRate <= 0) return undefined;
    if (classification.confidence < this.lowConfidenceThreshold) return undefined;

    const belowIndex = tierIndex(tier) - 1;
    if (belowIndex < tierIndex(window.min)) return undefined;

    const below = TIER_ORDER[belowIndex]!;
    if (this.learner.hasEvidence(below, classification.kind, classification.complexity)) {
      return undefined;
    }

    if (hashToUnitInterval(task.id) >= this.explorationRate) return undefined;

    return below;
  }

  private tierWindow(task: Task): { min: ModelTier; max: ModelTier } {
    const min = task.minTier
      ? TIER_ORDER[Math.max(tierIndex(this.minTier), tierIndex(task.minTier))]!
      : this.minTier;
    const max = task.maxTier
      ? TIER_ORDER[Math.min(tierIndex(this.maxTier), tierIndex(task.maxTier))]!
      : this.maxTier;

    // A caller-supplied minTier above maxTier collapses to maxTier.
    return tierIndex(min) > tierIndex(max) ? { min: max, max } : { min, max };
  }

  private fitsContext(tier: ModelTier, task: Task): boolean {
    const estimated = task.estimatedTokens ?? 0;
    if (estimated === 0) return true;
    return estimated <= this.models[tier].contextWindow;
  }

  private firstFittingTier(task: Task, from: ModelTier, max: ModelTier): ModelTier | undefined {
    for (let i = tierIndex(from); i <= tierIndex(max); i++) {
      const candidate = TIER_ORDER[i]!;
      if (this.fitsContext(candidate, task)) return candidate;
    }
    return undefined;
  }

  private fitContext(
    tier: ModelTier,
    task: Task,
    window: { min: ModelTier; max: ModelTier }
  ): { tier: ModelTier; reason: string } {
    if (this.fitsContext(tier, task)) {
      return { tier, reason: '' };
    }

    // Search the whole allowed window for a lane that can hold the input,
    // preferring the cheapest such lane.
    for (let i = tierIndex(window.min); i <= tierIndex(window.max); i++) {
      const candidate = TIER_ORDER[i]!;
      if (this.fitsContext(candidate, task)) {
        return {
          tier: candidate,
          reason: `~${task.estimatedTokens} tokens exceed ${tier} context window, using ${candidate}`,
        };
      }
    }

    return {
      tier,
      reason: `~${task.estimatedTokens} tokens exceed every available context window, keeping ${tier}`,
    };
  }

  private buildChoice(
    tier: ModelTier,
    classification: Classification,
    reason: string,
    attempt: number,
    escalated: boolean
  ): ModelChoice {
    const model = this.models[tier];
    return {
      tier,
      provider: model.provider,
      model: model.model,
      pricing: model.pricing,
      contextWindow: model.contextWindow,
      complexity: classification.complexity,
      confidence: classification.confidence,
      reason,
      attempt,
      escalated,
    };
  }
}
