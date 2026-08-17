import * as React from 'react';
import { Activity, ChevronDown, Server } from 'lucide-react';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';
import { SessionSidebar } from './SessionSidebar';
import { SessionCenter } from './SessionCenter';
import { GitContextPanel } from './GitContextPanel';
import { SurfaceRail } from './SurfaceRail';
import { PermissionOverlay } from './overlays/PermissionOverlay';
import { ModelPickerOverlay } from './overlays/ModelPickerOverlay';
import { PlanOverlay } from './overlays/PlanOverlay';
import { ContextFullBanner, OfflineBanner, ProviderErrorBanner } from './overlays/ContextFullBanner';
import { CheckpointOverlay, ShortcutsOverlay } from './overlays/CheckpointOverlay';
import { useSessionAgent } from './use-session-agent';
import { useWorkbench } from '../../contexts/WorkbenchContext';

export interface CortexCodeShellProps {
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
}

export function CortexCodeShell({ onOpenCommandPalette }: CortexCodeShellProps) {
  const { workspacePath } = useWorkbench();
  const agent = useSessionAgent(workspacePath);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [checkpointsOpen, setCheckpointsOpen] = React.useState(false);
  const [offline, setOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && agent.running) {
        event.preventDefault();
        void agent.interrupt();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommandPalette?.();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [agent, onOpenCommandPalette]);

  const project = workspacePath?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'workspace';

  return (
    <div
      className="h-screen w-screen flex flex-col bg-page text-text overflow-hidden"
      data-testid="cortex-code-shell"
      data-theme-chrome="paper-v3"
    >
      <header
        className="h-10 flex-shrink-0 flex items-center gap-3 px-3 border-b border-border bg-page"
        data-testid="cortex-topbar"
      >
        <div className="w-[240px] flex-shrink-0 min-w-0">
          <div className="text-[13px] font-medium truncate leading-4">
            {agent.sessionTitle}
          </div>
          <div className="text-[11px] text-text-tertiary truncate leading-3 font-mono">
            {project} · {agent.branch}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
          <span className="text-[12px] text-text-secondary">{agent.cpuLabel}</span>
          <button
            type="button"
            className="h-[26px] px-2 rounded-md border border-border bg-elevated text-[12px] flex items-center gap-1"
            onClick={() => setModelOpen(true)}
            data-testid="model-picker-trigger"
          >
            {agent.modelLabel}
            <ChevronDown className="w-2.5 h-2.5 text-text-tertiary" />
          </button>
          <div className="h-[26px] px-2 rounded-md border border-border bg-elevated text-[12px] flex items-center gap-1">
            <Server className="w-3 h-3 text-accent" />
            Local
          </div>
          <div className="w-6 h-6 rounded-full bg-elevated border border-border text-[10px] flex items-center justify-center">
            C
          </div>
        </div>
      </header>

      {offline && <OfflineBanner />}
      {agent.providerError && (
        <ProviderErrorBanner message={agent.providerError} onDismiss={agent.clearProviderError} />
      )}
      {agent.contextFull && <ContextFullBanner onCompact={agent.compactContext} />}

      <div className="flex-1 flex min-h-0">
        <SessionSidebar
          sessions={agent.sessions}
          activeId={agent.sessionId}
          projectName={project}
          branches={agent.worktrees}
          onNewSession={() => void agent.newSession()}
          onSelect={agent.selectSession}
          onSearch={onOpenCommandPalette}
          onOpenCheckpoints={() => setCheckpointsOpen(true)}
        />

        <SessionCenter agent={agent} onOpenCommandPalette={onOpenCommandPalette} />

        <GitContextPanel repoPath={workspacePath} />

        <SurfaceRail />
      </div>

      {agent.permission && (
        <PermissionOverlay
          request={agent.permission}
          onDecide={(decision) => void agent.decidePermission(decision)}
        />
      )}
      {modelOpen && (
        <ModelPickerOverlay
          value={agent.model}
          onChange={(model, provider) => {
            agent.setModel(model, provider);
            setModelOpen(false);
          }}
          onClose={() => setModelOpen(false)}
        />
      )}
      {agent.plan && !agent.plan.approved && (
        <PlanOverlay
          plan={agent.plan}
          onApprove={agent.approvePlan}
          onReject={agent.rejectPlan}
        />
      )}
      {checkpointsOpen && (
        <CheckpointOverlay
          onClose={() => setCheckpointsOpen(false)}
          onRestore={(id) => {
            void agent.restoreCheckpoint(id);
            setCheckpointsOpen(false);
          }}
        />
      )}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
