/**
 * Verifies the README's worked example produces the output it claims.
 *
 * Documentation that drifts from behaviour is worse than none, and the `reason`
 * string is the facade's main affordance for explaining a surprising choice.
 */

import { describe, it, expect } from 'vitest';
import { InfraAwareOrchestrator } from '../../orchestration/infra-aware-orchestrator';
import { DEFAULT_PROVIDER_CAPACITIES } from '../../orchestration/registry-adapter';
import { createUnifiedModelSelector } from '../unified-selector';

describe('README example', () => {
  it('produces the documented decision and reason', () => {
    const orchestrator = new InfraAwareOrchestrator();
    for (const id of ['openrouter', 'anthropic', 'openai']) {
      orchestrator.registerProvider(id, DEFAULT_PROVIDER_CAPACITIES[id]!);
    }

    // Saturate the cheap lane's only registered provider.
    const capacity = orchestrator.monitor.getCapacity('openrouter')!;
    for (let i = 0; i < capacity.maxConcurrency; i += 1) {
      orchestrator.monitor.startRequest('openrouter', 100);
    }

    const selector = createUnifiedModelSelector({ orchestrator });
    const decision = selector.select({
      preset: 'fastest',
      task: { id: 't-1', prompt: 'format this file' },
      priority: 'high',
    });

    expect(decision.tier).toBe('mid');
    expect(decision.proposedTier).toBe('cheap');
    expect(decision.deviation).toBe('lane-shift');
    expect(decision.provider).toBe('anthropic');
    expect(decision.model).toBe('claude-sonnet-4.5');

    // Each clause the README quotes, in order.
    expect(decision.reason).toContain(
      'preset=fastest (lanes cheap..mid, objective=latency)'
    );
    expect(decision.reason).toContain('task=simple/formatting');
    expect(decision.reason).toContain('-> proposed cheap lane');
    expect(decision.reason).toContain('cheap lane unavailable');
    expect(decision.reason).toContain('queue saturated');
    expect(decision.reason).toContain('infrastructure forced cheap -> mid');
    expect(decision.reason).toContain('selected anthropic/claude-sonnet-4.5');
    expect(decision.reason).toContain('objective=latency');
  });

  it('documents preset windows accurately', () => {
    const selector = createUnifiedModelSelector({});

    expect(selector.select({ preset: 'cheapest', task: { id: 'a', prompt: 'x' } }).window).toEqual({
      min: 'cheap',
      max: 'cheap',
    });
    expect(selector.select({ preset: 'fastest', task: { id: 'b', prompt: 'x' } }).window).toEqual({
      min: 'cheap',
      max: 'mid',
    });
    expect(selector.select({ preset: 'smartest', task: { id: 'c', prompt: 'x' } }).window).toEqual({
      min: 'mid',
      max: 'expensive',
    });
    expect(selector.select({ preset: 'reasoning', task: { id: 'd', prompt: 'x' } }).window).toEqual({
      min: 'expensive',
      max: 'expensive',
    });
  });
});
