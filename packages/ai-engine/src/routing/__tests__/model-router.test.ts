/**
 * Tests for ModelRouter: routing, escalation, and cost accounting.
 */

import { ModelRouter } from '../model-router';
import type { AttemptResult } from '../model-router';
import { DEFAULT_TIER_MODELS } from '../model-tiers';
import type { ModelChoice, Task, TokenUsage } from '../index';

const USAGE: TokenUsage = { inputTokens: 10_000, outputTokens: 500 };

function task(prompt: string, extra: Partial<Task> = {}): Task {
  return { id: 'task-1', prompt, ...extra };
}

/** Executor that succeeds only at or above `minTier`. */
function executorRequiring(minTierIndex: number): (choice: ModelChoice) => Promise<AttemptResult<string>> {
  const order = ['cheap', 'mid', 'expensive'];
  return async (choice) => {
    const succeeded = order.indexOf(choice.tier) >= minTierIndex;
    return {
      success: succeeded,
      value: succeeded ? `done on ${choice.tier}` : undefined,
      usage: USAGE,
      failureKind: succeeded ? undefined : 'validation-failed',
    };
  };
}

describe('ModelRouter', () => {
  describe('routing', () => {
    it('sends mechanical work to the cheap lane', () => {
      const router = new ModelRouter();
      const choice = router.route(task('format this file with prettier'));

      expect(choice.tier).toBe('cheap');
      expect(choice.model).toBe(DEFAULT_TIER_MODELS.cheap.model);
      expect(choice.provider).toBe('openrouter');
    });

    it('sends bug fixes to the mid lane', () => {
      // Exploration off: this asserts the classification path, not the sampling.
      const router = new ModelRouter({ explorationRate: 0 });
      expect(router.route(task('fix the bug in the login handler')).tier).toBe('mid');
    });

    it('sends architectural work to the expensive lane', () => {
      const router = new ModelRouter();
      const choice = router.route(task('redesign the architecture of the provider layer'));

      expect(choice.tier).toBe('expensive');
      expect(choice.model).toBe(DEFAULT_TIER_MODELS.expensive.model);
    });

    it('starts at attempt 1 and is not marked escalated', () => {
      const router = new ModelRouter();
      const choice = router.route(task('format this'));

      expect(choice.attempt).toBe(1);
      expect(choice.escalated).toBe(false);
    });

    it('explains its decision', () => {
      const router = new ModelRouter();
      const choice = router.route(task('format this file'));

      expect(choice.reason).toBeTruthy();
      expect(choice.reason).toContain('formatting');
    });

    it('is deterministic for the same task', () => {
      const router = new ModelRouter();
      const a = router.route(task('format this file'));
      const b = router.route(task('format this file'));

      expect(a.tier).toBe(b.tier);
    });

    it('stays deterministic with exploration enabled', () => {
      // Exploration is keyed on task id, not a coin flip, so repeated calls for
      // the same task cannot disagree.
      const router = new ModelRouter({ explorationRate: 0.5 });
      const tiers = new Set(
        Array.from({ length: 20 }, () => router.route({ id: 'stable-id', prompt: 'fix the login bug' }).tier)
      );

      expect(tiers.size).toBe(1);
    });

    it('explores roughly the configured share of tasks', () => {
      const router = new ModelRouter({ explorationRate: 0.05 });
      const explored = Array.from({ length: 500 }, (_, i) =>
        router.route({ id: `task-${i}`, prompt: 'fix the login bug' })
      ).filter((choice) => choice.reason.includes('exploring'));

      // Hash-based sampling: near the configured rate, not exactly on it.
      expect(explored.length).toBeGreaterThan(500 * 0.01);
      expect(explored.length).toBeLessThan(500 * 0.12);
    });

    it('samples sequential task ids, not just varied ones', () => {
      // Sequential ids are the common case and were the failure mode that made
      // the unmixed hash never fire.
      const router = new ModelRouter({ explorationRate: 0.05 });
      const explored = Array.from({ length: 200 }, (_, i) =>
        router.route({ id: `task-${i}`, prompt: 'redesign the architecture' })
      ).filter((choice) => choice.reason.includes('exploring'));

      expect(explored.length).toBeGreaterThan(0);
    });

    it('adds a safety margin for unclassifiable tasks', () => {
      const router = new ModelRouter();
      const choice = router.route(task('hmm'));

      // Unknown -> medium classification, then bumped up by the low-confidence guard.
      expect(choice.tier).toBe('expensive');
      expect(choice.reason).toContain('low confidence');
    });
  });

  describe('tier bounds', () => {
    it('honours a per-task maxTier', () => {
      const router = new ModelRouter();
      const choice = router.route(task('redesign the architecture', { maxTier: 'mid' }));

      expect(choice.tier).toBe('mid');
      expect(choice.reason).toContain('clamped');
    });

    it('honours a per-task minTier', () => {
      const router = new ModelRouter();
      expect(router.route(task('format this file', { minTier: 'mid' })).tier).toBe('mid');
    });

    it('honours a router-wide maxTier', () => {
      const router = new ModelRouter({ maxTier: 'cheap' });
      expect(router.route(task('redesign the architecture')).tier).toBe('cheap');
    });

    it('honours a router-wide minTier', () => {
      const router = new ModelRouter({ minTier: 'expensive' });
      expect(router.route(task('format this file')).tier).toBe('expensive');
    });

    it('resolves a contradictory task window to maxTier', () => {
      const router = new ModelRouter();
      const choice = router.route(task('format this', { minTier: 'expensive', maxTier: 'cheap' }));

      expect(choice.tier).toBe('cheap');
    });
  });

  describe('context window fitting', () => {
    it('avoids a lane whose context window is too small', () => {
      const router = new ModelRouter();
      // 500k tokens exceeds Sonnet/Opus (200k) but fits Gemini Flash (1M).
      const choice = router.route(task('fix the bug', { estimatedTokens: 500_000 }));

      expect(choice.tier).toBe('cheap');
      expect(choice.reason).toContain('context window');
    });

    it('keeps the chosen lane when the input fits', () => {
      const router = new ModelRouter();
      expect(router.route(task('fix the bug', { estimatedTokens: 50_000 })).tier).toBe('mid');
    });
  });

  describe('escalation', () => {
    it('moves up a lane on a capability failure', () => {
      const router = new ModelRouter();
      const first = router.route(task('format this file'));
      const second = router.escalate(task('format this file'), first, 'validation-failed');

      expect(second?.tier).toBe('mid');
      expect(second?.escalated).toBe(true);
      expect(second?.attempt).toBe(2);
      expect(second?.reason).toContain('escalated from cheap');
    });

    it('does not escalate a transient failure', () => {
      const router = new ModelRouter();
      const first = router.route(task('format this file'));

      expect(router.escalate(task('format this file'), first, 'transient')).toBeUndefined();
    });

    it('does not escalate a provider error', () => {
      const router = new ModelRouter();
      const first = router.route(task('format this file'));

      expect(router.escalate(task('format this file'), first, 'provider-error')).toBeUndefined();
    });

    it('cannot escalate past the top lane', () => {
      const router = new ModelRouter();
      const top = router.route(task('redesign the architecture'));

      expect(router.escalate(task('redesign the architecture'), top, 'validation-failed')).toBeUndefined();
    });

    it('respects the escalation ceiling', () => {
      const router = new ModelRouter({ learning: { maxEscalations: 1 } });
      const t = task('format this file');
      const first = router.route(t);
      const second = router.escalate(t, first, 'validation-failed');

      expect(second).toBeDefined();
      expect(router.escalate(t, second!, 'validation-failed')).toBeUndefined();
    });

    it('respects the task maxTier when escalating', () => {
      const router = new ModelRouter();
      const t = task('format this file', { maxTier: 'cheap' });
      const first = router.route(t);

      expect(router.escalate(t, first, 'validation-failed')).toBeUndefined();
    });

    it('does not escalate a context overflow into an even smaller window', () => {
      const router = new ModelRouter();
      // Exceeds every lane's window; there is nowhere useful to go.
      const t = task('fix the bug', { estimatedTokens: 2_000_000 });
      const first = router.route(t);

      expect(router.escalate(t, first, 'context-overflow')).toBeUndefined();
    });
  });

  describe('execute', () => {
    it('returns the cheap result when the cheap lane succeeds', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), executorRequiring(0));

      expect(result.success).toBe(true);
      expect(result.value).toBe('done on cheap');
      expect(result.attempts).toHaveLength(1);
      expect(result.choice.tier).toBe('cheap');
    });

    it('escalates automatically until the task succeeds', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), executorRequiring(1));

      expect(result.success).toBe(true);
      expect(result.value).toBe('done on mid');
      expect(result.attempts.map((a) => a.tier)).toEqual(['cheap', 'mid']);
    });

    it('walks all the way to the top lane when needed', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), executorRequiring(2));

      expect(result.success).toBe(true);
      expect(result.attempts.map((a) => a.tier)).toEqual(['cheap', 'mid', 'expensive']);
    });

    it('gives up after exhausting the lanes', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), executorRequiring(99));

      expect(result.success).toBe(false);
      expect(result.failureKind).toBe('validation-failed');
      expect(result.attempts).toHaveLength(3);
    });

    it('retries a transient failure on the same lane', async () => {
      const router = new ModelRouter({ transientRetries: 1 });
      let calls = 0;

      const result = await router.execute(task('format this file'), async () => {
        calls += 1;
        if (calls === 1) {
          return { success: false, usage: USAGE, failureKind: 'transient' as const };
        }
        return { success: true, value: 'ok', usage: USAGE };
      });

      expect(result.success).toBe(true);
      expect(result.attempts.map((a) => a.tier)).toEqual(['cheap', 'cheap']);
    });

    it('stops immediately on a provider error', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), async () => ({
        success: false,
        usage: USAGE,
        failureKind: 'provider-error' as const,
      }));

      expect(result.success).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(result.failureKind).toBe('provider-error');
    });

    it('defaults an unlabelled failure to a capability failure', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), async (choice) => ({
        success: choice.tier === 'mid',
        value: 'ok',
        usage: USAGE,
      }));

      expect(result.success).toBe(true);
      expect(result.attempts).toHaveLength(2);
    });

    it('accumulates cost across every attempt', async () => {
      const router = new ModelRouter();
      const result = await router.execute(task('format this file'), executorRequiring(2));

      expect(result.cost).toBeGreaterThan(0);
      expect(result.attempts).toHaveLength(3);
      // Three attempts of the same usage; baseline prices all three at top rate.
      expect(result.baselineCost).toBeGreaterThan(result.cost);
    });
  });

  describe('learning', () => {
    it('shifts the starting lane up after repeated cheap failures', async () => {
      const router = new ModelRouter();

      for (let i = 0; i < 25; i++) {
        await router.execute({ id: `t${i}`, prompt: 'format this file' }, executorRequiring(1));
      }

      // The cheap lane never works for this workload; the router should stop
      // paying for a doomed first attempt.
      expect(router.route({ id: 'next', prompt: 'format this file' }).tier).not.toBe('cheap');
    });

    it('keeps starting cheap while the cheap lane succeeds', async () => {
      const router = new ModelRouter();

      for (let i = 0; i < 25; i++) {
        await router.execute({ id: `t${i}`, prompt: 'format this file' }, executorRequiring(0));
      }

      expect(router.route({ id: 'next', prompt: 'format this file' }).tier).toBe('cheap');
    });

    it('learns down: pulls expensive work cheaper once exploration proves the cheap lane copes', async () => {
      // Always explore, so the cheaper lane gets measured deterministically.
      const router = new ModelRouter({ explorationRate: 1 });

      for (let i = 0; i < 40; i++) {
        await router.execute({ id: `t${i}`, prompt: 'refactor the module', kind: 'refactor' }, executorRequiring(0));
      }

      const choice = router.route({ id: 'next', prompt: 'refactor the module', kind: 'refactor' });
      expect(choice.tier).not.toBe('expensive');
    });

    it('cannot learn downward without exploration', async () => {
      const router = new ModelRouter({ explorationRate: 0 });

      for (let i = 0; i < 40; i++) {
        await router.execute({ id: `t${i}`, prompt: 'refactor the module', kind: 'refactor' }, executorRequiring(0));
      }

      // The cheap lane is never sampled, so there is no evidence to act on and
      // the classifier's verdict stands.
      expect(router.route({ id: 'next', prompt: 'refactor the module', kind: 'refactor' }).tier).toBe('expensive');
    });

    it('can be disabled', async () => {
      const router = new ModelRouter({ disableLearning: true });

      for (let i = 0; i < 25; i++) {
        await router.execute({ id: `t${i}`, prompt: 'format this file' }, executorRequiring(1));
      }

      expect(router.route({ id: 'next', prompt: 'format this file' }).tier).toBe('cheap');
    });

    it('does not explore when the rate is zero', () => {
      const router = new ModelRouter({ explorationRate: 0 });
      expect(router.route(task('fix the bug in the login handler')).tier).toBe('mid');
    });

    it('explores the lane below when the dice say so', () => {
      const router = new ModelRouter({ explorationRate: 1 });
      const choice = router.route(task('fix the bug in the login handler'));

      expect(choice.tier).toBe('cheap');
      expect(choice.reason).toContain('exploring');
    });

    it('stops exploring once the lane below is measured', async () => {
      const router = new ModelRouter({ explorationRate: 1 });

      // Cheap lane fails every time; after minSamples it is no longer unknown.
      for (let i = 0; i < 10; i++) {
        await router.execute({ id: `t${i}`, prompt: 'fix the bug in the login handler' }, executorRequiring(1));
      }

      const choice = router.route({ id: 'next', prompt: 'fix the bug in the login handler' });
      expect(choice.reason).not.toContain('exploring');
    });

    it('never explores below the task floor', () => {
      const router = new ModelRouter({ explorationRate: 1 });
      const choice = router.route(task('fix the bug in the login handler', { minTier: 'mid' }));

      expect(choice.tier).toBe('mid');
    });

    it('ignores provider errors as capability evidence', () => {
      const router = new ModelRouter();
      const t = task('format this file');
      const choice = router.route(t);

      for (let i = 0; i < 20; i++) {
        router.recordOutcome(
          { ...t, id: `t${i}` },
          choice,
          { succeeded: false, usage: USAGE, failureKind: 'provider-error' }
        );
      }

      const stats = router.getLearner().stats('cheap', 'formatting', 'simple');
      expect(stats.attempts).toBe(0);
    });
  });

  describe('cost reporting', () => {
    it('reports savings for a cheap-lane workload', async () => {
      const router = new ModelRouter();

      for (let i = 0; i < 10; i++) {
        await router.execute({ id: `t${i}`, prompt: 'format this file' }, executorRequiring(0));
      }

      const summary = router.getCostSummary();
      expect(summary.tasks).toBe(10);
      expect(summary.successfulTasks).toBe(10);
      expect(summary.savingsRatio).toBeGreaterThan(0.7);
    });

    it('exceeds the -70% target on a realistic read-heavy mix', async () => {
      const router = new ModelRouter();

      // 70% mechanical reads, 20% bug fixes, 10% architecture: roughly the mix
      // implied by "reading code is 60-80% of tokens".
      const prompts = [
        ...Array(70).fill('read the file src/index.ts'),
        ...Array(20).fill('fix the bug in the login handler'),
        ...Array(10).fill('redesign the architecture of the provider layer'),
      ];

      for (const [i, prompt] of prompts.entries()) {
        await router.execute({ id: `t${i}`, prompt, estimatedTokens: 30_000 }, executorRequiring(0));
      }

      const summary = router.getCostSummary();
      expect(summary.savingsRatio).toBeGreaterThan(0.7);
    });

    it('slices the report by task kind', async () => {
      const router = new ModelRouter();
      await router.execute({ id: 'a', prompt: 'format this file' }, executorRequiring(0));
      await router.execute({ id: 'b', prompt: 'redesign the architecture' }, executorRequiring(0));

      const report = router.getCostReport();
      expect(report.byKind['formatting']).toBeDefined();
      expect(report.byKind['architecture']).toBeDefined();
    });

    it('formats a report', async () => {
      const router = new ModelRouter();
      await router.execute({ id: 'a', prompt: 'format this file' }, executorRequiring(0));

      expect(router.formatCostReport()).toContain('Savings');
    });
  });

  describe('configuration', () => {
    it('allows overriding the model bound to a lane', () => {
      const router = new ModelRouter({
        tiers: { cheap: { provider: 'ollama', model: 'qwen3-coder', displayName: 'Qwen3 Coder' } },
      });

      const choice = router.route(task('format this file'));
      expect(choice.provider).toBe('ollama');
      expect(choice.model).toBe('qwen3-coder');
    });

    it('allows overriding pricing while keeping the model', () => {
      const router = new ModelRouter({ tiers: { cheap: { pricing: { input: 0.1, output: 0.4 } } } });
      const models = router.getTierModels();

      expect(models.cheap.model).toBe(DEFAULT_TIER_MODELS.cheap.model);
      expect(models.cheap.pricing.input).toBe(0.1);
    });
  });

  it('clears cost and learning state on reset', async () => {
    const router = new ModelRouter();
    await router.execute(task('format this file'), executorRequiring(0));
    router.reset();

    expect(router.getCostSummary().attempts).toBe(0);
    expect(router.getLearner().stats('cheap', 'formatting', 'simple').attempts).toBe(0);
  });
});
