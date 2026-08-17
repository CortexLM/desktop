/**
 * The store's close paths — the guarded ones, and what they do to `pendingClose`.
 *
 * WHY SEPARATE FROM `editor-store.test.ts`
 * ----------------------------------------
 * That file owns the focus-repair invariants (I1/I2) across the raw `closeTab` /
 * `closeAllTabs` / `closeOtherTabs`. This one owns the layer above them: whether a
 * gesture asks before destroying anything, and whether the answer lands on the
 * tabs the question named. The two are separable because the raw actions are still
 * the primitives — they are what a confirmation *applies* — and they are still
 * unguarded on purpose.
 *
 * The invariants are re-asserted here anyway. A confirmation that closes the right
 * tabs but leaves `activeTabId` pointing at one of them is a different bug with the
 * same symptom, and the point of a central invariant check is that a new action
 * cannot quietly opt out of it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useEditorStore, type EditorTab } from '../editor-store';
import { SESSION_STORAGE_KEY, type TabDiskState } from '../editor-session';

const state = () => useEditorStore.getState();
const store = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({
    tabs: [],
    activeTabId: null,
    conflictDialogTabId: null,
    pendingClose: null,
  });
});

afterEach(() => {
  useEditorStore.setState({
    tabs: [],
    activeTabId: null,
    conflictDialogTabId: null,
    pendingClose: null,
  });
});

/** I1/I2 from `editor-store.test.ts`, restated so this file's actions obey them. */
function expectInvariants(): void {
  const { tabs, activeTabId } = state();
  const active = tabs.filter((tab) => tab.isActive);
  expect(active.length, `I1 violated: ${active.length} tabs flagged active`).toBeLessThanOrEqual(1);

  if (activeTabId === null) {
    expect(active, 'I2 violated: activeTabId null but a tab is active').toHaveLength(0);
    return;
  }
  const target = tabs.find((tab) => tab.id === activeTabId);
  expect(target, `I2 violated: activeTabId ${activeTabId} not in tabs`).toBeDefined();
  expect(target?.isActive, 'I2 violated: activeTabId points at an inactive tab').toBe(true);
}

function openTabs(...paths: string[]): EditorTab[] {
  for (const path of paths) {
    store().openTab(path, `content of ${path}`, 'typescript');
  }
  return state().tabs;
}

const idFor = (path: string): string => {
  const tab = state().tabs.find((candidate) => candidate.path === path);
  if (!tab) throw new Error(`no tab open for ${path}`);
  return tab.id;
};

const soil = (path: string): void => {
  store().markTabDirty(idFor(path), true);
};

/** Sets a diskState directly: only reconciliation produces these in real use. */
const setDiskState = (path: string, diskState: TabDiskState): void => {
  useEditorStore.setState((current) => ({
    tabs: current.tabs.map((tab) => (tab.path === path ? { ...tab, diskState } : tab)),
  }));
};

const paths = (): string[] => state().tabs.map((tab) => tab.path);

describe('requestCloseTab', () => {
  it('closes a clean tab with no prompt', () => {
    openTabs('/a.ts', '/b.ts');

    store().requestCloseTab(idFor('/a.ts'));

    expect(paths()).toEqual(['/b.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('does not close a dirty tab: it raises a prompt instead', () => {
    // The bug this feature fixes. Before it, this call destroyed the edits.
    openTabs('/a.ts');
    soil('/a.ts');

    store().requestCloseTab(idFor('/a.ts'));

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).not.toBeNull();
    expect(state().pendingClose?.scope).toEqual({ kind: 'tab', tabId: idFor('/a.ts') });
    expectInvariants();
  });

  it('leaves the tab intact while the prompt is open', () => {
    openTabs('/a.ts');
    const id = idFor('/a.ts');
    store().updateTabContent(id, 'unsaved work');
    store().markTabDirty(id, true);

    store().requestCloseTab(id);

    const tab = store().getTab(id)!;
    expect(tab.content).toBe('unsaved work');
    expect(tab.isDirty).toBe(true);
    expect(store().hasUnsavedChanges()).toBe(true);
  });

  it('ignores an unknown id without raising a prompt', () => {
    openTabs('/a.ts');
    soil('/a.ts');

    store().requestCloseTab('tab-does-not-exist');

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('prompts for a missing tab with the only-copy wording', () => {
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'missing');

    store().requestCloseTab(idFor('/a.ts'));

    expect(state().pendingClose?.destroys).toBe('only-copy');
    expect(state().pendingClose?.confirmLabel).toMatch(/only copy that still exists/i);
  });
});

describe('confirmPendingClose', () => {
  it('closes the tab the prompt was about', () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    store().requestCloseTab(idFor('/a.ts'));
    store().confirmPendingClose();

    expect(paths()).toEqual(['/b.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('closes the tab the prompt named, not the one that is focused', () => {
    // The mutation this is here for: confirm, then close the wrong tab. The
    // dialog is open while the user reads it and focus can move underneath it —
    // a confirm that re-derived its target from `activeTabId` would discard
    // unsaved work in a file the dialog never mentioned.
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');
    const doomed = idFor('/a.ts');

    store().requestCloseTab(doomed);
    // Focus moves while the prompt is up, as a click on another tab would do.
    store().setActiveTab(idFor('/c.ts'));
    store().confirmPendingClose();

    expect(paths()).toEqual(['/b.ts', '/c.ts']);
    expect(state().activeTabId).toBe(idFor('/c.ts'));
    expectInvariants();
  });

  it('does nothing when no prompt is pending', () => {
    openTabs('/a.ts');
    soil('/a.ts');

    store().confirmPendingClose();

    expect(paths()).toEqual(['/a.ts']);
    expectInvariants();
  });

  it('drops a prompt whose file was saved while it was open, closing nothing', () => {
    // `Ctrl+S` is not blocked by this dialog, so this sequence is reachable. The
    // prompt said "discard unsaved edits"; there are none now, so the honest
    // outcome is to drop the question rather than silently turn a "discard" into
    // an ordinary close.
    openTabs('/a.ts');
    const id = idFor('/a.ts');
    soil('/a.ts');
    store().requestCloseTab(id);

    // A successful save: dirty cleared, baseline moved.
    store().markTabDirty(id, false, 1234);
    store().confirmPendingClose();

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('closes every other tab for an others-scoped prompt', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');
    soil('/c.ts');

    store().requestCloseOtherTabs(idFor('/b.ts'));
    store().confirmPendingClose();

    expect(paths()).toEqual(['/b.ts']);
    expect(state().activeTabId).toBe(idFor('/b.ts'));
    expectInvariants();
  });

  it('closes everything for an all-scoped prompt', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/b.ts');

    store().requestCloseAllTabs();
    store().confirmPendingClose();

    expect(paths()).toEqual([]);
    expect(state().activeTabId).toBeNull();
    expectInvariants();
  });
});

describe('cancelPendingClose', () => {
  it('closes nothing and keeps the edits', () => {
    openTabs('/a.ts', '/b.ts');
    const id = idFor('/a.ts');
    store().updateTabContent(id, 'unsaved work');
    store().markTabDirty(id, true);

    store().requestCloseTab(id);
    store().cancelPendingClose();

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(state().pendingClose).toBeNull();
    expect(store().getTab(id)?.content).toBe('unsaved work');
    expect(store().getTab(id)?.isDirty).toBe(true);
    expectInvariants();
  });

  it('leaves the focus where it was', () => {
    openTabs('/a.ts', '/b.ts');
    const activeBefore = state().activeTabId;

    store().requestCloseTab(idFor('/a.ts'));
    store().cancelPendingClose();

    expect(state().activeTabId).toBe(activeBefore);
    expectInvariants();
  });

  it('is safe with no prompt pending', () => {
    openTabs('/a.ts');

    store().cancelPendingClose();

    expect(state().pendingClose).toBeNull();
  });

  it('does not clear a conflict flag it was never asked about', () => {
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'conflict');

    store().requestCloseTab(idFor('/a.ts'));
    store().cancelPendingClose();

    expect(store().getTab(idFor('/a.ts'))?.diskState).toBe('conflict');
  });
});

describe('requestCloseAllTabs', () => {
  it('closes everything with no prompt when nothing is dirty', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');

    store().requestCloseAllTabs();

    expect(paths()).toEqual([]);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('names how many dirty tabs it would destroy, and which', () => {
    // The mission's third question. Three dirty tabs among five: the prompt
    // counts the casualties, not the tabs being closed, and lists them.
    openTabs('/a.ts', '/b.ts', '/c.ts', '/d.ts', '/e.ts');
    soil('/a.ts');
    soil('/c.ts');
    soil('/e.ts');

    store().requestCloseAllTabs();

    const pending = state().pendingClose!;
    expect(pending.title).toBe('Close 3 files without saving?');
    expect(pending.confirmLabel).toBe(
      'Close 3 files without saving (discard all unsaved edits)'
    );
    expect(pending.doomed.map((tab) => tab.path)).toEqual(['/a.ts', '/c.ts', '/e.ts']);
    expect(pending.destroys).toBe('my-edits');
    // Nothing closed yet.
    expect(paths()).toHaveLength(5);
  });

  it('escalates when one of the three holds the only copy', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');
    soil('/b.ts');
    soil('/c.ts');
    setDiskState('/b.ts', 'missing');

    store().requestCloseAllTabs();

    const pending = state().pendingClose!;
    expect(pending.destroys).toBe('only-copy');
    expect(pending.confirmLabel).toContain('1 file with no copy on disk');
  });

  it('does nothing with no tabs open', () => {
    store().requestCloseAllTabs();

    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });
});

describe('requestCloseOtherTabs', () => {
  it('closes the others with no prompt when they are clean', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');

    store().requestCloseOtherTabs(idFor('/b.ts'));

    expect(paths()).toEqual(['/b.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('ignores the kept tab being dirty', () => {
    // The kept tab loses nothing, so a prompt would name a casualty that is not
    // one.
    openTabs('/a.ts', '/b.ts');
    soil('/b.ts');

    store().requestCloseOtherTabs(idFor('/b.ts'));

    expect(paths()).toEqual(['/b.ts']);
    expect(state().pendingClose).toBeNull();
    expect(store().getTab(idFor('/b.ts'))?.isDirty).toBe(true);
    expectInvariants();
  });

  it('prompts when one of the others is dirty', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/c.ts');

    store().requestCloseOtherTabs(idFor('/b.ts'));

    expect(paths()).toHaveLength(3);
    expect(state().pendingClose?.doomed.map((tab) => tab.path)).toEqual(['/c.ts']);
    expectInvariants();
  });

  it('refuses an unknown id rather than prompting to close everything', () => {
    // The pre-existing guard, which the confirmation layer must not route around:
    // `closeOtherTabs(unknown)` once closed *every* tab, because "all except a
    // tab that is not here" is all of them.
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    soil('/b.ts');

    store().requestCloseOtherTabs('tab-does-not-exist');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('does nothing when the anchor is the only tab', () => {
    openTabs('/a.ts');
    soil('/a.ts');

    store().requestCloseOtherTabs(idFor('/a.ts'));

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });
});

describe('the prompt does not outlive what it describes', () => {
  it('is dropped when its tab is closed by another path', () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    store().requestCloseTab(idFor('/a.ts'));

    // Some other path closes it — the raw action, as the confirmation itself uses.
    store().closeTab(idFor('/a.ts'));

    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('is dropped when the casualty changes without the tab set changing', () => {
    // `acknowledgeDiskState` is reachable from the conflict dialog's Dismiss
    // button. It clears the `missing` flag without closing or saving anything, so
    // the same tab is still doomed — but as an ordinary unsaved tab, not as the
    // last copy of a deleted file. The prompt still on screen says "discard the
    // only copy that still exists", which has stopped being true.
    //
    // Deliberately *not* fixed by adding a prune to `acknowledgeDiskState`: the
    // re-check inside `confirmPendingClose` is the authoritative guard, and it has
    // to hold for any mutation of the tabs, including ones written later that
    // nobody thought to prune. This test drives that guard through a real action.
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'missing');
    store().requestCloseTab(idFor('/a.ts'));
    expect(state().pendingClose?.destroys).toBe('only-copy');

    store().acknowledgeDiskState(idFor('/a.ts'));

    // The prompt is stale, so confirming it closes nothing and clears it.
    store().confirmPendingClose();

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).toBeNull();
    expect(store().getTab(idFor('/a.ts'))?.isDirty).toBe(true);
    expectInvariants();
  });

  it('is dropped when a conflict flag is cleared under a prompt that mentioned it', () => {
    // Same guard, the other direction: `conflicted` → `unsaved` keeps the tab
    // doomed and the id list identical, so an id-only staleness check would keep a
    // prompt whose body promises a surviving version on disk.
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'conflict');
    store().requestCloseTab(idFor('/a.ts'));
    expect(state().pendingClose?.doomed[0].reason).toBe('conflicted');

    store().acknowledgeDiskState(idFor('/a.ts'));
    store().confirmPendingClose();

    expect(paths()).toEqual(['/a.ts']);
    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('is dropped when the tab it named is saved', () => {
    openTabs('/a.ts');
    soil('/a.ts');
    store().requestCloseTab(idFor('/a.ts'));

    store().markTabDirty(idFor('/a.ts'), false, 999);

    expect(state().pendingClose).toBeNull();
  });

  it('is dropped when the tab adopts the version on disk', () => {
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'conflict');
    store().requestCloseTab(idFor('/a.ts'));

    store().applyDiskVersion(idFor('/a.ts'), 'from disk', 4242);

    expect(state().pendingClose).toBeNull();
  });

  it('is dropped by closeAllTabs', () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    store().requestCloseTab(idFor('/a.ts'));

    store().closeAllTabs();

    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('is dropped by closeOtherTabs when its subject is among the others', () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/c.ts');
    store().requestCloseTab(idFor('/c.ts'));

    store().closeOtherTabs(idFor('/a.ts'));

    expect(state().pendingClose).toBeNull();
    expectInvariants();
  });

  it('survives an unrelated tab opening', () => {
    // Opening a file does not change what the prompt describes, and dropping it
    // would make the dialog vanish for no reason the user can see.
    openTabs('/a.ts');
    soil('/a.ts');
    store().requestCloseTab(idFor('/a.ts'));

    store().openTab('/new.ts', 'x', 'typescript');

    expect(state().pendingClose).not.toBeNull();
  });

  it('survives an unrelated tab being edited', () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    store().requestCloseTab(idFor('/a.ts'));

    store().updateTabContent(idFor('/b.ts'), 'typing in another file');

    expect(state().pendingClose).not.toBeNull();
  });

  it('is replaced, not queued, by a second request', () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    soil('/b.ts');

    store().requestCloseTab(idFor('/a.ts'));
    store().requestCloseTab(idFor('/b.ts'));

    // One question at a time, and it is the most recent gesture. A queue would
    // mean answering a question about a file the user has stopped thinking about.
    expect(state().pendingClose?.scope).toEqual({ kind: 'tab', tabId: idFor('/b.ts') });

    store().confirmPendingClose();
    expect(paths()).toEqual(['/a.ts']);
    expectInvariants();
  });
});

describe('pendingClose is never persisted', () => {
  /**
   * Read through a `Storage.prototype` spy rather than
   * `vi.spyOn(window.localStorage, 'setItem')`: under jsdom the latter records
   * zero calls, so a test written that way passes whatever the store does. It is
   * also asserted that at least one write was seen, so this cannot go quiet if
   * the storage key or engine changes.
   */
  it('is absent from what the store writes to storage', () => {
    // A question about a gesture from a previous session is noise, and reopening
    // into a modal offering to discard files the user may already have dealt with
    // elsewhere would be worse than noise.
    const writes: Array<[string, string]> = [];
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        writes.push([key, value]);
      });

    try {
      openTabs('/a.ts');
      soil('/a.ts');
      store().requestCloseTab(idFor('/a.ts'));
    } finally {
      spy.mockRestore();
    }

    expect(state().pendingClose).not.toBeNull();

    const sessionWrites = writes.filter(([key]) => key === SESSION_STORAGE_KEY);
    // The harness itself is checked: no writes seen would make the assertion
    // below vacuous.
    expect(sessionWrites.length, 'no session write observed — the spy or key is wrong').toBeGreaterThan(0);
    for (const [, value] of sessionWrites) {
      expect(value).not.toContain('pendingClose');
      expect(value).not.toContain('confirmLabel');
    }
    // And the payload really is the session, so the check above is not passing
    // merely because it inspected something unrelated.
    expect(sessionWrites.at(-1)?.[1]).toContain('/a.ts');
  });
});

describe('every close gesture goes through the same gate', () => {
  /**
   * The property the original bug violated: one path closed a dirty tab without
   * asking while the others asked. Each `request*` action is driven with the same
   * dirty tab, and each must refuse to destroy it.
   */
  const gestures: Array<[string, (id: string) => void]> = [
    ['requestCloseTab', (id) => store().requestCloseTab(id)],
    ['requestCloseAllTabs', () => store().requestCloseAllTabs()],
    ['requestCloseOtherTabs', () => store().requestCloseOtherTabs('anchor')],
  ];

  it.each(gestures)('%s asks before discarding unsaved edits', (_name, gesture) => {
    openTabs('/anchor.ts', '/dirty.ts');
    soil('/dirty.ts');
    // `requestCloseOtherTabs` is anchored on a clean tab, so the dirty one is
    // among the tabs it would close.
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.path === '/anchor.ts' ? { ...tab, id: 'anchor' } : tab
      ),
      activeTabId: current.activeTabId,
    }));

    gesture(idFor('/dirty.ts'));

    expect(state().tabs.some((tab) => tab.path === '/dirty.ts')).toBe(true);
    expect(state().pendingClose).not.toBeNull();
    expect(state().pendingClose?.destroys).not.toBe('nothing');
  });

  it.each(gestures)('%s closes without asking when nothing is dirty', (_name, gesture) => {
    openTabs('/anchor.ts', '/clean.ts');
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.path === '/anchor.ts' ? { ...tab, id: 'anchor' } : tab
      ),
    }));

    gesture(idFor('/clean.ts'));

    expect(state().pendingClose).toBeNull();
    expect(state().tabs.some((tab) => tab.path === '/clean.ts')).toBe(false);
    expectInvariants();
  });
});
