/**
 * MissionsView — list, create, and drive MissionOrchestrator records.
 *
 * Backend already exists (`mission:*` IPC + SQLite). This is the missing UI.
 */

import * as React from 'react';
import { ListChecks, Pause, Play, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { EmptyState, ErrorState } from '../../components/EmptyState';
import { cn } from '../../lib/utils';

export interface MissionStep {
  id: string;
  name: string;
  status: string;
  result?: string;
  error?: string;
}

export interface Mission {
  id: string;
  name: string;
  status: string;
  description: string;
  steps: MissionStep[];
  currentStep: number;
}

interface MissionsViewProps {
  workspaceId: string;
  className?: string;
}

function unwrap<T>(response: { success?: boolean; data?: T; error?: { message?: string } } | undefined): T {
  if (!response?.success || response.data === undefined) {
    throw new Error(response?.error?.message ?? 'Mission request failed');
  }
  return response.data;
}

export function MissionsView({ workspaceId, className }: MissionsViewProps) {
  const [missions, setMissions] = React.useState<Mission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = unwrap<{ missions: Mission[] }>(
        await window.cortex.mission.list({ workspaceId })
      );
      setMissions(data.missions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusyId('create');
    try {
      unwrap(
        await window.cortex.mission.create({
          workspaceId,
          name: trimmed,
          description: description.trim(),
          steps: ['Plan', 'Implement', 'Verify'],
        })
      );
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setBusyId(null);
    }
  };

  const act = async (id: string, action: 'start' | 'pause' | 'resume') => {
    setBusyId(id);
    try {
      unwrap(await window.cortex.mission[action]({ id }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} mission`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={cn('h-full overflow-auto p-6', className)} data-testid="missions-view">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-text">Missions</h1>
          <p className="text-sm text-text-secondary mt-1">
            Long-running work: planning → running → paused → completed. Start a
            mission from here, or pick Mission mode in the session composer.
          </p>
        </div>

        <form
          className="rounded-lg border border-border bg-surface p-4 space-y-3"
          data-testid="mission-create"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="text-sm font-medium">New mission</div>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label="Mission name"
            data-testid="mission-name"
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should this mission accomplish?"
            aria-label="Mission description"
            data-testid="mission-description"
          />
          <Button type="submit" disabled={!name.trim() || busyId === 'create'} data-testid="mission-create-submit">
            <Plus className="w-4 h-4" />
            Create
          </Button>
        </form>

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {error && <ErrorState title="Missions unavailable" message={error} onRetry={() => void load()} />}

        {!loading && !error && missions.length === 0 && (
          <EmptyState
            icon={<ListChecks className="w-8 h-8" />}
            title="No missions yet"
            description="Create a mission to track a multi-step agent task."
          />
        )}

        <ul className="space-y-3" data-testid="mission-list">
          {missions.map((mission) => (
            <li
              key={mission.id}
              className="rounded-lg border border-border bg-surface p-4 space-y-3"
              data-testid={`mission-${mission.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{mission.name}</div>
                  {mission.description && (
                    <p className="text-sm text-text-secondary mt-1">{mission.description}</p>
                  )}
                </div>
                <Badge variant="outline">{mission.status}</Badge>
              </div>

              <ol className="space-y-1">
                {mission.steps.map((step, index) => (
                  <li key={step.id} className="text-sm flex items-center gap-2">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        step.status === 'completed' && 'bg-emerald-500',
                        step.status === 'running' && 'bg-accent',
                        step.status === 'failed' && 'bg-red-500',
                        step.status === 'pending' && 'bg-text-tertiary'
                      )}
                    />
                    <span className={index === mission.currentStep ? 'text-text' : 'text-text-secondary'}>
                      {step.name}
                    </span>
                    <span className="text-xs text-text-tertiary">{step.status}</span>
                  </li>
                ))}
              </ol>

              <div className="flex gap-2">
                {mission.status === 'planning' || mission.status === 'paused' ? (
                  <Button
                    size="sm"
                    onClick={() => void act(mission.id, mission.status === 'paused' ? 'resume' : 'start')}
                    disabled={busyId === mission.id}
                    data-testid={`mission-${mission.status === 'paused' ? 'resume' : 'start'}-${mission.id}`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {mission.status === 'paused' ? 'Resume' : 'Start'}
                  </Button>
                ) : null}
                {mission.status === 'running' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void act(mission.id, 'pause')}
                    disabled={busyId === mission.id}
                    data-testid={`mission-pause-${mission.id}`}
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
