/**
 * Keyboard Shortcuts Hook - Global keyboard shortcuts handler
 *
 * The two close shortcuts route through the store's `requestClose*` actions, the
 * same ones the tab strip's close button, middle-click and context menu use.
 *
 * They used to call `window.confirm` here instead, with their own wording
 * (`File "…" has unsaved changes. Close anyway?` and `Some files have unsaved
 * changes. Close all tabs anyway?`). That was replaced rather than kept alongside
 * the dialog, because two confirmations for one decision is worse than either:
 *
 *  - the OK/Cancel buttons of a native `confirm` cannot name what they destroy,
 *    which is the convention the conflict-resolution dialog established and the
 *    only thing that makes a confirmation more than a speed bump;
 *  - `hasUnsavedChanges()` gated the close-all prompt on *any* tab being dirty
 *    and then said "some files", so the user learned neither how many nor which;
 *  - a `confirm` blocks the renderer thread, freezing autosave-on-blur and
 *    reconciliation behind a modal the user may walk away from;
 *  - and a shortcut that asks differently from the button teaches the user that
 *    the answer depends on the gesture.
 */

import { useEffect } from 'react';
import { useEditorStore } from '../store/editor-store';

export const useKeyboardShortcuts = () => {
  const { requestCloseTab, requestCloseAllTabs, getActiveTab } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + W - Close active tab
      if (isCtrlOrCmd && e.key === 'w') {
        e.preventDefault();
        const activeTab = getActiveTab();
        // The dirty check lives in the store, not here. Duplicating it would be a
        // second place for the rule to be true, and the six close paths agreeing
        // is the property worth protecting.
        if (activeTab) requestCloseTab(activeTab.id);
      }

      // Ctrl/Cmd + Shift + W - Close all tabs
      if (isCtrlOrCmd && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        requestCloseAllTabs();
      }

      // Ctrl/Cmd + S is handled in EditorView.tsx
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestCloseTab, requestCloseAllTabs, getActiveTab]);
};
