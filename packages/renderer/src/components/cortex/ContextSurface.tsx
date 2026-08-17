import { SESSION_SURFACE_LABEL, type SessionSurface } from './session-surfaces';
import { GitContextPanel } from './GitContextPanel';

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
      <div className="h-10 px-3 flex items-center border-b border-border">
        <div className="text-[13px] font-medium">{SESSION_SURFACE_LABEL[surface]}</div>
      </div>
      <div className="flex-1 px-3 py-4 text-[13px] text-text-secondary">
        {surfaceCopy(surface)}
      </div>
    </aside>
  );
}

function surfaceCopy(surface: SessionSurface): string {
  switch (surface) {
    case 'prs':
      return 'Pull requests for this workspace will list here.';
    case 'explorer':
      return 'Workspace files open in this 320 panel.';
    case 'terminal':
      return 'Terminal · ⌘J';
    case 'notes':
      return 'Session notes stay beside the transcript.';
    case 'plans':
      return 'Plans the agent proposes appear here for review.';
    case 'preview':
      return 'Preview the running app without leaving the session.';
    case 'ai-chat':
      return 'Side chat stays in the 320 column.';
    case 'browser':
      return 'Embedded browser for the agent loop.';
    default:
      return '';
  }
}
