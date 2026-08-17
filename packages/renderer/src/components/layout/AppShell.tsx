/**
 * AppShell - the workbench frame: header, activity bar, sidebar, main area,
 * status bar.
 *
 * Everything here is chrome. It owns no view logic; the caller supplies the
 * sidebar panel and main content, and this arranges them and handles the
 * layout-level shortcuts (Cmd+B).
 */

import * as React from 'react';
import { PanelLeftClose, PanelLeftOpen, Sparkles, Bug, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Hint } from '../ui/tooltip';
import { ThemeToggle } from '../ui/theme-switcher';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { useDebug } from '../../contexts/DebugContext';
import { VIEW_BY_ID, VIEWS, formatShortcut } from './views';

export interface AppShellProps {
  /** Panel rendered inside the sidebar, beside the activity bar. */
  sidebar?: React.ReactNode;
  /** Primary content area. */
  children: React.ReactNode;
  /** Left-hand status bar content; the right-hand side is owned by the shell. */
  statusBar?: React.ReactNode;
  /** Opens the command palette from the header search affordance. */
  onOpenCommandPalette?: () => void;
}

export function AppShell({
  sidebar,
  children,
  statusBar,
  onOpenCommandPalette,
}: AppShellProps) {
  const { sidebarCollapsed, toggleSidebar } = useWorkbench();

  // Cmd/Ctrl+B toggles the sidebar, matching the convention in every other
  // editor. Registered here because the shell owns the sidebar's visibility.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="h-screen w-screen flex flex-col bg-page text-text overflow-hidden">
      <AppHeader onOpenCommandPalette={onOpenCommandPalette} />

      <div className="flex-1 flex min-h-0">
        <ActivityBar />

        {/* Sidebar. Width animates to 0 rather than unmounting, so the panel
            keeps its scroll position and state across collapse/expand. */}
        <aside
          className={cn(
            'border-r border-border bg-wash flex-shrink-0 overflow-hidden transition-[width]',
            sidebarCollapsed ? 'w-0 border-r-0' : 'w-[320px]'
          )}
          aria-label="Sidebar"
          aria-hidden={sidebarCollapsed}
          data-testid="sidebar-panel"
        >
          <div className="h-full w-[320px] flex flex-col min-h-0">{sidebar}</div>
        </aside>

        <main
          className="flex-1 min-w-0 overflow-hidden bg-page"
          aria-label="Main content"
          data-testid="content-area"
        >
          {children}
        </main>
      </div>

      <StatusBar>{statusBar}</StatusBar>
    </div>
  );
}

/**
 * ActivityBar - the icon rail that switches views.
 *
 * Carries `data-testid="sidebar"`, which the E2E suite treats as the anchor for
 * "workspace is ready".
 */
function ActivityBar() {
  const { activeView, setActiveView, sidebarCollapsed, setSidebarCollapsed } = useWorkbench();

  const primary = VIEWS.filter((view) => view.group === 'primary');
  const secondary = VIEWS.filter((view) => view.group === 'secondary');

  const handleSelect = (viewId: typeof activeView) => {
    // Clicking the active icon collapses the sidebar; clicking any other
    // reveals it. Without this, selecting a view while collapsed appears to do
    // nothing at all.
    if (viewId === activeView) {
      setSidebarCollapsed(!sidebarCollapsed);
      return;
    }

    setActiveView(viewId);
    setSidebarCollapsed(false);
  };

  return (
    <nav
      className="w-12 flex-shrink-0 border-r border-border bg-elevated flex flex-col items-center py-2 gap-1"
      aria-label="Primary navigation"
      data-testid="sidebar"
    >
      {primary.map((view) => (
        <ActivityBarButton
          key={view.id}
          view={view}
          isActive={activeView === view.id}
          onSelect={handleSelect}
        />
      ))}

      <div className="flex-1" />

      {secondary.map((view) => (
        <ActivityBarButton
          key={view.id}
          view={view}
          isActive={activeView === view.id}
          onSelect={handleSelect}
        />
      ))}
    </nav>
  );
}

function ActivityBarButton({
  view,
  isActive,
  onSelect,
}: {
  view: (typeof VIEWS)[number];
  isActive: boolean;
  onSelect: (id: (typeof VIEWS)[number]['id']) => void;
}) {
  const Icon = view.icon;
  const shortcut = formatShortcut(view.shortcut);

  return (
    <Hint content={shortcut ? `${view.label} (${shortcut})` : view.label} side="right">
      <button
        type="button"
        onClick={() => onSelect(view.id)}
        // Icon-only control: the label lives in aria-label, and aria-current
        // tells assistive tech which view is showing rather than relying on colour.
        aria-label={view.label}
        aria-current={isActive ? 'page' : undefined}
        data-testid={view.testId}
        className={cn(
          'relative w-10 h-10 rounded-sm flex items-center justify-center transition-colors',
          isActive ? 'text-accent bg-accent-soft' : 'text-text-secondary hover:text-text hover:bg-tint'
        )}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />

        {/* Active marker that survives colour-blindness and high-contrast modes. */}
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
      </button>
    </Hint>
  );
}

function AppHeader({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const { workspacePath, sidebarCollapsed, toggleSidebar, setActiveView } = useWorkbench();
  const { enabled: debugEnabled, toggleDebugMode } = useDebug();

  const workspaceName = workspacePath ? basename(workspacePath) : 'No folder open';

  return (
    <header
      className="h-12 flex-shrink-0 border-b border-border bg-elevated flex items-center gap-3 px-3"
      role="banner"
      data-testid="app-header"
    >
      <Hint content={`${sidebarCollapsed ? 'Show' : 'Hide'} sidebar (${formatShortcut('Cmd+B')})`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-expanded={!sidebarCollapsed}
          data-testid="toggle-sidebar"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
          )}
        </Button>
      </Hint>

      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-6 h-6 rounded-sm bg-accent text-white flex items-center justify-center text-xs font-semibold flex-shrink-0"
          aria-hidden="true"
        >
          C
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-none truncate">Cortex IDE</h1>
          <p className="text-xs text-text-tertiary leading-none mt-0.5 truncate" title={workspacePath ?? undefined}>
            {workspaceName}
          </p>
        </div>
      </div>

      {/* Command palette entry point. A visible affordance matters because
          Cmd+P is undiscoverable on its own. */}
      <div className="flex-1 flex justify-center px-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full max-w-md h-7 flex items-center gap-2 px-3 rounded-sm border border-border bg-wash text-xs text-text-tertiary hover:bg-tint hover:text-text-secondary transition-colors"
          data-testid="command-palette-trigger"
        >
          <span className="flex-1 text-left">Search files and commands</span>
          <kbd className="px-1.5 py-0.5 rounded-xs border border-border bg-elevated text-[10px] font-sans">
            {formatShortcut('Cmd+P')}
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Hint content={`Ask AI (${formatShortcut('Cmd+L')})`}>
          <Button size="sm" onClick={() => setActiveView('ai-chat')} data-testid="ask-ai">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            Ask AI
          </Button>
        </Hint>

        <ThemeToggle />

        <Hint content={`Settings (${formatShortcut('Cmd+,')})`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('settings')}
            aria-label="Open settings"
            data-testid="open-settings"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </Button>
        </Hint>

        <Hint content={debugEnabled ? 'Disable debug mode' : 'Enable debug mode'}>
          <Button
            variant={debugEnabled ? 'secondary' : 'ghost'}
            size="icon"
            onClick={toggleDebugMode}
            aria-label={debugEnabled ? 'Disable debug mode' : 'Enable debug mode'}
            aria-pressed={debugEnabled}
            data-testid="toggle-debug"
          >
            <Bug className="w-4 h-4" aria-hidden="true" />
          </Button>
        </Hint>
      </div>
    </header>
  );
}

function StatusBar({ children }: { children?: React.ReactNode }) {
  const { activeView, workspacePath } = useWorkbench();

  return (
    <footer
      className="h-6 flex-shrink-0 border-t border-border bg-elevated px-3 flex items-center justify-between text-xs text-text-secondary"
      // A status bar reports state that changes without user action, so
      // announce updates politely rather than on focus.
      role="status"
      aria-live="polite"
      data-testid="status-bar"
    >
      <div className="flex items-center gap-4 min-w-0">{children}</div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <span>{VIEW_BY_ID[activeView]?.label}</span>
        {workspacePath && (
          <span className="truncate max-w-[280px]" title={workspacePath}>
            {workspacePath}
          </span>
        )}
      </div>
    </footer>
  );
}

/** Last path segment, for showing a folder name instead of a full path. */
function basename(path: string): string {
  const segments = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return segments[segments.length - 1] || path;
}
