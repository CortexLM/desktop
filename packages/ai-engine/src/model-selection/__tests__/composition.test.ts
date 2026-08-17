/**
 * Composition tests: the three criteria applied together.
 *
 * The headline case is the one the three systems could not previously express:
 * a trivial task (which `routing/` wants on the cheap lane) whose cheap-lane
 * providers are saturated (which only `orchestration/` knows), under a user
 * preset (which only `model-presets.ts` knows).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InfraAwareOrchestrator } from '../../orchestration/infra-aware-orchestrator';
import { DEFAULT_PROVIDER_CAPACITIES } from '../../orchestration/registry-adapter';
import type { Clock } from '../../orchestration/types';
import { UnifiedModelSelector, createUnifiedModelSelector } from '../unified-selector';
import type { SelectionAttemptResult } from '../unified-selector';
import type { Task } from '../../routing/types';

class FakeClock implements Clock {
  constructor(private t = 1_000) {}
  now() {
    return this.t;
  }
  advance(ms: number) {
    this.t += ms;
  }
}

function orchestratorWith(providers: string[], clock = new FakeClock()) {
  const orchestrator = new InfraAwareOrchestrator({}, { clock, sleep: async () => {} });
  for (const id of providers) {
    orchestrator.registerProvider(
      id,
      DEFAULT_PROVIDER_CAPACITIES[id] ?? { maxConcurrency: 4, qualityScore: 0.5 }
    );
  }
  return orchestrator;
}

/** Fill a provider's queue past the router's saturation cutoff. */
function saturate(orchestrator: InfraAwareOrchestrator, providerId: string) {
  const capacity = orchestrator.monitor.getCapacity(providerId)!;
  for (let i = 0; i < capacity.maxConcurrency; i += 1) {
    orchestrator.monitor.startRequest(providerId, 100);
  }
}

const trivial: Task = { id: 'compose-1', prompt: 'format this file with prettier' };

describe('composed selection', () => {
  describe('the three criteria compose', () => {
    it('routes a trivial task to the cheap lane when infrastructure is healthy', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      const selector = createUnifiedModelSelector({ orchestrator });

      const decision = selector.select({ task: trivial });

      expect(decision.classification.complexity).toBe('simple');
      expect(decision.proposedTier).toBe('cheap');
      expect(decision.tier).toBe('cheap');
      expect(decision.provider).toBe('openrouter');
      expect(decision.deviation).toBe('none');
    });

    it('trivial task + saturated cheap provider -> routes elsewhere and explains why', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      // Every cheap-lane candidate lives on openrouter (plus local ollama, which
      // is not registered here), so saturating it empties the whole lane.
      saturate(orchestrator, 'openrouter');

      const selector = createUnifiedModelSelector({ orchestrator });
      const decision = selector.select({ task: trivial });

      // Classification still says cheap...
      expect(decision.proposedTier).toBe('cheap');
      // ...but infrastructure is the last authority, so we do not route there.
      expect(decision.tier).not.toBe('cheap');
      expect(decision.provider).not.toBe('openrouter');
      expect(decision.provider).toBeTruthy();
      expect(decision.deviation).toBe('lane-shift');

      // And the reason names all three criteria plus the infra veto.
      expect(decision.reason).toContain('task=simple');
      expect(decision.reason).toContain('cheap lane unavailable');
      expect(decision.reason).toContain('queue saturated');
      expect(decision.reason).toContain(`forced cheap -> ${decision.tier}`);

      // The rejection is itemised per candidate, not just summarised.
      const rejectedCheap = decision.rejected.filter((entry) => entry.tier === 'cheap');
      expect(rejectedCheap.length).toBeGreaterThan(0);
      expect(rejectedCheap.every((entry) => entry.provider === 'openrouter')).toBe(true);
    });

    it('does not crash, and reports honestly, when nothing at all is callable', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      for (const id of ['openrouter', 'anthropic', 'openai']) saturate(orchestrator, id);

      const selector = createUnifiedModelSelector({ orchestrator });
      const decision = selector.select({ task: trivial });

      expect(decision.provider).toBeNull();
      expect(decision.model).toBeNull();
      expect(decision.slaAtRisk).toBe(true);
      expect(decision.reason).toContain('no callable candidate');
      expect(decision.reason).toContain('queue saturated');
    });

    it('keeps the lane and fails over within it when a fallback provider is free', () => {
      const orchestrator = orchestratorWith(['anthropic', 'openai']);
      // Anthropic owns the expensive lane's primary; openai holds a fallback.
      saturate(orchestrator, 'anthropic');

      const selector = createUnifiedModelSelector({ orchestrator });
      const decision = selector.select({
        task: { id: 'x', prompt: 'redesign the authentication architecture' },
      });

      expect(decision.proposedTier).toBe('expensive');
      expect(decision.tier).toBe('expensive');
      expect(decision.provider).toBe('openai');
      expect(decision.deviation).toBe('in-lane-failover');
      expect(decision.reason).toContain('failed over within it');
    });

    it('an open circuit makes a provider ineligible, same as saturation', () => {
      const clock = new FakeClock();
      const orchestrator = orchestratorWith(['openrouter', 'anthropic'], clock);
      const breaker = orchestrator.breakers.get('openrouter');
      breaker.trip();

      const selector = createUnifiedModelSelector({ orchestrator });
      const decision = selector.select({ task: trivial });

      expect(decision.provider).toBe('anthropic');
      expect(decision.rejected.some((entry) => entry.reason.includes('circuit open'))).toBe(true);
    });
  });

  describe('preset acts as a constraint, ahead of classification', () => {
    it('a cheapest preset does not let a complex task reach the top lane', () => {
      const orchestrator = orchestratorWith(['openrouter']);
      const selector = createUnifiedModelSelector({ orchestrator });

      const decision = selector.select({
        preset: 'cheapest',
        task: { id: 'c1', prompt: 'redesign the system architecture', requiresReasoning: true },
      });

      expect(decision.classification.complexity).toBe('complex');
      expect(decision.window).toEqual({ min: 'cheap', max: 'cheap' });
      expect(decision.tier).toBe('cheap');
      expect(decision.reason).toContain('preset=cheapest');
    });

    it('a reasoning preset does not let a trivial task reach the cheap lane', () => {
      const orchestrator = orchestratorWith(['anthropic']);
      const selector = createUnifiedModelSelector({ orchestrator });

      const decision = selector.select({ preset: 'reasoning', task: trivial });

      expect(decision.classification.complexity).toBe('simple');
      expect(decision.tier).toBe('expensive');
      expect(decision.provider).toBe('anthropic');
    });

    it('a strict preset window reports failure rather than overspending', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic']);
      saturate(orchestrator, 'openrouter');

      const selector = createUnifiedModelSelector({ orchestrator });
      const decision = selector.select({ preset: 'cheapest', task: trivial });

      // anthropic is free, but it is not in the cheap lane, and the user asked
      // for cheapest. Silently spending more would defeat the preset.
      expect(decision.provider).toBeNull();
      expect(decision.reason).toContain('under preset=cheapest');
    });

    it('allowInfraEscape opts into leaving the preset window', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic']);
      saturate(orchestrator, 'openrouter');

      const selector = createUnifiedModelSelector(
        { orchestrator },
        { allowInfraEscape: true }
      );
      const decision = selector.select({ preset: 'cheapest', task: trivial });

      expect(decision.provider).toBe('anthropic');
      expect(decision.reason).toContain('allowInfraEscape enabled');
    });

    it('preset and task bounds intersect to the narrower window', () => {
      const selector = new UnifiedModelSelector();
      const decision = selector.select({
        preset: 'smartest',
        task: { id: 'w', prompt: 'anything', maxTier: 'mid' },
      });

      expect(decision.window).toEqual({ min: 'mid', max: 'mid' });
    });
  });

  describe('large-context handling survives composition', () => {
    it('a 500k-token task stays on the cheap lane, which has the 1M window', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      const selector = createUnifiedModelSelector({ orchestrator });

      const decision = selector.select({
        task: { id: 'big', prompt: 'fix the bug', estimatedTokens: 500_000 },
      });

      expect(decision.tier).toBe('cheap');
      expect(decision.contextWindow).toBeGreaterThanOrEqual(500_000);
      // Every 200k-window candidate must have been rejected on context grounds.
      expect(
        decision.rejected.some((entry) => entry.reason.includes('context window'))
      ).toBe(true);
    });

    it('escalating a large-context task never lands on a smaller window', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      const selector = createUnifiedModelSelector({ orchestrator });
      const task: Task = { id: 'big2', prompt: 'fix the bug', estimatedTokens: 500_000 };

      const seen: number[] = [];
      const executor = async (): Promise<SelectionAttemptResult<string>> => ({
        success: false,
        usage: { inputTokens: 500_000, outputTokens: 100 },
        failureKind: 'validation-failed',
      });

      return selector
        .execute({ task }, async (decision) => {
          seen.push(decision.contextWindow ?? 0);
          return executor();
        })
        .then(() => {
          expect(seen.length).toBeGreaterThan(0);
          for (const window of seen) {
            expect(window).toBeGreaterThanOrEqual(500_000);
          }
        });
    });

    it('reports failure when no candidate can hold the input', () => {
      const selector = new UnifiedModelSelector();
      const decision = selector.select({
        task: { id: 'huge', prompt: 'fix the bug', estimatedTokens: 5_000_000 },
      });

      expect(decision.provider).toBeNull();
      expect(decision.reason).toContain('context window');
    });
  });

  describe('execution keeps both subsystems in sync', () => {
    let orchestrator: InfraAwareOrchestrator;
    let selector: UnifiedModelSelector;

    beforeEach(() => {
      orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      selector = createUnifiedModelSelector({ orchestrator });
    });

    it('records cost in routing/ and usage in orchestration/ on success', async () => {
      const result = await selector.execute({ task: trivial }, async () => ({
        success: true,
        value: 'done',
        usage: { inputTokens: 1_000, outputTokens: 200 },
      }));

      expect(result.success).toBe(true);
      expect(result.value).toBe('done');
      expect(result.cost).toBeGreaterThan(0);
      // routing/'s ledger saw it...
      expect(selector.getRouter().getCostSummary().attempts).toBe(1);
      // ...and so did orchestration/'s monitor.
      const signals = orchestrator.monitor.getSignals(result.decision.provider!)!;
      expect(signals.reliability.successes).toBe(1);
      expect(signals.cost.inputTokens).toBe(1_000);
    });

    it('escalates a capability failure up a lane', async () => {
      const lanes: string[] = [];
      const result = await selector.execute({ task: trivial }, async (decision) => {
        lanes.push(decision.tier);
        return {
          success: decision.tier !== 'cheap',
          value: 'ok',
          usage: { inputTokens: 100, outputTokens: 10 },
          failureKind: 'validation-failed' as const,
        };
      });

      expect(result.success).toBe(true);
      expect(lanes[0]).toBe('cheap');
      expect(lanes[1]).toBe('mid');
      expect(result.decision.escalated).toBe(true);
    });

    it('a transient failure fails over inside the lane rather than escalating', async () => {
      const providers: string[] = [];
      const result = await selector.execute(
        { task: { id: 'top', prompt: 'redesign the architecture' } },
        async (decision) => {
          providers.push(decision.provider!);
          return {
            success: providers.length > 1,
            value: 'ok',
            usage: { inputTokens: 100, outputTokens: 10 },
            failureKind: 'transient' as const,
          };
        }
      );

      expect(result.success).toBe(true);
      expect(providers).toHaveLength(2);
      expect(new Set(providers).size).toBe(2);
      // Same lane throughout: a transient fault says nothing about capability.
      expect(result.attempts.every((attempt) => attempt.tier === 'expensive')).toBe(true);
    });

    it('records failures against the circuit breaker', async () => {
      await selector.execute({ task: trivial }, async () => ({
        success: false,
        usage: { inputTokens: 100, outputTokens: 0 },
        failureKind: 'transient' as const,
      }));

      const states = orchestrator.breakers.getStates();
      expect(Object.values(states).length).toBeGreaterThan(0);
    });

    it('an executor that throws is reported, not propagated', async () => {
      const result = await selector.execute({ task: trivial }, async () => {
        throw new Error('socket hang up');
      });

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe('provider-error');
      expect(result.message).toContain('socket hang up');
    });
  });

  describe('degrades gracefully without infrastructure', () => {
    it('falls back to lane ordering and says so', () => {
      const selector = new UnifiedModelSelector();
      const decision = selector.select({ task: trivial });

      expect(decision.provider).toBe('openrouter');
      expect(decision.tier).toBe('cheap');
      expect(decision.reason).toContain('no infrastructure signal');
    });

    it('matches the standalone ModelRouter decision when infra is healthy', () => {
      const orchestrator = orchestratorWith(['openrouter', 'anthropic', 'openai']);
      const selector = createUnifiedModelSelector({ orchestrator });

      for (const prompt of [
        'format this file',
        'fix the failing test',
        'redesign the architecture',
      ]) {
        const task: Task = { id: `parity-${prompt}`, prompt };
        const composed = selector.select({ task });
        const standalone = selector.getRouter().route(task);

        expect(composed.tier).toBe(standalone.tier);
        expect(composed.provider).toBe(standalone.provider);
        expect(composed.model).toBe(standalone.model);
      }
    });
  });
});
