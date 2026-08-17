/**
 * BackpressureController - admission control under infrastructure pressure.
 *
 * Decides whether a request is admitted now, delayed, or rejected outright,
 * based on rate-limit headroom, queue saturation and remaining budget. Slowing
 * down before hitting a provider's limit is cheaper than absorbing 429s.
 */

import type { InfrastructureMonitor } from './infrastructure-monitor';
import {
  type AdmissionDecision,
  type CapacityWaitResult,
  type InfrastructureSnapshot,
  type ProviderId,
  type ProviderSignals,
  type RoutingRequest,
  type TaskPriority,
} from './types';

export interface BackpressureConfig {
  /** Rate-limit utilisation above which requests are throttled. */
  softRateLimitThreshold?: number;
  /** Rate-limit utilisation above which requests are rejected. */
  hardRateLimitThreshold?: number;
  /** Queue saturation above which requests are throttled. */
  softQueueThreshold?: number;
  /** Queue saturation above which requests are rejected. */
  hardQueueThreshold?: number;
  /** Budget utilisation above which only critical work is admitted. */
  budgetThrottleThreshold?: number;
  /** Longest delay a throttle decision may ask for, in ms. */
  maxThrottleDelayMs?: number;
  /** Baseline throttle delay before pressure scaling, in ms. */
  baseThrottleDelayMs?: number;
}

const BACKPRESSURE_DEFAULTS = {
  softRateLimitThreshold: 0.75,
  hardRateLimitThreshold: 0.95,
  softQueueThreshold: 0.8,
  hardQueueThreshold: 1,
  budgetThrottleThreshold: 0.9,
  maxThrottleDelayMs: 30_000,
  baseThrottleDelayMs: 250,
} as const;

/** Priorities exempt from soft throttling. */
const THROTTLE_EXEMPT: ReadonlySet<TaskPriority> = new Set<TaskPriority>(['critical']);

export class BackpressureController {
  private readonly monitor: InfrastructureMonitor;
  private readonly config: Required<BackpressureConfig>;

  /**
   * Time is not read directly: admission decisions come from monitor snapshots
   * and the wait budget accumulates requested delays, so no clock is needed.
   */
  constructor(monitor: InfrastructureMonitor, config: BackpressureConfig = {}) {
    this.monitor = monitor;
    this.config = {
      softRateLimitThreshold:
        config.softRateLimitThreshold ?? BACKPRESSURE_DEFAULTS.softRateLimitThreshold,
      hardRateLimitThreshold:
        config.hardRateLimitThreshold ?? BACKPRESSURE_DEFAULTS.hardRateLimitThreshold,
      softQueueThreshold: config.softQueueThreshold ?? BACKPRESSURE_DEFAULTS.softQueueThreshold,
      hardQueueThreshold: config.hardQueueThreshold ?? BACKPRESSURE_DEFAULTS.hardQueueThreshold,
      budgetThrottleThreshold:
        config.budgetThrottleThreshold ?? BACKPRESSURE_DEFAULTS.budgetThrottleThreshold,
      maxThrottleDelayMs:
        config.maxThrottleDelayMs ?? BACKPRESSURE_DEFAULTS.maxThrottleDelayMs,
      baseThrottleDelayMs:
        config.baseThrottleDelayMs ?? BACKPRESSURE_DEFAULTS.baseThrottleDelayMs,
    };
  }

  /**
   * Evaluates whether a request may proceed against a provider right now.
   * Pass a snapshot to evaluate a batch against one consistent observation.
   */
  evaluate(
    providerId: ProviderId,
    request: Pick<RoutingRequest, 'priority' | 'estimatedInputTokens' | 'estimatedOutputTokens'>,
    snapshot?: InfrastructureSnapshot
  ): AdmissionDecision {
    const state = snapshot ?? this.monitor.getSnapshot();
    const signals = state.providers[providerId];

    if (!signals) {
      return { action: 'reject', delayMs: 0, reason: `provider '${providerId}' not registered` };
    }

    const priority = request.priority ?? 'normal';

    // Budget exhaustion is the only truly unwaitable condition: no amount of
    // delay frees up spend.
    if (state.budget.exhausted && (signals.capacity.inputCostPerMillion ?? 0) > 0) {
      return { action: 'reject', delayMs: 0, reason: 'cost budget exhausted' };
    }

    // An explicit Retry-After is authoritative and waitable, so it takes
    // precedence over the health check that this same signal marks as `down`.
    if (signals.rateLimit.retryAfterMs !== undefined) {
      return {
        action: 'throttle',
        delayMs: Math.min(signals.rateLimit.retryAfterMs, this.config.maxThrottleDelayMs),
        reason: `provider requested retry after ${signals.rateLimit.retryAfterMs}ms`,
      };
    }

    // Down without a Retry-After means repeated hard failures; waiting will not
    // help, so the caller should route elsewhere.
    if (signals.health === 'down') {
      return { action: 'reject', delayMs: 0, reason: 'provider is down' };
    }

    // A request larger than the whole per-minute allowance can never be
    // admitted, no matter how long we wait. Reject so the caller reroutes.
    const requestTokens =
      (request.estimatedInputTokens ?? 0) + (request.estimatedOutputTokens ?? 0);
    const { tokensPerMinute } = signals.capacity;
    if (tokensPerMinute !== undefined && requestTokens > tokensPerMinute) {
      return {
        action: 'reject',
        delayMs: 0,
        reason: `request needs ${requestTokens} tokens, above the ${tokensPerMinute}/min limit`,
      };
    }

    const projectedUtil = this.projectRateLimitUtilization(signals, request);

    if (projectedUtil >= this.config.hardRateLimitThreshold) {
      return {
        action: 'throttle',
        delayMs: this.delayUntilWindowReset(signals),
        reason: `rate limit at ${(projectedUtil * 100).toFixed(0)}%, waiting for window reset`,
      };
    }

    if (signals.queue.saturation >= this.config.hardQueueThreshold) {
      return {
        action: 'throttle',
        delayMs: this.throttleDelay(signals.queue.saturation),
        reason: `queue full (${signals.queue.inFlight}/${signals.capacity.maxConcurrency})`,
      };
    }

    if (
      state.budget.utilization >= this.config.budgetThrottleThreshold &&
      priority !== 'critical' &&
      (signals.capacity.inputCostPerMillion ?? 0) > 0
    ) {
      return {
        action: 'reject',
        delayMs: 0,
        reason: `budget at ${(state.budget.utilization * 100).toFixed(0)}%, reserving remainder for critical work`,
      };
    }

    if (THROTTLE_EXEMPT.has(priority)) {
      return { action: 'admit', delayMs: 0, reason: `${priority} priority bypasses soft throttle` };
    }

    if (projectedUtil >= this.config.softRateLimitThreshold) {
      return {
        action: 'throttle',
        delayMs: this.throttleDelay(projectedUtil),
        reason: `approaching rate limit (${(projectedUtil * 100).toFixed(0)}%)`,
      };
    }

    if (signals.queue.saturation >= this.config.softQueueThreshold) {
      return {
        action: 'throttle',
        delayMs: this.throttleDelay(signals.queue.saturation),
        reason: `queue pressure (${(signals.queue.saturation * 100).toFixed(0)}%)`,
      };
    }

    return { action: 'admit', delayMs: 0, reason: 'infrastructure has headroom' };
  }

  /**
   * Resolves once the request may proceed, re-evaluating after each delay.
   * Returns the final decision plus the time actually waited; `reject` is
   * surfaced rather than thrown so callers can reroute to another provider.
   *
   * The wait budget is tracked by accumulating requested delays rather than by
   * reading the clock, so the loop terminates even if the caller's sleep does
   * not advance time.
   */
  async waitForCapacity(
    providerId: ProviderId,
    request: Pick<RoutingRequest, 'priority' | 'estimatedInputTokens' | 'estimatedOutputTokens'>,
    options: { maxWaitMs?: number; sleep?: (ms: number) => Promise<void> } = {}
  ): Promise<CapacityWaitResult> {
    const sleep = options.sleep ?? defaultSleep;
    const maxWaitMs = options.maxWaitMs ?? this.config.maxThrottleDelayMs;

    let waitedMs = 0;
    let decision = this.evaluate(providerId, request);

    while (decision.action === 'throttle') {
      const remaining = maxWaitMs - waitedMs;
      if (remaining <= 0) {
        return {
          action: 'reject',
          delayMs: 0,
          waitedMs,
          reason: `capacity wait exceeded ${maxWaitMs}ms: ${decision.reason}`,
        };
      }

      // A zero-delay throttle would spin, so always make forward progress.
      const delayMs = Math.max(1, Math.min(decision.delayMs, remaining));
      await sleep(delayMs);
      waitedMs += delayMs;
      decision = this.evaluate(providerId, request);
    }

    return { ...decision, waitedMs };
  }

  /**
   * Projected rate-limit utilisation including this request's estimated tokens,
   * so we throttle before crossing the limit rather than after.
   */
  private projectRateLimitUtilization(
    signals: ProviderSignals,
    request: Pick<RoutingRequest, 'estimatedInputTokens' | 'estimatedOutputTokens'>
  ): number {
    const { tokensPerMinute, requestsPerMinute } = signals.capacity;
    const projectedTokens =
      signals.rateLimit.tokensUsed +
      request.estimatedInputTokens +
      request.estimatedOutputTokens;

    const tokenUtil = tokensPerMinute ? projectedTokens / tokensPerMinute : 0;
    const requestUtil = requestsPerMinute
      ? (signals.rateLimit.requestsUsed + 1) / requestsPerMinute
      : 0;

    return Math.min(1, Math.max(tokenUtil, requestUtil));
  }

  /** Delay scaled by how far past the threshold the pressure sits. */
  private throttleDelay(pressure: number): number {
    const excess = Math.max(0, pressure - this.config.softRateLimitThreshold);
    const scale = 1 + excess * 10;
    return Math.min(
      this.config.maxThrottleDelayMs,
      Math.round(this.config.baseThrottleDelayMs * scale)
    );
  }

  private delayUntilWindowReset(signals: ProviderSignals): number {
    const reset = signals.rateLimit.resetInMs;
    const delay = reset > 0 ? reset : this.config.baseThrottleDelayMs;
    return Math.min(delay, this.config.maxThrottleDelayMs);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
