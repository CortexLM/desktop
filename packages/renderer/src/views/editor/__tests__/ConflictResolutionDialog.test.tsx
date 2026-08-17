/**
 * ConflictResolutionDialog — the buttons, and what happens when they are clicked.
 *
 * ## Why the diff view is stubbed
 *
 * `ConflictDiffView` imports `monaco-editor` and its five `?worker` imports, none
 * of which load under jsdom. It lives in its own module precisely so this test
 * can replace it and still assert everything around it: the labels, which panel
 * renders for which state, the disabled-until-loaded rule, and the direction each
 * destructive action moves bytes in. The stub also stands in for the real
 * component's `onEditorReady` contract, so the hand-merge path is exercised.
 *
 * ## What is asserted
 *
 * The mutations these tests exist to catch:
 *
 *  - swapping "keep my version" and "use the file on disk" (the swap destroys
 *    user work silently, and both wiring *and* labels are checked);
 *  - dropping the re-read before applying, so a stale diff gets written;
 *  - applying a resolution to the wrong tab;
 *  - offering a discard button on the `missing` panel, where the tab holds the
 *    only surviving copy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { useEditorStore } from '../../../store/editor-store';
import { RESOLUTION_LABELS } from '../../../store/conflict-resolution';
import type { DiskReadResult, TabDiskState } from '../../../store/editor-session';

/**
 * Stands in for the Monaco diff editor.
 *
 * Renders both sides as text so the test can assert *which* content went to
 * which pane — the orientation matters, because Monaco reads the left pane as
 * "original" and swapping the sides inverts the sign of every marker. Exposes an
 * input for the modified side so the hand-merge path has something to type into.
 */
vi.mock('../ConflictDiffView', () => ({
  ConflictDiffView: ({
    diskContent,
    myContent,
    language,
    theme,
    onEditorReady,
  }: {
    diskContent: string;
    myContent: string;
    language: string;
    theme: string;
    onEditorReady?: (get: () => string) => void;
  }) => {
    const [merged, setMerged] = React.useState(myContent);
    // Mirrors the real component: hands back a getter for the modified pane once
    // mounted, read at click time rather than subscribed to.
    React.useEffect(() => {
      onEditorReady?.(() => merged);
    }, [merged, onEditorReady]);

    return React.createElement(
      'div',
      { 'data-testid': 'conflict-diff', 'data-theme': theme, 'data-language': language },
      React.createElement('span', { 'data-testid': 'diff-original' }, diskContent),
      React.createElement('span', { 'data-testid': 'diff-modified' }, merged),
      React.createElement('input', {
        'data-testid': 'diff-edit',
        value: merged,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMerged(e.target.value),
      })
    );
  },
}));

const { ConflictResolutionDialog } = await import('../ConflictResolutionDialog');

const state = () => useEditorStore.getState();

interface Scenario {
  diskState?: TabDiskState;
  myContent?: string;
  diskContent?: string;
  diskMtime?: number;
  read?: DiskReadResult | (() => Promise<DiskReadResult>);
  writeOk?: boolean;
  writeMtime?: number;
  extraTab?: boolean;
}

/**
 * Opens a tab in the given disk state, points the dialog at it, and renders.
 * Returns the tab id plus the spies the assertions read.
 */
function setup(scenario: Scenario = {}) {
  const {
    diskState = 'conflict',
    myContent = 'my version',
    diskContent = 'disk version',
    diskMtime = 500,
    read,
    writeOk = true,
    writeMtime = 900,
    extraTab = false,
  } = scenario;

  state().openTab('/w/a.ts', myContent, 'typescript');
  if (extraTab) state().openTab('/w/b.ts', 'other content', 'typescript');

  const tabId = state().tabs[0].id;
  useEditorStore.setState((current) => ({
    tabs: current.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, isDirty: true, diskState, baselineMtime: 100 } : tab
    ),
  }));
  state().openConflictDialog(tabId);

  const writes: Array<{ path: string; content: string }> = [];
  const writer = vi.fn(async (path: string, content: string) => {
    writes.push({ path, content });
    return writeOk ? { ok: true as const, mtime: writeMtime } : { ok: false as const };
  });

  const defaultRead: DiskReadResult = { ok: true, file: { content: diskContent, mtime: diskMtime } };
  const reader = vi.fn(async () =>
    typeof read === 'function' ? read() : (read ?? defaultRead)
  );

  const onResolved = vi.fn();

  render(
    React.createElement(ConflictResolutionDialog, { reader, writer, onResolved })
  );

  return { tabId, writer, writes, reader, onResolved };
}

const action = (name: string) => screen.getByTestId(`conflict-action-${name}`);

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
});

afterEach(() => {
  cleanup();
  useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
});

describe('when there is nothing to resolve', () => {
  it('renders nothing with no dialog target', () => {
    state().openTab('/w/a.ts', 'body', 'typescript');

    render(React.createElement(ConflictResolutionDialog, { reader: null }));

    expect(screen.queryByTestId('conflict-dialog')).toBeNull();
  });

  it('renders nothing once the tab it pointed at is resolved', async () => {
    // A save that succeeds clears `diskState`, and the dialog must vanish with
    // it rather than sit there offering to overwrite a file that now agrees.
    const { tabId } = setup();
    await screen.findByTestId('conflict-dialog');

    state().markTabDirty(tabId, false, 900);

    await waitFor(() => expect(screen.queryByTestId('conflict-dialog')).toBeNull());
  });

  it('renders nothing once the tab is closed', async () => {
    const { tabId } = setup();
    await screen.findByTestId('conflict-dialog');

    state().closeTab(tabId);

    await waitFor(() => expect(screen.queryByTestId('conflict-dialog')).toBeNull());
  });
});

describe('the conflict panel', () => {
  it('names the file and says nothing has been written yet', async () => {
    setup();

    expect(await screen.findByTestId('conflict-dialog-path')).toHaveTextContent('/w/a.ts');
    expect(screen.getByTestId('conflict-dialog')).toHaveAttribute('data-disk-state', 'conflict');
    expect(screen.getByTestId('conflict-dialog-path').parentElement).toHaveTextContent(
      /nothing has been written yet/i
    );
  });

  it('offers exactly three actions, labelled with what they destroy', async () => {
    setup();
    await screen.findByTestId('conflict-diff');

    // The labels themselves, not paraphrases: a user who reads the button and
    // clicks has to have read the consequence.
    expect(action('keep-mine')).toHaveTextContent(RESOLUTION_LABELS.keepMine);
    expect(action('take-disk')).toHaveTextContent(RESOLUTION_LABELS.takeDisk);
    expect(action('cancel')).toHaveTextContent(RESOLUTION_LABELS.cancel);
    expect(screen.queryByTestId('conflict-action-recreate')).toBeNull();
    expect(screen.queryByTestId('conflict-action-dismiss')).toBeNull();
  });

  it('marks the two destructive actions with different casualties', async () => {
    setup();
    await screen.findByTestId('conflict-diff');

    expect(action('keep-mine')).toHaveAttribute('data-destroys', 'disk-changes');
    expect(action('take-disk')).toHaveAttribute('data-destroys', 'my-edits');
    expect(action('cancel')).toHaveAttribute('data-destroys', 'nothing');
  });

  it('puts disk on the left and the user version on the right', async () => {
    // Monaco reads the left pane as "original". Swapping the sides would make
    // "keep my version" look like it discards the lines it actually keeps.
    setup({ myContent: 'MINE', diskContent: 'DISK' });

    expect(await screen.findByTestId('diff-original')).toHaveTextContent('DISK');
    expect(screen.getByTestId('diff-modified')).toHaveTextContent('MINE');
  });

  it('reads the file it is showing a comparison for', async () => {
    const { reader } = setup();

    await waitFor(() => expect(reader).toHaveBeenCalledWith('/w/a.ts'));
  });
});

describe('the destructive buttons wait for the comparison', () => {
  it('disables them until the disk version has arrived', async () => {
    // Clicking before the diff loads is the click that overwrites a version the
    // user never saw.
    let release: (result: DiskReadResult) => void = () => {};
    setup({
      read: () => new Promise<DiskReadResult>((resolve) => {
        release = resolve;
      }),
    });

    await screen.findByTestId('conflict-dialog');
    expect(action('keep-mine')).toBeDisabled();
    expect(action('take-disk')).toBeDisabled();
    // Cancel destroys nothing, so it stays available.
    expect(action('cancel')).toBeEnabled();

    release({ ok: true, file: { content: 'disk version', mtime: 500 } });

    await waitFor(() => expect(action('keep-mine')).toBeEnabled());
    expect(action('take-disk')).toBeEnabled();
  });

  it('keeps them disabled and explains when disk cannot be read', async () => {
    // An empty left pane would read as "disk is empty" and make "keep my
    // version" look free.
    setup({ read: { ok: false, missing: false } });

    const notice = await screen.findByTestId('conflict-dialog-notice');
    expect(notice).toHaveAttribute('data-notice', 'unreadable');
    expect(action('keep-mine')).toBeDisabled();
    expect(screen.queryByTestId('conflict-diff')).toBeNull();
  });

  it('explains when the file is already gone', async () => {
    setup({ read: { ok: false, missing: true } });

    expect(await screen.findByTestId('conflict-dialog-notice')).toHaveAttribute(
      'data-notice',
      'vanished'
    );
  });

  it('reports unreadable when there is no bridge at all', async () => {
    state().openTab('/w/a.ts', 'my version', 'typescript');
    const tabId = state().tabs[0].id;
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isDirty: true, diskState: 'conflict' as TabDiskState } : tab
      ),
    }));
    state().openConflictDialog(tabId);

    render(React.createElement(ConflictResolutionDialog, { reader: null }));

    expect(await screen.findByTestId('conflict-dialog-notice')).toHaveAttribute(
      'data-notice',
      'unreadable'
    );
  });

  it('reports unreadable when the read rejects outright', async () => {
    // An IPC rejection must not escape a render effect as an unhandled error,
    // and must not leave the buttons enabled over an empty pane.
    const reader = vi.fn(async () => {
      throw new Error('bridge exploded');
    });
    state().openTab('/w/a.ts', 'my version', 'typescript');
    const tabId = state().tabs[0].id;
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isDirty: true, diskState: 'conflict' as TabDiskState } : tab
      ),
    }));
    state().openConflictDialog(tabId);

    render(React.createElement(ConflictResolutionDialog, { reader }));

    expect(await screen.findByTestId('conflict-dialog-notice')).toHaveAttribute(
      'data-notice',
      'unreadable'
    );
    expect(action('keep-mine')).toBeDisabled();
  });

  it('ignores a read that lands after the dialog is gone', async () => {
    // The effect's cancel flag. Without it, the late resolve calls setState on an
    // unmounted component and, worse, could repopulate a comparison for a tab
    // that is no longer being resolved.
    let release: (result: DiskReadResult) => void = () => {};
    setup({
      read: () => new Promise<DiskReadResult>((resolve) => {
        release = resolve;
      }),
    });
    await screen.findByTestId('conflict-dialog');

    cleanup();
    release({ ok: true, file: { content: 'arrives too late', mtime: 500 } });
    await Promise.resolve();

    expect(screen.queryByTestId('conflict-diff')).toBeNull();
  });

  it('falls back to the real bridge when no reader or writer is injected', async () => {
    // Exercises the production defaults: with no preload bridge present, the
    // reader and writer resolve to "cannot confirm what is on disk", so a
    // resolution refuses rather than writing blind.
    state().openTab('/w/a.ts', 'my version', 'typescript');
    const tabId = state().tabs[0].id;
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isDirty: true, diskState: 'missing' as TabDiskState } : tab
      ),
    }));
    state().openConflictDialog(tabId);
    const onResolved = vi.fn();

    render(React.createElement(ConflictResolutionDialog, { onResolved }));
    // `missing` shows no diff, so recreate is enabled without a read.
    await userEvent.click(action('recreate'));

    await waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'stale', reason: 'unreadable' })
      )
    );
    // Still unresolved, and nothing was written.
    expect(state().getTab(tabId)!.isDirty).toBe(true);
    expect(state().getTab(tabId)!.diskState).toBe('missing');
  });

  it('reports unreadable for a conflict when the real bridge is absent', async () => {
    // Production default on the diff path: `reader` not passed at all, so the
    // component builds one from the preload bridge, which is not present under
    // jsdom. An empty left-hand pane would read as "disk is empty" and make
    // "keep my version" look free, so it says unreadable instead.
    state().openTab('/w/a.ts', 'my version', 'typescript');
    const tabId = state().tabs[0].id;
    useEditorStore.setState((current) => ({
      tabs: current.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isDirty: true, diskState: 'conflict' as TabDiskState } : tab
      ),
    }));
    state().openConflictDialog(tabId);

    render(React.createElement(ConflictResolutionDialog));

    expect(await screen.findByTestId('conflict-dialog-notice')).toHaveAttribute(
      'data-notice',
      'unreadable'
    );
    expect(screen.queryByTestId('conflict-diff')).toBeNull();
    expect(action('keep-mine')).toBeDisabled();
  });

  it('ignores a read that rejects after the dialog is gone', async () => {
    // The catch's cancel flag, the mirror of the resolve one: a rejection
    // arriving after unmount must not set state on a dead component.
    let reject: (error: Error) => void = () => {};
    setup({
      read: () => new Promise<DiskReadResult>((_resolve, rejectRead) => {
        reject = rejectRead;
      }),
    });
    await screen.findByTestId('conflict-dialog');

    cleanup();
    reject(new Error('bridge exploded after unmount'));
    await Promise.resolve();

    expect(screen.queryByTestId('conflict-dialog-notice')).toBeNull();
  });

  it('renders the comparison in the dark theme when that is the theme', async () => {
    // The diff is the thing the user reads before destroying a version; handing
    // it the wrong theme makes it unreadable against the dialog around it.
    localStorage.setItem('cortex-theme', 'dark');
    try {
      setup();

      expect(await screen.findByTestId('conflict-diff')).toHaveAttribute('data-theme', 'dark');
    } finally {
      localStorage.removeItem('cortex-theme');
    }
  });

  it('renders the comparison in the light theme otherwise', async () => {
    localStorage.setItem('cortex-theme', 'light');
    try {
      setup();

      expect(await screen.findByTestId('conflict-diff')).toHaveAttribute('data-theme', 'light');
    } finally {
      localStorage.removeItem('cortex-theme');
    }
  });

  it('highlights the comparison with the language of the file being resolved', async () => {
    setup();

    expect(await screen.findByTestId('conflict-diff')).toHaveAttribute(
      'data-language',
      'typescript'
    );
  });
});

describe('keep my version', () => {
  it('writes the tab content to disk and closes', async () => {
    const { writes, onResolved } = setup({ myContent: 'my version' });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('keep-mine'));

    await waitFor(() =>
      expect(writes).toEqual([{ path: '/w/a.ts', content: 'my version' }])
    );
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'kept-mine' })
    );
    await waitFor(() => expect(state().conflictDialogTabId).toBeNull());
  });

  it('clears the conflict and advances the baseline to the mtime it wrote', async () => {
    const { tabId } = setup({ writeMtime: 4_242 });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('keep-mine'));

    await waitFor(() => {
      const tab = state().getTab(tabId)!;
      expect(tab.diskState).toBeUndefined();
      expect(tab.isDirty).toBe(false);
      expect(tab.baselineMtime).toBe(4_242);
    });
  });

  it('does not replace the tab content with the disk version', async () => {
    // The inversion check, from the UI side: keeping mine must leave the tab
    // holding mine.
    const { tabId } = setup({ myContent: 'MINE', diskContent: 'DISK' });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('keep-mine'));

    await waitFor(() => expect(state().getTab(tabId)!.isDirty).toBe(false));
    expect(state().getTab(tabId)!.content).toBe('MINE');
  });

  it('writes a hand-merged right-hand pane rather than the original edits', async () => {
    // The merge is a plus, not a prerequisite — but a merge that is silently
    // discarded under a button that promised it is worse than not offering it.
    const { writes, tabId } = setup({ myContent: 'my version' });
    await screen.findByTestId('conflict-diff');

    const input = screen.getByTestId('diff-edit');
    await userEvent.clear(input);
    await userEvent.type(input, 'merged by hand');
    await userEvent.click(action('keep-mine'));

    await waitFor(() =>
      expect(writes).toEqual([{ path: '/w/a.ts', content: 'merged by hand' }])
    );
    expect(state().getTab(tabId)!.content).toBe('merged by hand');
  });
});

describe('use the file on disk', () => {
  it('replaces the tab with the disk version and writes nothing', async () => {
    const { writes, tabId, onResolved } = setup({ myContent: 'MINE', diskContent: 'DISK' });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('take-disk'));

    await waitFor(() => expect(state().getTab(tabId)!.content).toBe('DISK'));
    // Nothing goes to disk: the disk version already is the file. A write here
    // would push the edits the user asked to discard over the version they
    // asked to keep.
    expect(writes).toEqual([]);
    expect(state().getTab(tabId)!.isDirty).toBe(false);
    expect(state().getTab(tabId)!.diskState).toBeUndefined();
    expect(onResolved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'took-disk' })
    );
  });

  it('moves the baseline to the mtime the disk content was read at', async () => {
    const { tabId } = setup({ diskMtime: 654 });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('take-disk'));

    await waitFor(() => expect(state().getTab(tabId)!.baselineMtime).toBe(654));
  });

  it('discards a hand-merge rather than saving it, which is what it says', async () => {
    // "Discard my unsaved edits" includes edits made inside the dialog.
    const { writes, tabId } = setup({ diskContent: 'DISK' });
    await screen.findByTestId('conflict-diff');

    const input = screen.getByTestId('diff-edit');
    await userEvent.clear(input);
    await userEvent.type(input, 'merged but abandoned');
    await userEvent.click(action('take-disk'));

    await waitFor(() => expect(state().getTab(tabId)!.content).toBe('DISK'));
    expect(writes).toEqual([]);
  });
});

describe('the two destructive buttons are not interchangeable', () => {
  it('moves bytes in opposite directions from identical state', async () => {
    // The single assertion that fails if the two are ever swapped. Run through
    // the real UI, not the planner, so the wiring is covered as well.
    const keeping = setup({ myContent: 'MINE', diskContent: 'DISK' });
    await screen.findByTestId('conflict-diff');
    await userEvent.click(action('keep-mine'));
    await waitFor(() => expect(keeping.writes).toHaveLength(1));
    const keptContent = state().getTab(keeping.tabId)!.content;

    cleanup();
    useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });

    const taking = setup({ myContent: 'MINE', diskContent: 'DISK' });
    await screen.findByTestId('conflict-diff');
    await userEvent.click(action('take-disk'));
    await waitFor(() => expect(state().getTab(taking.tabId)!.content).toBe('DISK'));

    // Keep mine: my bytes went to disk, the tab still holds mine.
    expect(keeping.writes).toEqual([{ path: '/w/a.ts', content: 'MINE' }]);
    expect(keptContent).toBe('MINE');
    // Take disk: nothing went to disk, the tab now holds the disk version.
    expect(taking.writes).toEqual([]);
    expect(state().getTab(taking.tabId)!.content).toBe('DISK');
  });
});

describe('cancel', () => {
  it('writes nothing, discards nothing, and leaves the conflict flagged', async () => {
    const { writes, tabId, onResolved } = setup({ myContent: 'MINE' });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('cancel'));

    await waitFor(() => expect(state().conflictDialogTabId).toBeNull());
    expect(writes).toEqual([]);
    const tab = state().getTab(tabId)!;
    expect(tab.content).toBe('MINE');
    expect(tab.isDirty).toBe(true);
    // Still flagged: the indicator is the only thing that will say so now.
    expect(tab.diskState).toBe('conflict');
    expect(onResolved).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  it('treats closing with Escape as cancel, not as any action that writes', async () => {
    const { writes, tabId } = setup();
    await screen.findByTestId('conflict-diff');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(state().conflictDialogTabId).toBeNull());
    expect(writes).toEqual([]);
    expect(state().getTab(tabId)!.diskState).toBe('conflict');
    expect(state().getTab(tabId)!.isDirty).toBe(true);
  });
});

describe('the file changes again while the dialog is open', () => {
  it('writes nothing, says so, and redraws the comparison against the new version', async () => {
    // Re-checking costs one IPC round trip and is the difference between
    // overwriting the version the user rejected and one they never saw.
    let call = 0;
    const { writes } = setup({
      read: async () => {
        call += 1;
        return call === 1
          ? { ok: true, file: { content: 'DISK v1', mtime: 500 } }
          : { ok: true, file: { content: 'DISK v2 by someone else', mtime: 900 } };
      },
    });

    await screen.findByTestId('conflict-diff');
    expect(screen.getByTestId('diff-original')).toHaveTextContent('DISK v1');

    await userEvent.click(action('keep-mine'));

    const notice = await screen.findByTestId('conflict-dialog-notice');
    expect(notice).toHaveAttribute('data-notice', 'changed-again');
    expect(notice).toHaveTextContent(/nothing was written/i);
    expect(writes).toEqual([]);
    // Still open, now showing what is actually on disk.
    expect(screen.getByTestId('conflict-dialog')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('diff-original')).toHaveTextContent('DISK v2 by someone else')
    );
  });

  it('lets the user choose again against the refreshed version', async () => {
    let call = 0;
    const { writes } = setup({
      myContent: 'MINE',
      read: async () => {
        call += 1;
        return call === 1
          ? { ok: true, file: { content: 'DISK v1', mtime: 500 } }
          : { ok: true, file: { content: 'DISK v2', mtime: 900 } };
      },
    });

    await screen.findByTestId('conflict-diff');
    await userEvent.click(action('keep-mine'));
    await screen.findByTestId('conflict-dialog-notice');

    // Second attempt: disk now matches what the dialog shows, so it proceeds.
    await userEvent.click(action('keep-mine'));

    await waitFor(() => expect(writes).toEqual([{ path: '/w/a.ts', content: 'MINE' }]));
  });

  it('refuses take-disk too rather than discarding edits against a stale diff', async () => {
    let call = 0;
    const { tabId } = setup({
      myContent: 'MINE',
      read: async () => {
        call += 1;
        return call === 1
          ? { ok: true, file: { content: 'DISK v1', mtime: 500 } }
          : { ok: true, file: { content: 'DISK v2', mtime: 900 } };
      },
    });

    await screen.findByTestId('conflict-diff');
    await userEvent.click(action('take-disk'));

    await screen.findByTestId('conflict-dialog-notice');
    // The edits are still there: nothing was discarded.
    expect(state().getTab(tabId)!.content).toBe('MINE');
    expect(state().getTab(tabId)!.isDirty).toBe(true);
  });

  it('reports a failed write without closing or clearing the flag', async () => {
    const { tabId, onResolved } = setup({ writeOk: false });
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('keep-mine'));

    await waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'write-failed' })
      )
    );
    // Closing on a failed write would look like it succeeded.
    expect(state().conflictDialogTabId).toBe(tabId);
    expect(state().getTab(tabId)!.isDirty).toBe(true);
    expect(state().getTab(tabId)!.diskState).toBe('conflict');
  });
});

describe('the missing panel', () => {
  it('offers to recreate the file, and no way to discard the last copy', async () => {
    // The tab holds the only surviving copy. A discard button here — one pixel
    // from where the conflict panel legitimately offers one — is the click that
    // loses data with no undo.
    setup({ diskState: 'missing' });

    await screen.findByTestId('conflict-dialog');
    expect(screen.getByTestId('conflict-dialog')).toHaveAttribute('data-disk-state', 'missing');
    expect(action('recreate')).toHaveTextContent(RESOLUTION_LABELS.recreate);
    expect(action('cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('conflict-action-take-disk')).toBeNull();
  });

  it('shows no comparison, because there is nothing to compare against', async () => {
    setup({ diskState: 'missing' });

    await screen.findByTestId('conflict-dialog');
    expect(screen.queryByTestId('conflict-diff')).toBeNull();
    // Scoped to the panel body: the cancel action's small print says "only copy"
    // too, so an unscoped query matches both and asserts nothing about either.
    expect(screen.getByTestId('conflict-dialog-path').parentElement).toHaveTextContent(
      /only copy/i
    );
  });

  it('writes the tab back to its path when recreating', async () => {
    const { writes, tabId } = setup({
      diskState: 'missing',
      myContent: 'MINE',
      read: { ok: false, missing: true },
    });
    await screen.findByTestId('conflict-dialog');

    await userEvent.click(action('recreate'));

    await waitFor(() => expect(writes).toEqual([{ path: '/w/a.ts', content: 'MINE' }]));
    expect(state().getTab(tabId)!.isDirty).toBe(false);
  });

  it('enables recreate immediately: it has no comparison to wait for', async () => {
    setup({ diskState: 'missing' });

    await screen.findByTestId('conflict-dialog');
    expect(action('recreate')).toBeEnabled();
  });
});

describe('the unsaved-lost panel', () => {
  it('only acknowledges, because nothing can be resolved', async () => {
    setup({ diskState: 'unsaved-lost' });

    await screen.findByTestId('conflict-dialog');
    expect(screen.getByTestId('conflict-dialog')).toHaveAttribute(
      'data-disk-state',
      'unsaved-lost'
    );
    expect(action('dismiss')).toHaveTextContent(RESOLUTION_LABELS.dismiss);
    expect(screen.queryByTestId('conflict-action-keep-mine')).toBeNull();
    expect(screen.queryByTestId('conflict-action-take-disk')).toBeNull();
    expect(screen.queryByTestId('conflict-action-recreate')).toBeNull();
  });

  it('clears the flag on dismiss without writing or discarding', async () => {
    const { writes, tabId } = setup({ diskState: 'unsaved-lost', myContent: 'from disk' });
    await screen.findByTestId('conflict-dialog');

    await userEvent.click(action('dismiss'));

    await waitFor(() => expect(state().getTab(tabId)!.diskState).toBeUndefined());
    expect(writes).toEqual([]);
    expect(state().getTab(tabId)!.content).toBe('from disk');
    expect(state().conflictDialogTabId).toBeNull();
  });

  it('explains why the edits are gone', async () => {
    setup({ diskState: 'unsaved-lost' });

    await screen.findByTestId('conflict-dialog');
    expect(screen.getByTestId('conflict-dialog-path').parentElement).toHaveTextContent(
      /too large/i
    );
  });
});

describe('the resolution lands on the tab the dialog names', () => {
  it('writes the path of its own tab while another tab is open', async () => {
    const { writes, tabId } = setup({ myContent: 'A edits', extraTab: true });
    // A second tab exists and is focused; the dialog is for the first.
    expect(state().tabs).toHaveLength(2);
    expect(screen.getByTestId('conflict-dialog')).toHaveAttribute('data-tab-id', tabId);

    await screen.findByTestId('conflict-diff');
    await userEvent.click(action('keep-mine'));

    await waitFor(() => expect(writes).toEqual([{ path: '/w/a.ts', content: 'A edits' }]));
  });

  it('adopts into its own tab and leaves the other one alone', async () => {
    const { tabId } = setup({ diskContent: 'DISK', extraTab: true });
    const otherId = state().tabs[1].id;
    await screen.findByTestId('conflict-diff');

    await userEvent.click(action('take-disk'));

    await waitFor(() => expect(state().getTab(tabId)!.content).toBe('DISK'));
    // Untouched.
    expect(state().getTab(otherId)!.content).toBe('other content');
  });
});
