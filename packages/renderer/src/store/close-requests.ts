/**
 * The guarded close actions, as a slice the store spreads in.
 *
 * WHY THEY ARE NOT WRITTEN INLINE IN `editor-store.ts`
 * ---------------------------------------------------
 * Two reasons, and the second is the real one.
 *
 * The store file has a line budget it was inside before this feature and is inside
 * again with these five actions living here. But moving code to satisfy a lint rule
 * is only worth doing if the seam is real, and this one is: everything here is
 * *policy* — whether a gesture may destroy work, and what the user is asked — while
 * `editor-store.ts` keeps the tab primitives that actually mutate the list.
 * `closeTab` has to stay unguarded, because it is what a confirmation applies once
 * the user has agreed; these are the layer that decides whether it may run at all.
 *
 * The seam also makes the policy testable through a fake host, with no zustand
 * store, no persistence middleware and no React — so a test can assert that a
 * confirmed close calls `closeOtherTabs` with the id the prompt named, rather than
 * inferring it from which tabs are left afterwards.
 */

import {
  applyCloseScope,
  planClose,
  prunePendingClose,
  type ClosableTab,
  type CloseActions,
  type ClosePrompt,
  type CloseScope,
} from './close-confirmation';

/** What the slice needs from the store it lives in. */
export interface CloseRequestHost extends CloseActions {
  getTabs: () => readonly ClosableTab[];
  getPending: () => ClosePrompt | null;
  setPending: (prompt: ClosePrompt | null) => void;
}

/**
 * A state patch, with any pending prompt re-checked against the new tab list.
 *
 * Every mutation that can change what a prompt would destroy goes through this:
 * closing a tab, saving one, adopting the disk version. Writing
 * `pendingClose: prunePendingClose(...)` at each call site works too, but it is a
 * line each author has to remember, and forgetting it leaves a dialog on screen
 * whose button acts on files that have moved on. One helper is one thing to
 * remember, and the type makes the omission visible.
 */
export function withPrunedPrompt<T extends ClosableTab, P extends object>(
  tabs: T[],
  pending: ClosePrompt | null,
  rest: P
): P & { tabs: T[]; pendingClose: ClosePrompt | null } {
  return { ...rest, tabs, pendingClose: prunePendingClose(pending, tabs) };
}

export interface CloseRequestSlice {
  requestCloseTab: (tabId: string) => void;
  requestCloseAllTabs: () => void;
  requestCloseOtherTabs: (tabId: string) => void;
  confirmPendingClose: () => void;
  cancelPendingClose: () => void;
}

export function createCloseRequests(host: CloseRequestHost): CloseRequestSlice {
  /**
   * One implementation of "the user asked to close something".
   *
   * The three `request*` actions are three scopes and no logic. The failure this
   * shape prevents is the one the feature was written for: a close path that
   * decides for itself whether to ask. With the decision in one place, a mutation
   * that removes the confirmation removes it from every gesture at once and cannot
   * hide in the least-used one.
   */
  const request = (scope: CloseScope): void => {
    const decision = planClose(scope, host.getTabs());

    if (decision.decision === 'noop') return;

    if (decision.decision === 'confirm') {
      host.setPending(decision.prompt);
      return;
    }

    // Nothing would be destroyed. Closes immediately: a confirmation here would be
    // friction on the common case, and friction on the common case is how a user
    // learns to dismiss the dialog that matters without reading it.
    applyCloseScope(scope, host);
  };

  return {
    requestCloseTab: (tabId) => request({ kind: 'tab', tabId }),
    requestCloseAllTabs: () => request({ kind: 'all' }),
    requestCloseOtherTabs: (tabId) => request({ kind: 'others', tabId }),

    /**
     * Carries out the close the prompt described.
     *
     * Reads the scope off the pending prompt rather than taking an argument or
     * consulting the focused tab. The dialog is open while the user reads it and
     * focus can move underneath it; a confirm that re-derived its target would
     * discard unsaved work in a file the dialog never mentioned. The scope is the
     * record of what the user was actually asked.
     */
    confirmPendingClose: () => {
      // Re-checked against the tabs as they are *now*, not as they were when the
      // prompt was built. Between the two, a `Ctrl+S` may have saved one of the
      // listed files, or a dismissed conflict flag may have changed what closing
      // one of them costs. Confirming a prompt whose description has stopped being
      // true is how a "yes" aimed at three named files lands on a different set.
      const pending = prunePendingClose(host.getPending(), host.getTabs());
      if (!pending) {
        host.setPending(null);
        return;
      }

      // Cleared first: the close actions below re-enter the store, and leaving a
      // satisfied prompt in place would keep the dialog mounted over an
      // already-closed tab.
      host.setPending(null);

      // The same mapping the unprompted close uses, so a scope cannot mean one
      // thing when nothing is at stake and another once it is.
      applyCloseScope(pending.scope, host);
    },

    /** Dismisses the prompt. Closes nothing, discards nothing. */
    cancelPendingClose: () => host.setPending(null),
  };
}
