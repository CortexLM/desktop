/**
 * Closing a tab — the decision about whether to ask first, separated from the UI.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A right-click on a tab used to close it. Not "open a menu with a close item in
 * it" — close it, immediately, discarding whatever was unsaved. Meanwhile the
 * save path had grown a full Monaco diff dialog to stop `Ctrl+S` from
 * overwriting the version on disk, with buttons disabled until the comparison
 * loaded and labels naming what each one destroys. The same unsaved edits that
 * `Ctrl+S` refused to touch without three sentences of explanation were thrown
 * away by an accidental right-click, in silence.
 *
 * The asymmetry, not the right-click, is the bug. So the decision lives here as
 * a pure function and *every* close path in the app is routed through it:
 * the close button, middle-click, the context menu's three items, `Ctrl+W` and
 * `Ctrl+Shift+W`. A user who learns that closing a dirty tab asks first must not
 * find a sixth gesture that does not.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It does not confirm a clean close. Friction on the 95% case is not caution, it
 * is training: a user who has dismissed the same dialog forty times today clicks
 * through the forty-first without reading it, and that is the one where the tab
 * was dirty. `planClose` returns `close` with no prompt whenever nothing would be
 * destroyed, and the tab shuts instantly.
 *
 * It also does not use one sentence for every casualty. A tab flagged `missing`
 * holds the *only surviving copy* of its file — the file was deleted on disk
 * while the edits were unsaved — so closing it is not "you can reopen it from
 * disk", it is unrecoverable. That tab gets different wording and a different
 * `destroys` value from an ordinary unsaved tab, for the same reason
 * `conflict-resolution.ts` gives the `missing` panel no discard button at all.
 */

import type { TabDiskState } from './editor-session';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Which tabs a close gesture is aimed at.
 *
 * Carried as data rather than resolved to a list of ids at request time, and
 * stored on the pending prompt, so that confirming applies the operation the
 * user was actually shown. If the prompt only remembered "yes, close", a tab
 * focused while the dialog was open would decide which file got destroyed.
 */
export type CloseScope =
  | { kind: 'tab'; tabId: string }
  | { kind: 'others'; tabId: string }
  | { kind: 'all' };

/** The subset of a tab this module reads. Satisfied structurally by `EditorTab`. */
export interface ClosableTab {
  id: string;
  path: string;
  isDirty: boolean;
  diskState?: TabDiskState;
}

// ---------------------------------------------------------------------------
// What a close would destroy
// ---------------------------------------------------------------------------

/**
 * Machine-readable casualty, mirroring `Casualty` in `conflict-resolution.ts`.
 *
 * `my-edits` is deliberately spelled the same way as there: it is the same
 * casualty, and a test that knows one dialog's vocabulary should not have to
 * learn a second. `only-copy` is new, because the conflict dialog never offers
 * to destroy the last copy of anything — this one has to, since closing a
 * `missing` tab is exactly that.
 */
export type CloseCasualty = 'nothing' | 'my-edits' | 'only-copy';

/** Why one particular tab would lose something. */
export type DoomedReason = 'unsaved' | 'conflicted' | 'only-copy';

/** A tab that would lose work, named so the prompt can list it. */
export interface DoomedTab {
  id: string;
  path: string;
  reason: DoomedReason;
}

/**
 * Whether closing this tab destroys anything, and what.
 *
 * `missing` is checked before `isDirty` on purpose. Reconciliation only ever
 * flags a dirty tab `missing` (a clean tab whose file vanished is closed
 * outright), so today the two always agree — but `markTabDirty(id, false)`
 * leaves `diskState` in place when called without an mtime, so a `missing` tab
 * that has been marked clean is reachable in principle. Trusting `isDirty` alone
 * there would let the last copy of a deleted file close without a word, which is
 * the single worst outcome this module exists to prevent. Checking the more
 * severe condition first costs one comparison.
 *
 * `unsaved-lost` is *not* a casualty: reconciliation already replaced that tab's
 * content with the version on disk and cleared its dirty flag. The edits were
 * lost on a previous boot; prompting now would ask the user to confirm the loss
 * of something that is already gone, and would be the kind of dialog that
 * teaches people to click through dialogs.
 */
export function classifyTab(tab: ClosableTab): DoomedTab | null {
  if (tab.diskState === 'missing') {
    return { id: tab.id, path: tab.path, reason: 'only-copy' };
  }
  if (!tab.isDirty) return null;
  if (tab.diskState === 'conflict') {
    return { id: tab.id, path: tab.path, reason: 'conflicted' };
  }
  return { id: tab.id, path: tab.path, reason: 'unsaved' };
}

/** The worst casualty in a set. `only-copy` outranks `my-edits`. */
export function worstCasualty(doomed: readonly DoomedTab[]): CloseCasualty {
  if (doomed.length === 0) return 'nothing';
  return doomed.some((tab) => tab.reason === 'only-copy') ? 'only-copy' : 'my-edits';
}

// ---------------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------------

/**
 * What the confirmation says.
 *
 * Built here rather than in JSX so the wording that tells a user what they are
 * about to destroy is asserted by unit tests, exactly as `RESOLUTION_LABELS` is.
 * A label that stops naming its casualty is a regression in this feature's only
 * real function, and it should fail a test rather than merely look different.
 */
export interface ClosePrompt {
  scope: CloseScope;
  title: string;
  body: string;
  /** Names the casualty in the label itself, not only in the body text. */
  confirmLabel: string;
  cancelLabel: string;
  /** Machine-readable, so a swapped pair of buttons is detectable by a test. */
  destroys: CloseCasualty;
  /** The tabs that would lose work, in strip order. Listed in the dialog. */
  doomed: DoomedTab[];
}

/** Per-tab explanation, shown next to each listed file. */
export const DOOMED_REASON_TEXT: Record<DoomedReason, string> = {
  unsaved: 'Unsaved edits that exist nowhere else.',
  conflicted:
    'Unsaved edits that exist nowhere else. A different version of this file is on disk.',
  'only-copy':
    'This file was deleted on disk. The tab holds the only copy left — closing it cannot be undone.',
};

const basename = (path: string): string => path.split('/').pop() || path;

/**
 * Wording for a one-tab close.
 *
 * Two sentences, and the second one is the whole point: it says where the work
 * goes, not that an action is irreversible in the abstract. "Cannot be undone"
 * is on every dialog anyone has ever dismissed.
 */
function singleTabPrompt(scope: CloseScope, tab: DoomedTab): ClosePrompt {
  const name = basename(tab.path);

  if (tab.reason === 'only-copy') {
    return {
      scope,
      title: `Close ${name} and discard the only copy?`,
      body:
        `${tab.path} was deleted on disk while these edits were unsaved, so this tab holds the ` +
        'only copy that still exists. Closing it destroys the file. Saving it first would recreate it.',
      confirmLabel: 'Close the file (discard the only copy that still exists)',
      cancelLabel: 'Cancel (keep the file open)',
      destroys: 'only-copy',
      doomed: [tab],
    };
  }

  const conflictNote =
    tab.reason === 'conflicted'
      ? ' A different version of this file is on disk; closing keeps that one and discards yours.'
      : '';

  return {
    scope,
    title: `Close ${name} without saving?`,
    body:
      `${tab.path} has unsaved edits. They exist nowhere else and cannot be recovered ` +
      `once the tab is closed.${conflictNote}`,
    confirmLabel: 'Close without saving (discard my unsaved edits)',
    cancelLabel: 'Cancel (keep the file open)',
    destroys: 'my-edits',
    doomed: [tab],
  };
}

/**
 * Wording for a close that takes several tabs at once.
 *
 * The count is in the title and in the button, because "close all" with three
 * dirty tabs among twelve is a different decision from "close all" with one, and
 * the user cannot see how many are dirty from the gesture they just made. The
 * files themselves are listed in `doomed` so the dialog can name them: a count
 * tells you how much you are about to lose, a list tells you whether you care.
 */
function multiTabPrompt(scope: CloseScope, doomed: DoomedTab[]): ClosePrompt {
  const count = doomed.length;
  const onlyCopies = doomed.filter((tab) => tab.reason === 'only-copy');
  const destroys = worstCasualty(doomed);

  const noun = `${count} files`;

  if (onlyCopies.length > 0) {
    const plural = onlyCopies.length === 1 ? 'file' : 'files';
    return {
      scope,
      title: `Close ${noun} without saving?`,
      body:
        `${count} open files have unsaved edits that exist nowhere else. ` +
        `${onlyCopies.length} of them ${onlyCopies.length === 1 ? 'was' : 'were'} deleted on disk, ` +
        `so ${onlyCopies.length === 1 ? 'its tab holds' : 'their tabs hold'} the only copy left.`,
      confirmLabel:
        `Close ${noun} without saving (discard all unsaved edits, including ` +
        `${onlyCopies.length} ${plural} with no copy on disk)`,
      cancelLabel: 'Cancel (keep them open)',
      destroys,
      doomed,
    };
  }

  return {
    scope,
    title: `Close ${noun} without saving?`,
    body:
      `${count} open files have unsaved edits. They exist nowhere else and cannot be ` +
      'recovered once the tabs are closed.',
    confirmLabel: `Close ${noun} without saving (discard all unsaved edits)`,
    cancelLabel: 'Cancel (keep them open)',
    destroys,
    doomed,
  };
}

/** Assembles the prompt for whatever set of tabs would lose work. */
export function buildClosePrompt(scope: CloseScope, doomed: DoomedTab[]): ClosePrompt {
  return doomed.length === 1
    ? singleTabPrompt(scope, doomed[0])
    : multiTabPrompt(scope, doomed);
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * What a close gesture should do.
 *
 * `noop` is separate from `close` so the store does not fire an action for a
 * gesture that would change nothing — and, more usefully, so a stale id is a
 * named outcome with a reason rather than an empty close that happens to be
 * harmless. `closeOtherTabs('unknown-id')` once closed *every* tab; the guard in
 * the store catches that, and `reason: 'unknown-tab'` here means a test can see
 * the request was rejected rather than merely observe that nothing broke.
 */
export type CloseDecision =
  | { decision: 'close'; scope: CloseScope }
  | { decision: 'confirm'; prompt: ClosePrompt }
  | { decision: 'noop'; reason: 'unknown-tab' | 'no-tabs' | 'no-others' };

/** The tabs a scope would actually remove, in strip order. */
export function tabsClosedBy(scope: CloseScope, tabs: readonly ClosableTab[]): ClosableTab[] {
  switch (scope.kind) {
    case 'tab':
      return tabs.filter((tab) => tab.id === scope.tabId);
    case 'others':
      return tabs.filter((tab) => tab.id !== scope.tabId);
    case 'all':
      return [...tabs];
  }
}

/**
 * Decides whether a close gesture needs confirming.
 *
 * The guards mirror the store's, deliberately. The store refuses an unknown id
 * in `closeTab` and `closeOtherTabs`, and if this function did not refuse it too
 * it would open a confirmation dialog for a set of tabs the store would then
 * decline to close — a prompt that destroys nothing and reports success. Worse
 * for `others`: an unknown id makes "all other tabs" mean "all tabs", so
 * confirming would name the wrong casualties.
 */
export function planClose(scope: CloseScope, tabs: readonly ClosableTab[]): CloseDecision {
  if (scope.kind !== 'all' && !tabs.some((tab) => tab.id === scope.tabId)) {
    return { decision: 'noop', reason: 'unknown-tab' };
  }
  if (scope.kind === 'all' && tabs.length === 0) {
    return { decision: 'noop', reason: 'no-tabs' };
  }

  const closing = tabsClosedBy(scope, tabs);
  if (scope.kind === 'others' && closing.length === 0) {
    return { decision: 'noop', reason: 'no-others' };
  }

  const doomed = closing
    .map((tab) => classifyTab(tab))
    .filter((entry): entry is DoomedTab => entry !== null);

  // Nothing would be lost: close now. Confirming here is what trains a user to
  // stop reading confirmations.
  if (doomed.length === 0) return { decision: 'close', scope };

  return { decision: 'confirm', prompt: buildClosePrompt(scope, doomed) };
}

/** The three primitives a decided close is carried out with. */
export interface CloseActions {
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
}

/**
 * Turns a scope into the one call that carries it out.
 *
 * Extracted because two callers need it — the immediate close of a clean tab, and
 * the confirmed close of a dirty one — and a scope that mapped to `closeTab` on
 * one path and `closeAllTabs` on the other would destroy work the prompt never
 * mentioned. One switch means the two cannot diverge, and it is the switch a
 * "confirm, then close the wrong thing" mutation has to go through.
 */
export function applyCloseScope(scope: CloseScope, actions: CloseActions): void {
  switch (scope.kind) {
    case 'tab':
      actions.closeTab(scope.tabId);
      return;
    case 'others':
      actions.closeOtherTabs(scope.tabId);
      return;
    case 'all':
      actions.closeAllTabs();
      return;
  }
}

/**
 * Drops a pending prompt whose subject has changed underneath it.
 *
 * A prompt is a sentence about specific files — "3 files have unsaved edits",
 * plus a list naming them. If one of those tabs is closed or saved by some other
 * path while the dialog is up (a `Ctrl+S`, a reconciliation finishing), the
 * sentence is no longer true, and confirming it would authorise a loss the user
 * was never shown.
 *
 * Implemented by re-planning rather than by checking that the listed ids still
 * exist. Existence is not the only way a prompt goes stale: a tab saved while the
 * dialog was open is still open and no longer has anything to lose. Re-planning
 * catches every such drift using the same code that produced the prompt, so the
 * two cannot disagree.
 *
 * The prompt is dropped rather than silently reworded. Rewriting the sentence and
 * the button under the cursor would change what a click does between the moment
 * the user read it and the moment they clicked.
 */
export function prunePendingClose(
  prompt: ClosePrompt | null,
  tabs: readonly ClosableTab[]
): ClosePrompt | null {
  if (!prompt) return null;

  const replan = planClose(prompt.scope, tabs);
  if (replan.decision !== 'confirm') return null;

  // Compared on `reason` as well as `id`. The same set of tabs can have a
  // *different casualty*: `acknowledgeDiskState` clears a `missing` flag without
  // closing or saving anything, which turns "this tab holds the only copy left"
  // into an ordinary unsaved tab. An id-only comparison would keep the prompt and
  // leave its button claiming to destroy the last copy of a file that has one on
  // disk again — overstating the loss, which erodes the prompt exactly as
  // understating it does.
  const shape = (entries: readonly DoomedTab[]): string =>
    entries.map((entry) => `${entry.id}\u0001${entry.reason}`).join('\u0000');

  if (shape(prompt.doomed) !== shape(replan.prompt.doomed)) return null;

  return prompt;
}
