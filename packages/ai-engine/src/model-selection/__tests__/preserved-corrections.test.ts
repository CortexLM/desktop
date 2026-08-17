/**
 * Guards for the two non-obvious design corrections the brief flags as
 * important, asserted *through the composed facade* rather than in isolation.
 *
 * Both were previously only exercised inside `routing/`. Composition adds a
 * plausible way to break them silently: the facade re-enters `ModelRouter.route`
 * on every selection, so if it passed a different task shape or a collapsed tier
 * window, learning and exploration would still "work" while never changing a
 * lane. These tests fail if that happens.
 */

import { describe, it, expect } from 'vitest';
import { UnifiedModelSelector } from '../unified-selector';
import { ModelRouter } from '../../routing/model-router';
import { EscalationLearner } from '../../routing/escalation';
import { DEFAULT_TIER_MODELS, costRatio } from '../../routing/model-tiers';
import type { Task } from '../../routing/types';

describe('preserved design corrections', () => {
  describe('failure penalty in the expected-cost calculation', () => {
    it('without it, a 5%-success cheap lane still looks optimal', () => {
      // This is the degenerate behaviour the penalty exists to prevent: on pure
      // token math a cheap attempt plus escalation is still cheaper than one
      // top-lane call, so learning could never move the starting lane.
      const naive = new EscalationLearner({ failurePenalty: 0, minSamples: 1 });
      for (let i = 0; i < 20; i += 1) {
        naive.record({ tier: 'cheap', succeeded: i === 0, complexity: 'simple', kind: 'formatting' });
      }

      const recommendation = naive.recommendStartTier(
        'cheap',
        DEFAULT_TIER_MODELS,
        'formatting',
        'simple'
      );
      expect(recommendation.tier).toBe('cheap');
    });

    it('with it, the same evidence moves the starting lane up', () => {
      const learner = new EscalationLearner({ minSamples: 1 });
      for (let i = 0; i < 20; i += 1) {
        learner.record({ tier: 'cheap', succeeded: i === 0, complexity: 'simple', kind: 'formatting' });
      }

      const recommendation = learner.recommendStartTier(
        'cheap',
        DEFAULT_TIER_MODELS,
        'formatting',
        'simple'
      );
      expect(recommendation.tier).not.toBe('cheap');
      expect(recommendation.reason).toContain('success rate');
    });

    it('survives composition: learned upshift reaches the composed decision', async () => {
      const selector = new UnifiedModelSelector(
        {},
        { routing: { learning: { minSamples: 1 }, explorationRate: 0 } }
      );

      // Fail the cheap lane repeatedly on a capability signal.
      for (let i = 0; i < 12; i += 1) {
        await selector.execute(
          { task: { id: `learn-${i}`, prompt: 'format this file', kind: 'formatting' } },
          async (decision) => ({
            success: decision.tier !== 'cheap',
            value: 'ok',
            usage: { inputTokens: 500, outputTokens: 50 },
            failureKind: 'validation-failed' as const,
          })
        );
      }

      const decision = selector.select({
        task: { id: 'learned', prompt: 'format this file', kind: 'formatting' },
      });

      expect(decision.proposedTier).not.toBe('cheap');
      expect(decision.reason).toContain('proposed');
    });
  });

  describe('bounded 5% exploration', () => {
    it('is what allows a downward move to ever be learned', () => {
      // With exploration off, a task classified `complex` never samples the mid
      // or cheap lane, so no evidence for a downshift can ever accumulate.
      const withoutExploration = new ModelRouter({ explorationRate: 0 });
      const withExploration = new ModelRouter({ explorationRate: 1 });

      const task = (id: string): Task => ({ id, prompt: 'refactor the module', kind: 'refactor' });

      expect(withoutExploration.route(task('e1')).tier).toBe('expensive');
      // Exploration probes exactly one lane below the classified lane.
      expect(withExploration.route(task('e1')).tier).toBe('mid');
      expect(withExploration.route(task('e1')).reason).toContain('exploring');
    });

    it('stays deterministic per task id, and bounded in rate', () => {
      const router = new ModelRouter({ explorationRate: 0.05 });
      const build = (id: string): Task => ({ id, prompt: 'format this file', kind: 'formatting' });

      // Determinism: same id, same lane, every time.
      const first = router.route(build('stable-id')).tier;
      expect(router.route(build('stable-id')).tier).toBe(first);

      // Boundedness: over many sequential ids, the probe rate stays near 5%.
      // The cheap lane is the floor here, so probe *up* from a mid task instead.
      const mid = new ModelRouter({ explorationRate: 0.05 });
      let probed = 0;
      const total = 2_000;
      for (let i = 0; i < total; i += 1) {
        const choice = mid.route({ id: `probe-${i}`, prompt: 'fix the bug', kind: 'bug-fix' });
        if (choice.tier === 'cheap') probed += 1;
      }

      const rate = probed / total;
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.1);
    });

    it('survives composition: the probe reaches the composed decision', () => {
      const selector = new UnifiedModelSelector({}, { routing: { explorationRate: 1 } });
      const decision = selector.select({
        task: { id: 'probe', prompt: 'fix the bug', kind: 'bug-fix' },
      });

      expect(decision.proposedTier).toBe('cheap');
      expect(decision.tier).toBe('cheap');
    });

    it('is not defeated by the composed preset window', () => {
      // A `cheapest` preset pins the window to the cheap lane, which is also the
      // exploration floor. The probe must simply not fire, rather than escaping
      // the window.
      const selector = new UnifiedModelSelector({}, { routing: { explorationRate: 1 } });
      const decision = selector.select({
        preset: 'cheapest',
        task: { id: 'probe2', prompt: 'fix the bug', kind: 'bug-fix' },
      });

      expect(decision.tier).toBe('cheap');
      expect(decision.window).toEqual({ min: 'cheap', max: 'cheap' });
    });
  });

  describe('cost-gap assumptions', () => {
    it('no composed logic depends on a specific lane cost ratio', () => {
      // The real blended gap on the default table, at the default 90% input mix.
      // Recorded as an observation, not relied upon: `expectedCost` uses whatever
      // prices are configured, and `failurePenalty` is a fraction of the top lane,
      // so both are scale-free.
      const ratio = costRatio(DEFAULT_TIER_MODELS.cheap.pricing, DEFAULT_TIER_MODELS.expensive.pricing);
      expect(ratio).toBeGreaterThan(1);

      // Halving the gap must not change which lane a trivial task starts on.
      const cheapTable = new UnifiedModelSelector({}, { routing: { explorationRate: 0 } });
      const flatTable = new UnifiedModelSelector(
        {},
        {
          routing: { explorationRate: 0 },
          tiers: { expensive: { pricing: { input: 2, output: 8 } } },
        }
      );

      const task: Task = { id: 'ratio', prompt: 'format this file', kind: 'formatting' };
      expect(cheapTable.select({ task }).tier).toBe(flatTable.select({ task }).tier);
    });
  });
});
