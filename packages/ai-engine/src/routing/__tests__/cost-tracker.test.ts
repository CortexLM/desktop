/**
 * Tests for cost tracking and savings reporting.
 */

import { CostTracker } from '../cost-tracker';
import { DEFAULT_TIER_MODELS } from '../model-tiers';
import type { ModelTier } from '../types';

function trackerWithDefaults(): CostTracker {
  return new CostTracker(DEFAULT_TIER_MODELS);
}

function record(
  tracker: CostTracker,
  tier: ModelTier,
  options: {
    taskId?: string;
    succeeded?: boolean;
    inputTokens?: number;
    outputTokens?: number;
    attempt?: number;
    escalated?: boolean;
  } = {}
): void {
  const model = DEFAULT_TIER_MODELS[tier];
  tracker.record({
    taskId: options.taskId ?? 'task-1',
    tier,
    provider: model.provider,
    model: model.model,
    pricing: model.pricing,
    kind: 'formatting',
    complexity: 'simple',
    attempt: options.attempt ?? 1,
    escalated: options.escalated ?? false,
    succeeded: options.succeeded ?? true,
    usage: {
      inputTokens: options.inputTokens ?? 100_000,
      outputTokens: options.outputTokens ?? 2_000,
    },
  });
}

describe('CostTracker', () => {
  it('computes actual cost from tier pricing', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap', { inputTokens: 1_000_000, outputTokens: 0 });

    // 1M input tokens at $0.30/M.
    expect(tracker.getSummary().cost).toBeCloseTo(0.3, 6);
  });

  it('bills input and output at different rates', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'expensive', { inputTokens: 1_000_000, outputTokens: 1_000_000 });

    // $15/M input + $75/M output.
    expect(tracker.getSummary().cost).toBeCloseTo(90, 6);
  });

  it('measures savings against the expensive lane as baseline', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap', { inputTokens: 1_000_000, outputTokens: 0 });

    const summary = tracker.getSummary();
    expect(summary.baselineCost).toBeCloseTo(15, 6);
    expect(summary.savings).toBeCloseTo(14.7, 6);
    expect(summary.savingsRatio).toBeCloseTo(0.98, 2);
  });

  it('reports no savings when work runs on the baseline lane', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'expensive');

    const summary = tracker.getSummary();
    expect(summary.savings).toBeCloseTo(0, 6);
    expect(summary.savingsRatio).toBeCloseTo(0, 6);
  });

  it('accepts a custom baseline', () => {
    const tracker = new CostTracker(DEFAULT_TIER_MODELS, DEFAULT_TIER_MODELS.mid.pricing);
    record(tracker, 'cheap', { inputTokens: 1_000_000, outputTokens: 0 });

    expect(tracker.getSummary().baselineCost).toBeCloseTo(3, 6);
  });

  it('counts unique tasks separately from attempts', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap', { taskId: 'a', succeeded: false });
    record(tracker, 'mid', { taskId: 'a', succeeded: true, attempt: 2, escalated: true });
    record(tracker, 'cheap', { taskId: 'b', succeeded: true });

    const summary = tracker.getSummary();
    expect(summary.attempts).toBe(3);
    expect(summary.tasks).toBe(2);
    expect(summary.successfulTasks).toBe(2);
  });

  it('attributes failed attempts to escalation waste', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap', { taskId: 'a', succeeded: false, inputTokens: 1_000_000, outputTokens: 0 });
    record(tracker, 'mid', { taskId: 'a', succeeded: true, attempt: 2, escalated: true });

    expect(tracker.getSummary().escalationWaste).toBeCloseTo(0.3, 6);
  });

  it('reports cost per successful task, not per token', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap', { taskId: 'a', succeeded: false, inputTokens: 1_000_000, outputTokens: 0 });
    record(tracker, 'cheap', { taskId: 'a', succeeded: true, inputTokens: 1_000_000, outputTokens: 0, attempt: 2 });

    const summary = tracker.getSummary();
    // Two attempts at $0.30, one successful task.
    expect(summary.costPerSuccessfulTask).toBeCloseTo(0.6, 6);
  });

  it('returns zeroed figures when nothing is recorded', () => {
    const summary = trackerWithDefaults().getSummary();
    expect(summary.attempts).toBe(0);
    expect(summary.cost).toBe(0);
    expect(summary.savingsRatio).toBe(0);
    expect(summary.costPerSuccessfulTask).toBe(0);
  });

  describe('reporting', () => {
    it('slices by tier, kind, and complexity', () => {
      const tracker = trackerWithDefaults();
      record(tracker, 'cheap', { taskId: 'a' });
      record(tracker, 'expensive', { taskId: 'b' });

      const report = tracker.getReport();
      expect(Object.keys(report.byTier).sort()).toEqual(['cheap', 'expensive']);
      expect(report.byKind['formatting']?.attempts).toBe(2);
      expect(report.byComplexity['simple']?.attempts).toBe(2);
    });

    it('reports tier distribution as shares of attempts', () => {
      const tracker = trackerWithDefaults();
      record(tracker, 'cheap', { taskId: 'a' });
      record(tracker, 'cheap', { taskId: 'b' });
      record(tracker, 'cheap', { taskId: 'c' });
      record(tracker, 'expensive', { taskId: 'd' });

      const { tierDistribution } = tracker.getReport();
      expect(tierDistribution.cheap).toBeCloseTo(0.75, 6);
      expect(tierDistribution.expensive).toBeCloseTo(0.25, 6);
      expect(tierDistribution.mid).toBe(0);
    });

    it('reports escalations per task', () => {
      const tracker = trackerWithDefaults();
      record(tracker, 'cheap', { taskId: 'a', succeeded: false });
      record(tracker, 'mid', { taskId: 'a', attempt: 2, escalated: true });
      record(tracker, 'cheap', { taskId: 'b' });

      expect(tracker.getReport().escalationRate).toBeCloseTo(0.5, 6);
    });

    it('formats a readable report', () => {
      const tracker = trackerWithDefaults();
      record(tracker, 'cheap', { inputTokens: 1_000_000, outputTokens: 0 });

      const text = tracker.formatReport();
      expect(text).toContain('Model routing cost report');
      expect(text).toContain('Savings');
      expect(text).toContain('Cost per success');
      expect(text).toContain('formatting');
    });

    it('formats without throwing when empty', () => {
      expect(() => trackerWithDefaults().formatReport()).not.toThrow();
    });
  });

  it('clears records on reset', () => {
    const tracker = trackerWithDefaults();
    record(tracker, 'cheap');
    tracker.reset();
    expect(tracker.getRecords()).toHaveLength(0);
  });

  it('demonstrates the target saving on a read-heavy simple workload', () => {
    const tracker = trackerWithDefaults();
    // 20 mechanical read/format tasks routed to the cheap lane.
    for (let i = 0; i < 20; i++) {
      record(tracker, 'cheap', { taskId: `t${i}`, inputTokens: 50_000, outputTokens: 1_000 });
    }

    // Target from the mission: -70% on simple tasks. Actual is higher on the
    // default price table, which pairs a Flash-class cheap lane against Opus.
    // The assertion is deliberately a floor, not an equality, so it does not
    // encode any particular lane cost ratio.
    expect(tracker.getSummary().savingsRatio).toBeGreaterThan(0.7);
  });
});
