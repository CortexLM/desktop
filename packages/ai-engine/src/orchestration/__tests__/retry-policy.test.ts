/**
 * Tests for RetryPolicy - transient-failure classification and backoff.
 */

import { AIProviderError } from '../../providers/base';
import { RetryExhaustedError, RetryPolicy, extractRetryAfterMs } from '../retry-policy';

describe('RetryPolicy', () => {
  /** Records sleeps instead of performing them. */
  function makePolicy(config = {}, random = () => 0.5) {
    const slept: number[] = [];
    const policy = new RetryPolicy(config, {
      sleep: async (ms) => {
        slept.push(ms);
      },
      random,
    });
    return { policy, slept };
  }

  describe('retry classification', () => {
    it('retries 429', () => {
      const { policy } = makePolicy();
      expect(policy.isRetryable(new AIProviderError('rate limited', 'p', undefined, 429))).toBe(
        true
      );
    });

    it('retries 5xx', () => {
      const { policy } = makePolicy();
      for (const status of [500, 502, 503, 504, 529]) {
        expect(policy.isRetryable(new AIProviderError('server', 'p', undefined, status))).toBe(
          true
        );
      }
    });

    it('does not retry client errors', () => {
      const { policy } = makePolicy();
      for (const status of [400, 401, 403, 404, 422]) {
        expect(policy.isRetryable(new AIProviderError('client', 'p', undefined, status))).toBe(
          false
        );
      }
    });

    it('retries transient transport codes', () => {
      const { policy } = makePolicy();
      for (const code of ['ECONNRESET', 'ETIMEDOUT', 'overloaded_error']) {
        expect(policy.isRetryable({ code })).toBe(true);
      }
    });

    it('retries based on message text when no code is present', () => {
      const { policy } = makePolicy();
      expect(policy.isRetryable(new Error('socket hang up'))).toBe(true);
      expect(policy.isRetryable(new Error('request timed out'))).toBe(true);
    });

    it('does not retry explicit client-error messages', () => {
      const { policy } = makePolicy();
      expect(policy.isRetryable(new Error('invalid api key'))).toBe(false);
      expect(policy.isRetryable(new Error('unauthorized'))).toBe(false);
    });

    it('retries unclassifiable errors', () => {
      const { policy } = makePolicy();
      expect(policy.isRetryable(new Error('something odd happened'))).toBe(true);
    });
  });

  describe('backoff', () => {
    it('grows exponentially', () => {
      // random 0.5 makes the jitter term zero.
      const { policy } = makePolicy({ initialDelayMs: 100, backoffMultiplier: 2 });

      expect(policy.delayFor(1)).toBe(100);
      expect(policy.delayFor(2)).toBe(200);
      expect(policy.delayFor(3)).toBe(400);
    });

    it('caps at maxDelayMs', () => {
      const { policy } = makePolicy({
        initialDelayMs: 1_000,
        backoffMultiplier: 10,
        maxDelayMs: 5_000,
      });

      expect(policy.delayFor(5)).toBe(5_000);
    });

    it('applies jitter around the base delay', () => {
      const high = makePolicy({ initialDelayMs: 1_000, jitterFactor: 0.2 }, () => 1);
      const low = makePolicy({ initialDelayMs: 1_000, jitterFactor: 0.2 }, () => 0);

      expect(high.policy.delayFor(1)).toBe(1_200);
      expect(low.policy.delayFor(1)).toBe(800);
    });

    it('never returns a negative delay', () => {
      const { policy } = makePolicy({ initialDelayMs: 100, jitterFactor: 2 }, () => 0);
      expect(policy.delayFor(1)).toBeGreaterThanOrEqual(0);
    });

    it('honours Retry-After over the computed backoff', () => {
      const { policy } = makePolicy({ initialDelayMs: 100 });
      expect(policy.delayFor(1, { retryAfterMs: 7_000 })).toBe(7_000);
    });

    it('ignores Retry-After when disabled', () => {
      const { policy } = makePolicy({ initialDelayMs: 100, respectRetryAfter: false });
      expect(policy.delayFor(1, { retryAfterMs: 7_000 })).toBe(100);
    });
  });

  describe('execute', () => {
    it('returns immediately on success', async () => {
      const { policy, slept } = makePolicy();
      const result = await policy.execute(async () => 'ok');

      expect(result.value).toBe('ok');
      expect(result.attempts).toBe(1);
      expect(slept).toHaveLength(0);
    });

    it('retries a transient failure then succeeds', async () => {
      const { policy, slept } = makePolicy({ initialDelayMs: 100 });
      let calls = 0;

      const result = await policy.execute(async () => {
        calls += 1;
        if (calls < 3) {
          throw new AIProviderError('overloaded', 'p', undefined, 503);
        }
        return 'recovered';
      });

      expect(result.value).toBe('recovered');
      expect(result.attempts).toBe(3);
      expect(slept).toEqual([100, 200]);
    });

    it('passes the attempt number to the operation', async () => {
      const { policy } = makePolicy();
      const seen: number[] = [];

      await policy.execute(async (attempt) => {
        seen.push(attempt);
        if (attempt < 2) throw new AIProviderError('retry', 'p', undefined, 503);
        return 'ok';
      });

      expect(seen).toEqual([1, 2]);
    });

    it('stops immediately on a permanent failure', async () => {
      const { policy, slept } = makePolicy();
      let calls = 0;

      await expect(
        policy.execute(async () => {
          calls += 1;
          throw new AIProviderError('bad request', 'p', undefined, 400);
        })
      ).rejects.toThrow(RetryExhaustedError);

      expect(calls).toBe(1);
      expect(slept).toHaveLength(0);
    });

    it('throws once attempts are exhausted', async () => {
      const { policy } = makePolicy({ maxAttempts: 2, initialDelayMs: 10 });
      let calls = 0;

      await expect(
        policy.execute(async () => {
          calls += 1;
          throw new AIProviderError('overloaded', 'p', undefined, 503);
        })
      ).rejects.toThrow(RetryExhaustedError);

      expect(calls).toBe(2);
    });

    it('reports the last error on exhaustion', async () => {
      const { policy } = makePolicy({ maxAttempts: 2, initialDelayMs: 10 });

      try {
        await policy.execute(async () => {
          throw new AIProviderError('still overloaded', 'p', undefined, 503);
        });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect((error as RetryExhaustedError).attempts).toBe(2);
        expect((error as RetryExhaustedError).lastError).toBeInstanceOf(AIProviderError);
      }
    });

    it('invokes the retry callback before each sleep', async () => {
      const { policy } = makePolicy({ initialDelayMs: 100 });
      const attempts: number[] = [];
      let calls = 0;

      await policy.execute(
        async () => {
          calls += 1;
          if (calls < 3) throw new AIProviderError('retry', 'p', undefined, 503);
          return 'ok';
        },
        (context) => attempts.push(context.attempt)
      );

      expect(attempts).toEqual([1, 2]);
    });

    it('accumulates total delay', async () => {
      const { policy } = makePolicy({ initialDelayMs: 100 });
      let calls = 0;

      const result = await policy.execute(async () => {
        calls += 1;
        if (calls < 3) throw new AIProviderError('retry', 'p', undefined, 503);
        return 'ok';
      });

      expect(result.totalDelayMs).toBe(300);
    });

    it('uses a Retry-After hint from the thrown error', async () => {
      const { policy, slept } = makePolicy({ initialDelayMs: 100 });
      let calls = 0;

      await policy.execute(async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('rate limited'), { status: 429, retryAfter: 3 });
        }
        return 'ok';
      });

      expect(slept).toEqual([3_000]);
    });
  });

  it('exposes maxAttempts', () => {
    const { policy } = makePolicy({ maxAttempts: 7 });
    expect(policy.maxAttempts).toBe(7);
  });
});

describe('extractRetryAfterMs', () => {
  it('reads retryAfterMs directly', () => {
    expect(extractRetryAfterMs({ retryAfterMs: 1_500 })).toBe(1_500);
  });

  it('converts retryAfter seconds', () => {
    expect(extractRetryAfterMs({ retryAfter: 2 })).toBe(2_000);
  });

  it('parses a string retryAfter', () => {
    expect(extractRetryAfterMs({ retry_after: '1.5' })).toBe(1_500);
  });

  it('reads the retry-after header', () => {
    expect(extractRetryAfterMs({ headers: { 'retry-after': '4' } })).toBe(4_000);
  });

  it('returns undefined when absent', () => {
    expect(extractRetryAfterMs(new Error('boom'))).toBeUndefined();
    expect(extractRetryAfterMs(null)).toBeUndefined();
    expect(extractRetryAfterMs('string')).toBeUndefined();
  });

  it('clamps negatives to zero', () => {
    expect(extractRetryAfterMs({ retryAfterMs: -100 })).toBe(0);
  });
});
