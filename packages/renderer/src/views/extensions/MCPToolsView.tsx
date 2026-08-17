/**
 * MCPToolsView.tsx
 * Liste et invocation des tools MCP disponibles
 */

import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, ChevronRight } from 'lucide-react';
import type { MCPTool, MCPServer } from '@cortex-ide/shared';
import { unwrapResponse } from '../../lib/api/client';

interface MCPToolsViewProps {
  serverId: string;
}

export const MCPToolsView: React.FC<MCPToolsViewProps> = ({ serverId }) => {
  const [server, setServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({});
  const [invoking, setInvoking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadServerAndTools();
  }, [serverId]);

  const loadServerAndTools = async () => {
    try {
      setLoading(true);
      // Handlers answer with an `IPCResponse` envelope: the payload lives under
      // `.data`, so reading `.server` straight off the response was undefined.
      const { server: loadedServer } = unwrapResponse(
        await window.cortex.mcp.getServer({ serverId })
      );
      setServer(loadedServer);

      if (loadedServer.status === 'running') {
        const { tools: discovered } = unwrapResponse(
          await window.cortex.mcp.discoverTools({ serverId })
        );
        setTools(discovered);
      } else {
        setTools(loadedServer.tools || []);
      }
    } catch (err) {
      console.error('[MCPToolsView] Failed to load tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvokeTool = async (toolName: string, inputSchema: MCPTool['inputSchema']) => {
    setInvoking(toolName);
    
    try {
      // Check permission first
      const { granted } = unwrapResponse(
        await window.cortex.mcp.checkPermission({ serverId, toolName })
      );

      if (!granted) {
        const shouldGrant = confirm(
          `This tool requires permission to run. Grant permission to ${toolName}?`
        );
        
        if (shouldGrant) {
          await window.cortex.mcp.grantPermission({ serverId, toolName });
        } else {
          return;
        }
      }

      // Build arguments from input
      const args = toolArgs[toolName] || {};
      
      // Validate required fields
      const required = inputSchema.required || [];
      const missing = required.filter(key => !args[key]);
      
      if (missing.length > 0) {
        alert(`Missing required fields: ${missing.join(', ')}`);
        return;
      }

      // Invoke tool
      const result = unwrapResponse(
        await window.cortex.mcp.invokeTool({
          serverId,
          toolName,
          arguments: args,
        })
      );

      setResults((prev) => ({ ...prev, [toolName]: result }));
    } catch (err) {
      alert(`Failed to invoke tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setInvoking(null);
    }
  };

  const handleArgChange = (toolName: string, key: string, value: unknown) => {
    setToolArgs((prev) => ({
      ...prev,
      [toolName]: {
        ...(prev[toolName] || {}),
        [key]: value,
      },
    }));
  };

  const toggleExpanded = (toolName: string) => {
    setExpandedTool(expandedTool === toolName ? null : toolName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading tools...</div>
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

  if (server.status !== 'running') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-sm text-muted-foreground">
          Server must be running to view and invoke tools
        </div>
        <button
          onClick={async () => {
            await window.cortex.mcp.startServer({ serverId });
            await loadServerAndTools();
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
        >
          Start Server
        </button>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">No tools available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{server.name} Tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tools.length} tool{tools.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Tools List */}
      <div className="space-y-3">
        {tools.map((tool) => {
          const isExpanded = expandedTool === tool.name;
          const args = toolArgs[tool.name] || {};
          const result = results[tool.name];

          return (
            <div
              key={tool.name}
              className="p-4 bg-card border border-border rounded-lg"
            >
              {/* Tool Header */}
              <div className="flex items-start justify-between">
                <button
                  onClick={() => toggleExpanded(tool.name)}
                  className="flex-1 flex items-start space-x-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground">{tool.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                </button>

                <button
                  onClick={() => handleInvokeTool(tool.name, tool.inputSchema)}
                  disabled={invoking === tool.name}
                  className="ml-4 flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>{invoking === tool.name ? 'Running...' : 'Run'}</span>
                </button>
              </div>

              {/* Tool Details (when expanded) */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Input Schema */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Parameters</h4>
                    {Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => {
                      const isRequired = tool.inputSchema.required?.includes(key);
                      
                      return (
                        <div key={key} className="space-y-1">
                          <label className="block text-sm font-medium text-foreground">
                            {key}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                            {schema.description && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                {schema.description}
                              </span>
                            )}
                          </label>
                          <input
                            type={schema.type === 'number' ? 'number' : 'text'}
                            value={args[key] || ''}
                            onChange={(e) => handleArgChange(tool.name, key, e.target.value)}
                            placeholder={schema.default || `Enter ${key}`}
                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Result */}
                  {result && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-foreground">Result</h4>
                      <div className="p-3 bg-background border border-border rounded-md">
                        <pre className="text-xs text-foreground font-mono whitespace-pre-wrap">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
