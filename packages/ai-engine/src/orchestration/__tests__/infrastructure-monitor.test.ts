/**
 * Tests for InfrastructureMonitor - signal collection accuracy.
 */

import { InfrastructureMonitor } from '../infrastructure-monitor';
import type { Clock, ProviderCapacity } from '../types';

/** Manually advanced clock for deterministic time-dependent assertions. */
class FakeClock implements Clock {
  private current = 1_000_000;

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

const CAPACITY: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 10_000,
  requestsPerMinute: 100,
  cacheCapacityTokens: 50_000,
  inputCostPerMillion: 3,
  outputCostPerMillion: 15,
  qualityScore: 0.9,
  baselineLatencyMs: 1_000,
};

describe('InfrastructureMonitor', () => {
  let clock: FakeClock;
  let monitor: InfrastructureMonitor;

  beforeEach(() => {
    clock = new FakeClock();
    monitor = new InfrastructureMonitor({ budgetLimitUsd: 1 }, clock);
    monitor.registerProvider('anthropic', CAPACITY);
  });

  describe('provider registration', () => {
    it('registers and reports providers', () => {
      expect(monitor.hasProvider('anthropic')).toBe(true);
      expect(monitor.getProviderIds()).toEqual(['anthropic']);
    });

    it('enforces a minimum concurrency of 1', () => {
      monitor.registerProvider('weird', { maxConcurrency: 0 });
      expect(monitor.getCapacity('weird')?.maxConcurrency).toBe(1);
    });

    it('unregisters providers', () => {
      monitor.unregisterProvider('anthropic');
      expect(monitor.hasProvider('anthropic')).toBe(false);
    });

    it('throws when tracking an unknown provider', () => {
      expect(() => monitor.startRequest('nope', 10)).toThrow(/not registered/);
    });
  });

  describe('queue depth', () => {
    it('counts queued requests before they execute', () => {
      monitor.enqueue('anthropic');
      monitor.enqueue('anthropic');

      const signals = monitor.getSignals('anthropic')!;
      expect(signals.queue.queued).toBe(2);
      expect(signals.queue.inFlight).toBe(0);
    });

    it('moves queued requests to in-flight on start', () => {
      const queueId = monitor.enqueue('anthropic');
      monitor.startRequest('anthropic', 100, queueId);

      const signals = monitor.getSignals('anthropic')!;
      expect(signals.queue.queued).toBe(0);
      expect(signals.queue.inFlight).toBe(1);
    });

    it('computes saturation against max concurrency', () => {
      for (let i = 0; i < 2; i += 1) {
        monitor.startRequest('anthropic', 100);
      }
      // 2 in flight of 4 allowed.
      expect(monitor.getSignals('anthropic')!.queue.saturation).toBe(0.5);
    });

    it('tracks the oldest queue wait time', () => {
      monitor.enqueue('anthropic');
      clock.advance(5_000);
      monitor.enqueue('anthropic');

      expect(monitor.getSignals('anthropic')!.queue.oldestWaitMs).toBe(5_000);
    });

    it('drops dequeued requests without executing them', () => {
      const queueId = monitor.enqueue('anthropic');
      monitor.dequeue('anthropic', queueId);
      expect(monitor.getSignals('anthropic')!.queue.queued).toBe(0);
    });

    it('aggregates queue depth across providers', () => {
      monitor.registerProvider('openai', CAPACITY);
      monitor.enqueue('anthropic');
      monitor.startRequest('openai', 50);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.totalQueued).toBe(1);
      expect(snapshot.totalInFlight).toBe(1);
    });
  });

  describe('latency measurement', () => {
    it('measures latency from start to completion', () => {
      const ticket = monitor.startRequest('anthropic', 100);
      clock.advance(750);
      monitor.completeRequest(ticket, { inputTokens: 100, outputTokens: 50 });

      const latency = monitor.getSignals('anthropic')!.latency;
      expect(latency.lastMs).toBe(750);
      expect(latency.emaMs).toBe(750);
      expect(latency.samples).toBe(1);
    });

    it('smooths latency with an EMA across samples', () => {
      const first = monitor.startRequest('anthropic', 100);
      clock.advance(1_000);
      monitor.completeRequest(first, { inputTokens: 10, outputTokens: 10 });

      const second = monitor.startRequest('anthropic', 100);
      clock.advance(2_000);
      monitor.completeRequest(second, { inputTokens: 10, outputTokens: 10 });

      // alpha 0.3: 0.3 * 2000 + 0.7 * 1000 = 1300
      expect(monitor.getSignals('anthropic')!.latency.emaMs).toBeCloseTo(1_300, 5);
    });

    it('computes percentiles from the sample window', () => {
      for (const duration of [100, 200, 300, 400, 500]) {
        const ticket = monitor.startRequest('anthropic', 10);
        clock.advance(duration);
        monitor.completeRequest(ticket, { inputTokens: 1, outputTokens: 1 });
      }

      const latency = monitor.getSignals('anthropic')!.latency;
      expect(latency.p50Ms).toBe(300);
      expect(latency.p95Ms).toBe(500);
    });

    it('falls back to the baseline before any samples exist', () => {
      const latency = monitor.getSignals('anthropic')!.latency;
      expect(latency.p50Ms).toBe(1_000);
      expect(latency.samples).toBe(0);
    });

    it('caps the retained sample window', () => {
      const bounded = new InfrastructureMonitor({ latencySampleSize: 3 }, clock);
      bounded.registerProvider('p', CAPACITY);

      for (const duration of [10, 20, 30, 1_000]) {
        const ticket = bounded.startRequest('p', 1);
        clock.advance(duration);
        bounded.completeRequest(ticket, { inputTokens: 1, outputTokens: 1 });
      }

      // Only the last 3 samples (20, 30, 1000) remain.
      expect(bounded.getSignals('p')!.latency.p50Ms).toBe(30);
    });

    it('records latency for failed requests too', () => {
      const ticket = monitor.startRequest('anthropic', 100);
      clock.advance(400);
      monitor.failRequest(ticket);

      expect(monitor.getSignals('anthropic')!.latency.lastMs).toBe(400);
    });
  });

  describe('rate limit tracking', () => {
    it('accumulates token usage in the window', () => {
      const ticket = monitor.startRequest('anthropic', 1_000);
      monitor.completeRequest(ticket, { inputTokens: 1_000, outputTokens: 500 });

      const rateLimit = monitor.getSignals('anthropic')!.rateLimit;
      expect(rateLimit.tokensUsed).toBe(1_500);
      expect(rateLimit.tokensRemaining).toBe(8_500);
      expect(rateLimit.utilization).toBeCloseTo(0.15, 5);
    });

    it('counts in-flight estimates against the limit', () => {
      monitor.startRequest('anthropic', 2_000);

      const rateLimit = monitor.getSignals('anthropic')!.rateLimit;
      expect(rateLimit.tokensUsed).toBe(2_000);
      expect(rateLimit.requestsUsed).toBe(1);
    });

    it('expires usage outside the trailing window', () => {
      const ticket = monitor.startRequest('anthropic', 5_000);
      monitor.completeRequest(ticket, { inputTokens: 5_000, outputTokens: 0 });
      expect(monitor.getSignals('anthropic')!.rateLimit.tokensUsed).toBe(5_000);

      clock.advance(61_000);
      expect(monitor.getSnapshot().providers.anthropic!.rateLimit.tokensUsed).toBe(0);
    });

    it('leaves limits undefined when not configured', () => {
      monitor.registerProvider('ollama', { maxConcurrency: 2 });
      const rateLimit = monitor.getSignals('ollama')!.rateLimit;

      expect(rateLimit.tokensRemaining).toBeUndefined();
      expect(rateLimit.utilization).toBe(0);
    });

    it('surfaces a provider Retry-After hint', () => {
      const ticket = monitor.startRequest('anthropic', 10);
      monitor.failRequest(ticket, { retryAfterMs: 5_000 });

      expect(monitor.getSignals('anthropic')!.rateLimit.retryAfterMs).toBe(5_000);
    });

    it('clears the Retry-After hint once it elapses', () => {
      const ticket = monitor.startRequest('anthropic', 10);
      monitor.failRequest(ticket, { retryAfterMs: 1_000 });
      clock.advance(1_500);

      expect(
        monitor.getSnapshot().providers.anthropic!.rateLimit.retryAfterMs
      ).toBeUndefined();
    });
  });

  describe('KV-cache state', () => {
    it('records a cache hit when cached tokens are returned', () => {
      const ticket = monitor.startRequest('anthropic', 1_000);
      monitor.completeRequest(ticket, {
        inputTokens: 1_000,
        outputTokens: 10,
        cachedInputTokens: 800,
      });

      const cache = monitor.getSignals('anthropic')!.cache;
      expect(cache.hits).toBe(1);
      expect(cache.hitRate).toBe(1);
      expect(cache.usedTokens).toBe(800);
    });

    it('records a miss when nothing was cached', () => {
      const ticket = monitor.startRequest('anthropic', 500);
      monitor.completeRequest(ticket, { inputTokens: 500, outputTokens: 10 });

      const cache = monitor.getSignals('anthropic')!.cache;
      expect(cache.misses).toBe(1);
      expect(cache.hitRate).toBe(0);
    });

    it('computes cache pressure against capacity', () => {
      monitor.setCacheUsage('anthropic', 25_000);
      expect(monitor.getSignals('anthropic')!.cache.pressure).toBe(0.5);
    });

    it('caps occupancy at capacity', () => {
      const ticket = monitor.startRequest('anthropic', 100_000);
      monitor.completeRequest(ticket, { inputTokens: 100_000, outputTokens: 0 });

      const cache = monitor.getSignals('anthropic')!.cache;
      expect(cache.usedTokens).toBe(50_000);
      expect(cache.pressure).toBe(1);
    });

    it('reports zero pressure when capacity is unknown', () => {
      monitor.registerProvider('ollama', { maxConcurrency: 1 });
      monitor.setCacheUsage('ollama', 9_999);
      expect(monitor.getSignals('ollama')!.cache.pressure).toBe(0);
    });

    it('tracks standalone cache lookups', () => {
      monitor.recordCacheLookup('anthropic', true);
      monitor.recordCacheLookup('anthropic', false);

      expect(monitor.getSignals('anthropic')!.cache.hitRate).toBe(0.5);
    });
  });

  describe('cost tracking', () => {
    it('bills input and output tokens at their own rates', () => {
      const ticket = monitor.startRequest('anthropic', 1_000_000);
      monitor.completeRequest(ticket, {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      });

      // $3 input + $15 output per million.
      expect(monitor.getSignals('anthropic')!.cost.spentUsd).toBeCloseTo(18, 6);
    });

    it('projects cost without recording it', () => {
      const projected = monitor.projectCost('anthropic', 500_000, 100_000);
      expect(projected).toBeCloseTo(1.5 + 1.5, 6);
      expect(monitor.getSignals('anthropic')!.cost.spentUsd).toBe(0);
    });

    it('projects zero for unknown providers', () => {
      expect(monitor.projectCost('nope', 1_000, 1_000)).toBe(0);
    });

    it('aggregates budget utilisation across providers', () => {
      monitor.registerProvider('openai', { ...CAPACITY, inputCostPerMillion: 2.5 });

      const a = monitor.startRequest('anthropic', 100_000);
      monitor.completeRequest(a, { inputTokens: 100_000, outputTokens: 0 });
      const b = monitor.startRequest('openai', 100_000);
      monitor.completeRequest(b, { inputTokens: 100_000, outputTokens: 0 });

      const budget = monitor.getBudgetState();
      // 0.3 + 0.25 against a $1 limit.
      expect(budget.spentUsd).toBeCloseTo(0.55, 6);
      expect(budget.utilization).toBeCloseTo(0.55, 6);
      expect(budget.remainingUsd).toBeCloseTo(0.45, 6);
    });

    it('flags a near-limit budget', () => {
      const ticket = monitor.startRequest('anthropic', 300_000);
      monitor.completeRequest(ticket, { inputTokens: 300_000, outputTokens: 0 });
      // $0.9 of a $1 budget.
      expect(monitor.getBudgetState().nearLimit).toBe(true);
      expect(monitor.getBudgetState().exhausted).toBe(false);
    });

    it('flags an exhausted budget', () => {
      const ticket = monitor.startRequest('anthropic', 400_000);
      monitor.completeRequest(ticket, { inputTokens: 400_000, outputTokens: 0 });
      expect(monitor.getBudgetState().exhausted).toBe(true);
    });

    it('treats an unset budget as unbounded', () => {
      const unbounded = new InfrastructureMonitor({}, clock);
      unbounded.registerProvider('anthropic', CAPACITY);

      const ticket = unbounded.startRequest('anthropic', 10_000_000);
      unbounded.completeRequest(ticket, { inputTokens: 10_000_000, outputTokens: 0 });

      const budget = unbounded.getBudgetState();
      expect(budget.utilization).toBe(0);
      expect(budget.exhausted).toBe(false);
      expect(budget.limitUsd).toBeUndefined();
    });
  });

  describe('health classification', () => {
    it('starts healthy', () => {
      expect(monitor.getSignals('anthropic')!.health).toBe('healthy');
    });

    it('marks a provider saturated when the queue is full', () => {
      for (let i = 0; i < 4; i += 1) {
        monitor.startRequest('anthropic', 1);
      }
      expect(monitor.getSignals('anthropic')!.health).toBe('saturated');
    });

    it('marks a provider degraded on a high error rate', () => {
      // 1 success, 1 failure = 50% error rate, above the 20% default.
      const ok = monitor.startRequest('anthropic', 1);
      monitor.completeRequest(ok, { inputTokens: 1, outputTokens: 1 });
      const bad = monitor.startRequest('anthropic', 1);
      monitor.failRequest(bad);

      expect(monitor.getSignals('anthropic')!.health).toBe('degraded');
    });

    it('marks a provider down after repeated consecutive failures', () => {
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('anthropic', 1);
        monitor.failRequest(ticket);
      }
      expect(monitor.getSignals('anthropic')!.health).toBe('down');
    });

    it('marks a provider down while a Retry-After is active', () => {
      const ticket = monitor.startRequest('anthropic', 1);
      monitor.failRequest(ticket, { retryAfterMs: 10_000 });
      expect(monitor.getSignals('anthropic')!.health).toBe('down');
    });

    it('resets consecutive failures on success', () => {
      for (let i = 0; i < 3; i += 1) {
        const ticket = monitor.startRequest('anthropic', 1);
        monitor.failRequest(ticket);
      }
      const ok = monitor.startRequest('anthropic', 1);
      monitor.completeRequest(ok, { inputTokens: 1, outputTokens: 1 });

      expect(monitor.getSignals('anthropic')!.reliability.consecutiveFailures).toBe(0);
    });
  });

  describe('congestion and parallelism', () => {
    it('reports no congestion when idle', () => {
      const snapshot = monitor.getSnapshot();
      expect(snapshot.congestion).toBe(0);
      expect(snapshot.recommendedParallelism).toBe(8);
    });

    it('raises congestion as the queue fills', () => {
      for (let i = 0; i < 3; i += 1) {
        monitor.startRequest('anthropic', 1);
      }
      expect(monitor.getSnapshot().congestion).toBeGreaterThan(0);
    });

    it('narrows parallelism as congestion rises', () => {
      const idle = monitor.parallelismFor(0);
      const busy = monitor.parallelismFor(0.5);
      const overloaded = monitor.parallelismFor(1);

      expect(idle).toBe(8);
      expect(busy).toBeLessThan(idle);
      expect(overloaded).toBe(1);
    });

    it('never drops parallelism below the floor', () => {
      const wide = new InfrastructureMonitor({ minParallelism: 2, maxParallelism: 6 }, clock);
      expect(wide.parallelismFor(1)).toBe(2);
    });

    it('treats a fully down fleet as maximally congested', () => {
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('anthropic', 1);
        monitor.failRequest(ticket);
      }
      expect(monitor.getSnapshot().congestion).toBe(1);
    });

    it('excludes down providers from the congestion average', () => {
      monitor.registerProvider('openai', CAPACITY);
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('anthropic', 1);
        monitor.failRequest(ticket);
      }

      // openai is idle and healthy, so overall congestion stays at 0.
      expect(monitor.getSnapshot().congestion).toBe(0);
    });
  });

  describe('events', () => {
    it('emits when a provider degrades', () => {
      const events: unknown[] = [];
      monitor.on('provider:degraded', (payload) => events.push(payload));

      const ok = monitor.startRequest('anthropic', 1);
      monitor.completeRequest(ok, { inputTokens: 1, outputTokens: 1 });
      const bad = monitor.startRequest('anthropic', 1);
      monitor.failRequest(bad);

      expect(events).toHaveLength(1);
    });

    it('emits when the budget is exhausted', () => {
      const events: unknown[] = [];
      monitor.on('budget:exhausted', (payload) => events.push(payload));

      const ticket = monitor.startRequest('anthropic', 400_000);
      monitor.completeRequest(ticket, { inputTokens: 400_000, outputTokens: 0 });

      expect(events).toHaveLength(1);
    });

    it('emits budget warnings only once', () => {
      const events: unknown[] = [];
      monitor.on('budget:near', (payload) => events.push(payload));

      for (let i = 0; i < 2; i += 1) {
        const ticket = monitor.startRequest('anthropic', 150_000);
        monitor.completeRequest(ticket, { inputTokens: 150_000, outputTokens: 0 });
      }

      expect(events).toHaveLength(1);
    });

    it('stops delivering after unsubscribe', () => {
      const events: unknown[] = [];
      const off = monitor.on('provider:degraded', (payload) => events.push(payload));
      off();

      const ok = monitor.startRequest('anthropic', 1);
      monitor.completeRequest(ok, { inputTokens: 1, outputTokens: 1 });
      const bad = monitor.startRequest('anthropic', 1);
      monitor.failRequest(bad);

      expect(events).toHaveLength(0);
    });
  });

  it('clears all state on reset', () => {
    monitor.startRequest('anthropic', 100);
    monitor.reset();

    expect(monitor.getProviderIds()).toEqual([]);
    expect(monitor.getBudgetState().spentUsd).toBe(0);
  });
});
