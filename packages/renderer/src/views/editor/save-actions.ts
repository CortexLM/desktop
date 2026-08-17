/**
 * Saving, and resolving a conflict — the sequencing, with every side effect injected.
 *
 * WHY THIS IS NOT IN `EditorView`
 * ------------------------------
 * `EditorView` imports `@monaco-editor/react`, which pulls in `monaco-editor` and
 * five `?worker` imports. None of that survives jsdom, so anything living in that
 * module is reachable only from an E2E run. The save gate is the one code path
 * whose failure destroys the user's file, so it lives here, where a unit test can
 * drive it: `EditorView` supplies the real store actions and IPC, a test supplies
 * fakes, and the order of operations is identical.
 *
 * Every function returns a discriminated result rather than throwing. Callers
 * need to distinguish "blocked, dialog opened" from "written" from "failed", and
 * the first of those is a normal outcome, not an exception.
 */

import {
  planResolutionApply,
  planSave,
  type RefusalReason,
  type ShownVersion,
} from '../../store/conflict-resolution';
import type { DiskFile, DiskReader } from '../../store/editor-session';

/** A tab as these functions read it. Satisfied structurally by `EditorTab`. */
export interface SaveableTab {
  id: string;
  path: string;
  content: string;
  isDirty: boolean;
  diskState?: 'clean' | 'conflict' | 'missing' | 'unsaved-lost';
  baselineMtime?: number;
}

export interface SaveDeps {
  /**
   * Re-read at call time rather than closed over.
   *
   * The tab can change between the keystroke and the write (reconciliation
   * finishing, another action landing), and a save decided from a stale snapshot
   * is a save that ignores a conflict detected a moment ago.
   */
  getTab: (tabId: string) => SaveableTab | undefined;
  writeFile: (path: string, content: string) => Promise<{ ok: true; mtime: number } | { ok: false }>;
  markSaved: (tabId: string, mtime: number) => void;
  openConflictDialog: (tabId: string) => void;
}

export type SaveResult =
  | { status: 'skipped'; reason: 'not-dirty' | 'no-tab' }
  | { status: 'blocked'; tabId: string }
  | { status: 'saved'; tabId: string; mtime: number }
  | { status: 'failed'; tabId: string };

/**
 * `Ctrl+S`, and the blur autosave.
 *
 * On a tab flagged `conflict` this writes nothing and opens the resolution
 * dialog. That is the whole point of the module: before this gate existed, the
 * user was shown a conflict indicator and then allowed to overwrite the other
 * version with the same keystroke as always, which made the warning worse than
 * silence.
 *
 * `force` is how the dialog's "keep my version" gets through the gate it just
 * opened. It is a parameter and not a second function so there is exactly one
 * code path that writes a file.
 */
export async function attemptSave(
  deps: SaveDeps,
  tabId: string,
  options: { force?: boolean } = {}
): Promise<SaveResult> {
  const tab = deps.getTab(tabId);
  if (!tab) return { status: 'skipped', reason: 'no-tab' };

  if (!options.force) {
    const decision = planSave(tab);
    if (!decision.save) {
      if (decision.reason === 'conflict') {
        deps.openConflictDialog(decision.tabId);
        return { status: 'blocked', tabId: decision.tabId };
      }
      return { status: 'skipped', reason: 'not-dirty' };
    }
  }

  const written = await deps.writeFile(tab.path, tab.content);
  if (!written.ok) return { status: 'failed', tabId: tab.id };

  // The mtime of the write becomes the new baseline, which is what clears the
  // conflict: the user's version is now the one on disk.
  deps.markSaved(tab.id, written.mtime);
  return { status: 'saved', tabId: tab.id, mtime: written.mtime };
}

export interface ResolveDeps extends SaveDeps {
  read: DiskReader;
  applyDiskVersion: (tabId: string, content: string, mtime: number) => void;
  acknowledgeDiskState: (tabId: string) => void;
  closeConflictDialog: () => void;
  /** Used only to commit a hand-merged right-hand pane before writing it. */
  updateTabContent: (tabId: string, content: string) => void;
}

/**
 * The IPC write, as `SaveDeps.writeFile` wants it.
 *
 * Absent bridge, rejected promise and `success: false` all collapse to
 * `{ ok: false }`: the caller's only correct response to each is the same — do
 * not clear the dirty flag, do not move the baseline. A save that failed must
 * leave the tab looking exactly as unsaved as it is.
 */
export function createIpcWriter(): SaveDeps['writeFile'] {
  return async (path, content) => {
    const bridge = (globalThis as {
      window?: {
        cortex?: {
          editor?: {
            saveFile?: (request: { path: string; content: string }) => Promise<unknown>;
          };
        };
      };
    }).window?.cortex?.editor;

    if (typeof bridge?.saveFile !== 'function') return { ok: false };

    try {
      const response = (await bridge.saveFile({ path, content })) as
        | { success: true; data?: { mtime?: number } }
        | { success: false }
        | null
        | undefined;

      if (!response || !response.success) return { ok: false };

      // A write with no mtime back cannot move the baseline honestly. Reporting
      // 0 would mark the tab saved against a baseline older than any real file,
      // so the next boot would call it a conflict with the version it just
      // wrote. Treating it as a failed write is the conservative reading: the
      // tab stays dirty and the user can save again.
      const mtime = response.data?.mtime;
      return typeof mtime === 'number' ? { ok: true, mtime } : { ok: false };
    } catch {
      return { ok: false };
    }
  };
}

export type ResolveResult =
  | { status: 'cancelled' }
  | { status: 'dismissed'; tabId: string }
  | { status: 'kept-mine'; tabId: string; mtime: number }
  | { status: 'took-disk'; tabId: string; mtime: number }
  /**
   * Nothing was written. `shown` is the version now on disk when it could be
   * read, so the caller can re-render the comparison against it, and null when
   * it could not — an mtime is always present in the former case, which is what
   * lets the refreshed dialog detect a *third* change.
   */
  | { status: 'stale'; tabId: string; reason: RefusalReason; shown: DiskFile | null }
  | { status: 'write-failed'; tabId: string }
  | { status: 'skipped'; reason: 'no-tab' };

/**
 * Applies the user's choice, after confirming disk still looks the way the
 * dialog said it did.
 *
 * `shown` is the disk version the comparison was rendered from. Re-reading and
 * comparing against it costs one IPC round trip and is the difference between
 * overwriting the version the user rejected and overwriting one they never saw:
 * a dialog stays open for as long as it takes to read, and a diff is a
 * photograph.
 *
 * On a refusal nothing is written and the dialog stays open — the caller
 * re-renders it against the version that is now on disk.
 */
export async function resolveConflict(
  deps: ResolveDeps,
  tabId: string,
  action: 'keep-mine' | 'take-disk' | 'recreate' | 'cancel' | 'dismiss',
  shown: ShownVersion
): Promise<ResolveResult> {
  if (action === 'cancel') {
    // Deliberately leaves `diskState` alone: the conflict is unresolved, and the
    // tab-strip indicator is the only thing that will say so afterwards.
    deps.closeConflictDialog();
    return { status: 'cancelled' };
  }

  const tab = deps.getTab(tabId);
  if (!tab) return { status: 'skipped', reason: 'no-tab' };

  if (action === 'dismiss') {
    // `unsaved-lost` only: nothing to write, nothing to adopt, just stop warning.
    deps.acknowledgeDiskState(tab.id);
    deps.closeConflictDialog();
    return { status: 'dismissed', tabId: tab.id };
  }

  const result = await deps.read(tab.path).catch(() => ({ ok: false, missing: false }) as const);
  const plan = planResolutionApply(action, shown, result);

  if (plan.apply === 'refuse') {
    return {
      status: 'stale',
      tabId: tab.id,
      reason: plan.reason,
      shown: result.ok ? { content: result.file.content, mtime: result.file.mtime } : null,
    };
  }

  if (plan.apply === 'adopt') {
    // No write. The tab takes the disk content and the unsaved edits are gone —
    // by explicit request, and only on this tab.
    deps.applyDiskVersion(tab.id, plan.file.content, plan.file.mtime);
    deps.closeConflictDialog();
    return { status: 'took-disk', tabId: tab.id, mtime: plan.file.mtime };
  }

  // `force`, because the gate that opened this dialog would otherwise block the
  // very save the user just asked for.
  const saved = await attemptSave(deps, tab.id, { force: true });
  if (saved.status !== 'saved') return { status: 'write-failed', tabId: tab.id };

  deps.closeConflictDialog();
  return { status: 'kept-mine', tabId: tab.id, mtime: saved.mtime };
}
