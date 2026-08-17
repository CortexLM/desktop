/**
 * Tests for InfraAwareOrchestrator - the observe/route/admit/execute loop.
 */

import { InfraAwareOrchestrator, type OrchestrationTask } from '../infra-aware-orchestrator';
import { AIProviderError } from '../../providers/base';
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

const FAST: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 500_000,
  inputCostPerMillion: 10,
  outputCostPerMillion: 30,
  qualityScore: 0.7,
  baselineLatencyMs: 500,
};

const CHEAP: ProviderCapacity = {
  maxConcurrency: 4,
  tokensPerMinute: 500_000,
  inputCostPerMillion: 1,
  outputCostPerMillion: 3,
  qualityScore: 0.6,
  baselineLatencyMs: 2_000,
};

describe('InfraAwareOrchestrator', () => {
  let clock: FakeClock;
  let orchestrator: InfraAwareOrchestrator;
  let slept: number[];

  /** Builds a task that succeeds, recording which provider ran it. */
  function successTask(
    id: string,
    ran: string[] = [],
    overrides: Partial<OrchestrationTask<string>> = {}
  ): OrchestrationTask<string> {
    return {
      id,
      estimatedInputTokens: 1_000,
      estimatedOutputTokens: 500,
      run: async ({ providerId }) => {
        ran.push(providerId);
        return {
          value: `done-by-${providerId}`,
          usage: { inputTokens: 1_000, outputTokens: 500 },
        };
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    clock = new FakeClock();
    slept = [];
    orchestrator = new InfraAwareOrchestrator(
      { retry: { maxAttempts: 2, initialDelayMs: 10 } },
      {
        clock,
        sleep: async (ms) => {
          slept.push(ms);
        },
      }
    );
    orchestrator.registerProvider('fast', FAST);
    orchestrator.registerProvider('cheap', CHEAP);
  });

  describe('single task execution', () => {
    it('executes a task and reports the provider used', async () => {
      const result = await orchestrator.execute(successTask('t1'));

      expect(result.success).toBe(true);
      expect(result.value).toMatch(/^done-by-/);
      expect(result.providerId).toBeTruthy();
      expect(result.attempts).toBe(1);
    });

    it('honours a latency objective', async () => {
      const result = await orchestrator.execute(
        successTask('t1', [], { sla: { objective: 'latency' } })
      );

      expect(result.providerId).toBe('fast');
    });

    it('honours a cost objective', async () => {
      const result = await orchestrator.execute(
        successTask('t1', [], { sla: { objective: 'cost' } })
      );

      expect(result.providerId).toBe('cheap');
    });

    it('bills the reported usage', async () => {
      const result = await orchestrator.execute(
        successTask('t1', [], { sla: { objective: 'cost' } })
      );

      // cheap: 1000 in at $1/M + 500 out at $3/M.
      expect(result.costUsd).toBeCloseTo(0.001 + 0.0015, 8);
    });

    it('falls back to estimates when a task reports no usage', async () => {
      const result = await orchestrator.execute({
        id: 't1',
        estimatedInputTokens: 200_000,
        estimatedOutputTokens: 0,
        sla: { objective: 'cost' },
        run: async () => ({ value: 'ok' }),
      });

      // cheap bills $1/M input: 200k tokens = $0.20.
      expect(result.costUsd).toBeCloseTo(0.2, 6);
    });

    it('records duration', async () => {
      const result = await orchestrator.execute({
        id: 't1',
        run: async () => {
          clock.advance(1_234);
          return { value: 'ok' };
        },
      });

      expect(result.durationMs).toBe(1_234);
    });

    it('restricts routing when asked', async () => {
      const result = await orchestrator.execute(
        successTask('t1', [], { restrictTo: ['cheap'] })
      );

      expect(result.providerId).toBe('cheap');
    });

    it('exposes the routing rationale', async () => {
      const result = await orchestrator.execute(successTask('t1'));
      expect(result.routingReason).toMatch(/selected/);
    });
  });

  describe('retry behaviour', () => {
    it('retries a transient failure on the same provider', async () => {
      const ran: string[] = [];
      let calls = 0;

      const result = await orchestrator.execute({
        id: 't1',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        restrictTo: ['fast'],
        run: async ({ providerId }) => {
          ran.push(providerId);
          calls += 1;
          if (calls === 1) {
            throw new AIProviderError('overloaded', 'fast', undefined, 503);
          }
          return { value: 'recovered' };
        },
      });

      expect(result.success).toBe(true);
      expect(ran).toEqual(['fast', 'fast']);
    });

    it('does not retry a permanent failure', async () => {
      let calls = 0;

      const result = await orchestrator.execute({
        id: 't1',
        restrictTo: ['fast'],
        run: async () => {
          calls += 1;
          throw new AIProviderError('bad request', 'fast', undefined, 400);
        },
      });

      expect(result.success).toBe(false);
      expect(calls).toBe(1);
    });

    it('counts retries in the stats', async () => {
      let calls = 0;

      await orchestrator.execute({
        id: 't1',
        restrictTo: ['fast'],
        run: async () => {
          calls += 1;
          if (calls === 1) throw new AIProviderError('overloaded', 'fast', undefined, 503);
          return { value: 'ok' };
        },
      });

      expect(orchestrator.getStats().totalRetries).toBe(1);
    });
  });

  describe('provider failover', () => {
    it('switches provider when one keeps failing', async () => {
      const ran: string[] = [];

      const result = await orchestrator.execute({
        id: 't1',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        sla: { objective: 'latency' },
        run: async ({ providerId }) => {
          ran.push(providerId);
          if (providerId === 'fast') {
            throw new AIProviderError('overloaded', 'fast', undefined, 503);
          }
          return { value: 'ok-from-cheap' };
        },
      });

      expect(result.success).toBe(true);
      expect(result.providerId).toBe('cheap');
      expect(result.attemptedProviders).toEqual(['fast', 'cheap']);
      expect(orchestrator.getStats().totalFailovers).toBe(1);
    });

    it('fails after exhausting every provider', async () => {
      const result = await orchestrator.execute({
        id: 't1',
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        run: async () => {
          throw new AIProviderError('overloaded', 'x', undefined, 503);
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(new Set(result.attemptedProviders)).toEqual(new Set(['fast', 'cheap']));
    });

    it('fails cleanly when no provider is eligible', async () => {
      const empty = new InfraAwareOrchestrator({}, { clock, sleep: async () => {} });
      const result = await empty.execute(successTask('t1'));

      expect(result.success).toBe(false);
      expect(result.error!.message).toMatch(/No eligible provider/);
    });

    it('opens the circuit after repeated failures', async () => {
      const breaking = new InfraAwareOrchestrator(
        {
          retry: { maxAttempts: 1 },
          circuitBreaker: { failureThreshold: 2 },
          maxProviderFailovers: 1,
        },
        { clock, sleep: async () => {} }
      );
      breaking.registerProvider('fast', FAST);

      for (let i = 0; i < 2; i += 1) {
        await breaking.execute({
          id: `t${i}`,
          restrictTo: ['fast'],
          run: async () => {
            throw new AIProviderError('down', 'fast', undefined, 503);
          },
        });
      }

      expect(breaking.breakers.getStates().fast).toBe('open');
    });

    it('routes away from an open circuit', async () => {
      const breaking = new InfraAwareOrchestrator(
        { retry: { maxAttempts: 1 }, circuitBreaker: { failureThreshold: 1 } },
        { clock, sleep: async () => {} }
      );
      breaking.registerProvider('fast', FAST);
      breaking.registerProvider('cheap', CHEAP);
      breaking.breakers.recordFailure('fast');

      const result = await breaking.execute(successTask('t1'));
      expect(result.providerId).toBe('cheap');
    });
  });

  describe('backpressure integration', () => {
    it('rejects a provider and reroutes when the budget is exhausted', async () => {
      const capped = new InfraAwareOrchestrator(
        { monitor: { budgetLimitUsd: 0.0001 }, retry: { maxAttempts: 1 } },
        { clock, sleep: async () => {} }
      );
      capped.registerProvider('paid', FAST);
      capped.registerProvider('local', { maxConcurrency: 2, inputCostPerMillion: 0 });

      // Burn the budget on the paid provider.
      const ticket = capped.monitor.startRequest('paid', 100_000);
      capped.monitor.completeRequest(ticket, { inputTokens: 100_000, outputTokens: 0 });

      const result = await capped.execute(successTask('t1'));
      expect(result.providerId).toBe('local');
    });

    it('accumulates throttle time in the stats', async () => {
      const throttling = new InfraAwareOrchestrator(
        { retry: { maxAttempts: 1 } },
        {
          clock,
          sleep: async (ms) => {
            slept.push(ms);
            clock.advance(ms);
          },
        }
      );
      throttling.registerProvider('only', {
        maxConcurrency: 4,
        tokensPerMinute: 1_000,
      });

      // Push utilisation past the soft threshold.
      const ticket = throttling.monitor.startRequest('only', 0);
      throttling.monitor.completeRequest(ticket, { inputTokens: 800, outputTokens: 0 });

      await throttling.execute({
        id: 't1',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        restrictTo: ['only'],
        run: async () => ({ value: 'ok' }),
      });

      expect(slept.length).toBeGreaterThan(0);
      expect(throttling.getStats().totalThrottledMs).toBeGreaterThan(0);
    });
  });

  describe('batch execution', () => {
    it('runs every task', async () => {
      const tasks = Array.from({ length: 6 }, (_, i) => successTask(`t${i}`));
      const results = await orchestrator.executeAll(tasks);

      expect(results).toHaveLength(6);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('returns an empty array for no tasks', async () => {
      expect(await orchestrator.executeAll([])).toEqual([]);
    });

    it('serves higher priority tasks first', async () => {
      const order: string[] = [];
      const narrow = new InfraAwareOrchestrator(
        { monitor: { maxParallelism: 1 }, retry: { maxAttempts: 1 } },
        { clock, sleep: async () => {} }
      );
      narrow.registerProvider('only', FAST);

      const makeTask = (id: string, priority: 'low' | 'critical'): OrchestrationTask<string> => ({
        id,
        priority,
        estimatedInputTokens: 10,
        estimatedOutputTokens: 10,
        run: async () => {
          order.push(id);
          return { value: id };
        },
      });

      await narrow.executeAll([
        makeTask('low-task', 'low'),
        makeTask('critical-task', 'critical'),
      ]);

      expect(order[0]).toBe('critical-task');
    });

    it('narrows parallelism when infrastructure is congested', async () => {
      // Saturating the fleet drives congestion to its ceiling.
      for (let i = 0; i < 4; i += 1) {
        orchestrator.monitor.startRequest('fast', 1);
        orchestrator.monitor.startRequest('cheap', 1);
      }

      expect(orchestrator.getSnapshot().recommendedParallelism).toBeLessThan(8);
    });

    it('reports mixed outcomes', async () => {
      const results = await orchestrator.executeAll([
        successTask('good'),
        {
          id: 'bad',
          estimatedInputTokens: 10,
          estimatedOutputTokens: 10,
          run: async () => {
            throw new AIProviderError('nope', 'x', undefined, 400);
          },
        },
      ]);

      const byId = new Map(results.map((r) => [r.taskId, r]));
      expect(byId.get('good')!.success).toBe(true);
      expect(byId.get('bad')!.success).toBe(false);
    });
  });

  describe('cache affinity', () => {
    it('keeps a repeated cacheKey on the same provider', async () => {
      const first = await orchestrator.execute(
        successTask('t1', [], { cacheKey: 'repo-a', sla: { objective: 'balanced' } })
      );

      const second = await orchestrator.execute(
        successTask('t2', [], { cacheKey: 'repo-a', sla: { objective: 'balanced' } })
      );

      expect(second.providerId).toBe(first.providerId);
    });
  });

  describe('observability', () => {
    it('counts submissions, successes and failures', async () => {
      await orchestrator.execute(successTask('ok'));
      await orchestrator.execute({
        id: 'bad',
        run: async () => {
          throw new AIProviderError('nope', 'x', undefined, 400);
        },
      });

      const stats = orchestrator.getStats();
      expect(stats.tasksSubmitted).toBe(2);
      expect(stats.tasksSucceeded).toBe(1);
      expect(stats.tasksFailed).toBe(1);
    });

    it('accumulates cost across tasks', async () => {
      await orchestrator.execute(successTask('t1', [], { sla: { objective: 'cost' } }));
      await orchestrator.execute(successTask('t2', [], { sla: { objective: 'cost' } }));

      expect(orchestrator.getStats().totalCostUsd).toBeCloseTo(2 * 0.0025, 8);
    });

    it('plans a route without executing', () => {
      const decision = orchestrator.planRoute(successTask('t1'));

      expect(decision.providerId).toBeTruthy();
      expect(orchestrator.getStats().tasksSubmitted).toBe(0);
    });

    it('exposes an infrastructure snapshot', () => {
      const snapshot = orchestrator.getSnapshot();

      expect(Object.keys(snapshot.providers)).toEqual(['fast', 'cheap']);
      expect(snapshot.congestion).toBe(0);
    });

    it('clears state on reset', async () => {
      await orchestrator.execute(successTask('t1'));
      orchestrator.reset();

      expect(orchestrator.getStats().tasksSubmitted).toBe(0);
      expect(orchestrator.getSnapshot().providers).toEqual({});
    });
  });
});
