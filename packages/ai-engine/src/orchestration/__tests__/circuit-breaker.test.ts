/**
 * Tests for CircuitBreaker - fail-fast state transitions.
 */

import { CircuitBreaker, CircuitBreakerRegistry } from '../circuit-breaker';
import type { Clock } from '../types';

class FakeClock implements Clock {
  private current = 1_000_000;

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

describe('CircuitBreaker', () => {
  let clock: FakeClock;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    clock = new FakeClock();
    breaker = new CircuitBreaker(
      { failureThreshold: 3, cooldownMs: 10_000, successThreshold: 2 },
      clock
    );
  });

  describe('closed state', () => {
    it('starts closed and permits traffic', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.canRequest()).toBe(true);
    });

    it('stays closed below the failure threshold', () => {
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe('closed');
      expect(breaker.canRequest()).toBe(true);
    });

    it('resets the failure count on success', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();
      breaker.recordFailure();
      breaker.recordFailure();

      // Only 2 consecutive failures since the success.
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('open state', () => {
    it('trips open at the failure threshold', () => {
      for (let i = 0; i < 3; i += 1) {
        breaker.recordFailure();
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.canRequest()).toBe(false);
    });

    it('blocks traffic during the cooldown', () => {
      for (let i = 0; i < 3; i += 1) {
        breaker.recordFailure();
      }
      clock.advance(9_000);

      expect(breaker.canRequest()).toBe(false);
      expect(breaker.getSnapshot().cooldownRemainingMs).toBe(1_000);
    });

    it('can be tripped manually', () => {
      breaker.trip();
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('half-open state', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i += 1) {
        breaker.recordFailure();
      }
      clock.advance(10_000);
    });

    it('moves to half-open after the cooldown', () => {
      expect(breaker.getState()).toBe('half-open');
      expect(breaker.canRequest()).toBe(true);
    });

    it('limits concurrent probes', () => {
      expect(breaker.acquire()).toBe(true);
      // Default halfOpenMaxProbes is 1, so the second probe is refused.
      expect(breaker.canRequest()).toBe(false);
    });

    it('closes after enough consecutive probe successes', () => {
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('half-open');

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('closed');
    });

    it('re-opens immediately when a probe fails', () => {
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
    });

    it('restarts the cooldown when a probe fails', () => {
      breaker.recordFailure();
      clock.advance(5_000);

      expect(breaker.canRequest()).toBe(false);
      expect(breaker.getSnapshot().cooldownRemainingMs).toBe(5_000);
    });

    it('releases the probe slot after the outcome is recorded', () => {
      breaker.acquire();
      expect(breaker.canRequest()).toBe(false);

      breaker.recordSuccess();
      expect(breaker.canRequest()).toBe(true);
    });
  });

  describe('acquire', () => {
    it('permits acquisition while closed', () => {
      expect(breaker.acquire()).toBe(true);
    });

    it('refuses acquisition while open', () => {
      breaker.trip();
      expect(breaker.acquire()).toBe(false);
    });
  });

  it('closes and clears counters on close', () => {
    breaker.trip();
    breaker.close();

    const snapshot = breaker.getSnapshot();
    expect(snapshot.state).toBe('closed');
    expect(snapshot.consecutiveFailures).toBe(0);
    expect(snapshot.openedAt).toBeUndefined();
  });

  it('reports diagnostics', () => {
    breaker.recordFailure();
    const snapshot = breaker.getSnapshot();

    expect(snapshot.state).toBe('closed');
    expect(snapshot.consecutiveFailures).toBe(1);
    expect(snapshot.cooldownRemainingMs).toBe(0);
  });
});

describe('CircuitBreakerRegistry', () => {
  let clock: FakeClock;
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    clock = new FakeClock();
    registry = new CircuitBreakerRegistry({ failureThreshold: 2 }, clock);
  });

  it('creates a breaker per provider on first use', () => {
    const a = registry.get('openai');
    const b = registry.get('openai');
    const c = registry.get('anthropic');

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('isolates providers from each other', () => {
    registry.recordFailure('openai');
    registry.recordFailure('openai');

    expect(registry.canRequest('openai')).toBe(false);
    expect(registry.canRequest('anthropic')).toBe(true);
  });

  it('reports states per provider', () => {
    registry.recordFailure('openai');
    registry.recordFailure('openai');
    registry.recordSuccess('anthropic');

    expect(registry.getStates()).toEqual({
      openai: 'open',
      anthropic: 'closed',
    });
  });

  it('closes every breaker on reset', () => {
    registry.recordFailure('openai');
    registry.recordFailure('openai');
    registry.resetAll();

    expect(registry.canRequest('openai')).toBe(true);
  });
});
