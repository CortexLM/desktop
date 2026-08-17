import { describe, it, expect, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;
import { BaseProvider, type ChatOptions, type ChatResponse, type ChatStreamChunk, type TokenPricing } from '../base.js';
import type { ProviderConfig, Message } from '../../types.js';

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    type: 'openai',
    apiKey: 'test-key',
    model: 'test-model',
    timeout: 1000,
    maxRetries: 2,
    ...overrides,
  } as ProviderConfig;
}

/** Provider concret minimal, pour exercer les helpers de `BaseProvider`. */
class StubProvider extends BaseProvider {
  // Backoff quasi instantané : on teste la logique, pas l'attente
  protected override readonly retryBaseDelayMs = 1;
  protected override readonly retryMaxDelayMs = 4;

  get name(): string {
    return 'stub';
  }

  get model(): string {
    return this.config.model;
  }

  async chat(): Promise<ChatResponse> {
    throw new Error('not used');
  }

  async *streamChat(): AsyncGenerator<ChatStreamChunk> {
    throw new Error('not used');
  }

  // Réexpose les helpers protégés pour les tests
  retry<T>(fn: () => Promise<T>, retries?: number) {
    return this.withRetry(fn, retries);
  }

  timeout<T>(promise: Promise<T>, ms?: number) {
    return this.withTimeout(promise, ms);
  }

  cost(tokensUsed: { prompt: number; completion: number }) {
    return this.calculateCost(tokensUsed);
  }
}

class PricedProvider extends StubProvider {
  protected override get pricing(): TokenPricing {
    return { promptPer1k: 0.03, completionPer1k: 0.06 };
  }
}

describe('BaseProvider.calculateCost', () => {
  it('returns 0 when the provider declares no pricing', () => {
    expect(new StubProvider(config()).cost({ prompt: 1000, completion: 1000 })).toBe(0);
  });

  it('applies the declared per-1k rates', () => {
    // 1000 prompt * 0.03 + 500 completion * 0.06/1k = 0.03 + 0.03
    expect(new PricedProvider(config()).cost({ prompt: 1000, completion: 500 })).toBeCloseTo(0.06);
  });

  it('scales linearly with token counts', () => {
    const provider = new PricedProvider(config());

    expect(provider.cost({ prompt: 2000, completion: 0 })).toBeCloseTo(0.06);
    expect(provider.cost({ prompt: 0, completion: 2000 })).toBeCloseTo(0.12);
  });

  it('returns 0 for an empty exchange', () => {
    expect(new PricedProvider(config()).cost({ prompt: 0, completion: 0 })).toBe(0);
  });

  it('handles sub-1k token counts', () => {
    expect(new PricedProvider(config()).cost({ prompt: 100, completion: 100 })).toBeCloseTo(0.009);
  });
});

describe('BaseProvider.withRetry', () => {
  it('returns the value on first success', async () => {
    const fn = mock(async () => 'ok');

    expect(await new StubProvider(config()).retry(fn)).toBe('ok');
    expect(fn.mock.calls.length).toBe(1);
  });

  it('retries until success', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient');
      return 'recovered';
    };

    const result = await new StubProvider(config()).retry(fn, 3);

    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('rethrows the last error once retries are exhausted', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      throw new Error(`fail-${attempts}`);
    };

    // retries=1 => 2 tentatives au total
    await expect(new StubProvider(config()).retry(fn, 1)).rejects.toThrow('fail-2');
    expect(attempts).toBe(2);
  });

  it('makes a single attempt when retries is 0', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      throw new Error('nope');
    };

    await expect(new StubProvider(config()).retry(fn, 0)).rejects.toThrow('nope');
    expect(attempts).toBe(1);
  });

  it('defaults the retry count to config.maxRetries', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      throw new Error('always');
    };

    // maxRetries: 2 => 3 tentatives
    await expect(new StubProvider(config({ maxRetries: 2 })).retry(fn)).rejects.toThrow('always');
    expect(attempts).toBe(3);
  });

  it('backs off exponentially between attempts', async () => {
    /** Backoff observable : base 10ms, plafond 100ms. */
    class SlowProvider extends StubProvider {
      protected override readonly retryBaseDelayMs = 10;
      protected override readonly retryMaxDelayMs = 100;
    }

    let attempts = 0;
    const fn = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    };

    const started = Date.now();
    await new SlowProvider(config()).retry(fn, 3);

    // 10ms puis 20ms
    expect(Date.now() - started).toBeGreaterThanOrEqual(30);
  });
});

describe('BaseProvider.withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    const provider = new StubProvider(config());

    expect(await provider.timeout(Promise.resolve('fast'), 500)).toBe('fast');
  });

  it('rejects with a timeout message when it does not', async () => {
    const provider = new StubProvider(config());
    const never = new Promise<string>(() => {});

    await expect(provider.timeout(never, 10)).rejects.toThrow('Timeout after 10ms');
  });

  it('propagates the underlying rejection', async () => {
    const provider = new StubProvider(config());

    await expect(provider.timeout(Promise.reject(new Error('inner')), 500)).rejects.toThrow(
      'inner'
    );
  });
});
