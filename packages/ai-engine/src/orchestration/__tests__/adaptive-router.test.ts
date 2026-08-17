/**
 * Tests for AdaptiveRouter - SLA-aware provider selection.
 */

import { AdaptiveRouter } from '../adaptive-router';
import { CircuitBreakerRegistry } from '../circuit-breaker';
import { InfrastructureMonitor } from '../infrastructure-monitor';
import type { Clock, ProviderCapacity } from '../types';

class FakeClock implements Clock {
  private current = 1_000_000;

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

/** Fast and expensive. */
const FAST: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 100_000,
  inputCostPerMillion: 10,
  outputCostPerMillion: 30,
  qualityScore: 0.7,
  baselineLatencyMs: 500,
};

/** Slow and cheap. */
const CHEAP: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 100_000,
  inputCostPerMillion: 0.5,
  outputCostPerMillion: 1.5,
  qualityScore: 0.6,
  baselineLatencyMs: 4_000,
};

/** Slow, mid-cost, highest quality. */
const SMART: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 100_000,
  inputCostPerMillion: 3,
  outputCostPerMillion: 15,
  qualityScore: 0.99,
  baselineLatencyMs: 3_000,
};

describe('AdaptiveRouter', () => {
  let clock: FakeClock;
  let monitor: InfrastructureMonitor;
  let router: AdaptiveRouter;

  /** Drives the EMA to a known value so latency scoring is deterministic. */
  function seedLatency(providerId: string, latencyMs: number, samples = 5): void {
    for (let i = 0; i < samples; i += 1) {
      const ticket = monitor.startRequest(providerId, 1);
      clock.advance(latencyMs);
      monitor.completeRequest(ticket, { inputTokens: 1, outputTokens: 1 });
    }
  }

  beforeEach(() => {
    clock = new FakeClock();
    monitor = new InfrastructureMonitor({}, clock);
    router = new AdaptiveRouter(monitor);

    monitor.registerProvider('fast', FAST);
    monitor.registerProvider('cheap', CHEAP);
    monitor.registerProvider('smart', SMART);
  });

  describe('objective-driven selection', () => {
    it('picks the lowest-latency provider for a latency SLA', () => {
      seedLatency('fast', 500);
      seedLatency('cheap', 4_000);
      seedLatency('smart', 3_000);

      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
        sla: { objective: 'latency' },
      });

      expect(decision.providerId).toBe('fast');
    });

    it('picks the cheapest provider for a cost SLA', () => {
      seedLatency('fast', 500);
      seedLatency('cheap', 4_000);
      seedLatency('smart', 3_000);

      const decision = router.route({
        estimatedInputTokens: 100_000,
        estimatedOutputTokens: 50_000,
        sla: { objective: 'cost' },
      });

      expect(decision.providerId).toBe('cheap');
    });

    it('picks the highest-quality provider for a quality SLA', () => {
      seedLatency('fast', 500);
      seedLatency('cheap', 4_000);
      seedLatency('smart', 3_000);

      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
        sla: { objective: 'quality' },
      });

      expect(decision.providerId).toBe('smart');
    });

    it('ranks alternatives behind the winner', () => {
      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
      });

      expect(decision.providerId).toBeTruthy();
      expect(decision.alternatives).toHaveLength(2);
      expect(decision.alternatives).not.toContain(decision.providerId);
    });

    it('exposes the full scoring table', () => {
      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
      });

      expect(decision.scores).toHaveLength(3);
      for (const score of decision.scores) {
        expect(score.components.latency).toBeGreaterThanOrEqual(0);
        expect(score.projectedCostUsd).toBeGreaterThan(0);
      }
    });
  });

  describe('load avoidance', () => {
    it('avoids a provider whose queue is saturated', () => {
      seedLatency('fast', 500);
      seedLatency('cheap', 600);
      seedLatency('smart', 600);

      // Fill the fast provider completely.
      for (let i = 0; i < 4; i += 1) {
        monitor.startRequest('fast', 1);
      }

      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
        sla: { objective: 'latency' },
      });

      expect(decision.providerId).not.toBe('fast');
    });

    it('marks a saturated provider ineligible with a reason', () => {
      for (let i = 0; i < 4; i += 1) {
        monitor.startRequest('fast', 1);
      }

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      const fastScore = decision.scores.find((s) => s.providerId === 'fast')!;
      expect(fastScore.ineligibleReason).toMatch(/saturated/);
      expect(fastScore.score).toBe(-1);
    });

    it('factors queue depth into projected latency', () => {
      seedLatency('fast', 1_000);

      const idle = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        restrictTo: ['fast'],
      });

      // 4 waiting on a concurrency of 4 means one extra wave of service time.
      for (let i = 0; i < 4; i += 1) {
        monitor.enqueue('fast');
      }

      const loaded = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        restrictTo: ['fast'],
      });

      expect(loaded.projectedLatencyMs!).toBeGreaterThan(idle.projectedLatencyMs!);
    });

    it('excludes rate-limited providers', () => {
      const ticket = monitor.startRequest('fast', 1);
      monitor.failRequest(ticket, { retryAfterMs: 10_000 });

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).not.toBe('fast');
    });

    it('excludes providers whose rate limit is nearly exhausted', () => {
      const ticket = monitor.startRequest('cheap', 96_000);
      monitor.completeRequest(ticket, { inputTokens: 96_000, outputTokens: 0 });

      const decision = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
      });

      const cheapScore = decision.scores.find((s) => s.providerId === 'cheap')!;
      expect(cheapScore.ineligibleReason).toMatch(/rate limit/);
    });
  });

  describe('reliability and circuit state', () => {
    it('excludes a provider that is down', () => {
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('fast', 1);
        monitor.failRequest(ticket);
      }

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).not.toBe('fast');
      const fastScore = decision.scores.find((s) => s.providerId === 'fast')!;
      expect(fastScore.ineligibleReason).toBe('provider down');
    });

    it('excludes providers with an open circuit', () => {
      const breakers = new CircuitBreakerRegistry({ failureThreshold: 2 }, clock);
      const guarded = new AdaptiveRouter(monitor, {}, breakers);

      breakers.recordFailure('fast');
      breakers.recordFailure('fast');

      const decision = guarded.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).not.toBe('fast');
      const fastScore = decision.scores.find((s) => s.providerId === 'fast')!;
      expect(fastScore.ineligibleReason).toBe('circuit open');
    });

    it('enforces a minimum success rate once enough samples exist', () => {
      // 2 successes, 3 failures = 60% error rate over 5 samples.
      for (let i = 0; i < 2; i += 1) {
        const ok = monitor.startRequest('cheap', 1);
        monitor.completeRequest(ok, { inputTokens: 1, outputTokens: 1 });
      }
      for (let i = 0; i < 3; i += 1) {
        const bad = monitor.startRequest('cheap', 1);
        monitor.failRequest(bad);
      }

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        sla: { objective: 'cost', minSuccessRate: 0.9 },
      });

      expect(decision.providerId).not.toBe('cheap');
    });

    it('ignores the success-rate SLA below the evidence threshold', () => {
      // A single failure should not disqualify a provider outright.
      const bad = monitor.startRequest('cheap', 1);
      monitor.failRequest(bad);

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        sla: { objective: 'cost', minSuccessRate: 0.9 },
        restrictTo: ['cheap'],
      });

      expect(decision.providerId).toBe('cheap');
    });
  });

  describe('cache affinity', () => {
    it('prefers a provider holding a warm prefix', () => {
      seedLatency('fast', 1_000);
      seedLatency('cheap', 1_000);
      seedLatency('smart', 1_000);

      router.recordCacheAffinity('repo-prefix', 'cheap');

      const decision = router.route({
        estimatedInputTokens: 50_000,
        estimatedOutputTokens: 1_000,
        cacheKey: 'repo-prefix',
        sla: { objective: 'latency' },
      });

      const cheapScore = decision.scores.find((s) => s.providerId === 'cheap')!;
      expect(cheapScore.components.cacheAffinity).toBe(1);
    });

    it('discounts projected latency for a warm cache', () => {
      seedLatency('fast', 1_000);

      const cold = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 100,
        restrictTo: ['fast'],
      });

      router.recordCacheAffinity('k', 'fast');
      const warm = router.route({
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 100,
        cacheKey: 'k',
        restrictTo: ['fast'],
      });

      expect(warm.projectedLatencyMs!).toBeLessThan(cold.projectedLatencyMs!);
    });

    it('clears affinity for a single key', () => {
      router.recordCacheAffinity('k', 'fast');
      router.clearCacheAffinity('k');

      const decision = router.route({
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        cacheKey: 'k',
        restrictTo: ['fast'],
      });

      expect(decision.scores[0]!.components.cacheAffinity).toBe(0);
    });
  });

  describe('filters and failover', () => {
    it('honours restrictTo', () => {
      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        restrictTo: ['smart'],
      });

      expect(decision.providerId).toBe('smart');
      expect(decision.scores).toHaveLength(1);
    });

    it('honours exclude', () => {
      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        exclude: ['fast', 'cheap'],
      });

      expect(decision.providerId).toBe('smart');
    });

    it('reroutes away from already-attempted providers', () => {
      const first = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      const second = router.reroute(
        { estimatedInputTokens: 10, estimatedOutputTokens: 10 },
        [first.providerId!]
      );

      expect(second.providerId).not.toBe(first.providerId);
    });

    it('returns null when everything is excluded', () => {
      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        exclude: ['fast', 'cheap', 'smart'],
      });

      expect(decision.providerId).toBeNull();
      expect(decision.slaAtRisk).toBe(true);
    });

    it('returns null when no providers are registered', () => {
      const empty = new AdaptiveRouter(new InfrastructureMonitor({}, clock));
      const decision = empty.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).toBeNull();
      expect(decision.reason).toMatch(/no providers/);
    });

    it('explains why every candidate was ineligible', () => {
      for (const providerId of ['fast', 'cheap', 'smart']) {
        for (let i = 0; i < 5; i += 1) {
          const ticket = monitor.startRequest(providerId, 1);
          monitor.failRequest(ticket);
        }
      }

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).toBeNull();
      expect(decision.reason).toMatch(/ineligible/);
    });
  });

  describe('budget and SLA risk', () => {
    it('excludes paid providers when the global budget is exhausted', () => {
      const capped = new InfrastructureMonitor({ budgetLimitUsd: 0.01 }, clock);
      capped.registerProvider('fast', FAST);
      capped.registerProvider('local', { maxConcurrency: 2, inputCostPerMillion: 0 });
      const cappedRouter = new AdaptiveRouter(capped);

      const ticket = capped.startRequest('fast', 100_000);
      capped.completeRequest(ticket, { inputTokens: 100_000, outputTokens: 0 });

      const decision = cappedRouter.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
      });

      expect(decision.providerId).toBe('local');
    });

    it('flags SLA risk when the winner exceeds the latency target', () => {
      seedLatency('fast', 5_000);
      seedLatency('cheap', 6_000);
      seedLatency('smart', 7_000);

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        sla: { objective: 'latency', maxLatencyMs: 1_000 },
      });

      expect(decision.providerId).toBeTruthy();
      expect(decision.slaAtRisk).toBe(true);
    });

    it('does not flag SLA risk when targets are met', () => {
      seedLatency('fast', 200);

      const decision = router.route({
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        restrictTo: ['fast'],
        sla: { objective: 'latency', maxLatencyMs: 5_000 },
      });

      expect(decision.slaAtRisk).toBe(false);
    });

    it('avoids a provider over the per-task cost cap when a cheaper one exists', () => {
      const decision = router.route({
        estimatedInputTokens: 1_000_000,
        estimatedOutputTokens: 0,
        sla: { objective: 'quality', maxCostPerTaskUsd: 1 },
      });

      // fast costs $10/M input, over the cap; cheap and smart stay eligible.
      const fastScore = decision.scores.find((s) => s.providerId === 'fast')!;
      expect(fastScore.ineligibleReason).toMatch(/budget/);
      expect(decision.providerId).not.toBe('fast');
    });

    it('still routes when every provider exceeds the cost cap', () => {
      const single = new InfrastructureMonitor({}, clock);
      single.registerProvider('fast', FAST);
      const singleRouter = new AdaptiveRouter(single);

      const decision = singleRouter.route({
        estimatedInputTokens: 1_000_000,
        estimatedOutputTokens: 0,
        sla: { objective: 'balanced', maxCostPerTaskUsd: 0.001 },
      });

      // Something must run; the decision is flagged rather than blocked.
      expect(decision.providerId).toBe('fast');
      expect(decision.slaAtRisk).toBe(true);
    });
  });

  it('includes a human-readable rationale', () => {
    seedLatency('fast', 500);

    const decision = router.route({
      estimatedInputTokens: 1_000,
      estimatedOutputTokens: 500,
      restrictTo: ['fast'],
      sla: { objective: 'latency' },
    });

    expect(decision.reason).toMatch(/selected fast/);
    expect(decision.reason).toMatch(/objective=latency/);
  });
});
