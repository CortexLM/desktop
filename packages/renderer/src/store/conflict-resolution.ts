/**
 * Conflict resolution — the decisions, separated from the dialog that shows them.
 *
 * WHY THIS MODULE EXISTS
 * ---------------------
 * `editor-session.ts` detects that a file changed on disk under unsaved edits and
 * flags the tab `conflict`. Detection alone made things worse than no detection:
 * the user was told both versions existed, and `Ctrl+S` still overwrote the disk
 * one without a word. A warning you can walk straight through is a trap.
 *
 * Everything here is a pure function over a tab and a disk read. The dialog
 * renders what these return and the save path obeys what they decide, so the
 * rules that decide whether work gets destroyed are testable without a DOM, a
 * Monaco instance or an IPC bridge.
 *
 * WHAT IS NOT CONFLATED, DELIBERATELY
 * -----------------------------------
 * `conflict`, `missing` and `unsaved-lost` all mean "the tab disagrees with the
 * filesystem", and it is tempting to serve them from one set of buttons. They get
 * three different panels instead:
 *
 *  - `conflict`     — two versions exist. Both can be destroyed, so both actions
 *                     that destroy one are named after what they destroy.
 *  - `missing`      — one version exists: the user's. There is nothing to "take
 *                     from disk", so that action is *absent* rather than
 *                     disabled, and no button here discards the last copy of the
 *                     user's work. Closing the tab already does that, behind its
 *                     own gesture.
 *  - `unsaved-lost` — zero versions of the edits exist; they were dropped for
 *                     size before this boot. Nothing can be resolved, so the
 *                     panel only acknowledges it.
 *
 * A single "discard" button covering "throw away my edits" and "throw away the
 * only copy of a deleted file" is exactly the button that loses data.
 */

import type { DiskFile, DiskReadResult } from './editor-session';
import type { TabDiskState } from './editor-session';

// ---------------------------------------------------------------------------
// Save gate
// ---------------------------------------------------------------------------

/** The subset of a tab the save gate reads. Satisfied structurally by `EditorTab`. */
export interface SaveGateTab {
  id: string;
  isDirty: boolean;
  diskState?: TabDiskState;
}

/**
 * Whether a save may proceed.
 *
 * `blocked` is not a failure: it means the user has to see what they would
 * destroy first. The `tabId` travels with it so the caller opens the dialog for
 * the tab that was actually being saved rather than whichever tab is focused by
 * the time the promise settles.
 */
export type SaveDecision =
  | { save: true }
  | { save: false; reason: 'not-dirty' }
  | { save: false; reason: 'conflict'; tabId: string };

/**
 * Gates a save on the tab's reconciliation state.
 *
 * Only `conflict` blocks, and the two states that look like they should are the
 * interesting part:
 *
 *  - `missing` saves. Writing a file that no longer exists recreates it and
 *    destroys nothing — refusing would strand the user's only copy in a tab.
 *  - `unsaved-lost` saves. The flag describes edits lost *before* this boot; the
 *    tab's baseline was refreshed from disk during reconciliation, so a save now
 *    is an ordinary write of whatever the user has typed since. Blocking it
 *    would gate today's work on yesterday's accident.
 */
export function planSave(tab: SaveGateTab | undefined): SaveDecision {
  if (!tab || !tab.isDirty) return { save: false, reason: 'not-dirty' };
  if (tab.diskState === 'conflict') return { save: false, reason: 'conflict', tabId: tab.id };
  return { save: true };
}

// ---------------------------------------------------------------------------
// Resolution panels
// ---------------------------------------------------------------------------

/** What the user can choose. One name per outcome; none of them is reused. */
export type ResolutionAction = 'keep-mine' | 'take-disk' | 'recreate' | 'cancel' | 'dismiss';

/**
 * Labels, kept here so the wording that tells the user what they are about to
 * destroy is asserted by tests rather than living only in JSX.
 *
 * Each destructive label names its casualty in the label itself, not only in the
 * description underneath: a user who reads three words off a button and clicks
 * still has to have read the consequence.
 */
export const RESOLUTION_LABELS = {
  keepMine: 'Keep my version (overwrite the file on disk)',
  takeDisk: 'Use the file on disk (discard my unsaved edits)',
  recreate: 'Save my version (recreate the deleted file)',
  cancel: 'Cancel (leave the conflict flagged)',
  dismiss: 'Dismiss',
} as const;

/** Which version an action destroys. Machine-readable so a swap is detectable. */
export type Casualty = 'disk-changes' | 'my-edits' | 'nothing';

export interface ResolutionActionSpec {
  action: ResolutionAction;
  label: string;
  /** Spelled-out consequence, shown next to the button. */
  detail: string;
  destroys: Casualty;
  tone: 'danger' | 'neutral';
}

export interface ResolutionPanel {
  /** Mirrors the tab's `diskState`; the three panels are not interchangeable. */
  kind: Exclude<TabDiskState, 'clean'>;
  title: string;
  body: string;
  /** Only a two-version disagreement has anything to diff. */
  showsDiff: boolean;
  actions: ResolutionActionSpec[];
}

const CONFLICT_PANEL: ResolutionPanel = {
  kind: 'conflict',
  title: 'This file changed on disk',
  body:
    'Your unsaved edits and the file on disk have both moved on since you last read it. ' +
    'Both versions are shown below. Nothing has been written yet.',
  showsDiff: true,
  actions: [
    {
      action: 'keep-mine',
      label: RESOLUTION_LABELS.keepMine,
      detail:
        'Writes your version over the file. Everything changed on disk since you opened it is lost.',
      destroys: 'disk-changes',
      tone: 'danger',
    },
    {
      action: 'take-disk',
      label: RESOLUTION_LABELS.takeDisk,
      detail:
        'Replaces the tab with the file on disk. Your unsaved edits exist nowhere else and cannot be recovered.',
      destroys: 'my-edits',
      tone: 'danger',
    },
    {
      action: 'cancel',
      label: RESOLUTION_LABELS.cancel,
      detail: 'Writes nothing and keeps both versions. The tab stays flagged as conflicting.',
      destroys: 'nothing',
      tone: 'neutral',
    },
  ],
};

const MISSING_PANEL: ResolutionPanel = {
  kind: 'missing',
  title: 'This file no longer exists on disk',
  body:
    'It was deleted or moved while your edits were unsaved, so the tab holds the only copy left. ' +
    'There is no version on disk to compare against or to take.',
  showsDiff: false,
  actions: [
    {
      action: 'recreate',
      label: RESOLUTION_LABELS.recreate,
      detail: 'Writes your version back to the original path, recreating the file. Destroys nothing.',
      destroys: 'nothing',
      tone: 'neutral',
    },
    {
      action: 'cancel',
      label: RESOLUTION_LABELS.cancel,
      detail: 'Writes nothing. The tab keeps your only copy and stays flagged.',
      destroys: 'nothing',
      tone: 'neutral',
    },
  ],
  // No discard action, on purpose. Discarding here would delete the sole
  // surviving copy of the user's work, which is the one outcome with no undo,
  // and it would sit one pixel from a button offered for the same reason on the
  // conflict panel — where a copy does survive on disk. Closing the tab is
  // still available and is its own deliberate gesture.
};

const UNSAVED_LOST_PANEL: ResolutionPanel = {
  kind: 'unsaved-lost',
  title: 'Unsaved edits for this file could not be restored',
  body:
    'They were too large to fit the session storage budget, so they were dropped when the window ' +
    'closed. The tab now shows the file on disk. There is nothing left to merge — this is a report, ' +
    'not a choice.',
  showsDiff: false,
  actions: [
    {
      action: 'dismiss',
      label: RESOLUTION_LABELS.dismiss,
      detail: 'Clears the warning. The tab keeps the version on disk.',
      destroys: 'nothing',
      tone: 'neutral',
    },
  ],
};

/**
 * The panel for a tab's disk state, or null when there is nothing to resolve.
 *
 * Returning null for `clean`, `undefined` and any unrecognised value keeps an
 * unexplained dialog from opening — the same rule the tab-strip indicator
 * follows, where an icon with no label is worse than no icon.
 */
export function planResolutionPanel(diskState: TabDiskState | undefined): ResolutionPanel | null {
  switch (diskState) {
    case 'conflict':
      return CONFLICT_PANEL;
    case 'missing':
      return MISSING_PANEL;
    case 'unsaved-lost':
      return UNSAVED_LOST_PANEL;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Re-checking disk before applying a resolution
// ---------------------------------------------------------------------------

/** The version of the file the user was actually looking at when they chose. */
export interface ShownVersion {
  content: string;
  mtime?: number;
}

export type RefusalReason = 'changed-again' | 'vanished' | 'unreadable';

/**
 * The operation a chosen action turns into, once disk has been re-read.
 *
 * The action → operation mapping lives here rather than in the dialog's click
 * handlers on purpose: `keep-mine` becoming `write` and `take-disk` becoming
 * `adopt` is the pair whose inversion silently destroys the user's work, so it
 * belongs somewhere a unit test can assert it directly.
 *
 * `refuse` is not an error to report and forget — the caller re-renders the
 * comparison against what is now on disk so the user chooses again.
 */
export type ApplyPlan =
  | { apply: 'write' }
  | { apply: 'adopt'; file: DiskFile }
  | { apply: 'refuse'; reason: RefusalReason };

/**
 * Re-verifies disk between the dialog opening and the resolution being applied.
 *
 * A dialog is open for as long as the user reads it, and a diff is a photograph.
 * Applying a choice made against a version that has since been replaced would
 * overwrite a *third* version the user never saw — the exact failure this whole
 * feature exists to prevent, reintroduced one step later.
 *
 * "Changed again" uses the same test as the original detection: a newer mtime
 * *and* different bytes. `touch`, or a checkout that restores identical content,
 * moves the mtime without changing anything, and re-prompting for that would
 * train the user to click through the dialog.
 *
 * Per action:
 *  - unreadable (permission blip, transient IPC failure) → refuse both. Writing
 *    blind is how you overwrite something you never managed to look at.
 *  - vanished → `keep-mine` proceeds, because recreating a deleted file destroys
 *    nothing; `take-disk` cannot proceed, because there is no longer anything to
 *    take.
 *  - no baseline mtime → applied. Claiming a conflict without a reference point
 *    would be a guess, which is the rule the detector already follows.
 */
export function planResolutionApply(
  action: 'keep-mine' | 'take-disk' | 'recreate',
  shown: ShownVersion,
  result: DiskReadResult
): ApplyPlan {
  if (!result.ok) {
    if (!result.missing) return { apply: 'refuse', reason: 'unreadable' };
    // The file is gone. Writing recreates it; there is nothing to adopt.
    return action === 'take-disk'
      ? { apply: 'refuse', reason: 'vanished' }
      : { apply: 'write' };
  }

  const { content, mtime } = result.file;
  const changedAgain =
    typeof shown.mtime === 'number' && mtime > shown.mtime && content !== shown.content;

  if (changedAgain) return { apply: 'refuse', reason: 'changed-again' };

  // `keep-mine` and `recreate` both write the tab over the file; only
  // `take-disk` moves bytes the other way.
  return action === 'take-disk' ? { apply: 'adopt', file: result.file } : { apply: 'write' };
}

/**
 * How a refused apply is explained. Kept beside the planner so the reason codes
 * and the sentences the user reads cannot drift apart.
 */
export const STALE_REASON_MESSAGE: Record<RefusalReason, string> = {
  'changed-again':
    'The file changed on disk again while this dialog was open. Nothing was written. The comparison below now shows the current version — choose again.',
  vanished:
    'The file was deleted on disk while this dialog was open, so there is no longer a version to take. Your unsaved edits are the only copy left.',
  unreadable:
    'The file could not be read to confirm what is on disk, so nothing was written. Check permissions and try again.',
};
