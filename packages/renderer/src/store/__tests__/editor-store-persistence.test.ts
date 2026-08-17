/**
 * Editor store — persistence across a reload.
 *
 * These tests exercise the `persist` middleware itself: what lands in storage,
 * what comes back, and what happens when storage is corrupt, partial or over
 * quota. The store is a module singleton and reads storage when it is created,
 * so each test seeds storage first and then imports a *fresh* module via
 * `vi.resetModules()` — importing once at the top would test a single
 * rehydration for the whole file.
 *
 * The two invariants asserted throughout the sibling `editor-store.test.ts`
 * (I1: at most one active tab; I2: `activeTabId` agrees with it) are re-checked
 * here after every restore, because rehydrating and closing tabs whose file
 * vanished are both list surgery that could break them.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  SESSION_STORAGE_KEY,
  type DiskReadResult,
  type PersistedSession,
} from '../editor-session';
import type { useEditorStore as StoreType } from '../editor-store';

type Store = typeof StoreType;

/** Imports a fresh store module, so its rehydration happens now. */
async function freshStore(): Promise<Store> {
  vi.resetModules();
  const module = await import('../editor-store');
  return module.useEditorStore;
}

function seedStorage(session: PersistedSession, version = 1): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: session, version }));
}

function readStorage(): { state: PersistedSession; version?: number } | null {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function persistedTab(overrides: Partial<PersistedSession['tabs'][number]> & { id: string }) {
  return {
    path: `/${overrides.id}.ts`,
    language: 'typescript',
    content: 'disk content',
    isDirty: false,
    isActive: false,
    ...overrides,
  };
}

/** Asserts the store's structural invariants on a restored list. */
function expectInvariants(store: Store): void {
  const { tabs, activeTabId } = store.getState();
  const active = tabs.filter((entry) => entry.isActive);

  expect(active.length, `I1 violated: ${active.length} active tabs`).toBeLessThanOrEqual(1);

  if (activeTabId === null) {
    expect(active, 'I2 violated: null activeTabId with an active tab').toHaveLength(0);
    return;
  }

  const target = tabs.find((entry) => entry.id === activeTabId);
  expect(target, `I2 violated: activeTabId ${activeTabId} absent from tabs`).toBeDefined();
  expect(target?.isActive, 'I2 violated: activeTabId points at an inactive tab').toBe(true);
}

const found = (content: string, mtime: number): DiskReadResult => ({
  ok: true,
  file: { content, mtime },
});

/** Reader over a path → result map; unlisted paths read as missing. */
function readerFor(files: Record<string, DiskReadResult>) {
  return async (path: string): Promise<DiskReadResult> => files[path] ?? { ok: false, missing: true };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('editor store persistence', () => {
  describe('writing', () => {
    it('writes the session to storage when a tab is opened', async () => {
      const store = await freshStore();

      store.getState().openTab('/a.ts', 'body', 'typescript', 1234);

      const written = readStorage();
      expect(written?.state.tabs).toHaveLength(1);
      expect(written?.state.tabs[0].path).toBe('/a.ts');
      expect(written?.state.tabs[0].content).toBe('body');
      expect(written?.state.tabs[0].baselineMtime).toBe(1234);
      expect(written?.state.activeTabId).toBe(store.getState().activeTabId);
    });

    it('really reaches Storage.prototype.setItem', async () => {
      // Guards against the whole suite passing while nothing is ever written:
      // `vi.spyOn(window.localStorage, 'setItem')` records 0 calls under jsdom
      // (measured), so the prototype is the observable seam. Verified to fire.
      const store = await freshStore();
      const spy = vi.spyOn(Storage.prototype, 'setItem');

      store.getState().openTab('/a.ts', 'body', 'typescript');

      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.some(([key]) => key === SESSION_STORAGE_KEY)).toBe(true);
    });

    it('persists unsaved content, because it exists nowhere else', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'original', 'typescript', 10);
      const id = store.getState().tabs[0].id;

      store.getState().updateTabContent(id, 'unsaved work');
      store.getState().markTabDirty(id, true);

      const written = readStorage();
      expect(written?.state.tabs[0].content).toBe('unsaved work');
      expect(written?.state.tabs[0].isDirty).toBe(true);
    });

    it('persists cursor and scroll positions', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');
      const id = store.getState().tabs[0].id;

      store.getState().updateCursorPosition(id, 42, 7);
      store.getState().updateScrollPosition(id, 900, 12);

      const written = readStorage();
      expect(written?.state.tabs[0].cursorPosition).toEqual({ line: 42, column: 7 });
      expect(written?.state.tabs[0].scrollPosition).toEqual({ top: 900, left: 12 });
    });

    it('never persists actions or the transient session status', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');

      const written = readStorage();
      expect(Object.keys(written?.state ?? {}).sort()).toEqual(['activeTabId', 'tabs']);
      expect(Object.keys(written?.state.tabs[0] ?? {})).not.toContain('diskState');
    });

    it('reflects a closed tab, so a stale tab cannot come back', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');
      store.getState().openTab('/b.ts', 'body', 'typescript');
      const id = store.getState().tabs[0].id;

      store.getState().closeTab(id);

      expect(readStorage()?.state.tabs.map((entry) => entry.path)).toEqual(['/b.ts']);
    });

    it('writes an empty session after closing everything', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');

      store.getState().closeAllTabs();

      expect(readStorage()?.state).toEqual({ tabs: [], activeTabId: null });
    });

    it('records the version so a future format change can migrate', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');

      expect(readStorage()?.version).toBe(1);
    });
  });

  describe('restoring', () => {
    it('brings tabs back with their content, order and focus', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1', content: 'first' }),
          persistedTab({ id: 't2', content: 'second', isActive: true }),
        ],
        activeTabId: 't2',
      });

      const store = await freshStore();

      const { tabs, activeTabId } = store.getState();
      expect(tabs.map((entry) => entry.path)).toEqual(['/t1.ts', '/t2.ts']);
      expect(tabs.map((entry) => entry.content)).toEqual(['first', 'second']);
      expect(activeTabId).toBe('t2');
      expectInvariants(store);
    });

    it('restores cursor and scroll positions per tab', async () => {
      seedStorage({
        tabs: [
          persistedTab({
            id: 't1',
            isActive: true,
            cursorPosition: { line: 42, column: 7 },
            scrollPosition: { top: 900, left: 12 },
          }),
        ],
        activeTabId: 't1',
      });

      const store = await freshStore();

      expect(store.getState().tabs[0].cursorPosition).toEqual({ line: 42, column: 7 });
      expect(store.getState().tabs[0].scrollPosition).toEqual({ top: 900, left: 12 });
    });

    it('restores the dirty flag with the unsaved content', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: 'unsaved', isDirty: true, isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();

      expect(store.getState().tabs[0].isDirty).toBe(true);
      expect(store.getState().tabs[0].content).toBe('unsaved');
      expect(store.getState().hasUnsavedChanges()).toBe(true);
    });

    it('does not claim a tab is dirty when its content was never persisted', async () => {
      // Restoring `isDirty: true` with empty content would show a modified dot
      // over content the user never wrote.
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: null, isDirty: true, isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();

      expect(store.getState().tabs[0].isDirty).toBe(false);
      expect(store.getState().tabs[0].unsavedContentDropped).toBe(true);
      expect(store.getState().hasUnsavedChanges()).toBe(false);
    });

    it('repairs a focus that points at a tab which is no longer stored', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', isActive: true })],
        activeTabId: 'deleted-elsewhere',
      });

      const store = await freshStore();

      expect(store.getState().activeTabId).toBe('t1');
      expectInvariants(store);
    });

    it('starts empty when storage holds nothing', async () => {
      const store = await freshStore();

      expect(store.getState().tabs).toEqual([]);
      expect(store.getState().activeTabId).toBeNull();
      expectInvariants(store);
    });

    it('starts empty when storage is corrupt rather than failing to boot', async () => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, '{ not json at all');

      const store = await freshStore();

      expect(store.getState().tabs).toEqual([]);
      expectInvariants(store);
    });

    it('drops a malformed tab but keeps the valid ones', async () => {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          state: {
            tabs: [{ id: 'broken' }, persistedTab({ id: 't1', isActive: true })],
            activeTabId: 't1',
          },
          version: 1,
        })
      );

      const store = await freshStore();

      expect(store.getState().tabs.map((entry) => entry.path)).toEqual(['/t1.ts']);
      expectInvariants(store);
    });

    it('keeps the actions callable after a restore', async () => {
      // `merge` returns a new object; dropping the action functions would leave
      // a store that looks right and throws on the first click.
      seedStorage({
        tabs: [persistedTab({ id: 't1', isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();

      expect(() => store.getState().setActiveTab('t1')).not.toThrow();
      expect(store.getState().getActiveTab()?.path).toBe('/t1.ts');
      expect(store.getState().getTab('t1')?.path).toBe('/t1.ts');

      store.getState().closeTab('t1');
      expect(store.getState().tabs).toEqual([]);
      expectInvariants(store);
    });

    it('re-opening a restored path focuses it instead of duplicating it', async () => {
      // The restored id is not the one `openTab` would mint, so a path-based
      // lookup is the only thing that keeps this from duplicating.
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: 'unsaved', isDirty: true, isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();

      store.getState().openTab('/t1.ts', 'content from disk', 'typescript');

      expect(store.getState().tabs).toHaveLength(1);
      // Same rule as a live re-open: unsaved edits are not overwritten.
      expect(store.getState().tabs[0].content).toBe('unsaved');
      expect(store.getState().tabs[0].isDirty).toBe(true);
      expectInvariants(store);
    });
  });

  describe('restoreSession (reconciliation with disk)', () => {
    it('settles the status even with no bridge, so callers never hang', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(null);

      expect(store.getState().sessionStatus).toBe('restored');
      expect(store.getState().tabs).toHaveLength(1);
    });

    it('settles the status with no tabs to reconcile', async () => {
      const store = await freshStore();
      await store.getState().restoreSession(readerFor({}));

      expect(store.getState().sessionStatus).toBe('restored');
    });

    it('refreshes a clean tab from disk and persists the refreshed content', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: 'stale', isActive: true, baselineMtime: 1 })],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('fresh from disk', 50) }));

      expect(store.getState().tabs[0].content).toBe('fresh from disk');
      expect(store.getState().tabs[0].baselineMtime).toBe(50);
      expect(readStorage()?.state.tabs[0].content).toBe('fresh from disk');
      expectInvariants(store);
    });

    it('closes a clean tab whose file vanished, and forgets it in storage', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1' }),
          persistedTab({ id: 'gone', path: '/gone.ts', isActive: true }),
        ],
        activeTabId: 'gone',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('a', 1) }));

      expect(store.getState().tabs.map((entry) => entry.path)).toEqual(['/t1.ts']);
      expect(store.getState().activeTabId).toBe('t1');
      // Not just hidden: gone from storage, so it cannot resurrect next boot.
      expect(readStorage()?.state.tabs.map((entry) => entry.path)).toEqual(['/t1.ts']);
      expectInvariants(store);
    });

    it('keeps a dirty tab whose file vanished and flags it', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1', path: '/gone.ts', content: 'my work', isDirty: true, isActive: true }),
        ],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({}));

      expect(store.getState().tabs).toHaveLength(1);
      expect(store.getState().tabs[0].content).toBe('my work');
      expect(store.getState().tabs[0].diskState).toBe('missing');
      expectInvariants(store);
    });

    it('flags a conflict without overwriting either version', async () => {
      seedStorage({
        tabs: [
          persistedTab({
            id: 't1',
            content: 'my unsaved work',
            isDirty: true,
            isActive: true,
            baselineMtime: 10,
          }),
        ],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('changed on disk', 99) }));

      const tab = store.getState().tabs[0];
      expect(tab.diskState).toBe('conflict');
      expect(tab.content).toBe('my unsaved work');
      expect(tab.isDirty).toBe(true);
      expectInvariants(store);
    });

    it('reports lost unsaved content instead of silently showing the disk version', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: null, isDirty: true, isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('disk version', 5) }));

      const tab = store.getState().tabs[0];
      expect(tab.diskState).toBe('unsaved-lost');
      expect(tab.content).toBe('disk version');
      expect(tab.isDirty).toBe(false);
    });

    it('leaves tabs alone when the reads fail transiently', async () => {
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: 'kept', isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(async () => ({ ok: false, missing: false }));

      expect(store.getState().tabs).toHaveLength(1);
      expect(store.getState().tabs[0].content).toBe('kept');
      expectInvariants(store);
    });

    it('runs on rehydration without an explicit call', async () => {
      // The middleware wiring itself: with no preload bridge the reader is null,
      // so the only observable effect is the status settling.
      seedStorage({
        tabs: [persistedTab({ id: 't1', isActive: true })],
        activeTabId: 't1',
      });

      const store = await freshStore();

      await vi.waitFor(() => {
        expect(store.getState().sessionStatus).toBe('restored');
      });
    });

    it('does not reconcile when rehydration reported an error', async () => {
      // `persist` types the rehydrate callback as receiving either a state or an
      // error. This store's storage turns every read failure into "no session",
      // so the error arm is unreachable through it — the guard is tested
      // directly rather than left as covered-but-unverified defensive code.
      vi.resetModules();
      const { handleRehydrated, useEditorStore: store } = await import('../editor-store');
      const spy = vi.spyOn(store.getState(), 'restoreSession');

      handleRehydrated(store.getState(), new Error('rehydrate failed'));

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not reconcile when rehydration produced no state', async () => {
      vi.resetModules();
      const { handleRehydrated } = await import('../editor-store');

      expect(() => handleRehydrated(undefined)).not.toThrow();
    });

    it('reconciles when rehydration succeeded', async () => {
      // The positive arm, so the two guards above cannot pass by never calling
      // through at all.
      vi.resetModules();
      const { handleRehydrated, useEditorStore: store } = await import('../editor-store');
      const spy = vi.spyOn(store.getState(), 'restoreSession').mockResolvedValue(undefined);

      handleRehydrated(store.getState());

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('reconciles through the preload bridge when one exists', async () => {
      // End-to-end through `createIpcDiskReader`, not the injected reader.
      seedStorage({
        tabs: [persistedTab({ id: 't1', content: 'stale', isActive: true })],
        activeTabId: 't1',
      });

      const openFile = vi.fn(async () => ({
        success: true,
        data: { content: 'from ipc', stats: { mtime: 77 } },
      }));
      (window as { cortex?: unknown }).cortex = { editor: { openFile } };

      try {
        const store = await freshStore();
        await vi.waitFor(() => {
          expect(store.getState().sessionStatus).toBe('restored');
        });

        expect(openFile).toHaveBeenCalledWith({ path: '/t1.ts' });
        expect(store.getState().tabs[0].content).toBe('from ipc');
        expect(store.getState().tabs[0].baselineMtime).toBe(77);
      } finally {
        delete (window as { cortex?: unknown }).cortex;
      }
    });
  });

  describe('conflict lifecycle', () => {
    it('a successful save clears the conflict and moves the baseline forward', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1', content: 'mine', isDirty: true, isActive: true, baselineMtime: 10 }),
        ],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('theirs', 99) }));
      expect(store.getState().tabs[0].diskState).toBe('conflict');

      // The save path passes the mtime it got back from the write.
      store.getState().markTabDirty('t1', false, 120);

      const tab = store.getState().tabs[0];
      expect(tab.diskState).toBeUndefined();
      expect(tab.isDirty).toBe(false);
      expect(tab.baselineMtime).toBe(120);
    });

    it('a conflict survives a reload when it was not resolved', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1', content: 'mine', isDirty: true, isActive: true, baselineMtime: 10 }),
        ],
        activeTabId: 't1',
      });

      const first = await freshStore();
      await first.getState().restoreSession(readerFor({ '/t1.ts': found('theirs', 99) }));
      expect(first.getState().tabs[0].diskState).toBe('conflict');

      // Reload: `diskState` is not persisted, so it must be re-derived.
      const second = await freshStore();
      expect(second.getState().tabs[0].diskState).toBeUndefined();
      await second.getState().restoreSession(readerFor({ '/t1.ts': found('theirs', 99) }));

      expect(second.getState().tabs[0].diskState).toBe('conflict');
      expect(second.getState().tabs[0].content).toBe('mine');
    });

    it('marking dirty without an mtime leaves the baseline and flag alone', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript', 10);
      const id = store.getState().tabs[0].id;

      store.getState().markTabDirty(id, true);

      expect(store.getState().tabs[0].baselineMtime).toBe(10);
    });

    it('acknowledgeDiskState clears the flag and nothing else', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1', content: 'mine', isDirty: true, isActive: true, baselineMtime: 10 }),
        ],
        activeTabId: 't1',
      });

      const store = await freshStore();
      await store.getState().restoreSession(readerFor({ '/t1.ts': found('theirs', 99) }));

      store.getState().acknowledgeDiskState('t1');

      const tab = store.getState().tabs[0];
      expect(tab.diskState).toBeUndefined();
      expect(tab.isDirty).toBe(true);
      expect(tab.content).toBe('mine');
    });

    it('acknowledgeDiskState ignores an unknown id', async () => {
      const store = await freshStore();
      store.getState().openTab('/a.ts', 'body', 'typescript');
      const before = store.getState().tabs;

      store.getState().acknowledgeDiskState('nope');

      expect(store.getState().tabs.map((entry) => entry.path)).toEqual(
        before.map((entry) => entry.path)
      );
      expectInvariants(store);
    });
  });

  describe('storage pressure', () => {
    it('drops a large clean tab\'s content but keeps a large tab\'s unsaved work', async () => {
      const store = await freshStore();

      // 600 KB each: over the 512 KiB per-tab cap that applies to clean tabs,
      // under the 2 MiB total. An earlier allocator capped dirty tabs the same
      // way and threw the unsaved 600 KB away with budget to spare.
      const big = 'x'.repeat(600_000);
      store.getState().openTab('/clean.ts', big, 'typescript', 1);
      store.getState().openTab('/dirty.ts', big, 'typescript', 2);
      store.getState().markTabDirty(store.getState().tabs[1].id, true);

      const written = readStorage();
      const byPath = new Map(written?.state.tabs.map((entry) => [entry.path, entry]) ?? []);

      // Both tabs survive as tabs; only the recoverable content is sacrificed.
      expect(byPath.size).toBe(2);
      expect(byPath.get('/dirty.ts')?.content?.length).toBe(600_000);
      expect(byPath.get('/clean.ts')?.content).toBeNull();
    });

    it('still restores a session whose clean content was dropped for size', async () => {
      const store = await freshStore();
      const big = 'x'.repeat(600_000);
      store.getState().openTab('/clean.ts', big, 'typescript', 1);
      store.getState().openTab('/dirty.ts', 'small edit', 'typescript', 2);
      store.getState().markTabDirty(store.getState().tabs[1].id, true);

      const restored = await freshStore();

      expect(restored.getState().tabs.map((entry) => entry.path)).toEqual([
        '/clean.ts',
        '/dirty.ts',
      ]);
      // The clean tab comes back empty and is refilled from disk.
      expect(restored.getState().tabs[0].content).toBe('');
      expect(restored.getState().tabs[1].content).toBe('small edit');

      await restored
        .getState()
        .restoreSession(
          readerFor({ '/clean.ts': found('refilled', 9), '/dirty.ts': found('small edit', 2) })
        );

      expect(restored.getState().tabs[0].content).toBe('refilled');
      expectInvariants(restored);
    });

    it('sacrifices the largest unsaved file rather than all of them', async () => {
      const store = await freshStore();

      // Total budget 2 MiB. Three dirty tabs of 900 KB: two fit, the third does
      // not, and it must be the loser on its own rather than taking the others
      // down with it.
      const chunk = 'y'.repeat(900_000);
      for (const path of ['/d1.ts', '/d2.ts', '/d3.ts']) {
        store.getState().openTab(path, chunk, 'typescript', 1);
        store.getState().markTabDirty(store.getState().tabs.at(-1)!.id, true);
      }

      const written = readStorage();
      const persistedContents = written?.state.tabs.filter((entry) => entry.content !== null) ?? [];

      expect(persistedContents).toHaveLength(2);
      expect(written?.state.tabs).toHaveLength(3);
    });

    it('does not throw when a write is rejected outright', async () => {
      const store = await freshStore();
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => store.getState().openTab('/a.ts', 'body', 'typescript')).not.toThrow();
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
      // The in-memory state is still correct; only persistence was lost.
      expect(store.getState().tabs).toHaveLength(1);
    });
  });

  describe('invariants across a restore + edit cycle', () => {
    it('holds I1 and I2 through a restore followed by ordinary actions', async () => {
      seedStorage({
        tabs: [
          persistedTab({ id: 't1' }),
          persistedTab({ id: 't2' }),
          persistedTab({ id: 't3', isActive: true }),
        ],
        activeTabId: 't3',
      });

      const store = await freshStore();
      expectInvariants(store);

      store.getState().setActiveTab('t1');
      expectInvariants(store);

      store.getState().openTab('/t4.ts', 'body', 'typescript');
      expectInvariants(store);

      store.getState().closeTab('t3');
      expectInvariants(store);

      store.getState().closeOtherTabs('t2');
      expectInvariants(store);
      expect(store.getState().tabs.map((entry) => entry.path)).toEqual(['/t2.ts']);

      store.getState().closeAllTabs();
      expectInvariants(store);
    });

    it('round-trips a session through storage without drift', async () => {
      const first = await freshStore();
      first.getState().openTab('/a.ts', 'aaa', 'typescript', 11);
      first.getState().openTab('/b.ts', 'bbb', 'javascript', 22);
      const bId = first.getState().tabs[1].id;
      first.getState().updateTabContent(bId, 'bbb edited');
      first.getState().markTabDirty(bId, true);
      first.getState().updateCursorPosition(bId, 3, 4);
      first.getState().setActiveTab(first.getState().tabs[0].id);

      const before = first.getState();
      const second = await freshStore();
      const after = second.getState();

      expect(after.tabs.map((entry) => entry.path)).toEqual(before.tabs.map((entry) => entry.path));
      expect(after.tabs.map((entry) => entry.content)).toEqual(
        before.tabs.map((entry) => entry.content)
      );
      expect(after.tabs.map((entry) => entry.language)).toEqual(
        before.tabs.map((entry) => entry.language)
      );
      expect(after.tabs.map((entry) => entry.isDirty)).toEqual(
        before.tabs.map((entry) => entry.isDirty)
      );
      expect(after.tabs.map((entry) => entry.baselineMtime)).toEqual(
        before.tabs.map((entry) => entry.baselineMtime)
      );
      expect(after.tabs[1].cursorPosition).toEqual({ line: 3, column: 4 });
      expect(after.activeTabId).toBe(before.activeTabId);
      expectInvariants(second);
    });
  });
});
