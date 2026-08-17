/**
 * Tests for BackpressureController - admission control under pressure.
 */

import { BackpressureController } from '../backpressure';
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

const CAPACITY: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 10_000,
  requestsPerMinute: 60,
  inputCostPerMillion: 3,
  outputCostPerMillion: 15,
  baselineLatencyMs: 1_000,
};

const SMALL_REQUEST = { estimatedInputTokens: 100, estimatedOutputTokens: 100 };

describe('BackpressureController', () => {
  let clock: FakeClock;
  let monitor: InfrastructureMonitor;
  let controller: BackpressureController;

  /** Burns rate-limit budget by completing a request of the given size. */
  function consumeTokens(providerId: string, tokens: number): void {
    const ticket = monitor.startRequest(providerId, 0);
    monitor.completeRequest(ticket, { inputTokens: tokens, outputTokens: 0 });
  }

  beforeEach(() => {
    clock = new FakeClock();
    monitor = new InfrastructureMonitor({ budgetLimitUsd: 1 }, clock);
    monitor.registerProvider('main', CAPACITY);
    controller = new BackpressureController(monitor);
  });

  describe('admission', () => {
    it('admits when infrastructure has headroom', () => {
      const decision = controller.evaluate('main', SMALL_REQUEST);

      expect(decision.action).toBe('admit');
      expect(decision.delayMs).toBe(0);
    });

    it('rejects an unregistered provider', () => {
      const decision = controller.evaluate('missing', SMALL_REQUEST);

      expect(decision.action).toBe('reject');
      expect(decision.reason).toMatch(/not registered/);
    });

    it('rejects when the provider is down with no Retry-After', () => {
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('main', 1);
        monitor.failRequest(ticket);
      }

      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('reject');
      expect(decision.reason).toMatch(/down/);
    });

    it('prefers a waitable throttle over rejection when Retry-After is set', () => {
      // Enough consecutive failures to look `down`, but the provider told us
      // exactly how long to wait, so waiting is the correct action.
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('main', 1);
        monitor.failRequest(ticket, { retryAfterMs: 2_000 });
      }

      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('throttle');
      expect(decision.delayMs).toBe(2_000);
    });
  });

  describe('rate limit backpressure', () => {
    it('throttles as the rate limit approaches', () => {
      // 8000 of 10000 tokens/min is 80%, past the 75% soft threshold.
      consumeTokens('main', 8_000);

      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('throttle');
      expect(decision.delayMs).toBeGreaterThan(0);
      expect(decision.reason).toMatch(/approaching rate limit/);
    });

    it('waits for the window to reset past the hard threshold', () => {
      consumeTokens('main', 9_800);

      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('throttle');
      expect(decision.reason).toMatch(/window reset/);
    });

    it('projects the incoming request into the utilisation check', () => {
      // 7000 used is 70%, under the threshold on its own.
      consumeTokens('main', 7_000);
      expect(controller.evaluate('main', SMALL_REQUEST).action).toBe('admit');

      // A 2000-token request would push it to 90%.
      const large = { estimatedInputTokens: 1_500, estimatedOutputTokens: 500 };
      expect(controller.evaluate('main', large).action).toBe('throttle');
    });

    it('scales the delay with the excess pressure', () => {
      consumeTokens('main', 8_000);
      const mild = controller.evaluate('main', SMALL_REQUEST).delayMs;

      const severe = controller.evaluate('main', {
        estimatedInputTokens: 1_000,
        estimatedOutputTokens: 500,
      }).delayMs;

      expect(severe).toBeGreaterThan(mild);
    });

    it('honours an explicit Retry-After', () => {
      const ticket = monitor.startRequest('main', 1);
      monitor.failRequest(ticket, { retryAfterMs: 4_000 });

      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('throttle');
      expect(decision.delayMs).toBe(4_000);
    });

    it('caps the delay at the configured maximum', () => {
      const capped = new BackpressureController(monitor, { maxThrottleDelayMs: 1_000 });
      const ticket = monitor.startRequest('main', 1);
      monitor.failRequest(ticket, { retryAfterMs: 60_000 });

      expect(capped.evaluate('main', SMALL_REQUEST).delayMs).toBe(1_000);
    });

    it('rejects a request larger than the whole per-minute allowance', () => {
      // No amount of waiting makes this admissible.
      const decision = controller.evaluate('main', {
        estimatedInputTokens: 20_000,
        estimatedOutputTokens: 0,
      });

      expect(decision.action).toBe('reject');
      expect(decision.reason).toMatch(/above the 10000\/min limit/);
    });

    it('ignores rate limits when none are configured', () => {
      monitor.registerProvider('local', { maxConcurrency: 4 });
      const decision = controller.evaluate('local', {
        estimatedInputTokens: 10_000_000,
        estimatedOutputTokens: 10_000_000,
      });

      expect(decision.action).toBe('admit');
    });
  });

  describe('queue backpressure', () => {
    it('throttles under queue pressure', () => {
      // 3 of 4 slots is 75%, under the 80% soft threshold; 4 hits 100%.
      for (let i = 0; i < 3; i += 1) {
        monitor.startRequest('main', 1);
      }
      expect(controller.evaluate('main', SMALL_REQUEST).action).toBe('admit');

      monitor.startRequest('main', 1);
      const decision = controller.evaluate('main', SMALL_REQUEST);
      expect(decision.action).toBe('throttle');
      expect(decision.reason).toMatch(/queue/);
    });

    it('reports the queue occupancy in the reason', () => {
      for (let i = 0; i < 4; i += 1) {
        monitor.startRequest('main', 1);
      }

      expect(controller.evaluate('main', SMALL_REQUEST).reason).toMatch(/4\/4/);
    });
  });

  describe('budget backpressure', () => {
    // A generous token limit keeps rate-limit pressure out of these cases so
    // only the budget signal is under test.
    const UNMETERED: ProviderCapacity = {
      maxConcurrency: 4,
      tokensPerMinute: 10_000_000,
      inputCostPerMillion: 3,
      outputCostPerMillion: 15,
    };

    beforeEach(() => {
      monitor.registerProvider('rich', UNMETERED);
    });

    it('reserves the remaining budget for critical work', () => {
      // $0.92 of a $1 budget, past the 90% throttle threshold.
      consumeTokens('rich', 306_667);

      const normal = controller.evaluate('rich', { ...SMALL_REQUEST, priority: 'normal' });
      expect(normal.action).toBe('reject');
      expect(normal.reason).toMatch(/budget/);

      const critical = controller.evaluate('rich', { ...SMALL_REQUEST, priority: 'critical' });
      expect(critical.action).toBe('admit');
    });

    it('rejects everything once the budget is exhausted', () => {
      consumeTokens('rich', 400_000);

      const decision = controller.evaluate('rich', { ...SMALL_REQUEST, priority: 'critical' });
      expect(decision.action).toBe('reject');
      expect(decision.reason).toMatch(/exhausted/);
    });

    it('still admits free providers when the budget is exhausted', () => {
      monitor.registerProvider('local', { maxConcurrency: 2, inputCostPerMillion: 0 });
      consumeTokens('rich', 400_000);

      expect(controller.evaluate('local', SMALL_REQUEST).action).toBe('admit');
    });
  });

  describe('priority handling', () => {
    it('lets critical work bypass soft throttling', () => {
      consumeTokens('main', 8_000);

      expect(controller.evaluate('main', { ...SMALL_REQUEST, priority: 'normal' }).action).toBe(
        'throttle'
      );
      expect(controller.evaluate('main', { ...SMALL_REQUEST, priority: 'critical' }).action).toBe(
        'admit'
      );
    });

    it('still throttles critical work past the hard limit', () => {
      consumeTokens('main', 9_900);

      expect(controller.evaluate('main', { ...SMALL_REQUEST, priority: 'critical' }).action).toBe(
        'throttle'
      );
    });
  });

  describe('waitForCapacity', () => {
    it('returns immediately when there is headroom', async () => {
      const slept: number[] = [];
      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        sleep: async (ms) => {
          slept.push(ms);
        },
      });

      expect(decision.action).toBe('admit');
      expect(slept).toHaveLength(0);
    });

    it('sleeps then admits once pressure clears', async () => {
      consumeTokens('main', 8_000);
      const slept: number[] = [];

      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        sleep: async (ms) => {
          slept.push(ms);
          // Advancing past the window expires the recorded usage.
          clock.advance(61_000);
        },
      });

      expect(slept).toHaveLength(1);
      expect(decision.action).toBe('admit');
    });

    it('gives up once the wait budget is spent', async () => {
      consumeTokens('main', 8_000);

      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        maxWaitMs: 1_000,
        sleep: async (ms) => {
          clock.advance(ms);
        },
      });

      expect(decision.action).toBe('reject');
      expect(decision.reason).toMatch(/exceeded/);
    });

    it('terminates even when sleeping does not advance the clock', async () => {
      // Guards against spinning when the caller's sleep is a no-op.
      consumeTokens('main', 9_900);
      let sleeps = 0;

      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        maxWaitMs: 5_000,
        sleep: async () => {
          sleeps += 1;
        },
      });

      expect(decision.action).toBe('reject');
      expect(sleeps).toBeLessThan(100);
    });

    it('reports the total time waited', async () => {
      consumeTokens('main', 8_000);

      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        sleep: async (ms) => {
          clock.advance(ms);
          clock.advance(61_000);
        },
      });

      expect(decision.action).toBe('admit');
      expect(decision.waitedMs).toBeGreaterThan(0);
    });

    it('surfaces a hard rejection without sleeping', async () => {
      for (let i = 0; i < 5; i += 1) {
        const ticket = monitor.startRequest('main', 1);
        monitor.failRequest(ticket);
      }

      const slept: number[] = [];
      const decision = await controller.waitForCapacity('main', SMALL_REQUEST, {
        sleep: async (ms) => {
          slept.push(ms);
        },
      });

      expect(decision.action).toBe('reject');
      expect(slept).toHaveLength(0);
    });
  });
});
