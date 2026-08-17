/**
 * WorkbenchContext - shared shell state: which view is active, which folder is
 * open, and whether the sidebar is showing.
 *
 * The sidebar, the header, the command palette and the status bar all need to
 * read or change this. Passing it down through AppShell as props would mean
 * threading callbacks through every layer, so it lives in one context instead.
 */

import * as React from 'react';

/** Views reachable from the activity bar. */
export type WorkbenchView =
  | 'session'
  | 'explorer'
  | 'search'
  | 'git'
  | 'terminal'
  | 'ai-chat'
  | 'extensions'
  | 'notes'
  | 'plans'
  | 'browser'
  | 'account'
  | 'automations'
  | 'settings'
  | 'security'
  | 'review'
  | 'knowledge';

const WORKSPACE_STORAGE_KEY = 'cortex:workspace-path';
const SIDEBAR_STORAGE_KEY = 'cortex:sidebar-collapsed';

interface WorkbenchContextValue {
  activeView: WorkbenchView;
  setActiveView: (view: WorkbenchView) => void;

  /** Absolute path of the open folder, or null before one is chosen. */
  workspacePath: string | null;
  openWorkspace: (path: string) => void;
  closeWorkspace: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = React.useState<WorkbenchView>('session');

  // Read persisted state during the first render so there's no flash of the
  // welcome screen for users who already have a folder open.
  const [workspacePath, setWorkspacePath] = React.useState<string | null>(() =>
    readStoredString(WORKSPACE_STORAGE_KEY)
  );

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
    () => readStoredString(SIDEBAR_STORAGE_KEY) === 'true'
  );

  const openWorkspace = React.useCallback((path: string) => {
    setWorkspacePath(path);
    writeStored(WORKSPACE_STORAGE_KEY, path);
  }, []);

  const closeWorkspace = React.useCallback(() => {
    setWorkspacePath(null);
    removeStored(WORKSPACE_STORAGE_KEY);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      writeStored(SIDEBAR_STORAGE_KEY, String(!prev));
      return !prev;
    });
  }, []);

  const setSidebarCollapsedPersisted = React.useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    writeStored(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, []);

  const value = React.useMemo<WorkbenchContextValue>(
    () => ({
      activeView,
      setActiveView,
      workspacePath,
      openWorkspace,
      closeWorkspace,
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed: setSidebarCollapsedPersisted,
    }),
    [
      activeView,
      workspacePath,
      openWorkspace,
      closeWorkspace,
      sidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsedPersisted,
    ]
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const context = React.useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useWorkbench must be used within WorkbenchProvider');
  }
  return context;
}

// localStorage access is wrapped because it throws in a few real situations
// (disabled storage, quota exceeded), and losing a UI preference should never
// take down the whole shell.

function readStoredString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference simply won't persist.
  }
}

function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
