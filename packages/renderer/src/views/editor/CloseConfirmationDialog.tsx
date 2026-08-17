/**
 * CloseConfirmationDialog — the friction that closing a dirty tab was missing.
 *
 * WHY THIS IS NOT `ConflictResolutionDialog`
 * ------------------------------------------
 * The instinct is to reuse it: it is right there, it already renders a title, a
 * body, and buttons that name what they destroy. It was the wrong trade, for
 * three reasons.
 *
 *  1. **It is built around one tab.** It subscribes to `conflictDialogTabId`,
 *     renders `tab.path` in its header and hands `tab.id` to actions that write
 *     to a single file. "Close all" with three dirty tabs has no single tab, and
 *     giving it one would mean either lying about the scope or bolting a second
 *     mode onto the component whose entire documented value is that its three
 *     panels are *not* interchangeable.
 *  2. **It resolves a three-way choice; this is a two-way one.** A conflict
 *     offers keep-mine / take-disk / cancel, and it exists because those three
 *     outcomes are genuinely different. A close offers close-anyway / cancel.
 *     Rendering two buttons through machinery that disables actions until a diff
 *     has loaded, re-reads disk at click time, and reports five result statuses
 *     would add three failure modes to a dialog that touches no file at all.
 *  3. **It reads from disk.** Closing a tab does not. Wiring a `DiskReader` into
 *     the close path so it could share a component would make an unrelated IPC
 *     round trip a precondition for closing a tab, and give the close path a way
 *     to fail on a permission error.
 *
 * WHY NOT `window.confirm`
 * ------------------------
 * That was the other candidate — and it is what `use-keyboard-shortcuts.ts`
 * already used for `Ctrl+W`, with the message
 * `File "…" has unsaved changes. Close anyway?`. It is rejected for reasons that
 * are specific rather than aesthetic:
 *
 *  - **Its buttons are "OK" and "Cancel", and nothing can change that.** The
 *    convention this feature inherits from conflict resolution is that a
 *    destructive button names its casualty in the label. `confirm` cannot; the
 *    consequence lives only in the prose, where a user who reads three words and
 *    clicks never meets it.
 *  - **No `data-destroys`.** A swapped pair of buttons is the mutation this
 *    feature most needs a test to catch. With a native `confirm` the only
 *    observable is the message string, so an inversion of which answer destroys
 *    work is invisible to a test.
 *  - **It cannot list the casualties.** "Close all" needs to name three files;
 *    `confirm` gets one string and no structure.
 *  - **It blocks the renderer thread**, so autosave-on-blur and reconciliation
 *    callbacks freeze behind a modal the user may leave sitting there.
 *
 * So: same conventions as the conflict dialog, same primitives, same
 * `data-destroys` contract — a separate, smaller component. Reusing the richer
 * one by principle would have been the bad trade.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * The destructive action is not the default. Escape, the overlay, and the
 * dialog's own X all cancel, and autofocus is on Cancel, so the reflex gesture
 * for dismissing a modal keeps the file open. The user has to aim at the
 * destructive button to lose anything.
 */

import React from 'react';

import { DOOMED_REASON_TEXT } from '../../store/close-confirmation';
import { useEditorStore } from '../../store/editor-store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

export const CloseConfirmationDialog: React.FC = () => {
  const pending = useEditorStore((state) => state.pendingClose);
  const confirmPendingClose = useEditorStore((state) => state.confirmPendingClose);
  const cancelPendingClose = useEditorStore((state) => state.cancelPendingClose);

  if (!pending) return null;

  return (
    <Dialog
      open
      onOpenChange={() => {
        // Every dismissal that is not the destructive button is a cancel:
        // Escape, the overlay, the X in the corner. A modal that discards work
        // when dismissed the way every other modal is dismissed is a trap.
        //
        // Unconditional, with no `if (!next)` guard: `open` is hardcoded true and
        // no `DialogTrigger` is rendered, so Radix has no way to report an
        // *opening*. A guard would be an untestable branch, and if some future
        // version did report one, cancelling is the harmless direction to fail in.
        cancelPendingClose();
      }}
    >
      <DialogContent
        className="max-w-xl"
        data-testid="close-confirm-dialog"
        data-scope={pending.scope.kind}
        data-destroys={pending.destroys}
        data-doomed-count={pending.doomed.length}
      >
        <DialogHeader>
          <DialogTitle data-testid="close-confirm-title">{pending.title}</DialogTitle>
          <DialogDescription data-testid="close-confirm-body">{pending.body}</DialogDescription>
        </DialogHeader>

        {/*
          The files themselves, not only a count. A count says how much is about
          to be lost; the list is what lets the user notice that one of the three
          is the file they spent the morning on.
        */}
        {pending.doomed.length > 1 && (
          <ul className="max-h-48 overflow-y-auto flex flex-col gap-2" data-testid="close-confirm-list">
            {pending.doomed.map((tab) => (
              <li
                key={tab.id}
                className="text-sm"
                data-testid="close-confirm-doomed"
                data-doomed-reason={tab.reason}
                // Full path, matching what the row displays. A `data-filename`
                // here would name something this dialog does not show — the same
                // drift `TabManager`'s attribute test exists to prevent.
                data-filepath={tab.path}
              >
                <span className="font-mono text-xs" title={tab.path}>
                  {tab.path}
                </span>
                <span className="block text-xs text-text-secondary">
                  {DOOMED_REASON_TEXT[tab.reason]}
                </span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2">
          {/*
            Cancel is rendered first and autofocused: it is the non-destructive
            answer, and in a dialog the user did not ask for, the button their
            hands reach for first must be the one that keeps their work.
          */}
          <Button
            variant="outline"
            size="sm"
            autoFocus
            onClick={cancelPendingClose}
            data-testid="close-confirm-cancel"
            data-destroys="nothing"
          >
            {pending.cancelLabel}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmPendingClose}
            data-testid="close-confirm-accept"
            data-destroys={pending.destroys}
          >
            {pending.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CloseConfirmationDialog;
