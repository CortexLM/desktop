/**
 * Logs Viewer Component
 * Affichage de l'historique d'exécution des automations
 */

import React, { useEffect, useState } from 'react';
import { ipc } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import type { Automation, AutomationLog } from '@cortex-ide/shared';
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react';

interface LogsViewerProps {
  automation: Automation;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ automation }) => {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLogs();
  }, [automation.id]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const logs = await ipc.automation.getLogs(automation.id, 50);
      setLogs(logs);
      setError(null);
    } catch (error) {
      // « No logs yet » est une affirmation sur l'historique ; un échec de
      // lecture n'en est pas une. Les distinguer évite de conclure qu'une
      // automation n'a jamais tourné alors que la requête a échoué.
      setError(error instanceof Error ? error.message : 'Failed to load logs');
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDuration = (startedAt: number, completedAt?: number): string => {
    if (!completedAt) return 'Running...';
    const duration = Math.round((completedAt - startedAt) / 1000);
    return `${duration}s`;
  };

  const getStatusIcon = (status: AutomationLog['status']) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: AutomationLog['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="default">Running</Badge>;
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Error</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Execution Logs</h3>
        <p className="text-sm text-muted-foreground">
          {/* Pas de compte quand la lecture a échoué : « 0 execution(s) » est une
              affirmation sur l'historique, et elle serait fausse. */}
          {automation.name}
          {error ? ' - executions unknown' : ` - ${logs.length} execution(s)`}
        </p>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center p-8"
            data-testid="logs-viewer-error"
          >
            <p className="text-red-500 mb-1">Failed to load logs</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No logs yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const isExpanded = expandedLogs.has(log.id);

              return (
                <div key={log.id} className="p-4">
                  {/* Log Header */}
                  <div
                    className="flex items-start justify-between cursor-pointer hover:bg-accent/50 -m-2 p-2 rounded"
                    onClick={() => toggleLogExpanded(log.id)}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 mt-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mt-1" />
                      )}
                      {getStatusIcon(log.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(log.status)}
                          <span className="text-sm text-muted-foreground">
                            {formatTimestamp(log.startedAt)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Duration: {formatDuration(log.startedAt, log.completedAt)}
                        </div>
                        {log.error && (
                          <div className="text-sm text-red-500 mt-1">
                            Error: {log.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Log Details */}
                  {isExpanded && (
                    <div className="mt-4 ml-9 space-y-3">
                      {/* Action Results */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">
                          Action Results ({log.actionResults.length})
                        </h4>
                        <div className="space-y-2">
                          {log.actionResults.map((result, index) => (
                            <div
                              key={index}
                              className="border border-border rounded-md p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {result.status === 'success' ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="text-sm font-medium">
                                    Action {index + 1}: {result.action.type}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {result.duration}ms
                                </span>
                              </div>

                              {result.output && (
                                <div className="mt-2">
                                  <div className="text-xs text-muted-foreground mb-1">
                                    Output:
                                  </div>
                                  <pre className="text-xs bg-accent/50 p-2 rounded overflow-x-auto">
                                    {result.output}
                                  </pre>
                                </div>
                              )}

                              {result.error && (
                                <div className="mt-2">
                                  <div className="text-xs text-red-500 mb-1">
                                    Error:
                                  </div>
                                  <pre className="text-xs bg-red-500/10 p-2 rounded overflow-x-auto text-red-500">
                                    {result.error}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Global Output */}
                      {log.output && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Output</h4>
                          <pre className="text-xs bg-accent/50 p-3 rounded overflow-x-auto">
                            {log.output}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
