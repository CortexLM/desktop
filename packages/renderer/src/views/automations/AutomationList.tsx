/**
 * Automation List View
 * Liste des automations avec statut, enable/disable toggle, last run
 */

import React, { useEffect, useState } from 'react';
import { ipc } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import type { Automation, AutomationLog } from '@cortex-ide/shared';
import { Play, Square, Trash2, Edit, Plus } from 'lucide-react';

interface AutomationListProps {
  workspaceId: string;
  onEdit: (automation: Automation) => void;
  onCreate: () => void;
  onViewLogs: (automation: Automation) => void;
}

export const AutomationList: React.FC<AutomationListProps> = ({
  workspaceId,
  onEdit,
  onCreate,
  onViewLogs,
}) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [lastRuns, setLastRuns] = useState<Map<string, AutomationLog>>(new Map());

  // Charger les automations
  useEffect(() => {
    loadAutomations();
  }, [workspaceId]);

  // Écouter les événements d'automation
  useEffect(() => {
    const unsubscribeStarted = ipc.automation.onStarted((event) => {
      setRunningIds((prev) => new Set(prev).add(event.automation.id));
    });

    const unsubscribeCompleted = ipc.automation.onCompleted((event) => {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(event.automation.id);
        return next;
      });
      setLastRuns((prev) => new Map(prev).set(event.automation.id, event.log));
    });

    const unsubscribeFailed = ipc.automation.onFailed((event) => {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(event.automation.id);
        return next;
      });
      setLastRuns((prev) => new Map(prev).set(event.automation.id, event.log));
    });

    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, []);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const list = await ipc.automation.list(workspaceId);
      setAutomations(list);
      setError(null);

      // Charger les derniers logs pour chaque automation.
      //
      // Dans son propre try/catch, et après `setError(null)` : l'historique est
      // une information secondaire. Une lecture de logs qui échoue ne doit pas
      // faire passer la liste — déjà chargée — pour une erreur de chargement.
      for (const automation of list) {
        try {
          const logs = await ipc.automation.getLogs(automation.id, 1);
          if (logs.length > 0) {
            setLastRuns((prev) => new Map(prev).set(automation.id, logs[0]));
          }
        } catch (logError) {
          console.error('Failed to load last run for automation:', automation.id, logError);
        }
      }
    } catch (error) {
      // La liste vide et la liste illisible ne doivent pas se ressembler : sans
      // ce message, un échec de chargement s'affiche comme « No automations
      // yet » et invite l'utilisateur à recréer ce qui existe déjà.
      setError(error instanceof Error ? error.message : 'Failed to load automations');
      console.error('Failed to load automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (automation: Automation) => {
    try {
      const updated = await ipc.automation.toggle(automation.id, !automation.enabled);
      setAutomations((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  const handleRun = async (automation: Automation) => {
    try {
      await ipc.automation.run(automation.id);
    } catch (error) {
      console.error('Failed to run automation:', error);
    }
  };

  const handleDelete = async (automation: Automation) => {
    if (!confirm(`Delete automation "${automation.name}"?`)) return;

    try {
      await ipc.automation.delete(automation.id);
      setAutomations((prev) => prev.filter((a) => a.id !== automation.id));
    } catch (error) {
      console.error('Failed to delete automation:', error);
    }
  };

  const getTriggerLabel = (trigger: Automation['trigger']): string => {
    switch (trigger.type) {
      case 'file_watch':
        return `File: ${trigger.patterns.join(', ')}`;
      case 'git_hook':
        return `Git: ${trigger.hook}`;
      case 'schedule':
        return `Schedule: ${trigger.cron}`;
      case 'manual':
        return 'Manual';
    }
  };

  const getStatusBadge = (automation: Automation) => {
    const isRunning = runningIds.has(automation.id);
    const lastRun = lastRuns.get(automation.id);

    if (isRunning) {
      return <Badge variant="default">Running</Badge>;
    }

    if (!automation.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }

    if (lastRun) {
      switch (lastRun.status) {
        case 'success':
          return <Badge className="bg-green-500">Success</Badge>;
        case 'error':
          return <Badge className="bg-red-500">Error</Badge>;
        default:
          return <Badge variant="secondary">Idle</Badge>;
      }
    }

    return <Badge variant="secondary">Never run</Badge>;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading automations...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Automations</h2>
        <Button size="sm" onClick={onCreate} data-testid="new-automation">
          <Plus className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center p-8"
            data-testid="automation-list-error"
          >
            <p className="text-red-500 mb-1">Failed to load automations</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={loadAutomations}>
              Retry
            </Button>
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-muted-foreground mb-4">No automations yet</p>
            <Button onClick={onCreate}>Create your first automation</Button>
          </div>
        ) : (
          <div className="divide-y divide-border" data-testid="automation-list">
            {automations.map((automation) => {
              const lastRun = lastRuns.get(automation.id);
              const isRunning = runningIds.has(automation.id);

              return (
                <div
                  key={automation.id}
                  className="p-4 hover:bg-accent/50 transition-colors"
                  data-testid="automation-item"
                  data-name={automation.name}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Name & Status */}
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium truncate">{automation.name}</h3>
                        {getStatusBadge(automation)}
                      </div>

                      {/* Trigger */}
                      <div className="text-sm text-muted-foreground mb-2">
                        {getTriggerLabel(automation.trigger)}
                      </div>

                      {/* Actions count */}
                      <div className="text-xs text-muted-foreground">
                        {automation.actions.length} action
                        {automation.actions.length !== 1 ? 's' : ''}
                      </div>

                      {/* Last run */}
                      {lastRun && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last run: {formatTimestamp(lastRun.startedAt)}
                          {lastRun.completedAt && (
                            <span className="ml-2">
                              ({Math.round((lastRun.completedAt - lastRun.startedAt) / 1000)}s)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(automation)}
                        data-testid="enable-automation"
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full
                          transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                          ${automation.enabled ? 'bg-primary' : 'bg-muted'}
                        `}
                        aria-label={automation.enabled ? 'Disable' : 'Enable'}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${automation.enabled ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>

                      {/* Run */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRun(automation)}
                        disabled={isRunning}
                        data-testid="run-automation"
                      >
                        {isRunning ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Edit */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(automation)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      {/* Logs */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewLogs(automation)}
                      >
                        Logs
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(automation)}
                        data-testid="delete-automation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
