/**
 * Editor session persistence — pure logic.
 *
 * Split from the store tests because everything here is a plain function: the
 * budget allocator, the storage wrapper, the untrusted-input parser and the
 * disk reconciler can be driven directly, including their failure paths, which
 * is exactly what a store-level test cannot reach.
 *
 * ON OBSERVING STORAGE WRITES
 * ---------------------------
 * `vi.spyOn(window.localStorage, 'setItem')` records **zero** calls under jsdom
 * (measured: spy count 0 while the value was really written and readable). jsdom
 * exposes `localStorage` through a proxy, so the own-property spy is never the
 * function that runs. Two angles are used instead, and both are verified to
 * actually fire:
 *
 *   1. a fake `RawStorage` injected into `createSessionStorage` — deterministic,
 *      and lets a byte limit be enforced exactly;
 *   2. `vi.spyOn(Storage.prototype, 'setItem')` when the real thing is needed —
 *      measured to record 1 call, unlike the instance spy.
 *
 * jsdom also throws a genuine `QuotaExceededError` on a large enough write
 * (measured with a 10 MB payload), so the quota path is exercised against real
 * storage rather than only a simulation.
 */

import { describe, it, expect, vi } from 'vitest';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

import {
  MAX_CLEAN_CONTENT_BYTES_PER_TAB,
  SESSION_STORAGE_KEY,
  allocateContentBudget,
  byteLength,
  createIpcDiskReader,
  createMemoryStorage,
  createSessionStorage,
  degradeSession,
  parsePersistedSession,
  parsePersistedTab,
  reconcileTabs,
  resolveStorageEngine,
  toPersistedSession,
  withRepairedFocus,
  type DiskReadResult,
  type PersistedSession,
  type RawStorage,
  type ReconcilableTab,
} from '../editor-session';

/**
 * Reads through a `PersistStorage` synchronously.
 *
 * `PersistStorage.getItem` is typed as possibly-async to support async engines.
 * `createSessionStorage` is synchronous by construction (it wraps a `Storage`),
 * and the assertion below fails loudly if that ever stops being true, instead of
 * letting a test compare against a pending promise and pass.
 */
function readSync(
  storage: PersistStorage<PersistedSession>,
  key: string
): StorageValue<PersistedSession> | null {
  const value = storage.getItem(key);
  expect(value, 'expected a synchronous read').not.toBeInstanceOf(Promise);
  return value as StorageValue<PersistedSession> | null;
}

/** A tab shaped for the budget/persistence helpers. */
function tab(overrides: Partial<ReconcilableTab> & { id: string }): ReconcilableTab {
  return {
    path: `/${overrides.id}.ts`,
    language: 'typescript',
    content: 'content',
    isDirty: false,
    isActive: false,
    ...overrides,
  };
}

/**
 * A storage engine with a hard byte ceiling, so the degradation ladder can be
 * driven deterministically instead of hoping a real quota trips.
 */
function createLimitedStorage(limit: number): RawStorage & { writes: string[] } {
  const map = new Map<string, string>();
  const writes: string[] = [];

  return {
    writes,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(value);
      if (byteLength(value) > limit) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      map.set(key, value);
    },
    removeItem: (key) => void map.delete(key),
  };
}

describe('byteLength', () => {
  it('counts UTF-8 bytes, not code units', () => {
    // A quota is counted in bytes; using `.length` would under-count by 2x here
    // and let an over-budget payload through.
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('é')).toBe(2);
    expect(byteLength('😀')).toBe(4);
  });

  it('over-estimates rather than under-estimates without TextEncoder', () => {
    // The fallback must never report fewer bytes than the truth, or an
    // over-quota payload would be waved through on a runtime lacking
    // TextEncoder.
    const original = globalThis.TextEncoder;
    // @ts-expect-error deliberately removing a global to reach the fallback
    delete globalThis.TextEncoder;

    try {
      expect(byteLength('abc')).toBeGreaterThanOrEqual(3);
      expect(byteLength('😀')).toBeGreaterThanOrEqual(4);
    } finally {
      globalThis.TextEncoder = original;
    }

    // And the real path is back, so no later test silently uses the fallback.
    expect(byteLength('abc')).toBe(3);
  });
});

describe('allocateContentBudget', () => {
  it('serves dirty tabs before clean ones when the budget is tight', () => {
    // Only ~one payload fits. The dirty tab's content exists nowhere else, so it
    // is the one that must survive.
    const content = 'x'.repeat(100);
    const keep = allocateContentBudget(
      [
        tab({ id: 'clean', content, isDirty: false }),
        tab({ id: 'dirty', content, isDirty: true }),
      ],
      1000,
      150
    );

    expect(keep.has('dirty')).toBe(true);
    expect(keep.has('clean')).toBe(false);
  });

  it('skips an oversized clean tab without starving the tabs behind it', () => {
    // The `continue`-not-`break` case: one huge file must not cost every other
    // tab its content.
    const keep = allocateContentBudget(
      [
        tab({ id: 'huge', content: 'x'.repeat(5000) }),
        tab({ id: 'small', content: 'x'.repeat(10) }),
      ],
      1000,
      10_000
    );

    expect(keep.has('huge')).toBe(false);
    expect(keep.has('small')).toBe(true);
  });

  it('exempts unsaved content from the per-tab cap', () => {
    // The per-tab cap exists because clean content is re-readable from disk.
    // Unsaved content is not, so capping it would discard the user's work while
    // budget sat unused — which is exactly what an earlier version of this
    // allocator did to a 1.5 MB dirty file.
    const keep = allocateContentBudget(
      [tab({ id: 'big-dirty', content: 'x'.repeat(5000), isDirty: true })],
      1000,
      10_000
    );

    expect(keep.has('big-dirty')).toBe(true);
  });

  it('still refuses unsaved content that exceeds the total budget', () => {
    const keep = allocateContentBudget(
      [tab({ id: 'enormous', content: 'x'.repeat(5000), isDirty: true })],
      1000,
      100
    );

    expect(keep.has('enormous')).toBe(false);
  });

  it('keeps more unsaved files rather than one big one', () => {
    // Smallest-first among dirty tabs: three recovered files beat one.
    const keep = allocateContentBudget(
      [
        tab({ id: 'big', content: 'x'.repeat(300), isDirty: true }),
        tab({ id: 's1', content: 'x'.repeat(100), isDirty: true }),
        tab({ id: 's2', content: 'x'.repeat(100), isDirty: true }),
        tab({ id: 's3', content: 'x'.repeat(100), isDirty: true }),
      ],
      10_000,
      320
    );

    expect([...keep].sort()).toEqual(['s1', 's2', 's3']);
  });

  it('stops once the total budget is consumed', () => {
    const tabs = Array.from({ length: 10 }, (_, index) =>
      tab({ id: `t${index}`, content: 'x'.repeat(100) })
    );

    const keep = allocateContentBudget(tabs, 1000, 250);

    expect(keep.size).toBe(2);
  });

  it('keeps everything when the budget is ample', () => {
    const keep = allocateContentBudget([tab({ id: 'a' }), tab({ id: 'b' })]);
    expect(keep.size).toBe(2);
  });
});

describe('toPersistedSession', () => {
  it('preserves tab order even though the budget is allocated dirty-first', () => {
    // Order is the tab strip's order; allocation order must not leak into it.
    const session = toPersistedSession(
      [
        tab({ id: 'a', isDirty: false }),
        tab({ id: 'b', isDirty: true }),
        tab({ id: 'c', isDirty: false }),
      ],
      'b'
    );

    expect(session.tabs.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(session.activeTabId).toBe('b');
  });

  it('nulls the content of tabs that lost the budget, keeping their metadata', () => {
    const session = toPersistedSession(
      [
        tab({
          id: 'big',
          content: 'x'.repeat(2000),
          cursorPosition: { line: 4, column: 2 },
          baselineMtime: 111,
        }),
      ],
      'big',
      100,
      100
    );

    expect(session.tabs[0].content).toBeNull();
    // The point of degrading rather than dropping: the tab still comes back.
    expect(session.tabs[0].path).toBe('/big.ts');
    expect(session.tabs[0].cursorPosition).toEqual({ line: 4, column: 2 });
    expect(session.tabs[0].baselineMtime).toBe(111);
  });

  it('persists cursor and scroll positions', () => {
    const session = toPersistedSession(
      [
        tab({
          id: 'a',
          cursorPosition: { line: 42, column: 7 },
          scrollPosition: { top: 900, left: 12 },
        }),
      ],
      'a'
    );

    expect(session.tabs[0].cursorPosition).toEqual({ line: 42, column: 7 });
    expect(session.tabs[0].scrollPosition).toEqual({ top: 900, left: 12 });
  });
});

describe('degradeSession', () => {
  it('drops clean content before dirty content, and metadata never', () => {
    const session: PersistedSession = {
      tabs: [
        { id: 'a', path: '/a.ts', language: 'ts', content: 'clean', isDirty: false, isActive: false },
        { id: 'b', path: '/b.ts', language: 'ts', content: 'dirty', isDirty: true, isActive: true },
      ],
      activeTabId: 'b',
    };

    const [first, second, third] = degradeSession(session);

    expect(first.tabs.map((entry) => entry.content)).toEqual(['clean', 'dirty']);
    expect(second.tabs.map((entry) => entry.content)).toEqual([null, 'dirty']);
    expect(third.tabs.map((entry) => entry.content)).toEqual([null, null]);
    // Every rung keeps the tab list itself.
    for (const stage of [first, second, third]) {
      expect(stage.tabs.map((entry) => entry.path)).toEqual(['/a.ts', '/b.ts']);
      expect(stage.activeTabId).toBe('b');
    }
  });
});

describe('parsePersistedTab / parsePersistedSession', () => {
  it('accepts a well-formed tab', () => {
    const parsed = parsePersistedTab({
      id: 'tab-1',
      path: '/a.ts',
      language: 'typescript',
      content: 'x',
      isDirty: true,
      isActive: true,
      cursorPosition: { line: 2, column: 3 },
      scrollPosition: { top: 10, left: 0 },
      baselineMtime: 5,
    });

    expect(parsed).toEqual({
      id: 'tab-1',
      path: '/a.ts',
      language: 'typescript',
      content: 'x',
      isDirty: true,
      isActive: true,
      cursorPosition: { line: 2, column: 3 },
      scrollPosition: { top: 10, left: 0 },
      baselineMtime: 5,
    });
  });

  it.each([
    ['not an object', 42],
    ['null', null],
    ['missing id', { path: '/a.ts' }],
    ['empty id', { id: '', path: '/a.ts' }],
    ['missing path', { id: 'tab-1' }],
    ['empty path', { id: 'tab-1', path: '' }],
    ['non-string path', { id: 'tab-1', path: 7 }],
  ])('rejects %s', (_label, value) => {
    expect(parsePersistedTab(value)).toBeNull();
  });

  it('defaults a missing language rather than producing an undefined mode', () => {
    // Monaco throws on `language: undefined`; a corrupt entry must not be able
    // to reach it.
    expect(parsePersistedTab({ id: 'a', path: '/a.ts' })?.language).toBe('plaintext');
  });

  it('drops malformed positions instead of trusting half of them', () => {
    const parsed = parsePersistedTab({
      id: 'a',
      path: '/a.ts',
      cursorPosition: { line: 3 },
      scrollPosition: { top: 'nope', left: 1 },
    });

    expect(parsed?.cursorPosition).toBeUndefined();
    expect(parsed?.scrollPosition).toBeUndefined();
  });

  it('treats a non-string content as absent rather than coercing it', () => {
    expect(parsePersistedTab({ id: 'a', path: '/a.ts', content: 42 })?.content).toBeNull();
  });

  it('preserves an empty-string content, which is a legitimately empty file', () => {
    expect(parsePersistedTab({ id: 'a', path: '/a.ts', content: '' })?.content).toBe('');
  });

  it('drops duplicate paths and ids that no action could ever produce', () => {
    const session = parsePersistedSession({
      tabs: [
        { id: 'a', path: '/dup.ts' },
        { id: 'b', path: '/dup.ts' },
        { id: 'a', path: '/other.ts' },
        { id: 'c', path: '/fine.ts' },
      ],
      activeTabId: 'a',
    });

    expect(session?.tabs.map((entry) => entry.path)).toEqual(['/dup.ts', '/fine.ts']);
  });

  it('skips malformed entries while keeping the valid ones', () => {
    const session = parsePersistedSession({
      tabs: [null, { id: 'a', path: '/a.ts' }, { nope: true }, 7],
      activeTabId: 'a',
    });

    expect(session?.tabs).toHaveLength(1);
  });

  it.each([
    ['a non-object', 'string'],
    ['a session without tabs', { activeTabId: 'a' }],
    ['a session whose tabs is not an array', { tabs: 'nope' }],
  ])('rejects %s', (_label, value) => {
    expect(parsePersistedSession(value)).toBeNull();
  });

  it('normalises a non-string activeTabId to null', () => {
    expect(parsePersistedSession({ tabs: [], activeTabId: 12 })?.activeTabId).toBeNull();
  });
});

describe('createSessionStorage', () => {
  it('writes a session that reads back identically', () => {
    const engine = createMemoryStorage();
    const storage = createSessionStorage(engine);
    const state: PersistedSession = {
      tabs: [
        { id: 'a', path: '/a.ts', language: 'ts', content: 'body', isDirty: true, isActive: true },
      ],
      activeTabId: 'a',
    };

    storage.setItem(SESSION_STORAGE_KEY, { state, version: 1 });

    expect(readSync(storage, SESSION_STORAGE_KEY)).toEqual({ state, version: 1 });
  });

  it('degrades to clean-content-stripped when the full payload is over quota', () => {
    // Sized so the full payload fails and the clean-stripped one fits.
    const engine = createLimitedStorage(260);
    const failures: number[] = [];
    const storage = createSessionStorage(engine, (stage) => failures.push(stage));

    storage.setItem(SESSION_STORAGE_KEY, {
      state: {
        tabs: [
          {
            id: 'a',
            path: '/a.ts',
            language: 'ts',
            content: 'x'.repeat(200),
            isDirty: false,
            isActive: false,
          },
          { id: 'b', path: '/b.ts', language: 'ts', content: 'keep', isDirty: true, isActive: true },
        ],
        activeTabId: 'b',
      },
      version: 1,
    });

    expect(failures).toEqual([0]);

    const readBack = readSync(storage, SESSION_STORAGE_KEY);
    expect(readBack?.state.tabs[0].content).toBeNull();
    expect(readBack?.state.tabs[1].content).toBe('keep');
  });

  it('falls back to metadata-only when even the dirty content will not fit', () => {
    const engine = createLimitedStorage(200);
    const failures: number[] = [];
    const storage = createSessionStorage(engine, (stage) => failures.push(stage));

    storage.setItem(SESSION_STORAGE_KEY, {
      state: {
        tabs: [
          {
            id: 'a',
            path: '/a.ts',
            language: 'ts',
            content: 'y'.repeat(300),
            isDirty: true,
            isActive: true,
          },
        ],
        activeTabId: 'a',
      },
      version: 1,
    });

    expect(failures).toEqual([0, 1]);

    const readBack = readSync(storage, SESSION_STORAGE_KEY);
    // The tab still comes back; only its content is gone.
    expect(readBack?.state.tabs[0].path).toBe('/a.ts');
    expect(readBack?.state.tabs[0].content).toBeNull();
    expect(readBack?.state.tabs[0].isDirty).toBe(true);
  });

  it('removes the key when nothing fits, rather than leaving a stale session', () => {
    const engine = createLimitedStorage(10);
    engine.setItem(SESSION_STORAGE_KEY, 'stale');
    const storage = createSessionStorage(engine);

    storage.setItem(SESSION_STORAGE_KEY, {
      state: {
        tabs: [{ id: 'a', path: '/a.ts', language: 'ts', content: 'z', isDirty: true, isActive: true }],
        activeTabId: 'a',
      },
      version: 1,
    });

    expect(engine.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('reports every failed stage to the observer', () => {
    const engine = createLimitedStorage(1);
    const failures: number[] = [];
    createSessionStorage(engine, (stage) => failures.push(stage)).setItem(SESSION_STORAGE_KEY, {
      state: {
        tabs: [{ id: 'a', path: '/a.ts', language: 'ts', content: 'z', isDirty: true, isActive: true }],
        activeTabId: 'a',
      },
      version: 1,
    });

    expect(failures).toEqual([0, 1, 2]);
  });

  it('survives a real jsdom QuotaExceededError end to end', () => {
    // Not a simulation: jsdom rejects a large enough write with a genuine
    // QuotaExceededError (measured). This proves the wiring, not just the logic.
    const key = 'cortex:editor-session-quota-probe';
    window.localStorage.removeItem(key);

    const storage = createSessionStorage(window.localStorage);
    let observed = 0;
    const observing = createSessionStorage(window.localStorage, () => {
      observed += 1;
    });

    // ~6 MB of clean content: over jsdom's quota, under it once stripped.
    observing.setItem(key, {
      state: {
        tabs: [
          {
            id: 'a',
            path: '/huge.ts',
            language: 'ts',
            content: 'x'.repeat(6 * 1024 * 1024),
            isDirty: false,
            isActive: true,
          },
        ],
        activeTabId: 'a',
      },
      version: 1,
    });

    expect(observed).toBeGreaterThan(0);
    const readBack = readSync(storage, key);
    expect(readBack?.state.tabs[0].path).toBe('/huge.ts');
    expect(readBack?.state.tabs[0].content).toBeNull();

    window.localStorage.removeItem(key);
  });

  it('reads a corrupt payload as an absent session', () => {
    const engine = createMemoryStorage();
    engine.setItem(SESSION_STORAGE_KEY, '{not json');

    expect(readSync(createSessionStorage(engine), SESSION_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['a JSON scalar', '42'],
    ['a payload with no state', '{"version":1}'],
    ['a payload whose state is malformed', '{"state":{"tabs":"nope"},"version":1}'],
  ])('reads %s as an absent session', (_label, raw) => {
    const engine = createMemoryStorage();
    engine.setItem(SESSION_STORAGE_KEY, raw);

    expect(readSync(createSessionStorage(engine), SESSION_STORAGE_KEY)).toBeNull();
  });

  it('defaults a missing version to undefined rather than inventing one', () => {
    const engine = createMemoryStorage();
    engine.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: { tabs: [], activeTabId: null } }));

    expect(readSync(createSessionStorage(engine), SESSION_STORAGE_KEY)?.version).toBeUndefined();
  });

  it('treats a throwing engine as an unavailable session on every operation', () => {
    // Private browsing / blocked storage: boot must not crash.
    const throwing: RawStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    const storage = createSessionStorage(throwing);

    expect(readSync(storage, SESSION_STORAGE_KEY)).toBeNull();
    expect(() =>
      storage.setItem(SESSION_STORAGE_KEY, { state: { tabs: [], activeTabId: null }, version: 1 })
    ).not.toThrow();
    expect(() => storage.removeItem(SESSION_STORAGE_KEY)).not.toThrow();
  });

  it('removeItem clears the key', () => {
    const engine = createMemoryStorage();
    engine.setItem(SESSION_STORAGE_KEY, 'x');

    createSessionStorage(engine).removeItem(SESSION_STORAGE_KEY);

    expect(engine.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('createMemoryStorage / resolveStorageEngine', () => {
  it('memory storage round-trips and deletes', () => {
    const engine = createMemoryStorage();
    expect(engine.getItem('k')).toBeNull();
    engine.setItem('k', 'v');
    expect(engine.getItem('k')).toBe('v');
    engine.removeItem('k');
    expect(engine.getItem('k')).toBeNull();
  });

  it('prefers localStorage when it is available', () => {
    expect(resolveStorageEngine()).toBe(window.localStorage);
  });

  it('falls back to memory when localStorage access throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });

    try {
      const engine = resolveStorageEngine();
      expect(engine).not.toBe(undefined);
      engine.setItem('k', 'v');
      expect(engine.getItem('k')).toBe('v');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    }

    expect(resolveStorageEngine()).toBe(window.localStorage);
  });

  it('falls back to memory when there is no localStorage at all', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });

    try {
      const engine = resolveStorageEngine();
      engine.setItem('k', 'v');
      expect(engine.getItem('k')).toBe('v');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    }
  });
});

describe('withRepairedFocus', () => {
  it('keeps a valid requested focus', () => {
    const result = withRepairedFocus(
      [
        { id: 'a', isActive: false },
        { id: 'b', isActive: true },
      ],
      'b'
    );

    expect(result.activeTabId).toBe('b');
    expect(result.tabs.map((entry) => entry.isActive)).toEqual([false, true]);
  });

  it('falls back to the flagged tab when the requested id is gone', () => {
    const result = withRepairedFocus(
      [
        { id: 'a', isActive: false },
        { id: 'b', isActive: true },
      ],
      'deleted'
    );

    expect(result.activeTabId).toBe('b');
  });

  it('falls back to the last tab when nothing is flagged', () => {
    const result = withRepairedFocus(
      [
        { id: 'a', isActive: false },
        { id: 'b', isActive: false },
      ],
      null
    );

    expect(result.activeTabId).toBe('b');
    expect(result.tabs.map((entry) => entry.isActive)).toEqual([false, true]);
  });

  it('clears the focus for an empty list', () => {
    expect(withRepairedFocus([], 'a')).toEqual({ tabs: [], activeTabId: null });
  });

  it('collapses several flagged tabs down to one (invariant I1)', () => {
    const result = withRepairedFocus(
      [
        { id: 'a', isActive: true },
        { id: 'b', isActive: true },
      ],
      null
    );

    expect(result.tabs.filter((entry) => entry.isActive)).toHaveLength(1);
    expect(result.activeTabId).toBe('a');
  });
});

/** Disk reader built from a path → result map; unlisted paths read as missing. */
function readerFor(files: Record<string, DiskReadResult>): (path: string) => Promise<DiskReadResult> {
  return async (path) => files[path] ?? { ok: false, missing: true };
}

const found = (content: string, mtime: number): DiskReadResult => ({
  ok: true,
  file: { content, mtime },
});

describe('reconcileTabs', () => {
  it('closes a clean tab whose file is gone', async () => {
    // A dead tab that errors on every click is worse than no tab — the same
    // failure mode as reattaching a terminal whose process had already exited.
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/gone.ts', isDirty: false, isActive: true })],
      'a',
      readerFor({})
    );

    expect(result.tabs).toHaveLength(0);
    expect(result.activeTabId).toBeNull();
    expect(result.closedPaths).toEqual(['/gone.ts']);
  });

  it('keeps a dirty tab whose file is gone and flags it', async () => {
    // The unsaved content is the only copy left; closing the tab would be the
    // one outcome the user cannot undo.
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/gone.ts', content: 'my work', isDirty: true, isActive: true })],
      'a',
      readerFor({})
    );

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].content).toBe('my work');
    expect(result.tabs[0].diskState).toBe('missing');
    expect(result.closedPaths).toEqual([]);
  });

  it('leaves a tab untouched when the read fails for a reason other than absence', async () => {
    // A permission error or an IPC blip must never close tabs.
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/locked.ts', content: 'stale', isDirty: false, isActive: true })],
      'a',
      readerFor({ '/locked.ts': { ok: false, missing: false } })
    );

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].content).toBe('stale');
    expect(result.tabs[0].diskState).toBeUndefined();
    expect(result.closedPaths).toEqual([]);
  });

  it('treats a reader that throws as a transient failure, not a deletion', async () => {
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/boom.ts', isActive: true })],
      'a',
      async () => {
        throw new Error('ipc died');
      }
    );

    expect(result.tabs).toHaveLength(1);
    expect(result.closedPaths).toEqual([]);
  });

  it('refreshes a clean tab from disk, silently', async () => {
    // The file on disk is the truth for a tab with no unsaved edits — a
    // git checkout between sessions should be picked up, not ignored.
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/a.ts', content: 'old', isDirty: false, isActive: true, baselineMtime: 1 })],
      'a',
      readerFor({ '/a.ts': found('new from disk', 99) })
    );

    expect(result.tabs[0].content).toBe('new from disk');
    expect(result.tabs[0].baselineMtime).toBe(99);
    expect(result.tabs[0].diskState).toBe('clean');
    expect(result.tabs[0].isDirty).toBe(false);
  });

  it('flags a conflict when a dirty tab meets a newer file, keeping the user version', async () => {
    const result = await reconcileTabs(
      [
        tab({
          id: 'a',
          path: '/a.ts',
          content: 'my unsaved work',
          isDirty: true,
          isActive: true,
          baselineMtime: 10,
        }),
      ],
      'a',
      readerFor({ '/a.ts': found('changed elsewhere', 20) })
    );

    expect(result.tabs[0].diskState).toBe('conflict');
    // Nothing overwritten in either direction.
    expect(result.tabs[0].content).toBe('my unsaved work');
    expect(result.tabs[0].isDirty).toBe(true);
    // Baseline untouched, so the conflict is still detectable next boot.
    expect(result.tabs[0].baselineMtime).toBe(10);
  });

  it('does not flag a conflict when the file is untouched', async () => {
    const result = await reconcileTabs(
      [
        tab({
          id: 'a',
          path: '/a.ts',
          content: 'my unsaved work',
          isDirty: true,
          isActive: true,
          baselineMtime: 10,
        }),
      ],
      'a',
      readerFor({ '/a.ts': found('original', 10) })
    );

    expect(result.tabs[0].diskState).toBe('clean');
    expect(result.tabs[0].content).toBe('my unsaved work');
  });

  it('does not flag a conflict when the mtime moved but the bytes did not', async () => {
    // `touch`, a checkout that restored identical content, a formatter that
    // changed nothing: a newer mtime alone is not a conflict.
    const result = await reconcileTabs(
      [
        tab({
          id: 'a',
          path: '/a.ts',
          content: 'same bytes',
          isDirty: true,
          isActive: true,
          baselineMtime: 10,
        }),
      ],
      'a',
      readerFor({ '/a.ts': found('same bytes', 50) })
    );

    expect(result.tabs[0].diskState).toBe('clean');
  });

  it('cannot claim a conflict for a dirty tab with no baseline', async () => {
    // No baseline means no evidence the file changed under us; asserting a
    // conflict would be a guess.
    const result = await reconcileTabs(
      [tab({ id: 'a', path: '/a.ts', content: 'work', isDirty: true, isActive: true })],
      'a',
      readerFor({ '/a.ts': found('different', 999) })
    );

    expect(result.tabs[0].diskState).toBe('clean');
    expect(result.tabs[0].content).toBe('work');
  });

  it('reports dropped unsaved content as lost and takes the disk version', async () => {
    // Honest degradation: the edits did not fit storage, so say so instead of
    // showing the disk content as though nothing had happened.
    const result = await reconcileTabs(
      [
        tab({
          id: 'a',
          path: '/a.ts',
          content: '',
          isDirty: true,
          isActive: true,
          unsavedContentDropped: true,
        }),
      ],
      'a',
      readerFor({ '/a.ts': found('disk version', 7) })
    );

    expect(result.tabs[0].diskState).toBe('unsaved-lost');
    expect(result.tabs[0].content).toBe('disk version');
    expect(result.tabs[0].isDirty).toBe(false);
    expect(result.tabs[0].baselineMtime).toBe(7);
    expect(result.tabs[0].unsavedContentDropped).toBe(false);
  });

  it('moves the focus off a tab that was closed for being absent', async () => {
    const result = await reconcileTabs(
      [
        tab({ id: 'a', path: '/a.ts', isActive: false }),
        tab({ id: 'gone', path: '/gone.ts', isActive: true }),
      ],
      'gone',
      readerFor({ '/a.ts': found('a', 1) })
    );

    expect(result.tabs.map((entry) => entry.path)).toEqual(['/a.ts']);
    expect(result.activeTabId).toBe('a');
    expect(result.tabs[0].isActive).toBe(true);
  });

  it('preserves order and per-tab positions across a mixed reconciliation', async () => {
    const result = await reconcileTabs(
      [
        tab({ id: 'a', path: '/a.ts', cursorPosition: { line: 5, column: 1 } }),
        tab({ id: 'b', path: '/gone.ts' }),
        tab({
          id: 'c',
          path: '/c.ts',
          isDirty: true,
          isActive: true,
          content: 'work',
          baselineMtime: 1,
          scrollPosition: { top: 300, left: 0 },
        }),
      ],
      'c',
      readerFor({ '/a.ts': found('a', 2), '/c.ts': found('elsewhere', 9) })
    );

    expect(result.tabs.map((entry) => entry.path)).toEqual(['/a.ts', '/c.ts']);
    expect(result.tabs[0].cursorPosition).toEqual({ line: 5, column: 1 });
    expect(result.tabs[1].scrollPosition).toEqual({ top: 300, left: 0 });
    expect(result.tabs[1].diskState).toBe('conflict');
    expect(result.closedPaths).toEqual(['/gone.ts']);
  });

  it('handles an empty tab list', async () => {
    const result = await reconcileTabs([], null, readerFor({}));

    expect(result).toEqual({ tabs: [], activeTabId: null, closedPaths: [] });
  });
});

describe('createIpcDiskReader', () => {
  const withBridge = async <T>(
    openFile: unknown,
    body: (reader: NonNullable<ReturnType<typeof createIpcDiskReader>>) => Promise<T>
  ): Promise<T> => {
    const original = (window as { cortex?: unknown }).cortex;
    (window as { cortex?: unknown }).cortex = { editor: { openFile } };

    try {
      const reader = createIpcDiskReader();
      if (!reader) throw new Error('expected a reader');
      return await body(reader);
    } finally {
      if (original === undefined) delete (window as { cortex?: unknown }).cortex;
      else (window as { cortex?: unknown }).cortex = original;
    }
  };

  it('returns null when no preload bridge is present', () => {
    const original = (window as { cortex?: unknown }).cortex;
    delete (window as { cortex?: unknown }).cortex;

    try {
      expect(createIpcDiskReader()).toBeNull();
    } finally {
      if (original !== undefined) (window as { cortex?: unknown }).cortex = original;
    }
  });

  it('returns null when the bridge exists but exposes no openFile', () => {
    const original = (window as { cortex?: unknown }).cortex;
    (window as { cortex?: unknown }).cortex = { editor: {} };

    try {
      expect(createIpcDiskReader()).toBeNull();
    } finally {
      if (original === undefined) delete (window as { cortex?: unknown }).cortex;
      else (window as { cortex?: unknown }).cortex = original;
    }
  });

  it('maps a successful response to content and mtime', async () => {
    const result = await withBridge(
      vi.fn(async () => ({ success: true, data: { content: 'body', stats: { mtime: 42 } } })),
      (reader) => reader('/a.ts')
    );

    expect(result).toEqual({ ok: true, file: { content: 'body', mtime: 42 } });
  });

  it('defaults a missing mtime to 0 so it can never look newer than a baseline', async () => {
    const result = await withBridge(
      vi.fn(async () => ({ success: true, data: { content: 'body' } })),
      (reader) => reader('/a.ts')
    );

    expect(result).toEqual({ ok: true, file: { content: 'body', mtime: 0 } });
  });

  it('maps FILE_NOT_FOUND to a missing file', async () => {
    const result = await withBridge(
      vi.fn(async () => ({ success: false, error: { code: 'FILE_NOT_FOUND' } })),
      (reader) => reader('/gone.ts')
    );

    expect(result).toEqual({ ok: false, missing: true });
  });

  it.each([
    ['PERMISSION_DENIED', { success: false, error: { code: 'PERMISSION_DENIED' } }],
    ['an error with no code', { success: false }],
    ['a null response', null],
  ])('does not treat %s as a deletion', async (_label, response) => {
    const result = await withBridge(
      vi.fn(async () => response),
      (reader) => reader('/a.ts')
    );

    expect(result).toEqual({ ok: false, missing: false });
  });

  it('treats a rejected call as a transient failure', async () => {
    const result = await withBridge(
      vi.fn(async () => {
        throw new Error('channel closed');
      }),
      (reader) => reader('/a.ts')
    );

    expect(result).toEqual({ ok: false, missing: false });
  });

  it('passes the requested path through', async () => {
    const openFile = vi.fn(async () => ({ success: true, data: { content: '', stats: { mtime: 1 } } }));
    await withBridge(openFile, (reader) => reader('/deep/nested/file.ts'));

    expect(openFile).toHaveBeenCalledWith({ path: '/deep/nested/file.ts' });
  });
});

describe('budget constants', () => {
  it('keeps the clean per-tab cap below the total', () => {
    // A per-tab cap above the total would make the total unreachable and the
    // dirty-first ordering pointless.
    expect(MAX_CLEAN_CONTENT_BYTES_PER_TAB).toBeLessThan(2 * 1024 * 1024);
  });
});
