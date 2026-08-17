/**
 * Budget manager tests: accounting, pressure classification, and the
 * agent-facing description.
 */

import { ContextBudgetManager } from '../budget-manager';
import type { ContextItem, ContextTier } from '../types';

function makeItem(id: string, tokens: number, tier: ContextTier = 'short-term'): ContextItem {
  return {
    id,
    content: 'x',
    tokens,
    tier,
    source: 'explicit-fetch',
    addedAtTurn: 0,
    useCount: 0,
    pinned: tier === 'task',
  };
}

describe('ContextBudgetManager', () => {
  it('rejects invalid configuration', () => {
    expect(() => new ContextBudgetManager({ maxTokens: 0 })).toThrow(/maxTokens/);
    expect(
      () => new ContextBudgetManager({ maxTokens: 1000, reserveForOutput: 1000 }),
    ).toThrow(/reserveForOutput/);
  });

  it('excludes the output reservation from usable tokens', () => {
    const manager = new ContextBudgetManager({ maxTokens: 10_000, reserveForOutput: 2000 });
    expect(manager.usable).toBe(8000);
  });

  it('reports used, remaining, and per-tier breakdown', () => {
    const manager = new ContextBudgetManager({ maxTokens: 10_000, reserveForOutput: 2000 });
    const items = [
      makeItem('task', 100, 'task'),
      makeItem('summary', 200, 'long-term'),
      makeItem('file-a', 700),
    ];

    const snapshot = manager.snapshot(items);

    expect(snapshot.used).toBe(1000);
    expect(snapshot.remaining).toBe(7000);
    expect(snapshot.byTier).toEqual({ task: 100, 'long-term': 200, 'short-term': 700 });
    expect(snapshot.utilization).toBeCloseTo(0.125);
  });

  it('classifies pressure by utilization of the usable budget', () => {
    const manager = new ContextBudgetManager({ maxTokens: 11_000, reserveForOutput: 1000 });

    expect(manager.snapshot([makeItem('a', 1000)]).pressure).toBe('low');
    expect(manager.snapshot([makeItem('a', 5500)]).pressure).toBe('moderate');
    expect(manager.snapshot([makeItem('a', 7800)]).pressure).toBe('high');
    expect(manager.snapshot([makeItem('a', 9500)]).pressure).toBe('critical');
  });

  it('flags needsRelief when a typical fetch would not fit', () => {
    const manager = new ContextBudgetManager({
      maxTokens: 10_000,
      reserveForOutput: 1000,
      typicalFetchTokens: 1500,
    });

    expect(manager.snapshot([makeItem('a', 5000)]).needsRelief).toBe(false);
    expect(manager.snapshot([makeItem('a', 8000)]).needsRelief).toBe(true);
  });

  it('answers fit questions and quantifies the deficit', () => {
    const manager = new ContextBudgetManager({ maxTokens: 10_000, reserveForOutput: 2000 });
    const items = [makeItem('a', 7500)];

    expect(manager.canFit(items, 400)).toBe(true);
    expect(manager.canFit(items, 900)).toBe(false);
    expect(manager.deficitFor(items, 400)).toBe(0);
    expect(manager.deficitFor(items, 900)).toBe(400);
  });

  it('counts overflow events when the usable budget is exceeded', () => {
    const manager = new ContextBudgetManager({ maxTokens: 5000, reserveForOutput: 1000 });

    expect(manager.overflowCount).toBe(0);
    manager.snapshot([makeItem('a', 4500)]);
    expect(manager.overflowCount).toBe(1);
  });

  it('describes the budget as actionable prompt text', () => {
    const manager = new ContextBudgetManager({ maxTokens: 10_000, reserveForOutput: 2000 });
    const text = ContextBudgetManager.describe(manager.snapshot([makeItem('a', 7600)]));

    expect(text).toContain('7600/8000');
    expect(text).toContain('95%');
    expect(text).toContain('critical');
    // Under critical pressure the agent must be told what to do next.
    expect(text).toMatch(/forget_context|summarize_context/);
  });
});
