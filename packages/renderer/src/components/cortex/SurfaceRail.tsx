import {
  FileText,
  Files,
  GitBranch,
  Globe,
  ListChecks,
  MessageSquare,
  Search,
  Shield,
  SquareTerminal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWorkbench, type WorkbenchView } from '../../contexts/WorkbenchContext';

const RAIL: Array<{ id: WorkbenchView; icon: typeof Files; testId: string; label: string }> = [
  { id: 'session', icon: MessageSquare, testId: 'sidebar-session', label: 'Session' },
  { id: 'git', icon: GitBranch, testId: 'sidebar-git', label: 'Changes' },
  { id: 'review', icon: Search, testId: 'sidebar-review', label: 'Review' },
  { id: 'explorer', icon: Files, testId: 'sidebar-explorer', label: 'Files' },
  { id: 'search', icon: Search, testId: 'sidebar-search', label: 'Search' },
  { id: 'terminal', icon: SquareTerminal, testId: 'sidebar-terminal', label: 'Terminal' },
  { id: 'notes', icon: FileText, testId: 'sidebar-notes', label: 'Notes' },
  { id: 'plans', icon: ListChecks, testId: 'sidebar-plans', label: 'Plans' },
  { id: 'security', icon: Shield, testId: 'sidebar-security', label: 'Security' },
  { id: 'ai-chat', icon: MessageSquare, testId: 'sidebar-ai-chat', label: 'Side chat' },
  { id: 'browser', icon: Globe, testId: 'sidebar-browser', label: 'Browser' },
  { id: 'extensions', icon: Files, testId: 'sidebar-extensions', label: 'Extensions' },
  { id: 'automations', icon: ListChecks, testId: 'sidebar-automations', label: 'Automations' },
  { id: 'account', icon: Files, testId: 'sidebar-account', label: 'Account' },
  { id: 'settings', icon: Files, testId: 'sidebar-settings', label: 'Settings' },
  { id: 'knowledge', icon: FileText, testId: 'sidebar-knowledge', label: 'Knowledge' },
];

export function SurfaceRail(_props: { onOpenCommandPalette?: () => void }) {
  const { activeView, setActiveView } = useWorkbench();

  return (
    <nav
      className="w-9 flex-shrink-0 border-l border-border bg-page flex flex-col items-center py-2 gap-1"
      aria-label="Surfaces"
      data-testid="sidebar"
    >
      {RAIL.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          data-testid={item.testId}
          onClick={() => setActiveView(item.id)}
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center',
            activeView === item.id ? 'bg-tint-strong text-text' : 'text-text-tertiary hover:text-text'
          )}
        >
          <item.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </nav>
  );
}
