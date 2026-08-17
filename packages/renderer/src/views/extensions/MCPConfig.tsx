/**
 * MCPConfig.tsx
 * Configuration et authentification pour les serveurs MCP
 */

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Key, Server } from 'lucide-react';
import type { MCPServer } from '@cortex-ide/shared';
import { unwrapResponse } from '../../lib/api/client';

interface MCPConfigProps {
  serverId: string;
  onClose?: () => void;
}

export const MCPConfig: React.FC<MCPConfigProps> = ({ serverId, onClose }) => {
  const [server, setServer] = useState<MCPServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnvValues, setShowEnvValues] = useState<Record<string, boolean>>({});
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServer();
  }, [serverId]);

  const loadServer = async () => {
    try {
      setLoading(true);
      // The payload sits under `.data` of the IPCResponse envelope.
      const { server: loadedServer } = unwrapResponse(
        await window.cortex.mcp.getServer({ serverId })
      );
      setServer(loadedServer);
      setEnvVars(loadedServer.env || {});
    } catch (err) {
      console.error('[MCPConfig] Failed to load server:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!server) return;

    setSaving(true);
    try {
      // Uninstall and reinstall with new config
      await window.cortex.mcp.uninstallServer({ serverId: server.id });
      await window.cortex.mcp.installServer({
        id: server.id,
        name: server.name,
        description: server.description,
        command: server.command!,
        args: server.args,
        env: envVars,
        version: server.version,
        author: server.author,
        homepage: server.homepage,
      });

      alert('Configuration saved successfully!');
      onClose?.();
    } catch (err) {
      alert(`Failed to save configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEnvChange = (key: string, value: string) => {
    setEnvVars((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddEnvVar = () => {
    const key = prompt('Environment variable name:');
    if (key && key.trim()) {
      setEnvVars((prev) => ({ ...prev, [key.trim()]: '' }));
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    setEnvVars((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleShowValue = (key: string) => {
    setShowEnvValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading configuration...</div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-500">Server not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{server.name} Configuration</h2>
        <p className="mt-1 text-sm text-muted-foreground">{server.description}</p>
      </div>

      {/* Server Info */}
      <div className="p-4 bg-card border border-border rounded-lg space-y-3">
        <div className="flex items-center space-x-2 text-sm">
          <Server className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Command:</span>
          <code className="px-2 py-0.5 bg-secondary rounded text-xs font-mono">
            {server.command} {server.args?.join(' ')}
          </code>
        </div>

        {server.version && (
          <div className="text-sm">
            <span className="font-medium text-foreground">Version:</span>{' '}
            <span className="text-muted-foreground">{server.version}</span>
          </div>
        )}

        {server.author && (
          <div className="text-sm">
            <span className="font-medium text-foreground">Author:</span>{' '}
            <span className="text-muted-foreground">{server.author}</span>
          </div>
        )}
      </div>

      {/* Environment Variables */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-base font-semibold text-foreground">Environment Variables</h3>
          </div>
          <button
            onClick={handleAddEnvVar}
            className="px-3 py-1.5 text-xs font-medium text-foreground bg-secondary rounded hover:bg-secondary/80 transition-colors"
          >
            Add Variable
          </button>
        </div>

        {Object.keys(envVars).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg">
            No environment variables configured
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-3">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={key}
                    readOnly
                    className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono"
                  />
                  <div className="relative">
                    <input
                      type={showEnvValues[key] ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => handleEnvChange(key, e.target.value)}
                      placeholder="Value"
                      className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => toggleShowValue(key)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showEnvValues[key] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveEnvVar(key)}
                  className="px-3 py-2 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>
    </div>
  );
};
