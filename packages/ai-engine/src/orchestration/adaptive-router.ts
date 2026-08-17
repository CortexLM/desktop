/**
 * AdaptiveRouter - infrastructure-conditioned provider selection.
 *
 * Scores every registered provider against the live InfrastructureSnapshot and
 * the caller's SLA targets, then picks the best eligible one. Saturated, open-
 * circuit and rate-limited providers are filtered out rather than penalised, so
 * routing never sends work into a wall.
 */

import type { CircuitBreakerRegistry } from './circuit-breaker';
import type { InfrastructureMonitor } from './infrastructure-monitor';
import {
  DEFAULT_SLA,
  type InfrastructureSnapshot,
  type ProviderId,
  type ProviderScore,
  type ProviderSignals,
  type RoutingDecision,
  type RoutingRequest,
  type SLAObjective,
  type SLATargets,
} from './types';

/** Relative weights per score component. Each set sums to 1. */
export interface ScoreWeights {
  latency: number;
  cost: number;
  load: number;
  reliability: number;
  cacheAffinity: number;
  quality: number;
}

/** Weight profiles per SLA objective. */
export const OBJECTIVE_WEIGHTS: Record<SLAObjective, ScoreWeights> = {
  latency: {
    latency: 0.45,
    cost: 0.05,
    load: 0.25,
    reliability: 0.15,
    cacheAffinity: 0.05,
    quality: 0.05,
  },
  cost: {
    latency: 0.1,
    cost: 0.5,
    load: 0.1,
    reliability: 0.15,
    cacheAffinity: 0.1,
    quality: 0.05,
  },
  balanced: {
    latency: 0.25,
    cost: 0.25,
    load: 0.2,
    reliability: 0.2,
    cacheAffinity: 0.05,
    quality: 0.05,
  },
  quality: {
    latency: 0.1,
    cost: 0.1,
    load: 0.15,
    reliability: 0.25,
    cacheAffinity: 0.05,
    quality: 0.35,
  },
};

export interface RouterConfig {
  /** Default SLA applied when a request omits one. */
  defaultSla?: SLATargets;
  /**
   * Queue saturation above which a provider is skipped entirely.
   * Prevents piling onto an already-full provider.
   */
  saturationCutoff?: number;
  /** Rate-limit utilisation above which a provider is skipped. */
  rateLimitCutoff?: number;
  /** Weight overrides merged onto the objective profile. */
  weights?: Partial<Record<SLAObjective, Partial<ScoreWeights>>>;
}

const ROUTER_DEFAULTS = {
  saturationCutoff: 0.95,
  rateLimitCutoff: 0.95,
} as const;

export class AdaptiveRouter {
  private readonly monitor: InfrastructureMonitor;
  private readonly breakers?: CircuitBreakerRegistry;
  private readonly config: Required<Omit<RouterConfig, 'weights'>> &
    Pick<RouterConfig, 'weights'>;
  /** Providers whose prefix is currently warm, per cache key. */
  private readonly cacheAffinity = new Map<string, Set<ProviderId>>();

  constructor(
    monitor: InfrastructureMonitor,
    config: RouterConfig = {},
    breakers?: CircuitBreakerRegistry
  ) {
    this.monitor = monitor;
    this.breakers = breakers;
    this.config = {
      defaultSla: config.defaultSla ?? DEFAULT_SLA,
      saturationCutoff: config.saturationCutoff ?? ROUTER_DEFAULTS.saturationCutoff,
      rateLimitCutoff: config.rateLimitCutoff ?? ROUTER_DEFAULTS.rateLimitCutoff,
      weights: config.weights,
    };
  }

  /**
   * Selects the best provider for a request given current infrastructure state.
   * Pass a snapshot to score several requests against one consistent
   * observation; omit it to take a fresh reading.
   */
  route(request: RoutingRequest, snapshot?: InfrastructureSnapshot): RoutingDecision {
    const state = snapshot ?? this.monitor.getSnapshot();
    const sla = { ...this.config.defaultSla, ...request.sla };
    const weights = this.weightsFor(sla.objective);

    const candidates = this.candidateIds(request, state);
    if (candidates.length === 0) {
      return {
        providerId: null,
        alternatives: [],
        reason: 'no providers registered or all excluded by request filters',
        scores: [],
        slaAtRisk: true,
      };
    }

    // Cost and latency components are relative, so establish the range first.
    const projections = candidates.map((providerId) => {
      const signals = state.providers[providerId]!;
      return {
        providerId,
        signals,
        latencyMs: this.projectLatency(signals, request),
        costUsd: this.monitor.projectCost(
          providerId,
          request.estimatedInputTokens,
          request.estimatedOutputTokens
        ),
      };
    });

    const maxLatency = Math.max(...projections.map((p) => p.latencyMs), 1);
    const maxCost = Math.max(...projections.map((p) => p.costUsd), Number.EPSILON);

    const scores: ProviderScore[] = projections.map((projection) => {
      const { providerId, signals, latencyMs, costUsd } = projection;
      const ineligibleReason = this.ineligibilityReason(signals, state, sla, costUsd);

      const components = {
        // Lower is better for latency and cost, so invert against the range.
        latency: 1 - latencyMs / maxLatency,
        cost: 1 - costUsd / maxCost,
        load: 1 - signals.queue.saturation,
        reliability: this.reliabilityComponent(signals),
        cacheAffinity: this.cacheAffinityComponent(providerId, request.cacheKey, signals),
        quality: signals.capacity.qualityScore ?? 0.5,
      };

      const score =
        components.latency * weights.latency +
        components.cost * weights.cost +
        components.load * weights.load +
        components.reliability * weights.reliability +
        components.cacheAffinity * weights.cacheAffinity +
        components.quality * weights.quality;

      return {
        providerId,
        score: ineligibleReason ? -1 : score,
        components,
        projectedLatencyMs: latencyMs,
        projectedCostUsd: costUsd,
        ineligibleReason,
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const eligible = scores.filter((entry) => !entry.ineligibleReason);

    if (eligible.length === 0) {
      return {
        providerId: null,
        alternatives: [],
        reason: `all ${scores.length} candidate(s) ineligible: ${summarise(scores)}`,
        scores,
        slaAtRisk: true,
      };
    }

    const winner = eligible[0]!;
    return {
      providerId: winner.providerId,
      alternatives: eligible.slice(1).map((entry) => entry.providerId),
      reason: this.explain(winner, sla, state),
      scores,
      projectedLatencyMs: winner.projectedLatencyMs,
      projectedCostUsd: winner.projectedCostUsd,
      slaAtRisk: this.missesSla(winner, sla),
    };
  }

  /**
   * Picks the next provider after a failure, excluding everything already
   * attempted. Used for mid-task failover.
   */
  reroute(
    request: RoutingRequest,
    attempted: ProviderId[],
    snapshot?: InfrastructureSnapshot
  ): RoutingDecision {
    return this.route(
      { ...request, exclude: [...(request.exclude ?? []), ...attempted] },
      snapshot
    );
  }

  /** Marks a provider as holding a warm cache for the given key. */
  recordCacheAffinity(cacheKey: string, providerId: ProviderId): void {
    let set = this.cacheAffinity.get(cacheKey);
    if (!set) {
      set = new Set();
      this.cacheAffinity.set(cacheKey, set);
    }
    set.add(providerId);
  }

  /** Forgets cache affinity for one key, or all keys when omitted. */
  clearCacheAffinity(cacheKey?: string): void {
    if (cacheKey === undefined) {
      this.cacheAffinity.clear();
    } else {
      this.cacheAffinity.delete(cacheKey);
    }
  }

  private candidateIds(
    request: RoutingRequest,
    state: InfrastructureSnapshot
  ): ProviderId[] {
    const excluded = new Set(request.exclude ?? []);
    const allowed = request.restrictTo ? new Set(request.restrictTo) : undefined;

    return Object.keys(state.providers).filter((providerId) => {
      if (excluded.has(providerId)) return false;
      if (allowed && !allowed.has(providerId)) return false;
      return true;
    });
  }

  /**
   * Expected end-to-end latency: queue wait plus service time. Queue wait is
   * estimated from depth divided by concurrency, times service time.
   */
  private projectLatency(signals: ProviderSignals, request: RoutingRequest): number {
    const serviceMs = Math.max(signals.latency.emaMs, signals.latency.p50Ms || 0) || 1;
    const waves = Math.floor(
      (signals.queue.inFlight + signals.queue.queued) / signals.capacity.maxConcurrency
    );
    const queueWaitMs = waves * serviceMs;

    // A warm prefix skips prefill on the cached portion.
    const cacheDiscount = this.isCacheWarm(signals.providerId, request.cacheKey) ? 0.7 : 1;
    return (serviceMs + queueWaitMs) * cacheDiscount;
  }

  private reliabilityComponent(signals: ProviderSignals): number {
    const successRate = 1 - signals.reliability.errorRate;
    const healthPenalty =
      signals.health === 'healthy'
        ? 0
        : signals.health === 'degraded'
          ? 0.3
          : signals.health === 'saturated'
            ? 0.5
            : 1;
    return Math.max(0, successRate - healthPenalty);
  }

  private cacheAffinityComponent(
    providerId: ProviderId,
    cacheKey: string | undefined,
    signals: ProviderSignals
  ): number {
    if (this.isCacheWarm(providerId, cacheKey)) return 1;
    // Fall back to the provider's historical hit rate, discounted by pressure.
    return signals.cache.hitRate * (1 - signals.cache.pressure);
  }

  private isCacheWarm(providerId: ProviderId, cacheKey?: string): boolean {
    if (!cacheKey) return false;
    return this.cacheAffinity.get(cacheKey)?.has(providerId) ?? false;
  }

  /** Returns a reason string when a provider must not be selected. */
  private ineligibilityReason(
    signals: ProviderSignals,
    state: InfrastructureSnapshot,
    sla: SLATargets,
    costUsd: number
  ): string | undefined {
    if (this.breakers && !this.breakers.canRequest(signals.providerId)) {
      return 'circuit open';
    }
    if (signals.health === 'down') {
      return 'provider down';
    }
    if (signals.rateLimit.retryAfterMs !== undefined) {
      return `rate limited for ${signals.rateLimit.retryAfterMs}ms`;
    }
    if (signals.queue.saturation >= this.config.saturationCutoff) {
      return `queue saturated (${signals.queue.saturation.toFixed(2)})`;
    }
    if (signals.rateLimit.utilization >= this.config.rateLimitCutoff) {
      return `rate limit nearly exhausted (${signals.rateLimit.utilization.toFixed(2)})`;
    }
    if (
      sla.minSuccessRate !== undefined &&
      signals.reliability.errorRate > 1 - sla.minSuccessRate &&
      // Only enforce once there is enough evidence to trust the rate.
      signals.reliability.successes + signals.reliability.failures >= 5
    ) {
      return `success rate below SLA (${(1 - signals.reliability.errorRate).toFixed(2)})`;
    }
    if (
      sla.maxCostPerTaskUsd !== undefined &&
      costUsd > sla.maxCostPerTaskUsd &&
      // Only bind when a cheaper option exists; otherwise something must run.
      this.hasCheaperOption(signals.providerId, state, sla.maxCostPerTaskUsd, costUsd)
    ) {
      return `projected cost $${costUsd.toFixed(4)} exceeds per-task budget`;
    }
    if (state.budget.exhausted && (signals.capacity.inputCostPerMillion ?? 0) > 0) {
      return 'global budget exhausted';
    }
    return undefined;
  }

  private hasCheaperOption(
    providerId: ProviderId,
    state: InfrastructureSnapshot,
    maxCostUsd: number,
    currentCostUsd: number
  ): boolean {
    for (const candidate of Object.values(state.providers)) {
      if (candidate.providerId === providerId) continue;
      if (candidate.health === 'down') continue;
      const rate =
        (candidate.capacity.inputCostPerMillion ?? 0) +
        (candidate.capacity.outputCostPerMillion ?? 0);
      // A zero-rate provider (e.g. local Ollama) is always cheaper.
      if (rate === 0) return true;
      if (currentCostUsd > maxCostUsd && rate < currentCostUsd) return true;
    }
    return false;
  }

  private missesSla(score: ProviderScore, sla: SLATargets): boolean {
    if (sla.maxLatencyMs !== undefined && score.projectedLatencyMs > sla.maxLatencyMs) {
      return true;
    }
    if (
      sla.maxCostPerTaskUsd !== undefined &&
      score.projectedCostUsd > sla.maxCostPerTaskUsd
    ) {
      return true;
    }
    return false;
  }

  private explain(
    score: ProviderScore,
    sla: SLATargets,
    state: InfrastructureSnapshot
  ): string {
    const parts = [
      `objective=${sla.objective}`,
      `latency~${Math.round(score.projectedLatencyMs)}ms`,
      `cost~$${score.projectedCostUsd.toFixed(4)}`,
      `load=${(1 - score.components.load).toFixed(2)}`,
      `congestion=${state.congestion.toFixed(2)}`,
    ];
    if (score.components.cacheAffinity >= 1) {
      parts.push('cache warm');
    }
    return `selected ${score.providerId} (${parts.join(', ')})`;
  }

  private weightsFor(objective: SLAObjective): ScoreWeights {
    const base = OBJECTIVE_WEIGHTS[objective];
    const overrides = this.config.weights?.[objective];
    return overrides ? { ...base, ...overrides } : base;
  }
}

function summarise(scores: ProviderScore[]): string {
  return scores
    .map((entry) => `${entry.providerId}: ${entry.ineligibleReason ?? 'eligible'}`)
    .join('; ');
}
