import {
  Eye,
  FileText,
  Files,
  GitBranch,
  GitPullRequest,
  Globe,
  ListChecks,
  MessageSquare,
  SquareTerminal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SESSION_SURFACES, SESSION_SURFACE_LABEL, type SessionSurface } from './session-surfaces';

const ICONS: Record<SessionSurface, typeof Files> = {
  git: GitBranch,
  prs: GitPullRequest,
  explorer: Files,
  terminal: SquareTerminal,
  notes: FileText,
  plans: ListChecks,
  preview: Eye,
  'ai-chat': MessageSquare,
  browser: Globe,
};

const TEST_IDS: Record<SessionSurface, string> = {
  git: 'sidebar-git',
  prs: 'sidebar-prs',
  explorer: 'sidebar-explorer',
  terminal: 'sidebar-terminal',
  notes: 'sidebar-notes',
  plans: 'sidebar-plans',
  preview: 'sidebar-preview',
  'ai-chat': 'sidebar-ai-chat',
  browser: 'sidebar-browser',
};

export function SurfaceRail({
  surface,
  onSurfaceChange,
}: {
  surface: SessionSurface;
  onSurfaceChange: (surface: SessionSurface) => void;
}) {
  return (
    <nav
      className="w-9 flex-shrink-0 border-l border-border bg-wash flex flex-col items-center py-2 gap-1"
      aria-label="Surfaces"
      data-testid="sidebar"
      data-rail-count={SESSION_SURFACES.length}
    >
      {SESSION_SURFACES.map((id) => {
        const Icon = ICONS[id];
        const active = surface === id;
        return (
          <button
            key={id}
            type="button"
            title={SESSION_SURFACE_LABEL[id]}
            aria-label={SESSION_SURFACE_LABEL[id]}
            aria-current={active ? 'page' : undefined}
            data-testid={TEST_IDS[id]}
            onClick={() => onSurfaceChange(id)}
            className={cn(
              'w-7 h-7 rounded-md flex items-center justify-center',
              active ? 'bg-tint-strong text-accent' : 'text-text-tertiary hover:text-text'
            )}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </button>
        );
      })}
    </nav>
  );
}
