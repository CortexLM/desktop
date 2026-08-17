/**
 * MCPExtensionList.tsx
 * Liste des serveurs MCP installés avec leur statut
 */

import React, { useState, useEffect } from 'react';
import { PlayCircle, StopCircle, Trash2, Settings, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { MCPServer } from '@cortex-ide/shared';
import { unwrapResponse } from '../../lib/api/client';

interface MCPExtensionListProps {
  onConfigureServer?: (serverId: string) => void;
  onViewTools?: (serverId: string) => void;
}

export const MCPExtensionList: React.FC<MCPExtensionListProps> = ({
  onConfigureServer,
  onViewTools,
}) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
    
    // Listen to server events
    const cleanupFns = [
      window.cortex.mcp.onServerStarted(() => loadServers()),
      window.cortex.mcp.onServerStopped(() => loadServers()),
      window.cortex.mcp.onServerError(() => loadServers()),
    ];

    return () => cleanupFns.forEach(fn => fn());
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      // The payload sits under `.data` of the IPCResponse envelope.
      const { servers: loadedServers } = unwrapResponse(
        await window.cortex.mcp.listServers({})
      );
      setServers(loadedServers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
      console.error('[MCPExtensionList] Failed to load servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartServer = async (serverId: string) => {
    try {
      await window.cortex.mcp.startServer({ serverId });
    } catch (err) {
      alert(`Failed to start server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleStopServer = async (serverId: string) => {
    try {
      await window.cortex.mcp.stopServer({ serverId });
    } catch (err) {
      alert(`Failed to stop server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUninstall = async (serverId: string, serverName: string) => {
    if (!confirm(`Are you sure you want to uninstall "${serverName}"?`)) {
      return;
    }

    try {
      await window.cortex.mcp.uninstallServer({ serverId });
      await loadServers();
    } catch (err) {
      alert(`Failed to uninstall server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'stopped':
      case 'installed':
        return <StopCircle className="w-4 h-4 text-gray-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: MCPServer['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'stopped':
      case 'installed':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
      case 'error':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading MCP extensions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-sm text-muted-foreground">No MCP extensions installed</div>
        <button
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
          onClick={() => window.location.hash = '#/extensions/marketplace'}
        >
          Browse Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers.map((server) => (
        <div
          key={server.id}
          className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-semibold text-foreground">{server.name}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                    server.status
                  )}`}
                >
                  {getStatusIcon(server.status)}
                  {server.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{server.description}</p>
              {server.version && (
                <p className="mt-1 text-xs text-muted-foreground">Version {server.version}</p>
              )}
              {server.tools && server.tools.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {server.tools.length} tool{server.tools.length !== 1 ? 's' : ''} available
                </p>
              )}
              {server.lastError && (
                <p className="mt-2 text-xs text-red-500">Error: {server.lastError}</p>
              )}
            </div>

            <div className="flex items-center space-x-2 ml-4">
              {server.status === 'running' ? (
                <button
                  onClick={() => handleStopServer(server.id)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Stop server"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => handleStartServer(server.id)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Start server"
                >
                  <PlayCircle className="w-5 h-5" />
                </button>
              )}

              {server.status === 'running' && onViewTools && (
                <button
                  onClick={() => onViewTools(server.id)}
                  className="px-3 py-1.5 text-xs font-medium text-foreground bg-secondary rounded hover:bg-secondary/80 transition-colors"
                >
                  View Tools
                </button>
              )}

              {onConfigureServer && (
                <button
                  onClick={() => onConfigureServer(server.id)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Configure"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => handleUninstall(server.id, server.name)}
                className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                title="Uninstall"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
