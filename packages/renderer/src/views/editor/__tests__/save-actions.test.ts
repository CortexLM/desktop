/**
 * Save sequencing and conflict resolution — the order in which side effects happen.
 *
 * ## Why this suite exists at all
 *
 * `EditorView` imports `@monaco-editor/react`, which pulls in `monaco-editor` and
 * five `?worker` imports. None of that loads under jsdom, so code living in that
 * module is reachable only from an E2E run. The save gate is the one code path
 * whose failure destroys the user's file, so it was extracted into
 * `save-actions.ts` where a unit test can drive it with fakes in the same order
 * `EditorView` drives it with the real store and IPC.
 *
 * ## The properties that matter
 *
 * Each of these is a mutation that, if it survived, would destroy user work:
 *
 *  - `attemptSave` writes nothing on a conflicting tab (remove the gate → red);
 *  - `keep-mine` writes the tab to disk, `take-disk` overwrites the tab from disk,
 *    and never the reverse (swap them → red);
 *  - both apply to the tab that was named, not the focused one (wrong tab → red);
 *  - a failed write leaves the tab exactly as dirty as it was.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  attemptSave,
  createIpcWriter,
  resolveConflict,
  type ResolveDeps,
  type SaveDeps,
  type SaveableTab,
} from '../save-actions';
import type { DiskReadResult } from '../../../store/editor-session';

function makeTab(overrides: Partial<SaveableTab> = {}): SaveableTab {
  return {
    id: 'tab-1',
    path: '/w/a.ts',
    content: 'my version',
    isDirty: true,
    ...overrides,
  };
}

/**
 * A fake world: a tab table, a write log, and spies for everything the real
 * store would mutate. `getTab` reads the table at call time, which is what lets
 * a test change the tab mid-flight the way reconciliation does.
 */
function harness(tabs: SaveableTab[] = [makeTab()]) {
  const table = new Map(tabs.map((tab) => [tab.id, { ...tab }]));
  const writes: Array<{ path: string; content: string }> = [];
  let nextMtime = 500;
  let writeOk = true;

  const deps = {
    getTab: vi.fn((id: string) => table.get(id)),
    writeFile: vi.fn(async (path: string, content: string) => {
      writes.push({ path, content });
      return writeOk ? { ok: true as const, mtime: nextMtime } : { ok: false as const };
    }),
    markSaved: vi.fn(),
    openConflictDialog: vi.fn(),
    applyDiskVersion: vi.fn(),
    acknowledgeDiskState: vi.fn(),
    closeConflictDialog: vi.fn(),
    updateTabContent: vi.fn((id: string, content: string) => {
      const tab = table.get(id);
      if (tab) table.set(id, { ...tab, content });
    }),
    read: vi.fn(async (_path: string): Promise<DiskReadResult> => ({
      ok: true,
      file: { content: 'disk version', mtime: 500 },
    })),
  } satisfies ResolveDeps;

  return {
    deps,
    writes,
    table,
    setDiskRead: (result: DiskReadResult | (() => Promise<DiskReadResult>)) => {
      deps.read.mockImplementation(
        typeof result === 'function' ? (result as () => Promise<DiskReadResult>) : async () => result
      );
    },
    failWrites: () => {
      writeOk = false;
    },
    setWriteMtime: (mtime: number) => {
      nextMtime = mtime;
    },
  };
}

describe('attemptSave — Ctrl+S', () => {
  it('writes a dirty tab and moves the baseline to the mtime it wrote', () => {
    const h = harness();
    h.setWriteMtime(900);

    return attemptSave(h.deps, 'tab-1').then((result) => {
      expect(result).toEqual({ status: 'saved', tabId: 'tab-1', mtime: 900 });
      expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
      // Advancing the baseline is what clears the conflict: the version just
      // written is now the one on disk. Without it, the next boot would report a
      // conflict with the file this save produced.
      expect(h.deps.markSaved).toHaveBeenCalledWith('tab-1', 900);
    });
  });

  it('writes nothing when the tab is flagged conflict', async () => {
    // The mission, as one test. Deleting the gate in `planSave` turns this red.
    const h = harness([makeTab({ diskState: 'conflict' })]);

    const result = await attemptSave(h.deps, 'tab-1');

    expect(result).toEqual({ status: 'blocked', tabId: 'tab-1' });
    expect(h.deps.writeFile).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
  });

  it('leaves the tab dirty and its baseline untouched when it blocks', async () => {
    // A blocked save must not look like a completed one in any respect.
    const h = harness([makeTab({ diskState: 'conflict', baselineMtime: 100 })]);

    await attemptSave(h.deps, 'tab-1');

    expect(h.deps.markSaved).not.toHaveBeenCalled();
    expect(h.table.get('tab-1')!.isDirty).toBe(true);
    expect(h.table.get('tab-1')!.baselineMtime).toBe(100);
  });

  it('opens the dialog for the tab it blocked, not the focused one', async () => {
    // Two conflicting tabs; the save was requested for the second. Opening the
    // dialog for the wrong one would show a diff of a file the user is not
    // saving, and its buttons would write to that file.
    const h = harness([
      makeTab({ id: 'tab-1', path: '/w/a.ts', diskState: 'conflict' }),
      makeTab({ id: 'tab-2', path: '/w/b.ts', diskState: 'conflict' }),
    ]);

    await attemptSave(h.deps, 'tab-2');

    expect(h.deps.openConflictDialog).toHaveBeenCalledExactlyOnceWith('tab-2');
  });

  it('saves a missing tab: writing recreates the file', async () => {
    const h = harness([makeTab({ diskState: 'missing' })]);

    const result = await attemptSave(h.deps, 'tab-1');

    expect(result.status).toBe('saved');
    expect(h.writes).toHaveLength(1);
    expect(h.deps.openConflictDialog).not.toHaveBeenCalled();
  });

  it('saves an unsaved-lost tab', async () => {
    const h = harness([makeTab({ diskState: 'unsaved-lost' })]);

    expect((await attemptSave(h.deps, 'tab-1')).status).toBe('saved');
  });

  it('does not write a clean tab', async () => {
    const h = harness([makeTab({ isDirty: false })]);

    expect(await attemptSave(h.deps, 'tab-1')).toEqual({
      status: 'skipped',
      reason: 'not-dirty',
    });
    expect(h.deps.writeFile).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown tab id', async () => {
    const h = harness();

    expect(await attemptSave(h.deps, 'tab-gone')).toEqual({
      status: 'skipped',
      reason: 'no-tab',
    });
    expect(h.deps.writeFile).not.toHaveBeenCalled();
  });

  it('reads the tab at call time, not from a snapshot', async () => {
    // A conflict can be detected by reconciliation between the keystroke and the
    // write. A save decided from a stale snapshot is a save that ignores it.
    const h = harness();
    h.deps.getTab.mockImplementationOnce((id: string) => {
      const tab = h.table.get(id)!;
      return { ...tab, diskState: 'conflict' };
    });

    const result = await attemptSave(h.deps, 'tab-1');

    expect(result.status).toBe('blocked');
    expect(h.writes).toEqual([]);
  });

  it('keeps the tab dirty when the write fails', async () => {
    // A save that failed must leave the tab looking exactly as unsaved as it is,
    // or the user closes the window believing their work is on disk.
    const h = harness();
    h.failWrites();

    expect(await attemptSave(h.deps, 'tab-1')).toEqual({
      status: 'failed',
      tabId: 'tab-1',
    });
    expect(h.deps.markSaved).not.toHaveBeenCalled();
  });

  it('force bypasses the gate, for the dialog that just opened it', async () => {
    // `force` is a parameter rather than a second function so there is exactly
    // one code path that writes a file.
    const h = harness([makeTab({ diskState: 'conflict' })]);

    const result = await attemptSave(h.deps, 'tab-1', { force: true });

    expect(result.status).toBe('saved');
    expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
    expect(h.deps.openConflictDialog).not.toHaveBeenCalled();
  });

  it('force still writes a clean tab rather than second-guessing the caller', async () => {
    // Reached only from a resolution the user explicitly chose.
    const h = harness([makeTab({ isDirty: false, diskState: 'conflict' })]);

    expect((await attemptSave(h.deps, 'tab-1', { force: true })).status).toBe('saved');
  });
});

describe('resolveConflict — keep mine', () => {
  it('writes the tab over the file on disk', async () => {
    const h = harness([makeTab({ diskState: 'conflict', content: 'my version' })]);
    h.setWriteMtime(700);

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toEqual({ status: 'kept-mine', tabId: 'tab-1', mtime: 700 });
    // The user's bytes go to disk. Not the disk bytes to the tab.
    expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
    expect(h.deps.markSaved).toHaveBeenCalledWith('tab-1', 700);
    expect(h.deps.closeConflictDialog).toHaveBeenCalled();
  });

  it('leaves the dialog open and writes nothing when the write fails', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.failWrites();

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toEqual({ status: 'write-failed', tabId: 'tab-1' });
    expect(h.deps.markSaved).not.toHaveBeenCalled();
    // Closing on a failed write would look like it succeeded.
    expect(h.deps.closeConflictDialog).not.toHaveBeenCalled();
  });

  it('writes to the tab that was named, not another conflicting one', async () => {
    const h = harness([
      makeTab({ id: 'tab-1', path: '/w/a.ts', content: 'A edits', diskState: 'conflict' }),
      makeTab({ id: 'tab-2', path: '/w/b.ts', content: 'B edits', diskState: 'conflict' }),
    ]);

    await resolveConflict(h.deps, 'tab-2', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    // Wrong path here means the resolution overwrote a file the user was not
    // looking at, with content from a different one.
    expect(h.writes).toEqual([{ path: '/w/b.ts', content: 'B edits' }]);
    expect(h.deps.markSaved).toHaveBeenCalledExactlyOnceWith('tab-2', 500);
  });
});

describe('resolveConflict — take disk', () => {
  it('replaces the tab content and writes nothing', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: true, file: { content: 'disk version', mtime: 500 } });

    const result = await resolveConflict(h.deps, 'tab-1', 'take-disk', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toEqual({ status: 'took-disk', tabId: 'tab-1', mtime: 500 });
    expect(h.deps.applyDiskVersion).toHaveBeenCalledExactlyOnceWith(
      'tab-1',
      'disk version',
      500
    );
    // Nothing is written to disk: the disk version already *is* the file.
    // Writing here would push the edits the user asked to discard over the
    // version they asked to keep — the inversion this pair guards against.
    expect(h.writes).toEqual([]);
    expect(h.deps.markSaved).not.toHaveBeenCalled();
    expect(h.deps.closeConflictDialog).toHaveBeenCalled();
  });

  it('adopts into the tab that was named, not another one', async () => {
    // `applyDiskVersion` is the branch that deliberately destroys unsaved edits.
    // Aiming it at the wrong tab discards work the user never chose to discard.
    const h = harness([
      makeTab({ id: 'tab-1', path: '/w/a.ts', diskState: 'conflict' }),
      makeTab({ id: 'tab-2', path: '/w/b.ts', diskState: 'conflict' }),
    ]);
    h.setDiskRead({ ok: true, file: { content: 'B on disk', mtime: 600 } });

    await resolveConflict(h.deps, 'tab-2', 'take-disk', { content: 'B on disk', mtime: 600 });

    expect(h.deps.applyDiskVersion).toHaveBeenCalledExactlyOnceWith('tab-2', 'B on disk', 600);
    expect(h.deps.read).toHaveBeenCalledWith('/w/b.ts');
  });

  it('adopts the bytes it re-read, not the ones the dialog was rendered from', async () => {
    // Same content, newer mtime: not a conflict by the detector's rule, but the
    // baseline must be the mtime actually on disk or the next boot re-flags it.
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: true, file: { content: 'disk version', mtime: 880 } });

    const result = await resolveConflict(h.deps, 'tab-1', 'take-disk', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toMatchObject({ status: 'took-disk', mtime: 880 });
    expect(h.deps.applyDiskVersion).toHaveBeenCalledWith('tab-1', 'disk version', 880);
  });
});

describe('resolveConflict — the two destructive actions move bytes in opposite directions', () => {
  /**
   * The single most important pair of assertions in this suite.
   *
   * From identical state, the only difference is which action was chosen, and
   * the outcome must be mirror-image. Swapping the two branches inside
   * `resolveConflict` or `planResolutionApply` fails this test, and that swap is
   * exactly the bug that silently destroys the user's work.
   */
  it('keep-mine writes and does not adopt; take-disk adopts and does not write', async () => {
    const shown = { content: 'disk version', mtime: 500 };

    const keeping = harness([makeTab({ diskState: 'conflict', content: 'my version' })]);
    keeping.setDiskRead({ ok: true, file: { content: 'disk version', mtime: 500 } });
    await resolveConflict(keeping.deps, 'tab-1', 'keep-mine', shown);

    const taking = harness([makeTab({ diskState: 'conflict', content: 'my version' })]);
    taking.setDiskRead({ ok: true, file: { content: 'disk version', mtime: 500 } });
    await resolveConflict(taking.deps, 'tab-1', 'take-disk', shown);

    // Keep mine: the tab's content reaches disk, the tab is not rewritten.
    expect(keeping.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
    expect(keeping.deps.applyDiskVersion).not.toHaveBeenCalled();

    // Take disk: the disk content reaches the tab, nothing reaches disk.
    expect(taking.writes).toEqual([]);
    expect(taking.deps.applyDiskVersion).toHaveBeenCalledWith('tab-1', 'disk version', 500);
  });
});

describe('resolveConflict — cancel and dismiss', () => {
  it('cancel writes nothing, discards nothing and leaves the flag on', async () => {
    // The conflict is unresolved, and the tab-strip indicator is the only thing
    // that will say so afterwards.
    const h = harness([makeTab({ diskState: 'conflict' })]);

    expect(await resolveConflict(h.deps, 'tab-1', 'cancel', { content: 'x', mtime: 1 })).toEqual({
      status: 'cancelled',
    });
    expect(h.writes).toEqual([]);
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
    expect(h.deps.acknowledgeDiskState).not.toHaveBeenCalled();
    expect(h.deps.closeConflictDialog).toHaveBeenCalled();
  });

  it('cancel does not even read disk', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);

    await resolveConflict(h.deps, 'tab-1', 'cancel', { content: 'x', mtime: 1 });

    expect(h.deps.read).not.toHaveBeenCalled();
  });

  it('cancel works on a tab that has already gone', async () => {
    // Nothing to do and nothing to look up: closing must not depend on the tab.
    const h = harness();

    expect(await resolveConflict(h.deps, 'tab-gone', 'cancel', { content: '' })).toEqual({
      status: 'cancelled',
    });
    expect(h.deps.closeConflictDialog).toHaveBeenCalled();
  });

  it('dismiss clears the flag without writing or discarding', async () => {
    const h = harness([makeTab({ diskState: 'unsaved-lost' })]);

    expect(await resolveConflict(h.deps, 'tab-1', 'dismiss', { content: '' })).toEqual({
      status: 'dismissed',
      tabId: 'tab-1',
    });
    expect(h.deps.acknowledgeDiskState).toHaveBeenCalledExactlyOnceWith('tab-1');
    expect(h.writes).toEqual([]);
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
  });

  it('dismiss clears the flag on the named tab only', async () => {
    const h = harness([
      makeTab({ id: 'tab-1', diskState: 'unsaved-lost' }),
      makeTab({ id: 'tab-2', path: '/w/b.ts', diskState: 'unsaved-lost' }),
    ]);

    await resolveConflict(h.deps, 'tab-2', 'dismiss', { content: '' });

    expect(h.deps.acknowledgeDiskState).toHaveBeenCalledExactlyOnceWith('tab-2');
  });

  it('does nothing for an unknown tab', async () => {
    const h = harness();

    expect(await resolveConflict(h.deps, 'tab-gone', 'keep-mine', { content: '' })).toEqual({
      status: 'skipped',
      reason: 'no-tab',
    });
    expect(h.writes).toEqual([]);
  });
});

describe('resolveConflict — recreate, for a file that was deleted', () => {
  it('writes the tab back to its path', async () => {
    const h = harness([makeTab({ diskState: 'missing' })]);
    h.setDiskRead({ ok: false, missing: true });
    h.setWriteMtime(1_000);

    const result = await resolveConflict(h.deps, 'tab-1', 'recreate', { content: '' });

    expect(result).toEqual({ status: 'kept-mine', tabId: 'tab-1', mtime: 1_000 });
    expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
  });

  it('still writes if the file reappeared with the same content', async () => {
    // Someone restored it from the same source; nothing is destroyed.
    const h = harness([makeTab({ diskState: 'missing' })]);
    h.setDiskRead({ ok: true, file: { content: 'my version', mtime: 900 } });

    expect((await resolveConflict(h.deps, 'tab-1', 'recreate', { content: '' })).status).toBe(
      'kept-mine'
    );
  });
});

describe('resolveConflict — the file changes again while the dialog is open', () => {
  it('writes nothing and reports the fresh version so the diff can be redrawn', async () => {
    // Applying a choice made against a version that has since been replaced
    // would overwrite a third version the user never saw.
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: true, file: { content: 'a third version', mtime: 900 } });

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toEqual({
      status: 'stale',
      tabId: 'tab-1',
      reason: 'changed-again',
      shown: { content: 'a third version', mtime: 900 },
    });
    expect(h.writes).toEqual([]);
    expect(h.deps.markSaved).not.toHaveBeenCalled();
    // The dialog stays open: the user has to choose again against what is there
    // now, not be told "done" for something that never happened.
    expect(h.deps.closeConflictDialog).not.toHaveBeenCalled();
  });

  it('refuses take-disk too, rather than discarding edits against a stale diff', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: true, file: { content: 'a third version', mtime: 900 } });

    const result = await resolveConflict(h.deps, 'tab-1', 'take-disk', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toMatchObject({ status: 'stale', reason: 'changed-again' });
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
  });

  it('proceeds when only the mtime moved and the bytes are identical', async () => {
    // `touch` between opening and clicking. Refusing here would make the dialog
    // unusable on a machine with a watcher running.
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: true, file: { content: 'disk version', mtime: 9_000 } });

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result.status).toBe('kept-mine');
    expect(h.writes).toHaveLength(1);
  });

  it('refuses when the file was deleted while the dialog was open', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: false, missing: true });

    const result = await resolveConflict(h.deps, 'tab-1', 'take-disk', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toEqual({
      status: 'stale',
      tabId: 'tab-1',
      reason: 'vanished',
      // Nothing to redraw the comparison from.
      shown: null,
    });
    expect(h.deps.applyDiskVersion).not.toHaveBeenCalled();
  });

  it('lets keep-mine recreate a file deleted while the dialog was open', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: false, missing: true });

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result.status).toBe('kept-mine');
    expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'my version' }]);
  });

  it('refuses both actions when the re-read fails', async () => {
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.setDiskRead({ ok: false, missing: false });

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toMatchObject({ status: 'stale', reason: 'unreadable', shown: null });
    expect(h.writes).toEqual([]);
  });

  it('treats a rejected re-read as unreadable rather than crashing the click', async () => {
    // An IPC rejection must not escape as an unhandled error from a click
    // handler, and must not be read as "disk is fine, go ahead".
    const h = harness([makeTab({ diskState: 'conflict' })]);
    h.deps.read.mockRejectedValue(new Error('bridge exploded'));

    const result = await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(result).toMatchObject({ status: 'stale', reason: 'unreadable' });
    expect(h.writes).toEqual([]);
  });
});

describe('resolveConflict — a hand-merged pane', () => {
  it('writes the merged content when the tab was updated before applying', async () => {
    // The dialog commits the right-hand pane to the store before calling in;
    // this asserts the write reads the updated tab rather than a snapshot taken
    // at click time, which would silently discard the merge.
    const h = harness([makeTab({ diskState: 'conflict', content: 'my version' })]);
    h.deps.updateTabContent('tab-1', 'merged by hand');

    await resolveConflict(h.deps, 'tab-1', 'keep-mine', {
      content: 'disk version',
      mtime: 500,
    });

    expect(h.writes).toEqual([{ path: '/w/a.ts', content: 'merged by hand' }]);
  });
});

describe('createIpcWriter', () => {
  const original = (globalThis as { window?: unknown }).window;

  function setBridge(editor: unknown) {
    (globalThis as { window?: unknown }).window = { cortex: { editor } };
  }

  beforeEach(() => {
    setBridge(undefined);
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  it('reports the mtime the main process wrote at', async () => {
    const saveFile = vi.fn(async () => ({ success: true, data: { mtime: 1_234 } }));
    setBridge({ saveFile });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: true, mtime: 1_234 });
    expect(saveFile).toHaveBeenCalledWith({ path: '/w/a.ts', content: 'body' });
  });

  it('fails when there is no bridge at all', async () => {
    // Absent preload: nothing was written, so the tab must stay dirty.
    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('fails when the bridge has no saveFile', async () => {
    setBridge({});

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('fails on an unsuccessful response', async () => {
    setBridge({ saveFile: async () => ({ success: false }) });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('fails on a null response', async () => {
    setBridge({ saveFile: async () => null });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('fails on a rejected promise', async () => {
    setBridge({
      saveFile: async () => {
        throw new Error('EACCES');
      },
    });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('treats a success with no mtime as a failure', async () => {
    // Reporting 0 would mark the tab saved against a baseline older than any
    // real file, so the next boot would call it a conflict with the version it
    // had just written. Staying dirty is the honest reading.
    setBridge({ saveFile: async () => ({ success: true, data: {} }) });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('treats a success with no data as a failure', async () => {
    setBridge({ saveFile: async () => ({ success: true }) });

    expect(await createIpcWriter()('/w/a.ts', 'body')).toEqual({ ok: false });
  });

  it('does not clear the dirty flag when the write fails through the real writer', async () => {
    // End to end through `attemptSave`, since that is what consumes it.
    setBridge({ saveFile: async () => ({ success: false }) });
    const markSaved = vi.fn();
    const deps: SaveDeps = {
      getTab: () => makeTab(),
      writeFile: createIpcWriter(),
      markSaved,
      openConflictDialog: vi.fn(),
    };

    expect(await attemptSave(deps, 'tab-1')).toEqual({ status: 'failed', tabId: 'tab-1' });
    expect(markSaved).not.toHaveBeenCalled();
  });
});
