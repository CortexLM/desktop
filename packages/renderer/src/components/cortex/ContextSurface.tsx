import * as React from 'react';
import { SESSION_SURFACE_LABEL, type SessionSurface } from './session-surfaces';
import { GitContextPanel } from './GitContextPanel';
import { lazyNamed } from '../layout/views';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { Spinner } from '../ui/spinner';
import { Button } from '../ui/button';
import { ipc } from '../../lib/ipc';

const FileExplorer = lazyNamed(() => import('../../views/editor/FileExplorer'), 'FileExplorer');
const TerminalGrid = lazyNamed(() => import('../../views/workspace/TerminalGrid'), 'TerminalGrid');
const NotesView = lazyNamed(() => import('../../views/workspace/NotesView'), 'NotesView');
const PlansView = lazyNamed(() => import('../../views/workspace/PlansView'), 'PlansView');
const BrowserView = lazyNamed(() => import('../../views/workspace/BrowserView'), 'BrowserView');
const SessionList = lazyNamed(() => import('../../views/agents/SessionList'), 'SessionList');
const ReviewView = lazyNamed(() => import('../../views/review/ReviewView'), 'ReviewView');

export function ContextSurface({
  surface,
  repoPath,
}: {
  surface: SessionSurface;
  repoPath: string | null;
}) {
  if (surface === 'git') {
    return <GitContextPanel repoPath={repoPath} />;
  }

  return (
    <aside
      className="w-[var(--panel-context)] flex-shrink-0 border-l border-border bg-wash flex flex-col min-h-0"
      data-testid={`${surface}-context-panel`}
      aria-label={SESSION_SURFACE_LABEL[surface]}
    >
      <SurfaceHeader surface={surface} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <React.Suspense fallback={<SurfaceLoading />}>
          <SurfaceBody surface={surface} repoPath={repoPath} />
        </React.Suspense>
      </div>
    </aside>
  );
}

function SurfaceHeader({ surface }: { surface: SessionSurface }) {
  const { setActiveView } = useWorkbench();
  const expand =
    surface === 'explorer'
      ? { label: 'Open editor', view: 'explorer' as const }
      : surface === 'terminal'
        ? { label: 'Open terminal', view: 'terminal' as const }
        : surface === 'notes'
          ? { label: 'Open notes', view: 'notes' as const }
          : surface === 'plans'
            ? { label: 'Open plans', view: 'plans' as const }
            : surface === 'browser' || surface === 'preview'
              ? { label: 'Open browser', view: 'browser' as const }
              : surface === 'ai-chat'
                ? { label: 'Open chat', view: 'ai-chat' as const }
                : surface === 'prs'
                  ? { label: 'Open review', view: 'review' as const }
                  : null;

  return (
    <div className="h-10 px-3 flex items-center justify-between border-b border-border gap-2">
      <div className="text-[13px] font-medium truncate">{SESSION_SURFACE_LABEL[surface]}</div>
      {expand && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={() => setActiveView(expand.view)}
        >
          {expand.label}
        </Button>
      )}
    </div>
  );
}

function SurfaceLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner size="sm" />
    </div>
  );
}

function SurfaceBody({
  surface,
  repoPath,
}: {
  surface: SessionSurface;
  repoPath: string | null;
}) {
  const workspaceId = repoPath ?? 'default';

  switch (surface) {
    case 'explorer':
      return <FileExplorer workspacePath={repoPath ?? '/'} />;
    case 'terminal':
      return <TerminalGrid />;
    case 'notes':
      return <NotesView workspaceId={workspaceId} />;
    case 'plans':
      return <PlansView workspaceId={workspaceId} />;
    case 'preview':
    case 'browser':
      return <BrowserView />;
    case 'ai-chat':
      return <SideChatPanel />;
    case 'prs':
      return <LocalChangesPanel repoPath={repoPath} />;
    default:
      return null;
  }
}

function SideChatPanel() {
  const { setActiveView } = useWorkbench();
  return (
    <div className="h-full min-h-0 overflow-auto" data-testid="side-chat-panel">
      <SessionList
        onSessionSelect={() => setActiveView('ai-chat')}
        onNewSession={() => setActiveView('ai-chat')}
      />
    </div>
  );
}

/**
 * Hosted GitHub/GitLab PRs are not synced. This panel lists local
 * reviewable diffs so the rail is not a dead placeholder.
 */
function LocalChangesPanel({ repoPath }: { repoPath: string | null }) {
  const [branch, setBranch] = React.useState<string>('—');

  React.useEffect(() => {
    if (!repoPath) return;
    void ipc.git
      .status({ repoPath })
      .then((status) => setBranch(status.branch))
      .catch(() => setBranch('unavailable'));
  }, [repoPath]);

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="prs-local-panel">
      <p className="px-3 pt-3 text-[12px] text-text-secondary">
        Local review. Hosted pull-request sync is not wired — use Review or{' '}
        <span className="font-mono">gh</span> in the terminal.
      </p>
      <div className="px-3 py-2 text-[12px] text-text-tertiary">Branch · {branch}</div>
      <div className="flex-1 min-h-0 overflow-auto">
        <ReviewView workspacePath={repoPath} />
      </div>
    </div>
  );
}
