/**
 * Manager tests: the four tools end-to-end, budget enforcement, automatic
 * optimization, and metrics.
 */

import { CATContextManager } from '../context-manager';
import { ContextUsageLearner } from '../usage-learner';
import { buildTestRepo, bodyOfTokens, FakeCodebase } from './fixtures';

function makeManager(overrides: { maxTokens?: number; reserveForOutput?: number; autoOptimize?: boolean } = {}) {
  const provider = buildTestRepo();
  const manager = new CATContextManager({
    provider,
    maxTokens: overrides.maxTokens ?? 20_000,
    reserveForOutput: overrides.reserveForOutput ?? 2000,
    autoOptimize: overrides.autoOptimize,
  });
  return { manager, provider };
}

describe('CATContextManager: task tier', () => {
  it('pins the task and includes constraints', () => {
    const { manager } = makeManager();
    const task = manager.setTask('Fix session expiry', { constraints: ['no breaking changes'] });

    expect(task.pinned).toBe(true);
    expect(task.tier).toBe('task');
    expect(task.content).toContain('no breaking changes');
  });

  it('protects the task from forget_context', () => {
    const { manager } = makeManager();
    const task = manager.setTask('Fix session expiry');

    const result = manager.forgetContext({ items: [task.id] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('pinned');
    expect(manager.getWorkspace().get(task.id)).toBeDefined();
  });
});

describe('CATContextManager: get_more_context', () => {
  it('loads requested files and reports the token cost', async () => {
    const { manager } = makeManager();
    const result = await manager.getMoreContext({ files: ['src/auth/session.ts'] });

    expect(result.ok).toBe(true);
    expect(result.addedItemIds).toHaveLength(1);
    expect(result.tokenDelta).toBeGreaterThan(0);
    expect(result.budget.used).toBe(result.tokenDelta);
  });

  it('requires at least one file or symbol', async () => {
    const { manager } = makeManager();
    const result = await manager.getMoreContext({});

    expect(result.ok).toBe(false);
    expect(result.message).toContain('`files`');
  });

  it('resolves symbols to their definition site', async () => {
    const { manager } = makeManager();
    const result = await manager.getMoreContext({ symbols: ['signToken'] });

    expect(result.ok).toBe(true);
    expect(manager.loadedFiles()).toContain('src/auth/token.ts');
  });

  it('expands dependencies when depth is set', async () => {
    const { manager } = makeManager();

    const shallow = await manager.getMoreContext({ files: ['src/auth/middleware.ts'], depth: 0 });
    expect(shallow.addedItemIds).toHaveLength(1);

    const deep = await manager.getMoreContext({ files: ['src/auth/middleware.ts'], depth: 2 });
    // middleware -> session -> token, minus the already-loaded middleware.
    expect(manager.loadedFiles()).toContain('src/auth/session.ts');
    expect(manager.loadedFiles()).toContain('src/auth/token.ts');
    expect(deep.addedItemIds?.length).toBeGreaterThan(0);
  });

  it('does not duplicate already-loaded files', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/auth/session.ts'] });
    const second = await manager.getMoreContext({ files: ['src/auth/session.ts'] });

    expect(second.addedItemIds).toHaveLength(0);
    expect(second.message).toContain('already loaded');
    expect(manager.getWorkspace().size).toBe(1);
  });

  it('reports unknown files instead of failing silently', async () => {
    const { manager } = makeManager();
    const result = await manager.getMoreContext({ files: ['src/does-not-exist.ts'] });

    expect(result.message).toContain('Not found');
    expect(result.ok).toBe(false);
  });
});

describe('CATContextManager: forget_context', () => {
  it('frees tokens and reports a negative delta', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx'] });
    const before = manager.getBudget().used;

    const result = manager.forgetContext({ items: ['src/ui/modal.tsx'] });

    expect(result.ok).toBe(true);
    expect(result.tokenDelta).toBeLessThan(0);
    expect(result.budget.used).toBeLessThan(before);
    expect(manager.getWorkspace().size).toBe(0);
  });

  it('accepts file paths as well as item ids', async () => {
    const { manager } = makeManager();
    const added = await manager.getMoreContext({ files: ['src/ui/button.tsx'] });

    const byId = manager.forgetContext({ items: [added.addedItemIds![0]] });
    expect(byId.ok).toBe(true);
  });

  it('teaches the learner that forgotten context was not useful', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx'] });
    manager.forgetContext({ items: ['src/ui/modal.tsx'] });

    const stats = manager.getLearner().getFileStats('src/ui/modal.tsx');
    expect(stats?.fetches).toBe(1);
    expect(stats?.usefulHits).toBe(0);
  });

  it('reports unknown identifiers', () => {
    const { manager } = makeManager();
    const result = manager.forgetContext({ items: ['src/nope.ts'] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unknown');
  });
});

describe('CATContextManager: summarize_context', () => {
  it('folds a turn range and frees tokens', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx', 'src/ui/button.tsx'] });
    const before = manager.getBudget().used;

    const result = manager.summarizeContext({ range: [0, 0] });

    expect(result.ok).toBe(true);
    expect(result.tokenDelta).toBeLessThan(0);
    expect(result.budget.used).toBeLessThan(before);
    expect(result.message).toMatch(/\dx/);
  });

  it('keeps folded content re-fetchable by preserving paths', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx', 'src/ui/button.tsx'] });
    manager.summarizeContext({ range: [0, 0] });

    const summary = manager.getWorkspace().byTier('long-term')[0];
    expect(summary.content).toContain('src/ui/modal.tsx');

    // The agent can pull the body back after folding.
    const refetch = await manager.getMoreContext({ files: ['src/ui/modal.tsx'] });
    expect(refetch.ok).toBe(true);
    expect(refetch.addedItemIds).toHaveLength(1);
  });

  it('explains why nothing was folded', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx'] });

    const result = manager.summarizeContext({ range: [0, 0] });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('at least two');
  });

  it('validates the range argument', () => {
    const { manager } = makeManager();

    expect(manager.summarizeContext({ range: [3, 1] }).ok).toBe(false);
    expect(manager.summarizeContext({ range: [Number.NaN, 1] }).ok).toBe(false);
  });
});

describe('CATContextManager: search_codebase', () => {
  it('adds ranked hits to context', async () => {
    const { manager } = makeManager();
    const result = await manager.searchCodebase({ query: 'auth session', limit: 3 });

    expect(result.ok).toBe(true);
    expect(result.addedItemIds!.length).toBeGreaterThan(0);
    expect(manager.loadedFiles().some((f) => f.startsWith('src/auth/'))).toBe(true);
  });

  it('honours the result limit', async () => {
    const { manager } = makeManager();
    const result = await manager.searchCodebase({ query: 'auth', limit: 1 });

    expect(result.addedItemIds).toHaveLength(1);
  });

  it('handles no matches without error', async () => {
    const { manager } = makeManager();
    const result = await manager.searchCodebase({ query: 'quantumfoobar' });

    expect(result.ok).toBe(true);
    expect(result.addedItemIds).toHaveLength(0);
    expect(result.message).toContain('No matches');
  });

  it('rejects an empty query', async () => {
    const { manager } = makeManager();
    expect((await manager.searchCodebase({ query: '   ' })).ok).toBe(false);
  });
});

describe('CATContextManager: budget enforcement', () => {
  it('never exceeds the usable budget', async () => {
    const provider = new FakeCodebase(
      Array.from({ length: 20 }, (_, i) => ({
        path: `src/big-${i}.ts`,
        content: bodyOfTokens(`big-${i}`, 500),
        keywords: ['big'],
      })),
    );

    const manager = new CATContextManager({
      provider,
      maxTokens: 5000,
      reserveForOutput: 1000,
    });

    await manager.searchCodebase({ query: 'big', limit: 20 });

    const budget = manager.getBudget();
    expect(budget.used).toBeLessThanOrEqual(budget.usable);
    expect(manager.getMetrics().overflowEvents).toBe(0);
  });

  it('refuses to overflow when autoOptimize is off', async () => {
    const provider = new FakeCodebase([
      { path: 'src/a.ts', content: bodyOfTokens('a', 900), keywords: ['a'] },
      { path: 'src/b.ts', content: bodyOfTokens('b', 900), keywords: ['b'] },
    ]);

    const manager = new CATContextManager({
      provider,
      maxTokens: 2000,
      reserveForOutput: 500,
      autoOptimize: false,
    });

    await manager.getMoreContext({ files: ['src/a.ts'] });
    const second = await manager.getMoreContext({ files: ['src/b.ts'] });

    expect(second.addedItemIds).toHaveLength(0);
    expect(second.message).toContain('no budget');
  });

  it('frees space automatically when a fetch would not fit', async () => {
    const provider = new FakeCodebase([
      { path: 'src/junk-1.ts', content: bodyOfTokens('junk-1', 400), keywords: ['junk'] },
      { path: 'src/junk-2.ts', content: bodyOfTokens('junk-2', 400), keywords: ['junk'] },
      { path: 'src/needed.ts', content: bodyOfTokens('needed', 400), keywords: ['needed'] },
    ]);

    const manager = new CATContextManager({
      provider,
      maxTokens: 1600,
      reserveForOutput: 300,
    });

    await manager.getMoreContext({ files: ['src/junk-1.ts', 'src/junk-2.ts'] });
    const result = await manager.getMoreContext({ files: ['src/needed.ts'] });

    expect(result.addedItemIds).toHaveLength(1);
    expect(manager.loadedFiles()).toContain('src/needed.ts');
    expect(manager.getBudget().used).toBeLessThanOrEqual(manager.getBudget().usable);
  });

  it('evicts unused context before context the agent has used', async () => {
    const provider = new FakeCodebase([
      { path: 'src/used.ts', content: bodyOfTokens('used', 300), keywords: ['x'] },
      { path: 'src/unused.ts', content: bodyOfTokens('unused', 300), keywords: ['x'] },
      { path: 'src/new.ts', content: bodyOfTokens('new', 300), keywords: ['x'] },
    ]);

    const manager = new CATContextManager({
      provider,
      maxTokens: 1000,
      reserveForOutput: 200,
    });

    await manager.getMoreContext({ files: ['src/used.ts', 'src/unused.ts'] });
    manager.recordUsefulContext(['src/used.ts']);
    manager.advanceTurn();

    await manager.getMoreContext({ files: ['src/new.ts'] });

    expect(manager.loadedFiles()).toContain('src/used.ts');
    expect(manager.loadedFiles()).not.toContain('src/unused.ts');
  });

  it('exposes remaining budget in agent-readable text', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/auth/session.ts'] });

    const text = manager.describeBudget();
    expect(text).toContain('Context budget:');
    expect(text).toContain('remaining');
    expect(text).toContain('Pressure:');
  });
});

describe('CATContextManager: learning', () => {
  it('carries learned patterns across sessions via a shared learner', async () => {
    const learner = new ContextUsageLearner();

    const first = new CATContextManager({
      provider: buildTestRepo(),
      maxTokens: 20_000,
      learner,
    });
    first.setTask('Fix session expiry');
    await first.getMoreContext({ files: ['src/auth/session.ts', 'src/auth/token.ts'] });
    first.recordUsefulContext(['src/auth/session.ts', 'src/auth/token.ts']);

    const second = new CATContextManager({
      provider: buildTestRepo(),
      maxTokens: 20_000,
      learner,
    });
    second.setTask('Fix session expiry again');

    const predictions = second.predictNeededContext();
    expect(predictions.map((p) => p.filePath)).toContain('src/auth/session.ts');
  });

  it('records co-occurrence when multiple items are useful together', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/auth/session.ts', 'src/auth/token.ts'] });
    manager.recordUsefulContext(['src/auth/session.ts', 'src/auth/token.ts']);

    manager.forgetContext({ items: ['src/auth/token.ts'] });
    const predictions = manager.predictNeededContext();

    expect(predictions.map((p) => p.filePath)).toContain('src/auth/token.ts');
  });
});

describe('CATContextManager: metrics and rendering', () => {
  it('computes precision as useful tokens over total', async () => {
    const { manager } = makeManager();
    manager.setTask('Fix session expiry');
    await manager.getMoreContext({ files: ['src/auth/session.ts', 'src/ui/modal.tsx'] });
    manager.recordUsefulContext(['src/auth/session.ts']);

    const metrics = manager.getMetrics();

    expect(metrics.precision).toBeGreaterThan(0);
    expect(metrics.precision).toBeLessThan(1);
    expect(metrics.deadItems).toBe(1);
  });

  it('counts tool calls and reclaimed tokens', async () => {
    const { manager } = makeManager();
    await manager.getMoreContext({ files: ['src/ui/modal.tsx', 'src/ui/button.tsx'] });
    await manager.searchCodebase({ query: 'auth' });
    manager.summarizeContext({ range: [0, 0] });
    manager.forgetContext({ items: manager.loadedFiles().slice(0, 1) });

    const metrics = manager.getMetrics();

    expect(metrics.toolCalls.get_more_context).toBe(1);
    expect(metrics.toolCalls.search_codebase).toBe(1);
    expect(metrics.toolCalls.summarize_context).toBe(1);
    expect(metrics.toolCalls.forget_context).toBe(1);
    expect(metrics.tokensReclaimed).toBeGreaterThan(0);
  });

  it('renders task context before working memory', async () => {
    const { manager } = makeManager();
    manager.setTask('Fix session expiry');
    await manager.getMoreContext({ files: ['src/auth/session.ts'] });

    const rendered = manager.render();

    expect(rendered.indexOf('## task')).toBeLessThan(rendered.indexOf('## short-term'));
    expect(rendered).toContain('src/auth/session.ts');
  });
});
