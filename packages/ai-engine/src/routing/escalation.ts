/**
 * Escalation policy + online learning.
 *
 * The router starts cheap and escalates on failure. This module learns
 * per-(kind, tier) success rates from observed outcomes and starts at the lane
 * with the lowest expected total cost.
 *
 * Expected cost of starting at tier i, given per-tier success probability p_i:
 *   E[i] = c_i + (1 - p_i) * (w + E[i+1])
 * with E[last] = c_last, and the learner picking argmin over the allowed window.
 *
 * The `w` term matters. Without it, token math alone always says "start cheap":
 * whenever the lane gap is large, a cheap attempt plus a mid attempt still costs
 * a fraction of one top-lane call, so even a 5%-success lane looks optimal. That
 * ignores what a wasted attempt actually costs — latency, burned tool calls,
 * and the risk of a wrong answer reaching the user. `w` prices that in as a
 * fraction of a top-lane call, which is what makes the learned signal able to
 * move the starting lane at all. Set `failurePenalty: 0` for pure token
 * economics.
 */

import { blendedCostPerMillion, tierIndex } from './model-tiers';
import type { FailureKind, ModelTier, TaskComplexity, TaskKind, TierModel } from './types';
import { TIER_ORDER } from './types';

/** Observed result of one attempt at one tier. */
export interface AttemptOutcome {
  tier: ModelTier;
  succeeded: boolean;
  /** Kind the task was classified as, used as the learning key. */
  kind?: TaskKind;
  complexity: TaskComplexity;
  failureKind?: FailureKind;
}

/** Success statistics for one (key, tier) pair. */
export interface TierStats {
  attempts: number;
  successes: number;
  /** Smoothed success rate. */
  successRate: number;
}

/**
 * Failures that mean "this tier is not smart enough" and therefore justify
 * moving up. Everything else is either retryable at the same tier or fatal.
 */
const ESCALATABLE: ReadonlySet<FailureKind> = new Set<FailureKind>([
  'incorrect-output',
  'validation-failed',
  'refusal',
  'incomplete',
  'context-overflow',
]);

/** Failures that should be retried on the same tier rather than escalated. */
const RETRYABLE_SAME_TIER: ReadonlySet<FailureKind> = new Set<FailureKind>(['transient']);

export interface EscalationLearnerConfig {
  /**
   * Laplace prior. `priorSuccesses` / (`priorSuccesses` + `priorFailures`) is
   * the assumed success rate before any evidence, and the total acts as the
   * strength of that prior.
   */
  priorSuccesses?: number;
  priorFailures?: number;
  /** Attempts required at a tier before its learned rate overrides the prior. */
  minSamples?: number;
  /** Hard ceiling on escalation steps per task. */
  maxEscalations?: number;
  /**
   * Cost of a wasted attempt, as a fraction of one top-lane call. Covers the
   * latency and rework a failed attempt causes beyond its token bill. Defaults
   * to 0.5; set to 0 to optimize purely on tokens.
   */
  failurePenalty?: number;
}

const DEFAULTS: Required<EscalationLearnerConfig> = {
  // Optimistic prior: assume the cheap lane works ~75% of the time, which is
  // what the two-tier literature reports for mechanical work.
  priorSuccesses: 3,
  priorFailures: 1,
  minSamples: 5,
  maxEscalations: 2,
  failurePenalty: 0.5,
};

function statsKey(kind: TaskKind | undefined, complexity: TaskComplexity): string {
  return kind ?? `complexity:${complexity}`;
}

export class EscalationLearner {
  private readonly config: Required<EscalationLearnerConfig>;
  /** key -> tier -> raw counts. */
  private readonly counts = new Map<string, Map<ModelTier, { attempts: number; successes: number }>>();

  constructor(config: EscalationLearnerConfig = {}) {
    this.config = { ...DEFAULTS, ...config };
  }

  get maxEscalations(): number {
    return this.config.maxEscalations;
  }

  /** Record the outcome of one attempt. */
  record(outcome: AttemptOutcome): void {
    const key = statsKey(outcome.kind, outcome.complexity);
    let perTier = this.counts.get(key);
    if (!perTier) {
      perTier = new Map();
      this.counts.set(key, perTier);
    }

    const entry = perTier.get(outcome.tier) ?? { attempts: 0, successes: 0 };
    entry.attempts += 1;
    if (outcome.succeeded) entry.successes += 1;
    perTier.set(outcome.tier, entry);
  }

  /** Smoothed success rate for a (key, tier) pair. */
  successRate(tier: ModelTier, kind: TaskKind | undefined, complexity: TaskComplexity): number {
    const entry = this.counts.get(statsKey(kind, complexity))?.get(tier);
    const { priorSuccesses, priorFailures } = this.config;

    if (!entry) {
      return priorSuccesses / (priorSuccesses + priorFailures);
    }

    return (entry.successes + priorSuccesses) / (entry.attempts + priorSuccesses + priorFailures);
  }

  /** Full stats for a (key, tier) pair. */
  stats(tier: ModelTier, kind: TaskKind | undefined, complexity: TaskComplexity): TierStats {
    const entry = this.counts.get(statsKey(kind, complexity))?.get(tier) ?? { attempts: 0, successes: 0 };
    return {
      attempts: entry.attempts,
      successes: entry.successes,
      successRate: this.successRate(tier, kind, complexity),
    };
  }

  /** True once a tier has enough observations to trust its learned rate. */
  hasEvidence(tier: ModelTier, kind: TaskKind | undefined, complexity: TaskComplexity): boolean {
    const entry = this.counts.get(statsKey(kind, complexity))?.get(tier);
    return (entry?.attempts ?? 0) >= this.config.minSamples;
  }

  /**
   * Expected total cost (per 1M tokens, blended) of starting at `tier` and
   * escalating on failure up to `maxTier`, including the failure penalty.
   */
  expectedCost(
    tier: ModelTier,
    maxTier: ModelTier,
    models: Record<ModelTier, TierModel>,
    kind: TaskKind | undefined,
    complexity: TaskComplexity
  ): number {
    const start = tierIndex(tier);
    const end = tierIndex(maxTier);
    const topCost = blendedCostPerMillion(models[TIER_ORDER[end]!].pricing);

    if (start >= end) {
      return blendedCostPerMillion(models[maxTier].pricing);
    }

    const penalty = this.config.failurePenalty * topCost;

    // Walk backwards: E[i] = c_i + (1 - p_i) * (penalty + E[i+1]).
    let expected = topCost;
    for (let i = end - 1; i >= start; i--) {
      const current = TIER_ORDER[i]!;
      const cost = blendedCostPerMillion(models[current].pricing);
      const p = this.successRate(current, kind, complexity);
      expected = cost + (1 - p) * (penalty + expected);
    }

    return expected;
  }

  /**
   * Cheapest lane to start from, by expected total cost, within [minTier, maxTier].
   * Returns the lane and a short justification.
   *
   * Evidence requirements are deliberately asymmetric:
   *
   * - Moving **up** needs evidence that the current lane fails. A lane that
   *   keeps missing is reason enough to stop paying for a doomed first attempt.
   * - Moving **down** needs evidence that the cheaper lane *succeeds*. A
   *   well-behaved expensive lane says nothing about whether a cheaper one
   *   could have done the job.
   *
   * Without the second rule the uniform prior recommends the cheap lane for
   * everything: whenever the lane gap is wide, an untested cheap attempt always
   * looks like a good bet on paper. Classification stays in charge until
   * measurements disagree with it.
   */
  recommendStartTier(
    baselineTier: ModelTier,
    models: Record<ModelTier, TierModel>,
    kind: TaskKind | undefined,
    complexity: TaskComplexity,
    minTier: ModelTier = 'cheap',
    maxTier: ModelTier = 'expensive'
  ): { tier: ModelTier; reason?: string } {
    const minIndex = tierIndex(minTier);
    const maxIndex = tierIndex(maxTier);

    const baselineIndex = tierIndex(baselineTier);
    const baselineHasEvidence = this.hasEvidence(baselineTier, kind, complexity);

    let bestTier = baselineTier;
    let bestCost = this.expectedCost(baselineTier, maxTier, models, kind, complexity);

    for (let i = minIndex; i <= maxIndex; i++) {
      const candidate = TIER_ORDER[i]!;
      if (candidate === baselineTier) continue;

      // Downshifts must be earned by the cheaper lane itself; upshifts may be
      // justified by the baseline lane failing.
      const allowed =
        i < baselineIndex
          ? this.hasEvidence(candidate, kind, complexity)
          : baselineHasEvidence || this.hasEvidence(candidate, kind, complexity);
      if (!allowed) continue;

      const cost = this.expectedCost(candidate, maxTier, models, kind, complexity);
      if (cost < bestCost) {
        bestCost = cost;
        bestTier = candidate;
      }
    }

    if (bestTier === baselineTier) {
      return { tier: bestTier };
    }

    // Justify with whichever side actually carries the evidence.
    const baselineStats = this.stats(baselineTier, kind, complexity);
    const chosenStats = this.stats(bestTier, kind, complexity);
    const shiftingUp = tierIndex(bestTier) > tierIndex(baselineTier);
    const evidence =
      baselineStats.attempts > 0
        ? `${baselineTier} success rate ${(baselineStats.successRate * 100).toFixed(0)}% ` +
          `over ${baselineStats.attempts} attempt${baselineStats.attempts === 1 ? '' : 's'}`
        : `${bestTier} success rate ${(chosenStats.successRate * 100).toFixed(0)}% ` +
          `over ${chosenStats.attempts} attempt${chosenStats.attempts === 1 ? '' : 's'}`;

    return {
      tier: bestTier,
      reason:
        `learned ${shiftingUp ? 'up' : 'down'}shift from ${baselineTier} to ${bestTier}: ` +
        `${evidence} makes starting at ${bestTier} cheaper overall`,
    };
  }

  /** Whether a failure justifies moving up a lane. */
  shouldEscalate(failureKind: FailureKind): boolean {
    return ESCALATABLE.has(failureKind);
  }

  /** Whether a failure should be retried on the same lane. */
  shouldRetrySameTier(failureKind: FailureKind): boolean {
    return RETRYABLE_SAME_TIER.has(failureKind);
  }

  /** Snapshot of everything learned so far, for persistence or debugging. */
  export(): Record<string, Partial<Record<ModelTier, TierStats>>> {
    const out: Record<string, Partial<Record<ModelTier, TierStats>>> = {};

    for (const [key, perTier] of this.counts) {
      const entry: Partial<Record<ModelTier, TierStats>> = {};
      for (const [tier, counts] of perTier) {
        entry[tier] = {
          attempts: counts.attempts,
          successes: counts.successes,
          successRate:
            (counts.successes + this.config.priorSuccesses) /
            (counts.attempts + this.config.priorSuccesses + this.config.priorFailures),
        };
      }
      out[key] = entry;
    }

    return out;
  }

  /** Restore a snapshot produced by `export`. */
  import(snapshot: Record<string, Partial<Record<ModelTier, TierStats>>>): void {
    for (const [key, perTier] of Object.entries(snapshot)) {
      const map = new Map<ModelTier, { attempts: number; successes: number }>();
      for (const tier of TIER_ORDER) {
        const stats = perTier[tier];
        if (stats) {
          map.set(tier, { attempts: stats.attempts, successes: stats.successes });
        }
      }
      this.counts.set(key, map);
    }
  }

  /** Drop all learned statistics. */
  reset(): void {
    this.counts.clear();
  }
}
