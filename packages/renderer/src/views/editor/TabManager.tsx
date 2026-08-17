/**
 * TabManager - Manages editor tabs with close actions and dirty state
 */

import React from 'react';
import { useEditorStore, type EditorTab } from '../../store/editor-store';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * How a reconciled-with-disk tab explains itself.
 *
 * A conflict that is detected but never shown is not reported, so each state the
 * store can produce after a session restore has a label here. `clean` and
 * `undefined` render nothing.
 */
const DISK_STATE_LABEL: Record<string, string> = {
  // No longer says "saving overwrites the version on disk": it does not any
  // more. `Ctrl+S` on a conflicting tab opens the resolution dialog instead, and
  // a tooltip describing the old behaviour would be worse than none — it would
  // tell the user the one thing about this feature that is no longer true.
  conflict:
    'This file changed on disk while your unsaved edits were stored. Click to compare both versions and choose which one to keep.',
  missing:
    'This file no longer exists on disk. Your unsaved edits are the only copy left. Click to review your options.',
  'unsaved-lost':
    'Unsaved edits for this file were too large to store and could not be restored. The version shown is the one on disk. Click for details.',
};

function diskStateLabel(tab: EditorTab): string | null {
  return tab.diskState ? DISK_STATE_LABEL[tab.diskState] ?? null : null;
}

export const TabManager: React.FC = () => {
  const {
    tabs,
    setActiveTab,
    openConflictDialog,
    requestCloseTab,
    requestCloseAllTabs,
    requestCloseOtherTabs,
  } = useEditorStore();

  /**
   * The tab whose context menu is open, or null.
   *
   * Anchored to a tab id rather than to coordinates alone so the menu's items act
   * on the tab that was right-clicked even if the strip re-renders underneath it
   * — "close other tabs" aimed at the wrong anchor closes the wrong files.
   */
  const [menu, setMenu] = React.useState<{ tabId: string; x: number; y: number } | null>(null);

  const handleTabClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tabId);
  };

  /**
   * Opens the resolution dialog from the warning indicator.
   *
   * Focuses the tab as well as opening the dialog: the dialog shows one tab's
   * comparison, and leaving the strip highlighting a different tab while a modal
   * discusses this one is how a resolution gets applied to the wrong file in the
   * user's head, if not in the code.
   */
  const handleResolveClick = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tabId);
    openConflictDialog(tabId);
  };

  /**
   * Every close gesture goes through `requestClose*`, never the raw store action.
   *
   * The raw `closeTab` still exists and still discards unsaved edits with no
   * prompt — it is what the confirmation applies once the user has agreed. A view
   * calling it directly is the bug this whole change exists to fix, so it is not
   * destructured here at all: reintroducing that call means adding it back to the
   * import list, which is visible in review.
   */
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    requestCloseTab(tabId);
  };

  const handleMiddleClick = (tabId: string, e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      requestCloseTab(tabId);
    }
  };

  /**
   * Right-click opens a menu. It used to close the tab.
   *
   * Not "close the tab, but ask first" — a right-click is how you *inspect*
   * something, and no editor on earth treats it as a destructive gesture. Even
   * with a confirmation, a right-click that pops up a modal about discarding work
   * is startling. So the menu the old `TODO` described is here, and closing is one
   * of its items: an explicit choice, made after the menu is open.
   */
  const handleContextMenu = (tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTab(tabId);
    setMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenu(null);

  /** Runs a menu item's action and dismisses the menu. */
  const runFromMenu = (action: () => void) => {
    closeMenu();
    action();
  };

  const getFileName = (path: string): string => {
    return path.split('/').pop() || path;
  };

  /**
   * Dismisses the menu on Escape or on any click outside it.
   *
   * `mousedown` rather than `click`: a menu that survives until mouseup can have
   * an item land under the pointer as the strip reflows, and a menu item that
   * closes tabs is not one to be casual about.
   */
  React.useEffect(() => {
    if (!menu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-testid="tab-context-menu"]')) return;
      setMenu(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [menu]);

  // The menu closes with the tab it is anchored to: leaving it open would leave
  // "Close other tabs" pointing at an id the store would reject.
  React.useEffect(() => {
    if (menu && !tabs.some((tab) => tab.id === menu.tabId)) setMenu(null);
  }, [menu, tabs]);

  if (tabs.length === 0) {
    return (
      <div className="h-10 bg-background border-b border-border flex items-center px-4 text-sm text-muted-foreground">
        No files open
      </div>
    );
  }

  return (
    <div className="h-10 bg-background border-b border-border flex items-center overflow-x-auto scrollbar-thin">
      <div className="flex items-center h-full">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'group relative flex items-center gap-2 px-3 h-full border-r border-border',
              'cursor-pointer select-none transition-colors',
              'hover:bg-accent/50',
              tab.isActive && 'bg-accent border-b-2 border-b-primary'
            )}
            onClick={(e) => handleTabClick(tab.id, e)}
            onMouseDown={(e) => handleMiddleClick(tab.id, e)}
            onContextMenu={(e) => handleContextMenu(tab.id, e)}
            data-testid="editor-tab"
            // `EditorTab` has no `name` field — this read `tab.name` and was the
            // last type error outside test files.
            //
            // Basename, not the full path, for three reasons:
            //   1. it is what the tab actually shows (`getFileName(tab.path)`
            //      below), so the attribute and the label cannot drift apart;
            //   2. it matches the sibling explorer attribute, which is the only
            //      `data-filename` any page object looks a file up by:
            //      `EditorPage.fileItem(filename)` targets
            //      `[data-testid="file-item"][data-filename="..."]`, and
            //      FileExplorer sets that from `node.data.name` — a basename.
            //      The E2E specs pass basenames (`openFile('file1.ts')`);
            //   3. GitPanel's `data-filename` is a repo-relative path, but for a
            //      different job: git status is path-keyed and two files with the
            //      same basename must be stageable independently.
            //
            // No page object reads `data-filename` off `editor-tab` today
            // (EditorPage addresses tabs by index), so nothing here changes an
            // existing selector. `data-filepath` is exposed alongside so a future
            // selector can disambiguate two open files sharing a basename without
            // having to redefine this one.
            data-filename={getFileName(tab.path)}
            data-filepath={tab.path}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <div
                className="w-2 h-2 rounded-full bg-primary"
                title="Unsaved changes"
                data-testid="modified-indicator"
              />
            )}

            {/*
              Session-restore outcome. Rendered as a real element with an
              accessible name rather than only a colour so it is reachable by a
              screen reader and by a test.
            */}
            {diskStateLabel(tab) && (
              // A button, not decoration. Opening the resolution dialog from here
              // means the user can compare and choose *without first attempting
              // an overwrite* — the save path reaches the same dialog, but only
              // after a keystroke whose documented meaning is "write this to
              // disk". Offering the safe entry point matters more than the
              // convenient one.
              //
              // The wrapper carries `title`: lucide icons do not accept one, and
              // silently dropping it would leave the warning unexplained.
              <button
                type="button"
                title={diskStateLabel(tab) ?? undefined}
                className="flex-shrink-0 inline-flex rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="disk-state-indicator"
                data-disk-state={tab.diskState}
                onClick={(e) => handleResolveClick(tab.id, e)}
              >
                <AlertTriangle
                  className="w-3.5 h-3.5 text-amber"
                  role="img"
                  aria-label={diskStateLabel(tab) ?? undefined}
                />
              </button>
            )}
            
            {/* File name */}
            <span className="text-sm font-medium whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
              {getFileName(tab.path)}
            </span>

            {/* Close button */}
            <button
              className={cn(
                'p-0.5 rounded hover:bg-background/80 transition-opacity',
                'opacity-0 group-hover:opacity-100',
                tab.isActive && 'opacity-100'
              )}
              onClick={(e) => handleCloseTab(tab.id, e)}
              title="Close (Ctrl+W)"
              data-testid="tab-close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/*
        The context menu the old `TODO` promised, replacing the right-click that
        simply closed the tab.

        Plain elements rather than a Radix menu primitive: `@radix-ui/react-context-menu`
        is not a dependency of this package, and adding one to render three buttons
        at a click position would be a new install for markup that fits here. The
        items are real `<button>`s, so they are focusable and keyboard-operable.
      */}
      {menu && (
        <div
          role="menu"
          aria-label="Tab actions"
          className="fixed z-modal min-w-[15rem] rounded-md border border-border bg-elevated p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          data-testid="tab-context-menu"
          data-tab-id={menu.tabId}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left text-sm px-2 py-1.5 rounded-xs hover:bg-tint focus-visible:outline-none focus-visible:bg-tint"
            onClick={() => runFromMenu(() => requestCloseTab(menu.tabId))}
            data-testid="tab-menu-close"
          >
            Close
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left text-sm px-2 py-1.5 rounded-xs hover:bg-tint focus-visible:outline-none focus-visible:bg-tint disabled:opacity-50"
            // Nothing to close: with one tab open, "close others" is a no-op, and
            // the store would refuse it anyway.
            disabled={tabs.length < 2}
            onClick={() => runFromMenu(() => requestCloseOtherTabs(menu.tabId))}
            data-testid="tab-menu-close-others"
          >
            Close other tabs
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left text-sm px-2 py-1.5 rounded-xs hover:bg-tint focus-visible:outline-none focus-visible:bg-tint"
            onClick={() => runFromMenu(() => requestCloseAllTabs())}
            data-testid="tab-menu-close-all"
          >
            Close all tabs
          </button>
        </div>
      )}
    </div>
  );
};
