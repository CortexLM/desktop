/**
 * Infrastructure-Aware Orchestration types (INFRAMIND pattern).
 *
 * Based on "INFRAMIND: Infrastructure-Aware Multi-Agent Orchestration"
 * (arXiv:2606.11440). The core idea: orchestration decisions are conditioned
 * on real-time infrastructure state (queue depths, latency, KV-cache pressure,
 * rate limits, budget) rather than on model capability alone.
 */

/** Identifier of a provider as registered in AIProviderRegistry. */
export type ProviderId = string;

/** Task urgency, used by the scheduler to reorder queued work. */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

/** Numeric weight per priority; higher wins. */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 1000,
  high: 100,
  normal: 10,
  low: 1,
};

/** What the orchestrator optimises for when scoring providers. */
export type SLAObjective = 'latency' | 'cost' | 'balanced' | 'quality';

/** Circuit breaker lifecycle state. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Overall health classification derived from infrastructure signals. */
export type ProviderHealth = 'healthy' | 'degraded' | 'saturated' | 'down';

/** Admission decision returned by the backpressure controller. */
export type AdmissionAction = 'admit' | 'throttle' | 'reject';

/**
 * Static description of a provider's infrastructure limits.
 * These are the constraints the monitor measures utilisation against.
 */
export interface ProviderCapacity {
  /** Max requests we allow in flight concurrently. */
  maxConcurrency: number;
  /** Tokens per minute allowed by the provider's rate limiter. */
  tokensPerMinute?: number;
  /** Requests per minute allowed by the provider's rate limiter. */
  requestsPerMinute?: number;
  /** KV-cache / prompt-cache capacity in tokens, if the provider exposes one. */
  cacheCapacityTokens?: number;
  /** USD per million input tokens. */
  inputCostPerMillion?: number;
  /** USD per million output tokens. */
  outputCostPerMillion?: number;
  /**
   * Relative quality weight in [0, 1], used by the `quality` objective.
   * Defaults to 0.5 when unknown.
   */
  qualityScore?: number;
  /** Baseline expected latency in ms, used before samples exist. */
  baselineLatencyMs?: number;
}

/** Observed latency distribution for one provider. */
export interface LatencyStats {
  /** Exponentially weighted moving average in ms. */
  emaMs: number;
  /** Median of the retained sample window. */
  p50Ms: number;
  /** 95th percentile of the retained sample window. */
  p95Ms: number;
  /** Most recent observation in ms. */
  lastMs: number;
  /** Number of latency samples observed since start. */
  samples: number;
}

/** Rate-limit budget remaining for the current window. */
export interface RateLimitState {
  /** Tokens consumed in the trailing window. */
  tokensUsed: number;
  /** Tokens still available, or undefined when no limit is configured. */
  tokensRemaining?: number;
  /** Requests issued in the trailing window. */
  requestsUsed: number;
  /** Requests still available, or undefined when no limit is configured. */
  requestsRemaining?: number;
  /** Worst-case utilisation across token and request limits, in [0, 1]. */
  utilization: number;
  /** Ms until the trailing window rolls over. */
  resetInMs: number;
  /** Set when the provider returned an explicit Retry-After. */
  retryAfterMs?: number;
}

/** Prompt/KV-cache occupancy and effectiveness. */
export interface CacheState {
  /** Tokens currently held in cache. */
  usedTokens: number;
  /** Configured capacity, when known. */
  capacityTokens?: number;
  /** usedTokens / capacityTokens in [0, 1]; 0 when capacity is unknown. */
  pressure: number;
  /** Cache hits observed. */
  hits: number;
  /** Cache misses observed. */
  misses: number;
  /** hits / (hits + misses); 0 when no lookups recorded. */
  hitRate: number;
}

/** Queue occupancy for one provider. */
export interface QueueState {
  /** Requests currently executing. */
  inFlight: number;
  /** Requests waiting for an execution slot. */
  queued: number;
  /** inFlight / maxConcurrency in [0, 1]. */
  saturation: number;
  /** Longest wait time currently observed in the queue, in ms. */
  oldestWaitMs: number;
}

/** Spend accounting for one provider. */
export interface CostState {
  /** Cumulative USD spent. */
  spentUsd: number;
  /** Input tokens billed. */
  inputTokens: number;
  /** Output tokens billed. */
  outputTokens: number;
}

/** Reliability signals for one provider. */
export interface ReliabilityState {
  /** Successful completions. */
  successes: number;
  /** Failed completions. */
  failures: number;
  /** Failures / total over the trailing window, in [0, 1]. */
  errorRate: number;
  /** Consecutive failures since the last success. */
  consecutiveFailures: number;
  /** Circuit breaker state. */
  circuit: CircuitState;
}

/** Full point-in-time infrastructure state for one provider. */
export interface ProviderSignals {
  providerId: ProviderId;
  health: ProviderHealth;
  queue: QueueState;
  latency: LatencyStats;
  rateLimit: RateLimitState;
  cache: CacheState;
  cost: CostState;
  reliability: ReliabilityState;
  capacity: ProviderCapacity;
}

/** Global budget tracking across all providers. */
export interface BudgetState {
  /** Total USD spent across providers. */
  spentUsd: number;
  /** Configured ceiling, when set. */
  limitUsd?: number;
  /** spentUsd / limitUsd in [0, 1]; 0 when no limit is set. */
  utilization: number;
  /** Remaining USD, or undefined when unbounded. */
  remainingUsd?: number;
  /** True once utilisation crosses the warning threshold. */
  nearLimit: boolean;
  /** True once the budget is fully consumed. */
  exhausted: boolean;
}

/**
 * Aggregate infrastructure snapshot. This is the observation vector the
 * planner and executor condition on.
 */
export interface InfrastructureSnapshot {
  /** Snapshot timestamp in ms since epoch. */
  timestamp: number;
  /** Per-provider signals, keyed by provider id. */
  providers: Record<ProviderId, ProviderSignals>;
  /** Sum of in-flight requests across providers. */
  totalInFlight: number;
  /** Sum of queued requests across providers. */
  totalQueued: number;
  /**
   * Congestion index in [0, 1] combining queue saturation, latency inflation
   * and rate-limit utilisation. Drives graph-complexity and parallelism.
   */
  congestion: number;
  /** Parallelism the orchestrator should use given current congestion. */
  recommendedParallelism: number;
  /** Global spend state. */
  budget: BudgetState;
}

/** SLA targets the router optimises against. */
export interface SLATargets {
  /** Primary optimisation objective. */
  objective: SLAObjective;
  /** Hard-ish latency ceiling in ms; providers above it are penalised. */
  maxLatencyMs?: number;
  /** Preferred cost ceiling in USD for a single task. */
  maxCostPerTaskUsd?: number;
  /** Minimum acceptable success rate in [0, 1]. */
  minSuccessRate?: number;
}

/** Default SLA: balance latency and cost, tolerate 10% errors. */
export const DEFAULT_SLA: SLATargets = {
  objective: 'balanced',
  minSuccessRate: 0.9,
};

/** A routing request describing the work to be placed. */
export interface RoutingRequest {
  /** Estimated input tokens, used for rate-limit and cost projection. */
  estimatedInputTokens: number;
  /** Estimated output tokens, used for cost projection. */
  estimatedOutputTokens: number;
  /** Task urgency. */
  priority?: TaskPriority;
  /** SLA overrides for this request. */
  sla?: SLATargets;
  /** Providers that must not be selected (e.g. already failed this task). */
  exclude?: ProviderId[];
  /** Only consider these providers when set. */
  restrictTo?: ProviderId[];
  /**
   * Stable cache key prefix. Providers holding this prefix warm get a
   * cache-affinity bonus, which lowers latency and cost.
   */
  cacheKey?: string;
}

/** Per-provider score breakdown, retained for observability. */
export interface ProviderScore {
  providerId: ProviderId;
  /** Final weighted score; higher is better. */
  score: number;
  /** Component contributions, each in [0, 1] before weighting. */
  components: {
    latency: number;
    cost: number;
    load: number;
    reliability: number;
    cacheAffinity: number;
    quality: number;
  };
  /** Projected latency for this request in ms. */
  projectedLatencyMs: number;
  /** Projected cost for this request in USD. */
  projectedCostUsd: number;
  /** Set when the provider was excluded from selection. */
  ineligibleReason?: string;
}

/** Outcome of a routing decision. */
export interface RoutingDecision {
  /** Chosen provider, or null when nothing is eligible. */
  providerId: ProviderId | null;
  /** Ranked fallbacks, best first. */
  alternatives: ProviderId[];
  /** Human-readable rationale. */
  reason: string;
  /** Full scoring table, including ineligible providers. */
  scores: ProviderScore[];
  /** Projected latency of the chosen provider. */
  projectedLatencyMs?: number;
  /** Projected cost of the chosen provider. */
  projectedCostUsd?: number;
  /** True when every eligible provider misses the SLA targets. */
  slaAtRisk: boolean;
}

/** Result of an admission-control evaluation. */
export interface AdmissionDecision {
  action: AdmissionAction;
  /** Ms to wait before proceeding, when action is `throttle`. */
  delayMs: number;
  reason: string;
}

/** Admission decision plus the time actually spent waiting for capacity. */
export interface CapacityWaitResult extends AdmissionDecision {
  /** Cumulative ms slept while waiting for headroom. */
  waitedMs: number;
}

/** Injectable clock so time-dependent logic stays testable. */
export interface Clock {
  now(): number;
}

/** Default clock backed by Date.now. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Usage reported back after a request completes. */
export interface RequestUsage {
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the provider's prompt cache. */
  cachedInputTokens?: number;
}
