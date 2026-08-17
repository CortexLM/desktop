/**
 * Learner tests: utility scoring, eviction ranking, prediction, persistence.
 */

import { ContextUsageLearner } from '../usage-learner';
import type { ContextItem, ContextSource, ContextTier } from '../types';

function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: overrides.id ?? 'item-1',
    content: overrides.content ?? 'const value = 1;',
    tokens: overrides.tokens ?? 100,
    tier: (overrides.tier ?? 'short-term') as ContextTier,
    source: (overrides.source ?? 'explicit-fetch') as ContextSource,
    filePath: overrides.filePath,
    symbols: overrides.symbols,
    addedAtTurn: overrides.addedAtTurn ?? 0,
    lastUsedAtTurn: overrides.lastUsedAtTurn,
    useCount: overrides.useCount ?? 0,
    pinned: overrides.pinned ?? false,
    foldedFrom: overrides.foldedFrom,
  };
}

describe('ContextUsageLearner', () => {
  it('raises hit rate for files that prove useful', () => {
    const learner = new ContextUsageLearner();

    for (let turn = 0; turn < 4; turn += 1) {
      learner.observe({
        itemId: `i${turn}`,
        filePath: 'src/auth/session.ts',
        source: 'explicit-fetch',
        turn,
        useful: true,
      });
    }

    learner.observe({
      itemId: 'x',
      filePath: 'src/ui/modal.tsx',
      source: 'search-result',
      turn: 1,
      useful: false,
    });

    const useful = learner.getFileStats('src/auth/session.ts');
    const useless = learner.getFileStats('src/ui/modal.tsx');

    expect(useful?.hitRate).toBeGreaterThan(0.8);
    expect(useless?.hitRate).toBeLessThan(0.3);
  });

  it('smooths hit rates so one observation is not decisive', () => {
    const learner = new ContextUsageLearner();
    learner.observe({ itemId: 'i', filePath: 'src/a.ts', source: 'explicit-fetch', turn: 0, useful: false });

    // A single miss must not zero the file out entirely.
    expect(learner.getFileStats('src/a.ts')?.hitRate).toBeGreaterThan(0);
    expect(learner.getFileStats('src/a.ts')?.hitRate).toBeLessThan(0.5);
  });

  it('tracks reliability per source type', () => {
    const learner = new ContextUsageLearner();

    for (let i = 0; i < 5; i += 1) {
      learner.observe({ itemId: `e${i}`, source: 'explicit-fetch', turn: i, useful: true });
      learner.observe({ itemId: `s${i}`, source: 'search-result', turn: i, useful: false });
    }

    expect(learner.getSourceHitRate('explicit-fetch')).toBeGreaterThan(
      learner.getSourceHitRate('search-result'),
    );
  });

  it('scores used and recent items above stale unused ones', () => {
    const learner = new ContextUsageLearner();
    const currentTurn = 10;

    const used = makeItem({ id: 'used', useCount: 3, lastUsedAtTurn: 10, addedAtTurn: 1 });
    const stale = makeItem({ id: 'stale', useCount: 0, addedAtTurn: 0 });

    expect(learner.expectedUtility(used, currentTurn)).toBeGreaterThan(
      learner.expectedUtility(stale, currentTurn),
    );
  });

  it('scores task-relevant content above unrelated content', () => {
    const learner = new ContextUsageLearner();
    learner.setTaskContext('session expiry bug in authentication tokens');

    const relevant = makeItem({
      id: 'relevant',
      filePath: 'src/auth/session.ts',
      symbols: ['createSession'],
      content: 'session expiry authentication tokens logic',
    });
    const unrelated = makeItem({
      id: 'unrelated',
      filePath: 'src/ui/button.tsx',
      content: 'render a button component',
    });

    expect(learner.expectedUtility(relevant, 1)).toBeGreaterThan(
      learner.expectedUtility(unrelated, 1),
    );
  });

  it('ranks eviction candidates worst-first and excludes protected items', () => {
    const learner = new ContextUsageLearner();
    learner.setTaskContext('fix session expiry');

    const items = [
      makeItem({ id: 'task', tier: 'task', pinned: true }),
      makeItem({ id: 'pinned', pinned: true }),
      makeItem({ id: 'valuable', useCount: 4, lastUsedAtTurn: 9, filePath: 'src/auth/session.ts' }),
      makeItem({ id: 'junk', useCount: 0, addedAtTurn: 0, filePath: 'src/ui/modal.tsx' }),
    ];

    const ranked = learner.rankForEviction(items, 10);
    const ids = ranked.map((item) => item.id);

    expect(ids).not.toContain('task');
    expect(ids).not.toContain('pinned');
    expect(ids[0]).toBe('junk');
    expect(ids[ids.length - 1]).toBe('valuable');
  });

  it('breaks utility ties by preferring to evict larger items', () => {
    const learner = new ContextUsageLearner();
    const small = makeItem({ id: 'small', tokens: 100, addedAtTurn: 0 });
    const large = makeItem({ id: 'large', tokens: 900, addedAtTurn: 0 });

    const ranked = learner.rankForEviction([small, large], 0);
    expect(ranked[0].id).toBe('large');
  });

  it('predicts files that were useful before', () => {
    const learner = new ContextUsageLearner();

    for (let turn = 0; turn < 3; turn += 1) {
      learner.observe({
        itemId: `i${turn}`,
        filePath: 'src/auth/session.ts',
        source: 'explicit-fetch',
        turn,
        useful: true,
      });
      learner.observe({
        itemId: `j${turn}`,
        filePath: 'src/ui/modal.tsx',
        source: 'search-result',
        turn,
        useful: false,
      });
    }

    const predictions = learner.predict({ limit: 3 });

    expect(predictions[0].filePath).toBe('src/auth/session.ts');
    expect(predictions.map((p) => p.filePath)).not.toContain('src/ui/modal.tsx');
    expect(predictions[0].reason).toContain('previous fetches');
  });

  it('excludes already-loaded files from predictions', () => {
    const learner = new ContextUsageLearner();
    learner.observe({ itemId: 'i', filePath: 'src/a.ts', source: 'explicit-fetch', turn: 0, useful: true });

    const predictions = learner.predict({ alreadyLoaded: ['src/a.ts'] });
    expect(predictions).toHaveLength(0);
  });

  it('suggests co-occurring files from what is already loaded', () => {
    const learner = new ContextUsageLearner();

    for (let i = 0; i < 3; i += 1) {
      learner.observeCooccurrence(['src/auth/session.ts', 'src/auth/token.ts']);
    }

    const predictions = learner.predict({ alreadyLoaded: ['src/auth/session.ts'] });

    expect(predictions.map((p) => p.filePath)).toContain('src/auth/token.ts');
    expect(predictions[0].reason).toContain('co-occurs');
  });

  it('round-trips state for cross-session reuse', () => {
    const learner = new ContextUsageLearner();
    learner.observe({ itemId: 'i', filePath: 'src/a.ts', source: 'explicit-fetch', turn: 3, useful: true });
    learner.observeCooccurrence(['src/a.ts', 'src/b.ts']);

    const restored = ContextUsageLearner.deserialize(learner.serialize());

    expect(restored.getFileStats('src/a.ts')?.usefulHits).toBe(1);
    expect(restored.predict({ alreadyLoaded: ['src/a.ts'] }).map((p) => p.filePath)).toContain(
      'src/b.ts',
    );
  });
});
