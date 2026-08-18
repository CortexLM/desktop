/**
 * Workbench - routes the active view into the AppShell's sidebar and main area.
 *
 * Views split into two kinds, following the convention of every editor:
 *  - sidebar views (explorer, search, source control) fill the sidebar and
 *    leave the editor in the main area, so you can browse files while editing.
 *  - document views (terminal, chat, settings, ...) take over the main area and
 *    leave whichever sidebar view you last used in place.
 *
 * Every view is code-split. The editor pulls in Monaco and the terminal pulls
 * in xterm, which together dominate the bundle; loading them on demand keeps
 * them out of startup for users who never open those views.
 */

import * as React from 'react';
import {
  FileQuestion,
  Folder,
  GitBranch,
  MessageSquarePlus,
  Search as SearchIcon,
} from 'lucide-react';
import { AppShell } from './AppShell';
import { CortexCodeShell } from '../cortex/CortexCodeShell';
import { VIEW_BY_ID, lazyNamed } from './views';
import { EmptyState, ErrorState } from '../EmptyState';
import { Spinner } from '../ui/spinner';
import { Button } from '../ui/button';
import { useWorkbench, type WorkbenchView } from '../../contexts/WorkbenchContext';
import { useDebug } from '../../contexts/DebugContext';
import { useErrorHandler } from '../../hooks/use-error-handler';
import { useEditorStore } from '../../store/editor-store';
import { ipc } from '../../lib/api';
import type { Automation } from '@cortex-ide/shared';

// --- Lazily loaded views -----------------------------------------------------

const EditorView = lazyNamed(() => import('../../views/editor/EditorView'), 'EditorView');
const FileExplorer = lazyNamed(() => import('../../views/editor/FileExplorer'), 'FileExplorer');
const GitPanel = lazyNamed(() => import('../../views/workspace/GitPanel'), 'GitPanel');
const AdvancedSearchPanel = lazyNamed(
  () => import('../search/AdvancedSearchPanel'),
  'AdvancedSearchPanel'
);
const TerminalGrid = lazyNamed(() => import('../../views/workspace/TerminalGrid'), 'TerminalGrid');
const ChatView = lazyNamed(() => import('../../views/agents/ChatView'), 'ChatView');
const SessionList = lazyNamed(() => import('../../views/agents/SessionList'), 'SessionList');
const MCPExtensions = lazyNamed(() => import('../../views/extensions/MCPExtensions'), 'MCPExtensions');
const NotesView = lazyNamed(() => import('../../views/workspace/NotesView'), 'NotesView');
const PlansView = lazyNamed(() => import('../../views/workspace/PlansView'), 'PlansView');
const BrowserView = lazyNamed(() => import('../../views/workspace/BrowserView'), 'BrowserView');
const ProfileView = lazyNamed(() => import('../../views/account/ProfileView'), 'ProfileView');
const TeamView = lazyNamed(() => import('../../views/account/TeamView'), 'TeamView');
const BillingView = lazyNamed(() => import('../../views/account/BillingView'), 'BillingView');
const AutomationList = lazyNamed(
  () => import('../../views/automations/AutomationList'),
  'AutomationList'
);
const AutomationEditor = lazyNamed(
  () => import('../../views/automations/AutomationEditor'),
  'AutomationEditor'
);
const LogsViewer = lazyNamed(
  () => import('../../views/automations/LogsViewer'),
  'LogsViewer'
);
const SettingsView = lazyNamed(() => import('../../views/settings/SettingsView'), 'SettingsView');
const DebugPanel = lazyNamed(() => import('../../views/debug/DebugPanel'), 'DebugPanel');
const SecurityView = lazyNamed(() => import('../../views/security/SecurityView'), 'SecurityView');
const ReviewView = lazyNamed(() => import('../../views/review/ReviewView'), 'ReviewView');
const KnowledgeView = lazyNamed(() => import('../../views/knowledge/KnowledgeView'), 'KnowledgeView');
const MissionsView = lazyNamed(() => import('../../views/missions/MissionsView'), 'MissionsView');

/** Views that render into the sidebar rather than taking over the main area. */
const SIDEBAR_VIEWS = new Set<WorkbenchView>(['explorer', 'search', 'git']);

/**
 * Testid for the main-area wrapper.
 *
 * Sidebar views leave the editor in the main area, so their panel testid
 * belongs to the sidebar; the main area is just the editor.
 */
function mainAreaTestId(view: WorkbenchView): string {
  return SIDEBAR_VIEWS.has(view) ? 'editor-area' : VIEW_BY_ID[view].panelTestId;
}

export interface WorkbenchProps {
  onOpenCommandPalette?: () => void;
}

export function Workbench({ onOpenCommandPalette }: WorkbenchProps) {
  const { activeView, workspacePath } = useWorkbench();
  const { showDebugPanel, setShowDebugPanel } = useDebug();
  const tabs = useEditorStore((state) => state.tabs);

  // Remember the last sidebar view so opening the terminal (a document view)
  // doesn't blank the sidebar out.
  const [lastSidebarView, setLastSidebarView] = React.useState<WorkbenchView>('explorer');

  React.useEffect(() => {
    if (SIDEBAR_VIEWS.has(activeView)) setLastSidebarView(activeView);
  }, [activeView]);

  const sidebarView = SIDEBAR_VIEWS.has(activeView) ? activeView : lastSidebarView;

  if (activeView === 'session') {
    return <CortexCodeShell onOpenCommandPalette={onOpenCommandPalette} />;
  }

  return (
    <AppShell
      onOpenCommandPalette={onOpenCommandPalette}
      sidebar={
        <SidebarPanel view={sidebarView} workspacePath={workspacePath} />
      }
      statusBar={<WorkbenchStatus openTabCount={tabs.length} />}
    >
      <div className="h-full flex flex-col min-h-0">
        {/* The panel's testid lives on this wrapper, outside the boundary, so
            the panel keeps its identity even when the view inside it fails to
            render. Putting it on the view itself meant a crashing view removed
            the very element that identifies the panel. */}
        <div className="flex-1 min-h-0" data-testid={mainAreaTestId(activeView)}>
          <ViewBoundary viewKey={activeView}>
            <MainArea view={activeView} workspacePath={workspacePath} />
          </ViewBoundary>
        </div>

        {/* Debug panel docks under whatever view is open, so you can watch IPC
            traffic while using the feature that produces it. */}
        {showDebugPanel && (
          <div className="h-1/3 min-h-[200px] border-t border-border" data-testid="debug-panel">
            <ViewBoundary viewKey="debug">
              <DebugPanel onClose={() => setShowDebugPanel(false)} />
            </ViewBoundary>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// --- Sidebar -----------------------------------------------------------------

function SidebarPanel({
  view,
  workspacePath,
}: {
  view: WorkbenchView;
  workspacePath: string | null;
}) {
  const definition = VIEW_BY_ID[view];

  return (
    <>
      <div className="h-9 flex-shrink-0 border-b border-border px-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {definition?.label}
        </h2>
      </div>

      {/* testid outside the boundary, so the panel is still identifiable if the
          view inside it fails. */}
      <div
        className="flex-1 min-h-0 overflow-auto scrollbar-thin"
        data-testid={definition?.panelTestId}
      >
        <ViewBoundary viewKey={`sidebar-${view}`}>
          <SidebarContent view={view} workspacePath={workspacePath} />
        </ViewBoundary>
      </div>
    </>
  );
}

function SidebarContent({
  view,
  workspacePath,
}: {
  view: WorkbenchView;
  workspacePath: string | null;
}) {
  if (!workspacePath) {
    return (
      <EmptyState
        icon={<Folder className="w-8 h-8" />}
        title="No folder open"
        description="Open a folder to browse its files, search it, and track changes."
      />
    );
  }

  switch (view) {
    case 'search':
      return (
        <div className="h-full">
          <AdvancedSearchPanel workspacePath={workspacePath} />
        </div>
      );

    case 'git':
      return (
        <div className="h-full">
          <GitPanel repoPath={workspacePath} />
        </div>
      );

    // explorer, and anything else that leaves the last sidebar view in place.
    default:
      return (
        <div className="h-full">
          <FileExplorer workspacePath={workspacePath} />
        </div>
      );
  }
}

// --- Main area ---------------------------------------------------------------

function MainArea({
  view,
  workspacePath,
}: {
  view: WorkbenchView;
  workspacePath: string | null;
}) {
  // Panel testids live on the wrapper in Workbench, not here, so they survive a
  // view that throws.
  switch (view) {
    case 'terminal':
      return (
        <div className="h-full">
          <TerminalGrid />
        </div>
      );

    case 'ai-chat':
      return <AIChatPanel />;

    case 'extensions':
      return (
        <div className="h-full overflow-auto">
          <MCPExtensions />
        </div>
      );

    case 'notes':
      return (
        <div className="h-full">
          <NotesView workspaceId={workspacePath ?? 'default'} />
        </div>
      );

    case 'plans':
      return (
        <div className="h-full">
          <PlansView workspaceId={workspacePath ?? 'default'} />
        </div>
      );

    case 'browser':
      return (
        <div className="h-full">
          <BrowserView />
        </div>
      );

    case 'account':
      return <AccountPanel />;

    case 'automations':
      return <AutomationsPanel workspaceId={workspacePath ?? 'default'} />;

    case 'settings':
      return (
        <div className="h-full overflow-auto">
          <SettingsView />
        </div>
      );

    case 'security':
      return (
        <div className="h-full overflow-auto">
          <SecurityView />
        </div>
      );

    case 'review':
      return (
        <div className="h-full overflow-auto">
          <ReviewView workspacePath={workspacePath} />
        </div>
      );

    case 'knowledge':
      return (
        <div className="h-full overflow-auto">
          <KnowledgeView workspacePath={workspacePath} />
        </div>
      );

    case 'missions':
      return (
        <div className="h-full overflow-auto">
          <MissionsView workspaceId={workspacePath ?? 'default'} />
        </div>
      );

    // explorer / search / git keep the editor in view.
    default:
      return <EditorArea workspacePath={workspacePath} />;
  }
}

function EditorArea({ workspacePath }: { workspacePath: string | null }) {
  const tabs = useEditorStore((state) => state.tabs);
  const { setActiveView } = useWorkbench();

  if (tabs.length === 0) {
    return (
      <EmptyState
        data-testid="editor-empty-state"
        icon={<FileQuestion className="w-8 h-8" />}
        title="No files open"
        description={
          workspacePath
            ? 'Pick a file in the Explorer, or search across the folder to find one.'
            : 'Open a folder to start editing files.'
        }
        action={{
          label: 'Browse files',
          onClick: () => setActiveView('explorer'),
          icon: <Folder className="w-4 h-4" aria-hidden="true" />,
        }}
        secondaryAction={{
          label: 'Search',
          onClick: () => setActiveView('search'),
          icon: <SearchIcon className="w-4 h-4" aria-hidden="true" />,
        }}
      />
    );
  }

  return (
    <div className="h-full">
      <EditorView />
    </div>
  );
}

/**
 * AIChatPanel - session list plus the active conversation.
 *
 * A session has to exist before ChatView can render, so this starts on an empty
 * state with a single obvious action rather than creating one behind the user's
 * back on mount.
 */
function AIChatPanel() {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const { handleError } = useErrorHandler();
  const { workspacePath } = useWorkbench();

  const createSession = React.useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await window.cortex.ai.createSession({
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        workspacePath: workspacePath ?? undefined,
      });

      if (!response?.success) {
        throw new Error(response?.error?.message ?? 'Could not start a chat session');
      }

      setSessionId(response.data.sessionId);
    } catch (error) {
      handleError(error, {
        title: 'Could not start chat',
        retry: () => void createSession(),
      });
    } finally {
      setIsCreating(false);
    }
  }, [handleError, workspacePath]);

  return (
    <div className="h-full flex">
      <div className="w-[260px] flex-shrink-0 border-r border-border overflow-auto scrollbar-thin">
        <ViewBoundary viewKey="session-list">
          <SessionList
            activeSessionId={sessionId ?? undefined}
            onSessionSelect={setSessionId}
            onNewSession={() => void createSession()}
          />
        </ViewBoundary>
      </div>

      <div className="flex-1 min-w-0">
        {sessionId ? (
          <ChatView sessionId={sessionId} model={DEFAULT_MODEL} workspacePath={workspacePath} />
        ) : (
          <EmptyState
            data-testid="ai-chat-empty-state"
            icon={<MessageSquarePlus className="w-8 h-8" />}
            title="Start an AI chat"
            description="Ask about this codebase, generate code, or work through a problem."
            action={{
              label: isCreating ? 'Starting...' : 'New chat session',
              onClick: () => void createSession(),
            }}
          />
        )}
      </div>
    </div>
  );
}

// Whichever provider is configured decides the real model; these are the
// defaults a new session starts from until the user picks something else.
const DEFAULT_PROVIDER = 'anthropic' as const;
const DEFAULT_MODEL = 'claude-sonnet-4';

/**
 * AccountPanel - profile, team and billing.
 *
 * Only ProfileView was reachable before: TeamView and BillingView were built and
 * exported but nothing rendered them, so two finished views were dead code. They
 * belong to the same "account" destination, so they're tabs of one panel.
 */
const ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile', testId: 'profile-tab' },
  { id: 'team', label: 'Team', testId: 'team-tab' },
  { id: 'billing', label: 'Billing', testId: 'billing-tab' },
] as const;

type AccountTab = (typeof ACCOUNT_TABS)[number]['id'];

function AccountPanel() {
  const [tab, setTab] = React.useState<AccountTab>('profile');

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center gap-1 px-4 py-2 border-b border-border"
        role="tablist"
        aria-label="Account sections"
      >
        {ACCOUNT_TABS.map(({ id, label, testId }) => (
          <Button
            key={id}
            variant={tab === id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
            data-testid={testId}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto" role="tabpanel">
        <ViewBoundary viewKey={`account-${tab}`}>
          {tab === 'profile' && <ProfileView />}
          {tab === 'team' && <TeamView />}
          {tab === 'billing' && <BillingView />}
        </ViewBoundary>
      </div>
    </div>
  );
}

/**
 * AutomationsPanel - list, editor and logs for the workspace's automations.
 *
 * The list's three callbacks used to be wired to no-ops, so "New automation",
 * "Edit" and "Logs" were dead buttons: AutomationEditor and LogsViewer existed
 * but nothing ever rendered them. This drives them from a single `mode` so only
 * one is on screen at a time.
 */
function AutomationsPanel({ workspaceId }: { workspaceId: string }) {
  type Mode =
    | { kind: 'list' }
    | { kind: 'edit'; automation?: Automation }
    | { kind: 'logs'; automation: Automation };

  const [mode, setMode] = React.useState<Mode>({ kind: 'list' });
  const [reloadKey, setReloadKey] = React.useState(0);
  const { handleError } = useErrorHandler();

  const backToList = React.useCallback(() => setMode({ kind: 'list' }), []);

  const saveAutomation = React.useCallback(
    async (data: Partial<Automation>) => {
      try {
        const editing = mode.kind === 'edit' ? mode.automation : undefined;

        if (editing) {
          await ipc.automation.update(editing.id, {
            name: data.name,
            enabled: data.enabled,
            trigger: data.trigger,
            actions: data.actions,
          });
        } else {
          await ipc.automation.create(
            workspaceId,
            data.name ?? 'Untitled automation',
            data.enabled ?? true,
            data.trigger!,
            data.actions ?? []
          );
        }

        // Force the list to refetch so the new/updated row shows up.
        setReloadKey((key) => key + 1);
        backToList();
      } catch (error) {
        handleError(error, { title: 'Could not save automation' });
      }
    },
    [mode, workspaceId, backToList, handleError]
  );

  if (mode.kind === 'edit') {
    return (
      <div className="h-full overflow-auto" data-testid="automation-editor">
        <ViewBoundary viewKey="automation-editor">
          <AutomationEditor
            automation={mode.automation}
            workspaceId={workspaceId}
            onSave={saveAutomation}
            onCancel={backToList}
          />
        </ViewBoundary>
      </div>
    );
  }

  if (mode.kind === 'logs') {
    return (
      <div className="h-full overflow-auto" data-testid="logs-viewer">
        <ViewBoundary viewKey="automation-logs">
          <div className="p-4">
            <Button variant="ghost" size="sm" onClick={backToList} className="mb-4">
              Back to automations
            </Button>
            <LogsViewer automation={mode.automation} />
          </div>
        </ViewBoundary>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <AutomationList
        key={reloadKey}
        workspaceId={workspaceId}
        onEdit={(automation) => setMode({ kind: 'edit', automation })}
        onCreate={() => setMode({ kind: 'edit' })}
        onViewLogs={(automation) => setMode({ kind: 'logs', automation })}
      />
    </div>
  );
}

function WorkbenchStatus({ openTabCount }: { openTabCount: number }) {
  const { activeView, setActiveView } = useWorkbench();

  return (
    <>
      <button
        type="button"
        onClick={() => setActiveView('git')}
        className="flex items-center gap-1.5 hover:text-text transition-colors rounded-xs"
        aria-label="Open source control"
      >
        <GitBranch className="w-3 h-3" aria-hidden="true" />
        <span>Source control</span>
      </button>

      {/* The open-tab count is the only place editor state is observable from a
          document view (terminal, chat, notes...), where the tab strip itself is
          unmounted. E2E relies on it to check tabs survive a view switch. */}
      <span data-testid="status-open-tabs">
        {openTabCount === 0
          ? 'No files open'
          : `${openTabCount} file${openTabCount === 1 ? '' : 's'} open`}
      </span>

      {activeView === 'explorer' && <span className="text-text-tertiary">Cmd+P to open a file</span>}
    </>
  );
}

// --- Loading / failure boundaries -------------------------------------------

/**
 * Wraps a lazily loaded view in its Suspense fallback and an error boundary.
 *
 * One failing view shouldn't blank the whole workbench: the shell, activity bar
 * and other views keep working, and the broken pane offers a retry. Remounted
 * via `key` so retrying a failed chunk load actually re-attempts the import.
 */
function ViewBoundary({
  viewKey,
  children,
}: {
  viewKey: string;
  children: React.ReactNode;
}) {
  const [attempt, setAttempt] = React.useState(0);

  return (
    <ViewErrorBoundary
      key={`${viewKey}-${attempt}`}
      onRetry={() => setAttempt((value) => value + 1)}
    >
      <React.Suspense fallback={<ViewLoading />}>{children}</React.Suspense>
    </ViewErrorBoundary>
  );
}

function ViewLoading() {
  return (
    <div className="h-full w-full flex items-center justify-center" data-testid="view-loading">
      <Spinner size="md" />
    </div>
  );
}

interface ViewErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Workbench] View failed to render:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorState
        title="This view failed to load"
        message={error.message}
        onRetry={() => {
          this.setState({ error: null });
          this.props.onRetry();
        }}
      />
    );
  }
}
