/**
 * Editor store — the conflict dialog, and adopting the version on disk.
 *
 * ## Why a separate file
 *
 * `editor-store.test.ts` covers tab lifecycle and the two structural invariants.
 * The actions here are about a different thing: which tab the resolution dialog
 * is pointed at, and the one store action that deliberately destroys unsaved
 * work. They get their own suite so the invariant asserted after every test can
 * be the one that matters for *them*:
 *
 *   I3. `conflictDialogTabId` is either null or the id of a tab that is present
 *       in `tabs` and has something to resolve.
 *
 * A dialog pointed at a tab that is gone renders a panel with no content and
 * offers actions that write to `undefined`. A dialog pointed at a tab with
 * nothing wrong is a modal the user cannot explain.
 *
 * The store's structural invariants (one active tab, `activeTabId` present in
 * `tabs`) are re-asserted here too, because `closeTab` and `closeOtherTabs` now
 * touch the dialog id as well and could keep one consistent while breaking the
 * other.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { useEditorStore, type EditorTab } from '../editor-store';
import { planResolutionPanel } from '../conflict-resolution';
import type { TabDiskState } from '../editor-session';

const state = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
});

/** I3, plus the two structural invariants the closing actions could break. */
function expectInvariants(): void {
  const { tabs, activeTabId, conflictDialogTabId } = state();

  const active = tabs.filter((tab) => tab.isActive);
  expect(active.length, 'more than one tab flagged active').toBeLessThanOrEqual(1);

  if (activeTabId !== null) {
    expect(
      tabs.find((tab) => tab.id === activeTabId),
      `activeTabId ${activeTabId} is not in tabs`
    ).toBeDefined();
  }

  if (conflictDialogTabId === null) return;

  const target = tabs.find((tab) => tab.id === conflictDialogTabId);
  expect(
    target,
    `I3 violated: dialog points at ${conflictDialogTabId}, which is not in tabs`
  ).toBeDefined();
  expect(
    planResolutionPanel(target?.diskState),
    `I3 violated: dialog is open for a tab in state ${String(target?.diskState)}, which has nothing to resolve`
  ).not.toBeNull();
}

function openTabs(...paths: string[]): EditorTab[] {
  for (const path of paths) {
    state().openTab(path, `content of ${path}`, 'typescript');
  }
  return state().tabs;
}

/** Only reconciliation produces these in real use, so tests set them directly. */
function setDiskState(tabId: string, diskState: TabDiskState | undefined): void {
  useEditorStore.setState((current) => ({
    tabs: current.tabs.map((tab) => (tab.id === tabId ? { ...tab, diskState } : tab)),
  }));
}

describe('openConflictDialog', () => {
  it('opens for a conflicting tab', () => {
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'conflict');

    state().openConflictDialog(tab.id);

    expect(state().conflictDialogTabId).toBe(tab.id);
    expectInvariants();
  });

  it.each(['conflict', 'missing', 'unsaved-lost'] as const)(
    'opens for the %s state, each of which has a panel',
    (diskState) => {
      const [tab] = openTabs('/w/a.ts');
      setDiskState(tab.id, diskState);

      state().openConflictDialog(tab.id);

      expect(state().conflictDialogTabId).toBe(tab.id);
      expectInvariants();
    }
  );

  it('refuses to open for a tab with nothing to resolve', () => {
    // A modal about a file that is fine is noise the user cannot dismiss with
    // understanding.
    const [tab] = openTabs('/w/a.ts');

    state().openConflictDialog(tab.id);

    expect(state().conflictDialogTabId).toBeNull();
  });

  it('refuses to open for a clean tab', () => {
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'clean');

    state().openConflictDialog(tab.id);

    expect(state().conflictDialogTabId).toBeNull();
  });

  it('refuses an unknown tab id', () => {
    // An id can go stale between render and click. A dialog pointed at a missing
    // tab would render an empty panel whose buttons write to `undefined`.
    openTabs('/w/a.ts');

    state().openConflictDialog('tab-gone');

    expect(state().conflictDialogTabId).toBeNull();
  });

  it('points at the tab it was given, not the focused one', () => {
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');
    // `/w/b.ts` is focused, having been opened last.
    expect(state().activeTabId).toBe(second.id);

    state().openConflictDialog(first.id);

    expect(state().conflictDialogTabId).toBe(first.id);
    expectInvariants();
  });

  it('replaces the target when opened for a different tab', () => {
    // The simple case, deliberately: one dialog at a time, and the last request
    // wins rather than being silently ignored.
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');
    setDiskState(second.id, 'conflict');

    state().openConflictDialog(first.id);
    state().openConflictDialog(second.id);

    expect(state().conflictDialogTabId).toBe(second.id);
    expectInvariants();
  });
});

describe('closeConflictDialog', () => {
  it('closes without touching the tab or its flag', () => {
    // Cancel must not be a shortcut for resolving: the conflict is still there.
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'conflict');
    state().markTabDirty(tab.id, true);
    state().openConflictDialog(tab.id);

    state().closeConflictDialog();

    expect(state().conflictDialogTabId).toBeNull();
    expect(state().getTab(tab.id)).toMatchObject({ diskState: 'conflict', isDirty: true });
    expectInvariants();
  });

  it('is a no-op when nothing is open', () => {
    openTabs('/w/a.ts');

    state().closeConflictDialog();

    expect(state().conflictDialogTabId).toBeNull();
  });
});

describe('the dialog cannot outlive its tab', () => {
  it('closes when the tab it points at is closed', () => {
    // Its actions write to a path looked up by tab id; applying one to a tab
    // that no longer exists is how a resolution lands on the wrong file.
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'conflict');
    state().openConflictDialog(tab.id);

    state().closeTab(tab.id);

    expect(state().conflictDialogTabId).toBeNull();
    expectInvariants();
  });

  it('stays open when a different tab is closed', () => {
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');
    state().openConflictDialog(first.id);

    state().closeTab(second.id);

    expect(state().conflictDialogTabId).toBe(first.id);
    expectInvariants();
  });

  it('closes when the active tab it points at is closed and another is focused', () => {
    // Exercises the other return branch of `closeTab`, where focus moves.
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(second.id, 'conflict');
    state().setActiveTab(second.id);
    state().openConflictDialog(second.id);

    state().closeTab(second.id);

    expect(state().conflictDialogTabId).toBeNull();
    expect(state().activeTabId).toBe(first.id);
    expectInvariants();
  });

  it('closes when every tab is closed', () => {
    const [tab] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(tab.id, 'conflict');
    state().openConflictDialog(tab.id);

    state().closeAllTabs();

    expect(state().conflictDialogTabId).toBeNull();
    expectInvariants();
  });

  it('closes when its tab is one of the others being closed', () => {
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(second.id, 'conflict');
    state().openConflictDialog(second.id);

    state().closeOtherTabs(first.id);

    expect(state().conflictDialogTabId).toBeNull();
    expectInvariants();
  });

  it('survives closeOtherTabs when it points at the surviving tab', () => {
    const [first] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');
    state().openConflictDialog(first.id);

    state().closeOtherTabs(first.id);

    expect(state().conflictDialogTabId).toBe(first.id);
    expectInvariants();
  });

  it('closes when a successful save resolves the conflict it was opened for', () => {
    // `markTabDirty` with an mtime clears `diskState`. The dialog id is left
    // alone by that action, and the dialog component stops rendering because the
    // tab no longer has a panel — asserted here so I3 is not read as a promise
    // that the store nulls the id itself.
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'conflict');
    state().markTabDirty(tab.id, true);
    state().openConflictDialog(tab.id);

    state().markTabDirty(tab.id, false, 900);

    expect(state().getTab(tab.id)!.diskState).toBeUndefined();
    expect(planResolutionPanel(state().getTab(tab.id)!.diskState)).toBeNull();
  });
});

describe('applyDiskVersion — the branch that destroys unsaved edits on purpose', () => {
  it('replaces content, clears dirty, moves the baseline and clears the flag', () => {
    const [tab] = openTabs('/w/a.ts');
    state().updateTabContent(tab.id, 'my unsaved edits');
    state().markTabDirty(tab.id, true);
    setDiskState(tab.id, 'conflict');

    state().applyDiskVersion(tab.id, 'the disk version', 777);

    expect(state().getTab(tab.id)).toMatchObject({
      content: 'the disk version',
      isDirty: false,
      // The tab now matches the file, so the next boot must not re-flag it.
      baselineMtime: 777,
      diskState: undefined,
      unsavedContentDropped: false,
    });
    expectInvariants();
  });

  it('destroys the edits of the named tab only', () => {
    // The `tab.id === tabId` test is the whole safety property: applying this to
    // the wrong tab discards unsaved work the user never chose to discard, on a
    // file they were not even looking at.
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    state().updateTabContent(first.id, 'A unsaved edits');
    state().markTabDirty(first.id, true);
    state().updateTabContent(second.id, 'B unsaved edits');
    state().markTabDirty(second.id, true);
    setDiskState(second.id, 'conflict');

    state().applyDiskVersion(second.id, 'B on disk', 777);

    expect(state().getTab(second.id)).toMatchObject({
      content: 'B on disk',
      isDirty: false,
    });
    // Untouched, in every respect.
    expect(state().getTab(first.id)).toMatchObject({
      content: 'A unsaved edits',
      isDirty: true,
      baselineMtime: undefined,
    });
    expectInvariants();
  });

  it('does not write anything back to the tab list for an unknown id', () => {
    const [tab] = openTabs('/w/a.ts');
    state().updateTabContent(tab.id, 'my unsaved edits');
    state().markTabDirty(tab.id, true);

    state().applyDiskVersion('tab-gone', 'should land nowhere', 777);

    expect(state().getTab(tab.id)).toMatchObject({
      content: 'my unsaved edits',
      isDirty: true,
    });
    expectInvariants();
  });

  it('does not change which tab is focused', () => {
    // Adopting the disk version into a background tab must not yank focus.
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');

    state().applyDiskVersion(first.id, 'A on disk', 777);

    expect(state().activeTabId).toBe(second.id);
    expectInvariants();
  });

  it('clears the unsaved-lost marker it is resolving', () => {
    const [tab] = openTabs('/w/a.ts');
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((entry) =>
        entry.id === tab.id
          ? { ...entry, unsavedContentDropped: true, diskState: 'unsaved-lost' as TabDiskState }
          : entry
      ),
    }));

    state().applyDiskVersion(tab.id, 'disk', 500);

    expect(state().getTab(tab.id)).toMatchObject({
      unsavedContentDropped: false,
      diskState: undefined,
    });
  });
});

describe('acknowledgeDiskState', () => {
  it('clears the flag without touching content or the dirty bit', () => {
    // `dismiss` on the unsaved-lost panel: stop warning, change nothing.
    const [tab] = openTabs('/w/a.ts');
    state().updateTabContent(tab.id, 'from disk');
    setDiskState(tab.id, 'unsaved-lost');

    state().acknowledgeDiskState(tab.id);

    expect(state().getTab(tab.id)).toMatchObject({
      diskState: undefined,
      content: 'from disk',
      isDirty: false,
    });
    expectInvariants();
  });

  it('clears the flag on the named tab only', () => {
    const [first, second] = openTabs('/w/a.ts', '/w/b.ts');
    setDiskState(first.id, 'conflict');
    setDiskState(second.id, 'unsaved-lost');

    state().acknowledgeDiskState(second.id);

    expect(state().getTab(first.id)!.diskState).toBe('conflict');
    expect(state().getTab(second.id)!.diskState).toBeUndefined();
  });
});

describe('conflictDialogTabId is not persisted', () => {
  it('is absent from the persisted session', () => {
    // A dialog is something the user is looking at now. Reopening the app into a
    // modal about a file they may have already fixed elsewhere would be noise —
    // and `diskState` is re-derived on boot anyway.
    const [tab] = openTabs('/w/a.ts');
    setDiskState(tab.id, 'conflict');
    state().openConflictDialog(tab.id);

    const options = (useEditorStore as unknown as {
      persist: { getOptions: () => { partialize?: (s: unknown) => unknown } };
    }).persist.getOptions();
    const persisted = options.partialize?.(state()) as Record<string, unknown>;

    expect(persisted).not.toHaveProperty('conflictDialogTabId');
  });
});
