import type { ReactNode } from 'react';
import { Filter, GitBranch, HelpCircle, Info, List, Plus, Search, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SessionRow } from './use-session-agent';
import { useWorkbench } from '../../contexts/WorkbenchContext';

export function SessionSidebar({
  sessions,
  activeId,
  projectName,
  branches,
  onNewSession,
  onSelect,
  onSearch,
  onOpenCheckpoints,
}: {
  sessions: SessionRow[];
  activeId: string | null;
  projectName: string;
  branches: Array<{ name: string; pr: string }>;
  onNewSession: () => void;
  onSelect: (id: string) => void;
  onSearch?: () => void;
  onOpenCheckpoints?: () => void;
}) {
  const { setActiveView, workspacePath } = useWorkbench();
  const recent = sessions.filter((row) => row.group === 'recent');
  const project = sessions.filter((row) => row.group === 'project');

  return (
    <aside
      className="w-[var(--sidebar-workspace)] flex-shrink-0 border-r border-border bg-wash flex flex-col min-h-0"
      data-testid="sidebar-panel"
      aria-label="Sessions"
    >
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={onNewSession}
          className="h-[30px] w-full flex items-center gap-2 px-2 rounded-md text-[13px] hover:bg-tint"
          data-testid="new-session"
        >
          <Plus className="w-3.5 h-3.5 flex-shrink-0" />
          New session
        </button>
        <div className="h-[30px] flex items-center justify-between px-2 text-text-tertiary">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onSearch} aria-label="Search sessions">
              <Search className="w-3.5 h-3.5" />
            </button>
            <Filter className="w-3.5 h-3.5" />
            <List className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 scrollbar-thin">
        {!workspacePath ? (
          <p className="px-2 py-4 text-[13px] text-text-secondary">
            No folder open. Open a folder to start a session with isolated workspace context.
          </p>
        ) : null}
        <SectionLabel>recent</SectionLabel>
        {(recent.length ? recent : [{ id: 'placeholder', title: 'New session', group: 'recent' as const }]).map(
          (row) => (
            <SessionRowButton
              key={row.id}
              title={row.title}
              active={row.id === activeId}
              onClick={() => onSelect(row.id)}
            />
          )
        )}
        <button type="button" className="h-6 px-2 text-[12px] text-text-tertiary">
          Show more sessions
        </button>

        <SectionLabel>{projectName}</SectionLabel>
        {project.map((row) => (
          <SessionRowButton
            key={row.id}
            title={row.title}
            active={row.id === activeId}
            onClick={() => onSelect(row.id)}
          />
        ))}

        {branches.map((item) => (
          <div key={item.name} className="h-[26px] px-2 flex items-center gap-2 text-[12px]">
            <GitBranch className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            <span className="font-mono truncate">{item.name}</span>
            {item.pr ? <span className="text-text-tertiary">{item.pr}</span> : null}
          </div>
        ))}
      </div>

      <div className="h-[30px] flex-shrink-0 flex items-center gap-3 px-3 border-t border-border text-text-tertiary">
        <button type="button" aria-label="Theme" onClick={() => setActiveView('settings')}>
          <Sun className="w-3.5 h-3.5" />
        </button>
        <button type="button" aria-label="Help" onClick={onOpenCheckpoints}>
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <Info className="w-3.5 h-3.5" />
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="h-6 px-2 flex items-center text-[11px] text-text-tertiary">
      {children}
    </div>
  );
}

function SessionRowButton({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 w-full px-2 rounded-md text-left text-[13px] truncate',
        active ? 'bg-tint-strong text-text' : 'text-text-secondary hover:bg-tint'
      )}
    >
      {title}
    </button>
  );
}
