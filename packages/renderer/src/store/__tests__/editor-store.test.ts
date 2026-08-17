/**
 * Editor store — state transitions and invariants.
 *
 * This is the state every view reads, so the tests here target the transitions
 * and the invariants rather than the getters. Two invariants are asserted after
 * *every* mutating test via `expectInvariants()`:
 *
 *   I1. At most one tab carries `isActive: true`.
 *   I2. `activeTabId` is either null or the id of a tab present in `tabs`, and
 *       it agrees with whichever tab carries `isActive`.
 *
 * Both describe the class of bug that shows up as "the UI is strange after a
 * few clicks": the tab strip highlights nothing, or `getActiveTab()` returns
 * undefined while the store still believes a tab is focused.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEditorStore, type EditorTab } from '../editor-store';

const state = () => useEditorStore.getState();

/** Fresh store per test — zustand stores are module singletons. */
beforeEach(() => {
  useEditorStore.setState({ tabs: [], activeTabId: null });
});

/**
 * The two structural invariants of the store.
 *
 * Called at the end of every mutating test. Asserting them centrally is what
 * makes a new action that forgets to keep `activeTabId` in sync fail somewhere,
 * rather than only in a test written specifically for that action.
 */
function expectInvariants(): void {
  const { tabs, activeTabId } = state();

  const active = tabs.filter((tab) => tab.isActive);
  expect(
    active.length,
    `I1 violated: ${active.length} tabs flagged active (${active.map((t) => t.path).join(', ')})`
  ).toBeLessThanOrEqual(1);

  if (activeTabId === null) {
    expect(active, 'I2 violated: activeTabId is null but a tab is flagged active').toHaveLength(0);
    return;
  }

  const target = tabs.find((tab) => tab.id === activeTabId);
  expect(
    target,
    `I2 violated: activeTabId ${activeTabId} is not in tabs [${tabs.map((t) => t.id).join(', ')}]`
  ).toBeDefined();
  expect(target?.isActive, 'I2 violated: activeTabId points at a tab not flagged active').toBe(
    true
  );
}

/** Opens tabs in order and returns them, so tests can address them by index. */
function openTabs(...paths: string[]): EditorTab[] {
  for (const path of paths) {
    useEditorStore.getState().openTab(path, `content of ${path}`, 'typescript');
  }
  return state().tabs;
}

const idFor = (path: string): string => {
  const tab = state().tabs.find((candidate) => candidate.path === path);
  if (!tab) throw new Error(`no tab open for ${path}`);
  return tab.id;
};

describe('editor store', () => {
  describe('openTab', () => {
    it('appends a tab and focuses it, leaving previous tabs unfocused', () => {
      openTabs('/a.ts', '/b.ts');

      const { tabs, activeTabId } = state();
      expect(tabs.map((tab) => tab.path)).toEqual(['/a.ts', '/b.ts']);
      expect(activeTabId).toBe(tabs[1].id);
      expect(tabs.map((tab) => tab.isActive)).toEqual([false, true]);
      expectInvariants();
    });

    it('focuses the existing tab instead of duplicating it when the path is already open', () => {
      openTabs('/a.ts', '/b.ts');
      const firstId = idFor('/a.ts');

      // Re-opening from the explorer: same path, freshly read content.
      useEditorStore.getState().openTab('/a.ts', 'content of /a.ts', 'typescript');

      const { tabs, activeTabId } = state();
      expect(tabs).toHaveLength(2);
      expect(tabs.filter((tab) => tab.path === '/a.ts')).toHaveLength(1);
      expect(activeTabId).toBe(firstId);
      expectInvariants();
    });

    it('preserves unsaved content when a dirty tab is re-opened', () => {
      openTabs('/a.ts');
      const id = idFor('/a.ts');
      useEditorStore.getState().updateTabContent(id, 'edited but not saved');
      useEditorStore.getState().markTabDirty(id, true);

      // The explorer hands over the content it read from disk.
      useEditorStore.getState().openTab('/a.ts', 'content of /a.ts', 'typescript');

      const tab = useEditorStore.getState().getTab(id);
      expect(tab?.content).toBe('edited but not saved');
      expect(tab?.isDirty).toBe(true);
      expectInvariants();
    });

    it('gives every tab a distinct id even when opened within the same millisecond', () => {
      // Ids are `tab-${Date.now()}-${random}`. Freezing the clock removes the
      // timestamp's contribution, so this fails if the random suffix is ever
      // dropped — e.g. while replacing the deprecated `substr` call.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      try {
        const paths = Array.from({ length: 50 }, (_, index) => `/file-${index}.ts`);
        openTabs(...paths);

        const ids = state().tabs.map((tab) => tab.id);
        expect(new Set(ids).size).toBe(50);
      } finally {
        vi.useRealTimers();
      }
      expectInvariants();
    });
  });

  describe('closeTab', () => {
    it('focuses the tab to the right when the active tab is closed', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');
      useEditorStore.getState().setActiveTab(idFor('/b.ts'));

      useEditorStore.getState().closeTab(idFor('/b.ts'));

      const { tabs, activeTabId } = state();
      expect(tabs.map((tab) => tab.path)).toEqual(['/a.ts', '/c.ts']);
      expect(activeTabId).toBe(idFor('/c.ts'));
      expectInvariants();
    });

    it('falls back to the new last tab when the rightmost tab is closed', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');
      // '/c.ts' is active: it was opened last.

      useEditorStore.getState().closeTab(idFor('/c.ts'));

      expect(state().activeTabId).toBe(idFor('/b.ts'));
      expectInvariants();
    });

    it('focuses the new first tab when the leftmost tab is closed', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');
      useEditorStore.getState().setActiveTab(idFor('/a.ts'));

      useEditorStore.getState().closeTab(idFor('/a.ts'));

      expect(state().activeTabId).toBe(idFor('/b.ts'));
      expectInvariants();
    });

    it('clears the active tab when the last remaining tab is closed', () => {
      openTabs('/only.ts');

      useEditorStore.getState().closeTab(idFor('/only.ts'));

      expect(state().tabs).toHaveLength(0);
      expect(state().activeTabId).toBeNull();
      expect(useEditorStore.getState().getActiveTab()).toBeUndefined();
      expectInvariants();
    });

    it('leaves the focus alone when a background tab is closed', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');
      const activeId = idFor('/c.ts');

      useEditorStore.getState().closeTab(idFor('/a.ts'));

      expect(state().activeTabId).toBe(activeId);
      expect(useEditorStore.getState().getActiveTab()?.path).toBe('/c.ts');
      expectInvariants();
    });

    it('ignores an unknown tab id', () => {
      openTabs('/a.ts', '/b.ts');
      const before = state();

      useEditorStore.getState().closeTab('tab-does-not-exist');

      expect(state().tabs).toBe(before.tabs);
      expect(state().activeTabId).toBe(before.activeTabId);
      expectInvariants();
    });

    it('keeps exactly one tab focused while closing tabs one by one', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts', '/d.ts');

      for (let remaining = 4; remaining > 0; remaining -= 1) {
        expect(state().tabs).toHaveLength(remaining);
        expectInvariants();
        useEditorStore.getState().closeTab(state().activeTabId!);
      }

      expect(state().tabs).toHaveLength(0);
      expect(state().activeTabId).toBeNull();
      expectInvariants();
    });
  });

  describe('closeAllTabs / closeOtherTabs', () => {
    it('closeAllTabs empties the strip and drops the focus', () => {
      openTabs('/a.ts', '/b.ts');

      useEditorStore.getState().closeAllTabs();

      expect(state().tabs).toEqual([]);
      expect(state().activeTabId).toBeNull();
      expectInvariants();
    });

    it('closeOtherTabs keeps only the named tab and focuses it', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');
      const keepId = idFor('/b.ts');

      useEditorStore.getState().closeOtherTabs(keepId);

      const { tabs, activeTabId } = state();
      expect(tabs.map((tab) => tab.path)).toEqual(['/b.ts']);
      expect(activeTabId).toBe(keepId);
      expectInvariants();
    });

    it('closeOtherTabs preserves the kept tab\'s content and dirty flag', () => {
      openTabs('/a.ts', '/b.ts');
      const keepId = idFor('/b.ts');
      useEditorStore.getState().updateTabContent(keepId, 'unsaved work');
      useEditorStore.getState().markTabDirty(keepId, true);

      useEditorStore.getState().closeOtherTabs(keepId);

      const kept = useEditorStore.getState().getTab(keepId);
      expect(kept?.content).toBe('unsaved work');
      expect(kept?.isDirty).toBe(true);
      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(true);
      expectInvariants();
    });

    it('closeOtherTabs ignores an unknown id rather than closing everything', () => {
      // A stale id (tab closed between render and click) must not wipe the strip
      // and leave `activeTabId` pointing at a tab that was never in it.
      openTabs('/a.ts', '/b.ts');
      const before = state();

      useEditorStore.getState().closeOtherTabs('tab-does-not-exist');

      expect(state().tabs.map((tab) => tab.path)).toEqual(['/a.ts', '/b.ts']);
      expect(state().activeTabId).toBe(before.activeTabId);
      expectInvariants();
    });
  });

  describe('setActiveTab', () => {
    it('moves the focus and the isActive flag together', () => {
      openTabs('/a.ts', '/b.ts', '/c.ts');

      useEditorStore.getState().setActiveTab(idFor('/a.ts'));

      const { tabs, activeTabId } = state();
      expect(activeTabId).toBe(idFor('/a.ts'));
      expect(tabs.map((tab) => tab.isActive)).toEqual([true, false, false]);
      expect(useEditorStore.getState().getActiveTab()?.path).toBe('/a.ts');
      expectInvariants();
    });

    it('ignores an unknown id rather than unfocusing every tab', () => {
      // Without a guard this set `activeTabId` to a tab that does not exist and
      // cleared every `isActive` flag: the strip highlights nothing and
      // `getActiveTab()` returns undefined while the store reports a focus.
      openTabs('/a.ts', '/b.ts');
      const activeId = idFor('/b.ts');

      useEditorStore.getState().setActiveTab('tab-does-not-exist');

      expect(state().activeTabId).toBe(activeId);
      expect(useEditorStore.getState().getActiveTab()?.path).toBe('/b.ts');
      expectInvariants();
    });
  });

  describe('dirty state', () => {
    it('reports unsaved changes for any dirty tab, not just the active one', () => {
      openTabs('/a.ts', '/b.ts');
      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);

      useEditorStore.getState().markTabDirty(idFor('/a.ts'), true);

      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(true);
      expect(useEditorStore.getState().getActiveTab()?.isDirty).toBe(false);
      expectInvariants();
    });

    it('drops the unsaved-changes flag with the tab that carried it', () => {
      // Closing a dirty tab discards its edits, so nothing should still report
      // pending work — this is what gates the "unsaved changes" confirm dialog.
      openTabs('/a.ts', '/b.ts');
      useEditorStore.getState().markTabDirty(idFor('/a.ts'), true);

      useEditorStore.getState().closeTab(idFor('/a.ts'));

      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);
      expectInvariants();
    });

    it('keeps a tab dirty when a save fails, and clears it when the save succeeds', () => {
      // Mirrors EditorView's save path: `markTabDirty(id, false)` runs only on a
      // successful IPC response. A regression that cleared the flag before the
      // response arrived would silently lose the user's work on a failed write.
      openTabs('/a.ts');
      const id = idFor('/a.ts');
      useEditorStore.getState().updateTabContent(id, 'edited');
      useEditorStore.getState().markTabDirty(id, true);

      // Failed save: nothing calls markTabDirty(false).
      expect(useEditorStore.getState().getTab(id)?.isDirty).toBe(true);
      expect(useEditorStore.getState().getTab(id)?.content).toBe('edited');
      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(true);

      // Successful retry.
      useEditorStore.getState().markTabDirty(id, false);

      expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);
      expect(useEditorStore.getState().getTab(id)?.content).toBe('edited');
      expectInvariants();
    });

    it('updates content only for the addressed tab', () => {
      openTabs('/a.ts', '/b.ts');

      useEditorStore.getState().updateTabContent(idFor('/a.ts'), 'only a changed');

      expect(useEditorStore.getState().getTab(idFor('/a.ts'))?.content).toBe('only a changed');
      expect(useEditorStore.getState().getTab(idFor('/b.ts'))?.content).toBe('content of /b.ts');
      expectInvariants();
    });
  });

  describe('cursor and scroll position', () => {
    it('keeps per-tab cursor and scroll positions across a focus switch', () => {
      // EditorView restores these on tab change. If a mutation dropped them,
      // switching away and back would silently jump to line 1.
      openTabs('/a.ts', '/b.ts');
      const aId = idFor('/a.ts');
      const bId = idFor('/b.ts');

      useEditorStore.getState().updateCursorPosition(aId, 42, 7);
      useEditorStore.getState().updateScrollPosition(aId, 900, 12);
      useEditorStore.getState().updateCursorPosition(bId, 3, 1);

      useEditorStore.getState().setActiveTab(bId);
      useEditorStore.getState().setActiveTab(aId);

      expect(useEditorStore.getState().getTab(aId)?.cursorPosition).toEqual({
        line: 42,
        column: 7,
      });
      expect(useEditorStore.getState().getTab(aId)?.scrollPosition).toEqual({
        top: 900,
        left: 12,
      });
      expect(useEditorStore.getState().getTab(bId)?.cursorPosition).toEqual({ line: 3, column: 1 });
      expect(useEditorStore.getState().getTab(bId)?.scrollPosition).toBeUndefined();
      expectInvariants();
    });

    it('survives a content edit without losing the cursor position', () => {
      openTabs('/a.ts');
      const id = idFor('/a.ts');
      useEditorStore.getState().updateCursorPosition(id, 10, 5);

      useEditorStore.getState().updateTabContent(id, 'new content');
      useEditorStore.getState().markTabDirty(id, true);

      expect(useEditorStore.getState().getTab(id)?.cursorPosition).toEqual({ line: 10, column: 5 });
      expectInvariants();
    });
  });

  describe('invariants under arbitrary action sequences', () => {
    it('holds I1 and I2 across a long pseudo-random sequence', () => {
      // Deterministic LCG: a failure is reproducible from the seed rather than
      // flaking once in CI and never again.
      let seed = 20260817;
      const next = (bound: number): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % bound;
      };

      const store = () => useEditorStore.getState();
      let opened = 0;

      for (let step = 0; step < 400; step += 1) {
        const tabs = state().tabs;
        const pick = (): string | undefined =>
          tabs.length === 0 ? undefined : tabs[next(tabs.length)].id;

        switch (next(8)) {
          case 0:
          case 1:
            store().openTab(`/file-${opened++}.ts`, 'x', 'typescript');
            break;
          case 2:
            // Re-open an existing path: must focus, never duplicate.
            if (tabs.length > 0) store().openTab(tabs[next(tabs.length)].path, 'x', 'typescript');
            break;
          case 3: {
            const id = pick();
            if (id) store().closeTab(id);
            break;
          }
          case 4: {
            const id = pick();
            if (id) store().setActiveTab(id);
            break;
          }
          case 5: {
            const id = pick();
            if (id) store().markTabDirty(id, next(2) === 0);
            break;
          }
          case 6:
            if (next(20) === 0) store().closeAllTabs();
            break;
          case 7: {
            const id = pick();
            if (id && next(10) === 0) store().closeOtherTabs(id);
            break;
          }
        }

        expectInvariants();

        // No duplicate paths, ever: `openTab` focuses instead of duplicating.
        const paths = state().tabs.map((tab) => tab.path);
        expect(new Set(paths).size, `duplicate path after step ${step}`).toBe(paths.length);
      }
    });
  });
});

afterEach(() => {
  useEditorStore.setState({ tabs: [], activeTabId: null });
});
