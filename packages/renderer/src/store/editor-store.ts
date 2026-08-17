/**
 * Editor Store - Zustand state management for editor tabs and files
 *
 * Tabs survive a window reload. What is persisted, and the reasoning behind the
 * trade-offs, is documented in `editor-session.ts`; the short version is that
 * unsaved content is persisted (the store tracks `isDirty`, so those edits exist
 * nowhere else) and every restored tab is reconciled against the filesystem on
 * boot, so a file that changed or vanished in the meantime is reported instead
 * of being silently overwritten or left as a dead tab.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { type ClosePrompt } from './close-confirmation';
import {
  createCloseRequests,
  withPrunedPrompt,
  type CloseRequestSlice,
} from './close-requests';
import { planResolutionPanel } from './conflict-resolution';
import {
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  createIpcDiskReader,
  createSessionStorage,
  reconcileTabs,
  resolveStorageEngine,
  toPersistedSession,
  withRepairedFocus,
  type DiskReader,
  type PersistedSession,
  type TabDiskState,
} from './editor-session';

export interface EditorTab {
  id: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
  isActive: boolean;
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  /**
   * mtime of the file the tab's content was last read from or written to. The
   * reference point for conflict detection: an unsaved tab whose file has a
   * newer mtime was edited elsewhere while we held it.
   */
  baselineMtime?: number;
  /** Result of the last reconciliation against disk. Never persisted. */
  diskState?: TabDiskState;
  /** Set on restore when a dirty tab's content did not fit the storage budget. */
  unsavedContentDropped?: boolean;
}

/** How far along the boot-time restore is. */
export type SessionStatus = 'idle' | 'restoring' | 'restored';

interface EditorState extends CloseRequestSlice {
  tabs: EditorTab[];
  activeTabId: string | null;
  sessionStatus: SessionStatus;
  /**
   * Tab whose resolution dialog is open, or null.
   *
   * Held as an id rather than a copy of the tab so the dialog cannot render a
   * stale snapshot of content that is still being reconciled. Not persisted: a
   * dialog is a thing the user is looking at now, and reopening the app into a
   * modal about a file they may have already fixed elsewhere would be noise.
   */
  conflictDialogTabId: string | null;
  /**
   * The close gesture waiting on the user's answer, or null.
   *
   * Holds the *scope* of the requested close, not just "a dialog is open", so
   * confirming applies the operation the prompt described. A prompt that only
   * remembered "yes" would close whichever tab was focused by the time the user
   * clicked, and the tab focused while a modal is open is not necessarily the one
   * the modal is about.
   *
   * Not persisted: a question about a gesture from a previous session is noise,
   * and reopening the app into a modal offering to discard files the user may
   * have already dealt with elsewhere would be worse than noise.
   */
  pendingClose: ClosePrompt | null;
  // Actions
  openTab: (path: string, content: string, language: string, mtime?: number) => void;
  closeTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;

  // `requestCloseTab` / `requestCloseAllTabs` / `requestCloseOtherTabs`, plus
  // `confirmPendingClose` / `cancelPendingClose` — the close paths every UI
  // gesture goes through, declared in `close-requests.ts`.
  //
  // `closeTab` / `closeAllTabs` / `closeOtherTabs` above remain the unguarded
  // primitives: they are what a confirmation applies once the user has agreed, and
  // what the focus-repair tests drive directly. A view calling one of them instead
  // of its `request*` counterpart destroys unsaved work with no prompt — precisely
  // the bug this feature exists to close.
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean, mtime?: number) => void;
  updateCursorPosition: (tabId: string, line: number, column: number) => void;
  updateScrollPosition: (tabId: string, top: number, left: number) => void;
  getTab: (tabId: string) => EditorTab | undefined;
  getActiveTab: () => EditorTab | undefined;
  hasUnsavedChanges: () => boolean;

  /** Reconciles restored tabs with disk. Called once after rehydration. */
  restoreSession: (reader?: DiskReader | null) => Promise<void>;
  /** Clears a `conflict` / `missing` / `unsaved-lost` flag once acknowledged. */
  acknowledgeDiskState: (tabId: string) => void;

  /** Opens the resolution dialog for a tab that has something to resolve. */
  openConflictDialog: (tabId: string) => void;
  /** Closes the dialog without touching the tab or its flag. */
  closeConflictDialog: () => void;
  /**
   * Replaces a tab's content with the version on disk, discarding unsaved edits.
   * The destructive half of "use the file on disk" — no write to disk happens.
   */
  applyDiskVersion: (tabId: string, content: string, mtime: number) => void;
}

/**
 * What runs once `persist` has put the stored session in place.
 *
 * Exported so the guards can be tested directly. Both are reachable in
 * principle — `persist` types the callback as receiving either a state or an
 * error — but neither can be provoked through this store's own storage, whose
 * `getItem` converts every failure into "no session". Testing the function
 * instead of the wiring is the difference between covering these lines and
 * verifying them.
 */
export function handleRehydrated(state: EditorState | undefined, error?: unknown): void {
  if (error || !state) return;
  void state.restoreSession();
}

export const useEditorStore = create<EditorState>()(
  devtools(
    persist(
      (set, get) => ({
      tabs: [],
      activeTabId: null,
      sessionStatus: 'idle' as SessionStatus,
      conflictDialogTabId: null,
      pendingClose: null,

      openTab: (path, content, language, mtime) => {
        const existingTab = get().tabs.find((tab) => tab.path === path);

        if (existingTab) {
          // Tab already exists, just activate it.
          //
          // Deliberately does NOT refresh content from the incoming read: doing
          // so would discard unsaved edits on a tab the user re-clicked in the
          // explorer. Restoring a session applies the same rule — see
          // `reconcileTabs`, where only clean tabs adopt the disk content.
          set((state) => ({
            tabs: state.tabs.map((tab) =>
              tab.id === existingTab.id
                ? { ...tab, isActive: true }
                : { ...tab, isActive: false }
            ),
            activeTabId: existingTab.id,
          }));
        } else {
          // Create new tab
          const newTab: EditorTab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path,
            content,
            language,
            isDirty: false,
            isActive: true,
            baselineMtime: mtime,
          };

          set((state) => ({
            tabs: [
              ...state.tabs.map((tab) => ({ ...tab, isActive: false })),
              newTab,
            ],
            activeTabId: newTab.id,
          }));
        }
      },

      closeTab: (tabId) => {
        set((state) => {
          const tabIndex = state.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex === -1) return state;

          const newTabs = state.tabs.filter((tab) => tab.id !== tabId);
          let newActiveTabId = state.activeTabId;

          // A dialog open for the tab being closed has to go with it: its
          // actions write to a path by tab id, and applying one to a tab that no
          // longer exists is how a resolution lands on the wrong file.
          const dialogId = state.conflictDialogTabId === tabId ? null : state.conflictDialogTabId;

          // If closing the active tab, select another tab
          // A pending close prompt naming this tab has lost its subject, so
          // `withPrunedPrompt` re-checks it: a question about files that are no
          // longer open must not stay on screen with a button that acts on them.
          if (state.activeTabId === tabId && newTabs.length > 0) {
            // Select the tab to the right, or the last tab if closing the last one
            const nextTab = newTabs[tabIndex] || newTabs[newTabs.length - 1];
            newActiveTabId = nextTab.id;

            return withPrunedPrompt(
              newTabs.map((tab) => ({ ...tab, isActive: tab.id === newActiveTabId })),
              state.pendingClose,
              { activeTabId: newActiveTabId, conflictDialogTabId: dialogId }
            );
          }

          return withPrunedPrompt(newTabs, state.pendingClose, {
            activeTabId: newTabs.length === 0 ? null : newActiveTabId,
            conflictDialogTabId: dialogId,
          });
        });
      },

      closeAllTabs: () => {
        // No tabs left, so no prompt can still be about anything.
        set({ tabs: [], activeTabId: null, conflictDialogTabId: null, pendingClose: null });
      },

      closeOtherTabs: (tabId) => {
        set((state) => {
          // Unknown id is a no-op, as in closeTab. Without this guard the
          // filter kept nothing, so a stale id (a tab closed between render and
          // click) closed *every* tab — discarding unsaved edits — and left
          // `activeTabId` pointing at a tab that was no longer in the list.
          if (!state.tabs.some((tab) => tab.id === tabId)) return state;

          const remaining = state.tabs
            .filter((tab) => tab.id === tabId)
            .map((tab) => ({ ...tab, isActive: true }));

          // Every other tab is gone, so a dialog — resolution or close
          // confirmation — aimed at one of them has no target left.
          return withPrunedPrompt(remaining, state.pendingClose, {
            activeTabId: tabId,
            conflictDialogTabId: state.conflictDialogTabId === tabId ? tabId : null,
          });
        });
      },

      /**
       * The guarded close paths, from `close-requests.ts`.
       *
       * Spread in rather than written here: they are policy over the primitives
       * above, and keeping them in one factory is what stops six gestures from
       * each deciding for themselves whether to ask before destroying work.
       */
      ...createCloseRequests({
        getTabs: () => get().tabs,
        getPending: () => get().pendingClose,
        setPending: (prompt) => set({ pendingClose: prompt }),
        closeTab: (tabId) => get().closeTab(tabId),
        closeOtherTabs: (tabId) => get().closeOtherTabs(tabId),
        closeAllTabs: () => get().closeAllTabs(),
      }),

      setActiveTab: (tabId) => {
        set((state) => {
          // Same guard: focusing an id that is not in `tabs` cleared every
          // `isActive` flag and still set `activeTabId`, so the tab strip
          // highlighted nothing while `getActiveTab()` returned undefined.
          if (!state.tabs.some((tab) => tab.id === tabId)) return state;

          return {
            tabs: state.tabs.map((tab) => ({
              ...tab,
              isActive: tab.id === tabId,
            })),
            activeTabId: tabId,
          };
        });
      },

      updateTabContent: (tabId, content) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, content } : tab
          ),
        }));
      },

      /**
       * `mtime` is the value returned by a successful save. Passing it moves the
       * conflict-detection baseline forward, so the version just written is what
       * the next boot compares against; without it, a saved tab would be
       * reported as conflicting with the file it had itself produced.
       */
      markTabDirty: (tabId, isDirty, mtime) => {
        set((state) =>
          // A save landing while a close prompt is up (`Ctrl+S` is not blocked by
          // that dialog) means the prompt now describes a loss that would not
          // happen, so `withPrunedPrompt` drops it.
          withPrunedPrompt(
            state.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    isDirty,
                    baselineMtime: mtime ?? tab.baselineMtime,
                    // A completed save resolves any conflict on that tab: the
                    // user's version is now the one on disk.
                    diskState: mtime === undefined ? tab.diskState : undefined,
                  }
                : tab
            ),
            state.pendingClose,
            {}
          )
        );
      },

      updateCursorPosition: (tabId, line, column) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, cursorPosition: { line, column } }
              : tab
          ),
        }));
      },

      updateScrollPosition: (tabId, top, left) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId
              ? { ...tab, scrollPosition: { top, left } }
              : tab
          ),
        }));
      },

      getTab: (tabId) => {
        return get().tabs.find((tab) => tab.id === tabId);
      },

      getActiveTab: () => {
        const activeTabId = get().activeTabId;
        if (!activeTabId) return undefined;
        return get().tabs.find((tab) => tab.id === activeTabId);
      },

      hasUnsavedChanges: () => {
        return get().tabs.some((tab) => tab.isDirty);
      },

      /**
       * Reconciles the restored tabs against the filesystem.
       *
       * Runs after rehydration rather than during it: rehydration is synchronous
       * (localStorage) and must not be blocked on IPC, so tabs appear
       * immediately with their persisted content and are corrected a moment
       * later. `reader` is injectable for tests; when no preload bridge exists
       * the restore is a no-op and the status still settles, so callers
       * awaiting it never hang.
       */
      restoreSession: async (reader) => {
        const read = reader === undefined ? createIpcDiskReader() : reader;
        const { tabs, activeTabId } = get();

        if (!read || tabs.length === 0) {
          set({ sessionStatus: 'restored' });
          return;
        }

        set({ sessionStatus: 'restoring' });

        const result = await reconcileTabs(tabs, activeTabId, read);

        set({
          tabs: result.tabs,
          activeTabId: result.activeTabId,
          sessionStatus: 'restored',
        });
      },

      acknowledgeDiskState: (tabId) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, diskState: undefined } : tab
          ),
        }));
      },

      /**
       * Opens the resolution dialog, but only for a tab that exists and has
       * something to resolve.
       *
       * Guarded rather than trusting the caller, for the reason `setActiveTab`
       * and `closeOtherTabs` are guarded: an id can go stale between render and
       * click, and a dialog pointed at a missing tab would render a panel with
       * no content and actions that write to `undefined`.
       */
      openConflictDialog: (tabId) => {
        const tab = get().tabs.find((entry) => entry.id === tabId);
        if (!tab) return;
        if (!planResolutionPanel(tab.diskState)) return;
        set({ conflictDialogTabId: tabId });
      },

      closeConflictDialog: () => {
        set({ conflictDialogTabId: null });
      },

      /**
       * Adopts the disk version into a tab: content replaced, dirty cleared,
       * baseline moved to the mtime that content was read at, flag cleared.
       *
       * Nothing is written to disk — that is the point. This is the branch where
       * the user's unsaved edits are deliberately destroyed, and it destroys them
       * *only* in the tab that was named. The `tab.id === tabId` test is the
       * whole safety property: applying this to the wrong tab would discard
       * unsaved work the user never chose to discard, on a file they were not
       * even looking at.
       */
      applyDiskVersion: (tabId, content, mtime) => {
        set((state) =>
          // The tab just adopted the disk version, so it has no unsaved edits left
          // to warn about and any prompt saying otherwise is dropped.
          withPrunedPrompt(
            state.tabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    content,
                    isDirty: false,
                    baselineMtime: mtime,
                    diskState: undefined,
                    unsavedContentDropped: false,
                  }
                : tab
            ),
            state.pendingClose,
            {}
          )
        );
      },
    }),
      {
        name: SESSION_STORAGE_KEY,
        version: SESSION_VERSION,
        storage: createSessionStorage(resolveStorageEngine()),

        // Only the session is persisted: actions are recreated by `create`, and
        // `sessionStatus` describes this boot, not the previous one.
        partialize: (state) =>
          toPersistedSession(state.tabs, state.activeTabId) as unknown as EditorState,

        /**
         * Rebuilds live tabs from the persisted shape.
         *
         * `content: null` means the content did not fit the storage budget. For a
         * clean tab that is harmless — reconciliation refills it from disk. For a
         * dirty tab the edits are gone, and `unsavedContentDropped` carries that
         * fact to `reconcileTabs`, which turns it into a visible `unsaved-lost`
         * state rather than a tab that silently shows the disk version as if
         * nothing had happened.
         */
        merge: (persisted, current) => {
          const session = persisted as PersistedSession | undefined;
          if (!session || !Array.isArray(session.tabs)) return current;

          const restored: EditorTab[] = session.tabs.map((tab) => ({
            id: tab.id,
            path: tab.path,
            language: tab.language,
            content: tab.content ?? '',
            isDirty: tab.isDirty && tab.content !== null,
            isActive: tab.isActive,
            cursorPosition: tab.cursorPosition,
            scrollPosition: tab.scrollPosition,
            baselineMtime: tab.baselineMtime,
            unsavedContentDropped: tab.isDirty && tab.content === null,
          }));

          const repaired = withRepairedFocus(restored, session.activeTabId);

          return {
            ...current,
            tabs: repaired.tabs,
            activeTabId: repaired.activeTabId,
          };
        },

        /**
         * Kicks off reconciliation once the persisted state is in place.
         *
         * `persist` rehydrates asynchronously with respect to module evaluation,
         * so this callback — not the module body — is the only correct place to
         * read the restored tabs.
         */
        onRehydrateStorage: () => handleRehydrated,
      }
    ),
    { name: 'EditorStore' }
  )
);
