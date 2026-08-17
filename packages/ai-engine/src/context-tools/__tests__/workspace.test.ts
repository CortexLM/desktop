/**
 * Workspace tests: tier semantics, pin protection, resolution, and folding.
 */

import { ContextWorkspace, defaultStructuralSummarizer } from '../workspace';

const countTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4));

function makeWorkspace() {
  return new ContextWorkspace({ countTokens });
}

describe('ContextWorkspace', () => {
  it('pins task-tier items implicitly', () => {
    const ws = makeWorkspace();
    const task = ws.add({ content: 'goal', tokens: 10, tier: 'task', source: 'task-spec' });
    const file = ws.add({ content: 'body', tokens: 10, tier: 'short-term', source: 'explicit-fetch' });

    expect(task.pinned).toBe(true);
    expect(file.pinned).toBe(false);
  });

  it('refuses to remove pinned items unless forced', () => {
    const ws = makeWorkspace();
    const task = ws.add({ content: 'goal', tokens: 10, tier: 'task', source: 'task-spec' });

    expect(ws.remove(task.id)).toBe(false);
    expect(ws.size).toBe(1);
    expect(ws.remove(task.id, true)).toBe(true);
    expect(ws.size).toBe(0);
  });

  it('never unpins task semantics', () => {
    const ws = makeWorkspace();
    const task = ws.add({ content: 'goal', tokens: 10, tier: 'task', source: 'task-spec' });

    expect(ws.setPinned(task.id, false)).toBe(false);
    expect(ws.get(task.id)?.pinned).toBe(true);
  });

  it('resolves identifiers by id and by file path', () => {
    const ws = makeWorkspace();
    const item = ws.add({
      content: 'body',
      tokens: 10,
      tier: 'short-term',
      source: 'explicit-fetch',
      filePath: 'src/a.ts',
    });

    expect(ws.resolve(item.id)).toEqual([item.id]);
    expect(ws.resolve('src/a.ts')).toEqual([item.id]);
    expect(ws.resolve('src/missing.ts')).toEqual([]);
  });

  it('tracks use count and last-used turn', () => {
    const ws = makeWorkspace();
    const item = ws.add({ content: 'body', tokens: 10, tier: 'short-term', source: 'explicit-fetch' });

    ws.advanceTurn();
    ws.advanceTurn();
    expect(ws.markUsed(item.id)).toBe(true);

    expect(ws.get(item.id)?.useCount).toBe(1);
    expect(ws.get(item.id)?.lastUsedAtTurn).toBe(2);
    expect(ws.markUsed('nope')).toBe(false);
  });

  describe('fold', () => {
    it('compresses multiple short-term items into one long-term summary', () => {
      const ws = makeWorkspace();
      ws.add({
        content: 'export function alpha() { /* long body */ }'.repeat(40),
        tokens: 400,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/a.ts',
      });
      ws.add({
        content: 'export class Beta { /* long body */ }'.repeat(40),
        tokens: 380,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/b.ts',
      });

      const result = ws.fold(0, 0);

      expect(result.summary).not.toBeNull();
      expect(result.summary?.tier).toBe('long-term');
      expect(result.removedIds).toHaveLength(2);
      expect(result.tokensSaved).toBeGreaterThan(0);
      expect(ws.byTier('short-term')).toHaveLength(0);
      expect(ws.byTier('long-term')).toHaveLength(1);
    });

    it('keeps file paths in the summary so folded context stays re-fetchable', () => {
      const ws = makeWorkspace();
      ws.add({
        content: 'export function alpha() {}'.repeat(40),
        tokens: 400,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/a.ts',
      });
      ws.add({
        content: 'export function beta() {}'.repeat(40),
        tokens: 400,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/b.ts',
      });

      const summary = ws.fold(0, 0).summary;

      expect(summary?.content).toContain('src/a.ts');
      expect(summary?.content).toContain('src/b.ts');
      expect(summary?.foldedFrom).toHaveLength(2);
    });

    it('leaves task and long-term tiers untouched', () => {
      const ws = makeWorkspace();
      ws.add({ content: 'goal', tokens: 50, tier: 'task', source: 'task-spec' });
      ws.add({ content: 'prior summary', tokens: 60, tier: 'long-term', source: 'summary' });
      ws.add({
        content: 'a'.repeat(1600),
        tokens: 400,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/a.ts',
      });
      ws.add({
        content: 'b'.repeat(1600),
        tokens: 400,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/b.ts',
      });

      ws.fold(0, 0);

      expect(ws.byTier('task')).toHaveLength(1);
      // Original long-term item plus the new summary.
      expect(ws.byTier('long-term')).toHaveLength(2);
    });

    it('does not fold a single item', () => {
      const ws = makeWorkspace();
      ws.add({
        content: 'x'.repeat(400),
        tokens: 100,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/a.ts',
      });

      const result = ws.fold(0, 0);

      expect(result.summary).toBeNull();
      expect(result.tokensSaved).toBe(0);
      expect(ws.size).toBe(1);
    });

    it('refuses folds that would not save tokens', () => {
      const ws = makeWorkspace();
      // Two tiny items: the summary scaffolding costs more than the content.
      ws.add({ content: 'a', tokens: 1, tier: 'short-term', source: 'explicit-fetch', filePath: 'src/a.ts' });
      ws.add({ content: 'b', tokens: 1, tier: 'short-term', source: 'explicit-fetch', filePath: 'src/b.ts' });

      const result = ws.fold(0, 0);

      expect(result.summary).toBeNull();
      expect(ws.size).toBe(2);
    });

    it('only folds items inside the requested turn range', () => {
      const ws = makeWorkspace();
      ws.add({
        content: 'old-a'.repeat(200),
        tokens: 250,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/old-a.ts',
      });
      ws.add({
        content: 'old-b'.repeat(200),
        tokens: 250,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/old-b.ts',
      });
      ws.advanceTurn();
      ws.advanceTurn();
      const recent = ws.add({
        content: 'recent'.repeat(200),
        tokens: 300,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/recent.ts',
      });

      ws.fold(0, 1);

      expect(ws.get(recent.id)).toBeDefined();
      expect(ws.byTier('short-term')).toHaveLength(1);
    });

    it('excludes pinned short-term items from folding', () => {
      const ws = makeWorkspace();
      const pinned = ws.add({
        content: 'pinned'.repeat(200),
        tokens: 300,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/pinned.ts',
        pinned: true,
      });
      ws.add({
        content: 'a'.repeat(1200),
        tokens: 300,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/a.ts',
      });
      ws.add({
        content: 'b'.repeat(1200),
        tokens: 300,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/b.ts',
      });

      ws.fold(0, 0);

      expect(ws.get(pinned.id)).toBeDefined();
    });
  });
});

describe('defaultStructuralSummarizer', () => {
  it('keeps declaration names and drops bodies', () => {
    const summary = defaultStructuralSummarizer([
      {
        id: '1',
        content: `
          import fs from 'fs';
          export function createSession(user: string) {
            const secret = deriveSecret(user);
            return { user, secret };
          }
          export class SessionStore {}
          export interface SessionOptions {}
        `,
        tokens: 300,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: 'src/auth/session.ts',
        addedAtTurn: 0,
        useCount: 1,
        pinned: false,
      },
    ]);

    expect(summary).toContain('src/auth/session.ts');
    expect(summary).toContain('createSession');
    expect(summary).toContain('SessionStore');
    expect(summary).toContain('SessionOptions');
    // Implementation detail must be gone; that is the token saving.
    expect(summary).not.toContain('deriveSecret(user)');
    expect(summary).toContain('get_more_context');
  });
});
