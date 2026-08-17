/**
 * InfrastructureMonitor - real-time infrastructure signal collection.
 *
 * Tracks, per provider: queue depth, API latency, KV-cache state, rate-limit
 * headroom and cost. Exposes an InfrastructureSnapshot that routing and
 * scheduling decisions condition on (INFRAMIND pattern, arXiv:2606.11440).
 *
 * All time-dependent behaviour goes through an injectable Clock so the monitor
 * is deterministic under test.
 */

import {
  type BudgetState,
  type CacheState,
  type Clock,
  type CostState,
  type InfrastructureSnapshot,
  type LatencyStats,
  type ProviderCapacity,
  type ProviderHealth,
  type ProviderId,
  type ProviderSignals,
  type QueueState,
  type RateLimitState,
  type ReliabilityState,
  type RequestUsage,
  systemClock,
} from './types';

/** Tunables for signal aggregation. */
export interface MonitorConfig {
  /** Trailing window for rate-limit and error-rate accounting, in ms. */
  windowMs?: number;
  /** EMA smoothing factor in (0, 1]; higher reacts faster. */
  latencyEmaAlpha?: number;
  /** Max latency samples retained for percentile estimation. */
  latencySampleSize?: number;
  /** Global spend ceiling in USD. */
  budgetLimitUsd?: number;
  /** Budget utilisation at which `nearLimit` flips true. */
  budgetWarnThreshold?: number;
  /** Rate-limit utilisation above which a provider counts as saturated. */
  saturationThreshold?: number;
  /** Error rate above which a provider counts as degraded. */
  degradedErrorRate?: number;
  /** Baseline parallelism at zero congestion. */
  maxParallelism?: number;
  /** Floor for parallelism under heavy congestion. */
  minParallelism?: number;
}

const DEFAULTS = {
  windowMs: 60_000,
  latencyEmaAlpha: 0.3,
  latencySampleSize: 64,
  budgetWarnThreshold: 0.8,
  saturationThreshold: 0.85,
  degradedErrorRate: 0.2,
  maxParallelism: 8,
  minParallelism: 1,
} as const;

/** Handle returned by startRequest, used to close the loop on completion. */
export interface RequestTicket {
  id: string;
  providerId: ProviderId;
  /** Clock time when the request was enqueued. */
  enqueuedAt: number;
  /** Clock time when the request left the queue and began executing. */
  startedAt: number;
  estimatedInputTokens: number;
}

/** Events emitted as infrastructure conditions change. */
export interface MonitorEvents {
  'provider:degraded': { providerId: ProviderId; errorRate: number };
  'provider:saturated': { providerId: ProviderId; utilization: number };
  'provider:recovered': { providerId: ProviderId };
  'ratelimit:near': { providerId: ProviderId; utilization: number };
  'budget:near': { spentUsd: number; limitUsd: number };
  'budget:exhausted': { spentUsd: number; limitUsd: number };
}

type Listener<K extends keyof MonitorEvents> = (payload: MonitorEvents[K]) => void;

/** Timestamped token/request consumption record. */
interface WindowEntry {
  at: number;
  tokens: number;
  ok: boolean;
}

interface ProviderRuntime {
  capacity: Required<
    Pick<ProviderCapacity, 'maxConcurrency' | 'qualityScore' | 'baselineLatencyMs'>
  > &
    ProviderCapacity;
  inFlight: Map<string, RequestTicket>;
  queued: Map<string, { enqueuedAt: number }>;
  latencySamples: number[];
  latencyEma: number;
  lastLatencyMs: number;
  latencyCount: number;
  window: WindowEntry[];
  successes: number;
  failures: number;
  consecutiveFailures: number;
  cacheUsedTokens: number;
  cacheHits: number;
  cacheMisses: number;
  cost: CostState;
  retryAfterUntil?: number;
  /** Last computed health, used to emit recovery transitions. */
  lastHealth: ProviderHealth;
}

export class InfrastructureMonitor {
  private readonly clock: Clock;
  private readonly config: Required<Omit<MonitorConfig, 'budgetLimitUsd'>> &
    Pick<MonitorConfig, 'budgetLimitUsd'>;
  private readonly providers = new Map<ProviderId, ProviderRuntime>();
  private readonly listeners = new Map<string, Set<Listener<never>>>();
  private requestCounter = 0;
  private budgetNearNotified = false;
  private budgetExhaustedNotified = false;

  constructor(config: MonitorConfig = {}, clock: Clock = systemClock) {
    this.clock = clock;
    this.config = {
      windowMs: config.windowMs ?? DEFAULTS.windowMs,
      latencyEmaAlpha: config.latencyEmaAlpha ?? DEFAULTS.latencyEmaAlpha,
      latencySampleSize: config.latencySampleSize ?? DEFAULTS.latencySampleSize,
      budgetLimitUsd: config.budgetLimitUsd,
      budgetWarnThreshold: config.budgetWarnThreshold ?? DEFAULTS.budgetWarnThreshold,
      saturationThreshold: config.saturationThreshold ?? DEFAULTS.saturationThreshold,
      degradedErrorRate: config.degradedErrorRate ?? DEFAULTS.degradedErrorRate,
      maxParallelism: config.maxParallelism ?? DEFAULTS.maxParallelism,
      minParallelism: config.minParallelism ?? DEFAULTS.minParallelism,
    };
  }

  /** Registers a provider and its infrastructure limits. */
  registerProvider(providerId: ProviderId, capacity: ProviderCapacity): void {
    const baselineLatencyMs = capacity.baselineLatencyMs ?? 1_000;
    this.providers.set(providerId, {
      capacity: {
        ...capacity,
        maxConcurrency: Math.max(1, capacity.maxConcurrency),
        qualityScore: capacity.qualityScore ?? 0.5,
        baselineLatencyMs,
      },
      inFlight: new Map(),
      queued: new Map(),
      latencySamples: [],
      latencyEma: baselineLatencyMs,
      lastLatencyMs: baselineLatencyMs,
      latencyCount: 0,
      window: [],
      successes: 0,
      failures: 0,
      consecutiveFailures: 0,
      cacheUsedTokens: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cost: { spentUsd: 0, inputTokens: 0, outputTokens: 0 },
      lastHealth: 'healthy',
    });
  }

  /** Removes a provider and discards its signals. */
  unregisterProvider(providerId: ProviderId): void {
    this.providers.delete(providerId);
  }

  /** True when the provider is registered. */
  hasProvider(providerId: ProviderId): boolean {
    return this.providers.has(providerId);
  }

  /** Registered provider ids. */
  getProviderIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /** Static capacity for a provider. */
  getCapacity(providerId: ProviderId): ProviderCapacity | undefined {
    return this.providers.get(providerId)?.capacity;
  }

  /**
   * Marks a request as waiting for an execution slot. Returns an opaque id used
   * to promote it to in-flight. Queue depth feeds directly into congestion.
   */
  enqueue(providerId: ProviderId): string {
    const runtime = this.requireProvider(providerId);
    const id = this.nextRequestId();
    runtime.queued.set(id, { enqueuedAt: this.clock.now() });
    return id;
  }

  /** Drops a queued request without executing it (e.g. rejected, cancelled). */
  dequeue(providerId: ProviderId, queueId: string): void {
    this.providers.get(providerId)?.queued.delete(queueId);
  }

  /**
   * Promotes a request to in-flight. Pass the id from `enqueue` to preserve the
   * measured queue wait, or omit it for requests that never queued.
   */
  startRequest(
    providerId: ProviderId,
    estimatedInputTokens: number,
    queueId?: string
  ): RequestTicket {
    const runtime = this.requireProvider(providerId);
    const now = this.clock.now();

    let enqueuedAt = now;
    if (queueId) {
      const queued = runtime.queued.get(queueId);
      if (queued) {
        enqueuedAt = queued.enqueuedAt;
        runtime.queued.delete(queueId);
      }
    }

    const ticket: RequestTicket = {
      id: queueId ?? this.nextRequestId(),
      providerId,
      enqueuedAt,
      startedAt: now,
      estimatedInputTokens,
    };
    runtime.inFlight.set(ticket.id, ticket);
    return ticket;
  }

  /** Records a successful completion with billed usage. */
  completeRequest(ticket: RequestTicket, usage: RequestUsage): void {
    const runtime = this.requireProvider(ticket.providerId);
    const now = this.clock.now();
    runtime.inFlight.delete(ticket.id);

    this.recordLatency(runtime, Math.max(0, now - ticket.startedAt));

    const totalTokens = usage.inputTokens + usage.outputTokens;
    runtime.window.push({ at: now, tokens: totalTokens, ok: true });
    runtime.successes += 1;
    runtime.consecutiveFailures = 0;

    this.recordCache(runtime, usage);
    this.recordCost(runtime, usage);
    this.pruneWindow(runtime, now);
    this.evaluateHealth(ticket.providerId, runtime);
    this.evaluateBudget();
  }

  /**
   * Records a failed completion. `retryAfterMs` propagates a provider's
   * Retry-After so the router can back off precisely instead of guessing.
   */
  failRequest(
    ticket: RequestTicket,
    options: { retryAfterMs?: number; tokensConsumed?: number } = {}
  ): void {
    const runtime = this.requireProvider(ticket.providerId);
    const now = this.clock.now();
    runtime.inFlight.delete(ticket.id);

    this.recordLatency(runtime, Math.max(0, now - ticket.startedAt));

    runtime.window.push({ at: now, tokens: options.tokensConsumed ?? 0, ok: false });
    runtime.failures += 1;
    runtime.consecutiveFailures += 1;

    if (options.retryAfterMs !== undefined) {
      runtime.retryAfterUntil = now + options.retryAfterMs;
    }

    this.pruneWindow(runtime, now);
    this.evaluateHealth(ticket.providerId, runtime);
  }

  /** Records a prompt-cache lookup outcome outside of a request completion. */
  recordCacheLookup(providerId: ProviderId, hit: boolean): void {
    const runtime = this.requireProvider(providerId);
    if (hit) {
      runtime.cacheHits += 1;
    } else {
      runtime.cacheMisses += 1;
    }
  }

  /** Sets observed KV-cache occupancy in tokens. */
  setCacheUsage(providerId: ProviderId, usedTokens: number): void {
    const runtime = this.requireProvider(providerId);
    runtime.cacheUsedTokens = Math.max(0, usedTokens);
  }

  /** Current signals for one provider. */
  getSignals(providerId: ProviderId): ProviderSignals | undefined {
    const runtime = this.providers.get(providerId);
    if (!runtime) return undefined;
    return this.buildSignals(providerId, runtime, this.clock.now());
  }

  /**
   * Point-in-time infrastructure observation across all providers, including
   * derived congestion and the parallelism it implies.
   */
  getSnapshot(): InfrastructureSnapshot {
    const now = this.clock.now();
    const providers: Record<ProviderId, ProviderSignals> = {};
    let totalInFlight = 0;
    let totalQueued = 0;
    let congestionSum = 0;
    let liveProviders = 0;

    for (const [providerId, runtime] of this.providers) {
      this.pruneWindow(runtime, now);
      const signals = this.buildSignals(providerId, runtime, now);
      providers[providerId] = signals;
      totalInFlight += signals.queue.inFlight;
      totalQueued += signals.queue.queued;

      if (signals.health !== 'down') {
        congestionSum += this.providerCongestion(signals);
        liveProviders += 1;
      }
    }

    const congestion = liveProviders > 0 ? clamp01(congestionSum / liveProviders) : 1;

    return {
      timestamp: now,
      providers,
      totalInFlight,
      totalQueued,
      congestion,
      recommendedParallelism: this.parallelismFor(congestion),
      budget: this.getBudgetState(),
    };
  }

  /** Global spend state. */
  getBudgetState(): BudgetState {
    let spentUsd = 0;
    for (const runtime of this.providers.values()) {
      spentUsd += runtime.cost.spentUsd;
    }

    const limitUsd = this.config.budgetLimitUsd;
    if (limitUsd === undefined || limitUsd <= 0) {
      return { spentUsd, utilization: 0, nearLimit: false, exhausted: false };
    }

    const utilization = clamp01(spentUsd / limitUsd);
    return {
      spentUsd,
      limitUsd,
      utilization,
      remainingUsd: Math.max(0, limitUsd - spentUsd),
      nearLimit: utilization >= this.config.budgetWarnThreshold,
      exhausted: spentUsd >= limitUsd,
    };
  }

  /**
   * Parallelism to use at a given congestion level. Biases toward simpler,
   * narrower execution graphs under load and wider ones when idle.
   */
  parallelismFor(congestion: number): number {
    const { minParallelism, maxParallelism } = this.config;
    const span = Math.max(0, maxParallelism - minParallelism);
    return Math.max(minParallelism, Math.round(maxParallelism - span * clamp01(congestion)));
  }

  /** Projected USD cost of a request against a provider's price sheet. */
  projectCost(providerId: ProviderId, inputTokens: number, outputTokens: number): number {
    const capacity = this.providers.get(providerId)?.capacity;
    if (!capacity) return 0;
    const inRate = capacity.inputCostPerMillion ?? 0;
    const outRate = capacity.outputCostPerMillion ?? 0;
    return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
  }

  /** Subscribes to an infrastructure event. Returns an unsubscribe function. */
  on<K extends keyof MonitorEvents>(event: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set?.delete(listener as Listener<never>);
    };
  }

  /** Clears all providers, counters and budget notifications. */
  reset(): void {
    this.providers.clear();
    this.requestCounter = 0;
    this.budgetNearNotified = false;
    this.budgetExhaustedNotified = false;
  }

  private buildSignals(
    providerId: ProviderId,
    runtime: ProviderRuntime,
    now: number
  ): ProviderSignals {
    const queue = this.buildQueueState(runtime, now);
    const latency = this.buildLatencyStats(runtime);
    const rateLimit = this.buildRateLimitState(runtime, now);
    const cache = this.buildCacheState(runtime);
    const reliability = this.buildReliabilityState(runtime);

    return {
      providerId,
      health: this.classifyHealth(runtime, queue, rateLimit, reliability, now),
      queue,
      latency,
      rateLimit,
      cache,
      cost: { ...runtime.cost },
      reliability,
      capacity: runtime.capacity,
    };
  }

  private buildQueueState(runtime: ProviderRuntime, now: number): QueueState {
    let oldestWaitMs = 0;
    for (const entry of runtime.queued.values()) {
      oldestWaitMs = Math.max(oldestWaitMs, now - entry.enqueuedAt);
    }

    const inFlight = runtime.inFlight.size;
    return {
      inFlight,
      queued: runtime.queued.size,
      saturation: clamp01(inFlight / runtime.capacity.maxConcurrency),
      oldestWaitMs,
    };
  }

  private buildLatencyStats(runtime: ProviderRuntime): LatencyStats {
    const sorted = [...runtime.latencySamples].sort((a, b) => a - b);
    return {
      emaMs: runtime.latencyEma,
      p50Ms: percentile(sorted, 0.5, runtime.capacity.baselineLatencyMs),
      p95Ms: percentile(sorted, 0.95, runtime.capacity.baselineLatencyMs),
      lastMs: runtime.lastLatencyMs,
      samples: runtime.latencyCount,
    };
  }

  private buildRateLimitState(runtime: ProviderRuntime, now: number): RateLimitState {
    const { tokensPerMinute, requestsPerMinute } = runtime.capacity;
    let tokensUsed = 0;
    let oldestAt = now;

    for (const entry of runtime.window) {
      tokensUsed += entry.tokens;
      oldestAt = Math.min(oldestAt, entry.at);
    }

    // Requests still executing count against the limit even before completion.
    const requestsUsed = runtime.window.length + runtime.inFlight.size;
    for (const ticket of runtime.inFlight.values()) {
      tokensUsed += ticket.estimatedInputTokens;
    }

    const tokenUtil = tokensPerMinute ? tokensUsed / tokensPerMinute : 0;
    const requestUtil = requestsPerMinute ? requestsUsed / requestsPerMinute : 0;

    const elapsed = runtime.window.length > 0 ? now - oldestAt : 0;
    const resetInMs = Math.max(0, this.config.windowMs - elapsed);
    const retryAfterMs =
      runtime.retryAfterUntil && runtime.retryAfterUntil > now
        ? runtime.retryAfterUntil - now
        : undefined;

    return {
      tokensUsed,
      tokensRemaining: tokensPerMinute ? Math.max(0, tokensPerMinute - tokensUsed) : undefined,
      requestsUsed,
      requestsRemaining: requestsPerMinute
        ? Math.max(0, requestsPerMinute - requestsUsed)
        : undefined,
      utilization: clamp01(Math.max(tokenUtil, requestUtil)),
      resetInMs,
      retryAfterMs,
    };
  }

  private buildCacheState(runtime: ProviderRuntime): CacheState {
    const capacityTokens = runtime.capacity.cacheCapacityTokens;
    const lookups = runtime.cacheHits + runtime.cacheMisses;
    return {
      usedTokens: runtime.cacheUsedTokens,
      capacityTokens,
      pressure: capacityTokens ? clamp01(runtime.cacheUsedTokens / capacityTokens) : 0,
      hits: runtime.cacheHits,
      misses: runtime.cacheMisses,
      hitRate: lookups > 0 ? runtime.cacheHits / lookups : 0,
    };
  }

  private buildReliabilityState(runtime: ProviderRuntime): ReliabilityState {
    const total = runtime.window.length;
    const failures = runtime.window.filter((entry) => !entry.ok).length;
    return {
      successes: runtime.successes,
      failures: runtime.failures,
      errorRate: total > 0 ? failures / total : 0,
      consecutiveFailures: runtime.consecutiveFailures,
      // The monitor observes; the circuit breaker owns state transitions.
      circuit: 'closed',
    };
  }

  private classifyHealth(
    runtime: ProviderRuntime,
    queue: QueueState,
    rateLimit: RateLimitState,
    reliability: ReliabilityState,
    now: number
  ): ProviderHealth {
    if (runtime.retryAfterUntil && runtime.retryAfterUntil > now) {
      return 'down';
    }
    if (reliability.consecutiveFailures >= 5) {
      return 'down';
    }
    if (
      rateLimit.utilization >= this.config.saturationThreshold ||
      queue.saturation >= this.config.saturationThreshold
    ) {
      return 'saturated';
    }
    if (reliability.errorRate > this.config.degradedErrorRate) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Per-provider congestion blending queue saturation, latency inflation
   * versus baseline, and rate-limit utilisation.
   */
  private providerCongestion(signals: ProviderSignals): number {
    const baseline = Math.max(1, signals.capacity.baselineLatencyMs ?? 1_000);
    const latencyInflation = clamp01((signals.latency.emaMs / baseline - 1) / 2);
    return clamp01(
      0.4 * signals.queue.saturation +
        0.3 * signals.rateLimit.utilization +
        0.3 * latencyInflation
    );
  }

  private recordLatency(runtime: ProviderRuntime, latencyMs: number): void {
    const alpha = this.config.latencyEmaAlpha;
    runtime.latencyEma =
      runtime.latencyCount === 0
        ? latencyMs
        : alpha * latencyMs + (1 - alpha) * runtime.latencyEma;
    runtime.lastLatencyMs = latencyMs;
    runtime.latencyCount += 1;

    runtime.latencySamples.push(latencyMs);
    if (runtime.latencySamples.length > this.config.latencySampleSize) {
      runtime.latencySamples.shift();
    }
  }

  private recordCache(runtime: ProviderRuntime, usage: RequestUsage): void {
    const cached = usage.cachedInputTokens ?? 0;
    if (cached > 0) {
      runtime.cacheHits += 1;
      runtime.cacheUsedTokens = Math.max(runtime.cacheUsedTokens, cached);
    } else if (usage.inputTokens > 0) {
      runtime.cacheMisses += 1;
      runtime.cacheUsedTokens += usage.inputTokens;
    }

    const capacity = runtime.capacity.cacheCapacityTokens;
    if (capacity !== undefined) {
      runtime.cacheUsedTokens = Math.min(runtime.cacheUsedTokens, capacity);
    }
  }

  private recordCost(runtime: ProviderRuntime, usage: RequestUsage): void {
    const inRate = runtime.capacity.inputCostPerMillion ?? 0;
    const outRate = runtime.capacity.outputCostPerMillion ?? 0;
    runtime.cost.inputTokens += usage.inputTokens;
    runtime.cost.outputTokens += usage.outputTokens;
    runtime.cost.spentUsd +=
      (usage.inputTokens / 1_000_000) * inRate + (usage.outputTokens / 1_000_000) * outRate;
  }

  private pruneWindow(runtime: ProviderRuntime, now: number): void {
    const cutoff = now - this.config.windowMs;
    while (runtime.window.length > 0 && runtime.window[0]!.at < cutoff) {
      runtime.window.shift();
    }
    if (runtime.retryAfterUntil !== undefined && runtime.retryAfterUntil <= now) {
      runtime.retryAfterUntil = undefined;
    }
  }

  private evaluateHealth(providerId: ProviderId, runtime: ProviderRuntime): void {
    const now = this.clock.now();
    const signals = this.buildSignals(providerId, runtime, now);
    const previous = runtime.lastHealth;
    runtime.lastHealth = signals.health;

    if (signals.health === previous) return;

    if (signals.health === 'degraded' || signals.health === 'down') {
      this.emit('provider:degraded', {
        providerId,
        errorRate: signals.reliability.errorRate,
      });
    } else if (signals.health === 'saturated') {
      this.emit('provider:saturated', {
        providerId,
        utilization: signals.rateLimit.utilization,
      });
    } else if (previous !== 'healthy') {
      this.emit('provider:recovered', { providerId });
    }

    if (signals.rateLimit.utilization >= this.config.saturationThreshold) {
      this.emit('ratelimit:near', {
        providerId,
        utilization: signals.rateLimit.utilization,
      });
    }
  }

  private evaluateBudget(): void {
    const budget = this.getBudgetState();
    if (budget.limitUsd === undefined) return;

    if (budget.exhausted && !this.budgetExhaustedNotified) {
      this.budgetExhaustedNotified = true;
      this.emit('budget:exhausted', {
        spentUsd: budget.spentUsd,
        limitUsd: budget.limitUsd,
      });
      return;
    }

    if (budget.nearLimit && !this.budgetNearNotified) {
      this.budgetNearNotified = true;
      this.emit('budget:near', {
        spentUsd: budget.spentUsd,
        limitUsd: budget.limitUsd,
      });
    }
  }

  private emit<K extends keyof MonitorEvents>(event: K, payload: MonitorEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<K>)(payload);
    }
  }

  private requireProvider(providerId: ProviderId): ProviderRuntime {
    const runtime = this.providers.get(providerId);
    if (!runtime) {
      throw new Error(`Provider '${providerId}' is not registered with the monitor`);
    }
    return runtime;
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `req_${this.requestCounter.toString(36)}`;
  }
}

/** Clamps a value into [0, 1]. */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Percentile of a pre-sorted array, falling back when empty. */
function percentile(sorted: number[], q: number, fallback: number): number {
  if (sorted.length === 0) return fallback;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index]!;
}
