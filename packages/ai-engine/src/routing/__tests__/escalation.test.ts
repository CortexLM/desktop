/**
 * Tests for escalation policy and online learning.
 */

import { EscalationLearner } from '../escalation';
import { DEFAULT_TIER_MODELS } from '../model-tiers';
import type { FailureKind } from '../types';

describe('EscalationLearner', () => {
  let learner: EscalationLearner;

  beforeEach(() => {
    learner = new EscalationLearner();
  });

  describe('failure triage', () => {
    it.each<FailureKind>(['incorrect-output', 'validation-failed', 'refusal', 'incomplete', 'context-overflow'])(
      'escalates on %s',
      (kind) => {
        expect(learner.shouldEscalate(kind)).toBe(true);
      }
    );

    it('does not escalate on transient failures', () => {
      expect(learner.shouldEscalate('transient')).toBe(false);
      expect(learner.shouldRetrySameTier('transient')).toBe(true);
    });

    it('neither escalates nor retries on provider errors', () => {
      expect(learner.shouldEscalate('provider-error')).toBe(false);
      expect(learner.shouldRetrySameTier('provider-error')).toBe(false);
    });
  });

  describe('success rate learning', () => {
    it('starts from an optimistic prior', () => {
      const rate = learner.successRate('cheap', 'formatting', 'simple');
      expect(rate).toBeGreaterThan(0.5);
      expect(rate).toBeLessThan(1);
    });

    it('drops as failures accumulate', () => {
      const before = learner.successRate('cheap', 'formatting', 'simple');
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'formatting', complexity: 'simple' });
      }
      expect(learner.successRate('cheap', 'formatting', 'simple')).toBeLessThan(before);
    });

    it('rises as successes accumulate', () => {
      const before = learner.successRate('cheap', 'formatting', 'simple');
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: true, kind: 'formatting', complexity: 'simple' });
      }
      expect(learner.successRate('cheap', 'formatting', 'simple')).toBeGreaterThan(before);
    });

    it('keeps statistics separate per kind', () => {
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'formatting', complexity: 'simple' });
      }
      expect(learner.successRate('cheap', 'file-read', 'simple')).toBeGreaterThan(
        learner.successRate('cheap', 'formatting', 'simple')
      );
    });

    it('keeps statistics separate per tier', () => {
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'bug-fix', complexity: 'medium' });
        learner.record({ tier: 'mid', succeeded: true, kind: 'bug-fix', complexity: 'medium' });
      }
      expect(learner.successRate('mid', 'bug-fix', 'medium')).toBeGreaterThan(
        learner.successRate('cheap', 'bug-fix', 'medium')
      );
    });

    it('falls back to a complexity key when no kind is known', () => {
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: false, complexity: 'simple' });
      }
      expect(learner.successRate('cheap', undefined, 'simple')).toBeLessThan(0.5);
    });

    it('reports raw counts alongside the smoothed rate', () => {
      learner.record({ tier: 'cheap', succeeded: true, kind: 'formatting', complexity: 'simple' });
      learner.record({ tier: 'cheap', succeeded: false, kind: 'formatting', complexity: 'simple' });

      const stats = learner.stats('cheap', 'formatting', 'simple');
      expect(stats.attempts).toBe(2);
      expect(stats.successes).toBe(1);
    });

    it('tracks whether enough evidence exists', () => {
      expect(learner.hasEvidence('cheap', 'formatting', 'simple')).toBe(false);
      for (let i = 0; i < 5; i++) {
        learner.record({ tier: 'cheap', succeeded: true, kind: 'formatting', complexity: 'simple' });
      }
      expect(learner.hasEvidence('cheap', 'formatting', 'simple')).toBe(true);
    });
  });

  describe('expected cost', () => {
    it('is cheapest at the cheap lane when it usually succeeds', () => {
      for (let i = 0; i < 20; i++) {
        learner.record({ tier: 'cheap', succeeded: true, kind: 'formatting', complexity: 'simple' });
      }

      const cheap = learner.expectedCost('cheap', 'expensive', DEFAULT_TIER_MODELS, 'formatting', 'simple');
      const expensive = learner.expectedCost('expensive', 'expensive', DEFAULT_TIER_MODELS, 'formatting', 'simple');
      expect(cheap).toBeLessThan(expensive);
    });

    it('accounts for the cost of escalating after a failure', () => {
      // A lane that always fails still costs its own price plus the next lane's.
      for (let i = 0; i < 50; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'architecture', complexity: 'complex' });
      }

      const startCheap = learner.expectedCost('cheap', 'expensive', DEFAULT_TIER_MODELS, 'architecture', 'complex');
      const startExpensive = learner.expectedCost(
        'expensive',
        'expensive',
        DEFAULT_TIER_MODELS,
        'architecture',
        'complex'
      );
      expect(startCheap).toBeGreaterThan(startExpensive);
    });
  });

  describe('start tier recommendation', () => {
    it('leaves the baseline alone with no evidence', () => {
      const result = learner.recommendStartTier('cheap', DEFAULT_TIER_MODELS, 'formatting', 'simple');
      expect(result.tier).toBe('cheap');
      expect(result.reason).toBeUndefined();
    });

    it('shifts up once the cheap lane proves unreliable', () => {
      for (let i = 0; i < 50; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'symbol-rename', complexity: 'simple' });
      }

      const result = learner.recommendStartTier('cheap', DEFAULT_TIER_MODELS, 'symbol-rename', 'simple');
      expect(result.tier).not.toBe('cheap');
      expect(result.reason).toContain('success rate');
    });

    it('shifts down when a cheap lane handles supposedly complex work', () => {
      for (let i = 0; i < 50; i++) {
        learner.record({ tier: 'cheap', succeeded: true, kind: 'refactor', complexity: 'complex' });
        learner.record({ tier: 'mid', succeeded: true, kind: 'refactor', complexity: 'complex' });
      }

      const result = learner.recommendStartTier('expensive', DEFAULT_TIER_MODELS, 'refactor', 'complex');
      expect(result.tier).toBe('cheap');
      expect(result.reason).toContain('cheap');
    });

    it('respects the min tier bound', () => {
      for (let i = 0; i < 50; i++) {
        learner.record({ tier: 'cheap', succeeded: true, kind: 'refactor', complexity: 'complex' });
      }

      const result = learner.recommendStartTier(
        'expensive',
        DEFAULT_TIER_MODELS,
        'refactor',
        'complex',
        'mid',
        'expensive'
      );
      expect(result.tier).not.toBe('cheap');
    });

    it('respects the max tier bound', () => {
      for (let i = 0; i < 50; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'formatting', complexity: 'simple' });
        learner.record({ tier: 'mid', succeeded: false, kind: 'formatting', complexity: 'simple' });
      }

      const result = learner.recommendStartTier(
        'cheap',
        DEFAULT_TIER_MODELS,
        'formatting',
        'simple',
        'cheap',
        'mid'
      );
      expect(result.tier).not.toBe('expensive');
    });
  });

  describe('persistence', () => {
    it('round-trips learned statistics', () => {
      for (let i = 0; i < 7; i++) {
        learner.record({ tier: 'cheap', succeeded: i % 2 === 0, kind: 'formatting', complexity: 'simple' });
      }

      const snapshot = learner.export();
      const restored = new EscalationLearner();
      restored.import(snapshot);

      expect(restored.stats('cheap', 'formatting', 'simple')).toEqual(
        learner.stats('cheap', 'formatting', 'simple')
      );
    });

    it('clears statistics on reset', () => {
      for (let i = 0; i < 10; i++) {
        learner.record({ tier: 'cheap', succeeded: false, kind: 'formatting', complexity: 'simple' });
      }
      learner.reset();
      expect(learner.stats('cheap', 'formatting', 'simple').attempts).toBe(0);
    });
  });

  it('honours a configured escalation ceiling', () => {
    expect(new EscalationLearner({ maxEscalations: 1 }).maxEscalations).toBe(1);
  });
});
