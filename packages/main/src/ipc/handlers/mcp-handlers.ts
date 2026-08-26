/**
 * MCP IPC Handlers
 */

import { BrowserWindow, ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  ListMCPServersRequestSchema,
  GetMCPServerRequestSchema,
  InstallMCPServerRequestSchema,
  UninstallMCPServerRequestSchema,
  StartMCPServerRequestSchema,
  StopMCPServerRequestSchema,
  DiscoverMCPToolsRequestSchema,
  InvokeMCPToolRequestSchema,
  ListMCPPermissionsRequestSchema,
  GrantMCPPermissionRequestSchema,
  RevokeMCPPermissionRequestSchema,
  CheckMCPPermissionRequestSchema,
} from '@cortex-ide/shared';

import type {
  ListMCPServersRequest,
  ListMCPServersResponse,
  GetMCPServerRequest,
  GetMCPServerResponse,
  InstallMCPServerRequest,
  InstallMCPServerResponse,
  UninstallMCPServerRequest,
  UninstallMCPServerResponse,
  StartMCPServerRequest,
  StartMCPServerResponse,
  StopMCPServerRequest,
  StopMCPServerResponse,
  DiscoverMCPToolsRequest,
  DiscoverMCPToolsResponse,
  InvokeMCPToolRequest,
  InvokeMCPToolResponse,
  ListMCPPermissionsRequest,
  ListMCPPermissionsResponse,
  GrantMCPPermissionRequest,
  GrantMCPPermissionResponse,
  RevokeMCPPermissionRequest,
  RevokeMCPPermissionResponse,
  CheckMCPPermissionRequest,
  CheckMCPPermissionResponse,
} from '@cortex-ide/shared';

import { getMCPService } from '../../services/mcp-service';
import { createHandler } from './shared/handler-factory';

export const MCP_CHANNELS = [
  IPC_CHANNELS.MCP_LIST_SERVERS,
  IPC_CHANNELS.MCP_GET_SERVER,
  IPC_CHANNELS.MCP_INSTALL_SERVER,
  IPC_CHANNELS.MCP_UNINSTALL_SERVER,
  IPC_CHANNELS.MCP_START_SERVER,
  IPC_CHANNELS.MCP_STOP_SERVER,
  IPC_CHANNELS.MCP_DISCOVER_TOOLS,
  IPC_CHANNELS.MCP_INVOKE_TOOL,
  IPC_CHANNELS.MCP_LIST_PERMISSIONS,
  IPC_CHANNELS.MCP_GRANT_PERMISSION,
  IPC_CHANNELS.MCP_REVOKE_PERMISSION,
  IPC_CHANNELS.MCP_CHECK_PERMISSION,
] as const;

export const handleListMCPServers = createHandler<ListMCPServersRequest, ListMCPServersResponse>(
  ListMCPServersRequestSchema,
  async (request) => {
    const servers = getMCPService().getAllServers();

    const filtered = request.status
      ? servers.filter((s) => s.status === request.status)
      : servers;

    return { servers: filtered };
  }
);

export const handleGetMCPServer = createHandler<GetMCPServerRequest, GetMCPServerResponse>(
  GetMCPServerRequestSchema,
  async (request) => {
    const server = getMCPService().getServer(request.serverId);

    if (!server) {
      throw new Error(`MCP server ${request.serverId} not found`);
    }

    return { server };
  }
);

export const handleInstallMCPServer = createHandler<
  InstallMCPServerRequest,
  InstallMCPServerResponse
>(InstallMCPServerRequestSchema, async (request) => {
  // `transport` est optionnel côté requête (le schéma applique `stdio` par
  // défaut) mais requis par le service : on le résout explicitement.
  const server = await getMCPService().installServer({
    ...request,
    transport: request.transport ?? 'stdio',
  });

  return { server };
});

export const handleUninstallMCPServer = createHandler<
  UninstallMCPServerRequest,
  UninstallMCPServerResponse
>(UninstallMCPServerRequestSchema, async (request) => {
  await getMCPService().uninstallServer(request.serverId);
  return { success: true };
});

export const handleStartMCPServer = createHandler<StartMCPServerRequest, StartMCPServerResponse>(
  StartMCPServerRequestSchema,
  async (request) => {
    await getMCPService().startServer(request.serverId);
    return { success: true };
  }
);

export const handleStopMCPServer = createHandler<StopMCPServerRequest, StopMCPServerResponse>(
  StopMCPServerRequestSchema,
  async (request) => {
    await getMCPService().stopServer(request.serverId);
    return { success: true };
  }
);

export const handleDiscoverMCPTools = createHandler<
  DiscoverMCPToolsRequest,
  DiscoverMCPToolsResponse
>(DiscoverMCPToolsRequestSchema, async (request) => {
  const tools = await getMCPService().discoverTools(request.serverId);
  return { tools };
});

export const handleInvokeMCPTool = createHandler<InvokeMCPToolRequest, InvokeMCPToolResponse>(
  InvokeMCPToolRequestSchema,
  async (request) =>
    getMCPService().invokeTool({
      serverId: request.serverId,
      toolName: request.toolName,
      arguments: request.arguments,
    })
);

export const handleListMCPPermissions = createHandler<
  ListMCPPermissionsRequest,
  ListMCPPermissionsResponse
>(ListMCPPermissionsRequestSchema, async (request) => {
  const allPermissions = getMCPService().getAllPermissions();

  const filtered = request.serverId
    ? allPermissions.filter((p) => p.serverId === request.serverId)
    : allPermissions;

  return { permissions: filtered };
});

export const handleGrantMCPPermission = createHandler<
  GrantMCPPermissionRequest,
  GrantMCPPermissionResponse
>(GrantMCPPermissionRequestSchema, async (request) => {
  await getMCPService().grantPermission(request.serverId, request.toolName, request.grantedBy);
  return { success: true };
});

export const handleRevokeMCPPermission = createHandler<
  RevokeMCPPermissionRequest,
  RevokeMCPPermissionResponse
>(RevokeMCPPermissionRequestSchema, async (request) => {
  await getMCPService().revokePermission(request.serverId, request.toolName);
  return { success: true };
});

export const handleCheckMCPPermission = createHandler<
  CheckMCPPermissionRequest,
  CheckMCPPermissionResponse
>(CheckMCPPermissionRequestSchema, async (request) => {
  const granted = getMCPService().hasPermission(request.serverId, request.toolName);
  return { granted };
});

function broadcastMCPEvent(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

let mcpEventCleanup: (() => void) | undefined;

/**
 * Forwards MCPService EventEmitter events onto the `event:mcp-*` channels the
 * renderer already subscribes to (`MCPExtensionList` refreshes on start/stop).
 */
export function setupMCPEvents(): () => void {
  const service = getMCPService();

  const onStarted = (serverId: string) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_SERVER_STARTED, {
      type: 'mcp-server-started',
      serverId,
    });
  };
  const onStopped = (serverId: string) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_SERVER_STOPPED, {
      type: 'mcp-server-stopped',
      serverId,
    });
  };
  const onError = (payload: { serverId: string; error: Error | string }) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_SERVER_ERROR, {
      type: 'mcp-server-error',
      serverId: payload.serverId,
      error: payload.error instanceof Error ? payload.error.message : String(payload.error),
    });
  };
  const onToolInvoked = (payload: {
    serverId: string;
    toolName: string;
    result: InvokeMCPToolResponse;
  }) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_TOOL_INVOKED, {
      type: 'mcp-tool-invoked',
      serverId: payload.serverId,
      toolName: payload.toolName,
      result: payload.result,
    });
  };
  const onPermissionGranted = (permission: {
    serverId: string;
    toolName: string;
    granted: boolean;
  }) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_PERMISSION_GRANTED, {
      type: 'mcp-permission-granted',
      permission,
    });
  };
  const onPermissionRevoked = (payload: { serverId: string; toolName: string }) => {
    broadcastMCPEvent(IPC_CHANNELS.EVENT_MCP_PERMISSION_REVOKED, {
      type: 'mcp-permission-revoked',
      serverId: payload.serverId,
      toolName: payload.toolName,
    });
  };

  service.on('server:started', onStarted);
  service.on('server:stopped', onStopped);
  service.on('server:error', onError);
  service.on('tool:invoked', onToolInvoked);
  service.on('permission:granted', onPermissionGranted);
  service.on('permission:revoked', onPermissionRevoked);

  return () => {
    service.off('server:started', onStarted);
    service.off('server:stopped', onStopped);
    service.off('server:error', onError);
    service.off('tool:invoked', onToolInvoked);
    service.off('permission:granted', onPermissionGranted);
    service.off('permission:revoked', onPermissionRevoked);
  };
}

/**
 * Enregistre les handlers MCP
 */
export function registerMCPHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_SERVERS, handleListMCPServers);
  ipcMain.handle(IPC_CHANNELS.MCP_GET_SERVER, handleGetMCPServer);
  ipcMain.handle(IPC_CHANNELS.MCP_INSTALL_SERVER, handleInstallMCPServer);
  ipcMain.handle(IPC_CHANNELS.MCP_UNINSTALL_SERVER, handleUninstallMCPServer);
  ipcMain.handle(IPC_CHANNELS.MCP_START_SERVER, handleStartMCPServer);
  ipcMain.handle(IPC_CHANNELS.MCP_STOP_SERVER, handleStopMCPServer);
  ipcMain.handle(IPC_CHANNELS.MCP_DISCOVER_TOOLS, handleDiscoverMCPTools);
  ipcMain.handle(IPC_CHANNELS.MCP_INVOKE_TOOL, handleInvokeMCPTool);
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_PERMISSIONS, handleListMCPPermissions);
  ipcMain.handle(IPC_CHANNELS.MCP_GRANT_PERMISSION, handleGrantMCPPermission);
  ipcMain.handle(IPC_CHANNELS.MCP_REVOKE_PERMISSION, handleRevokeMCPPermission);
  ipcMain.handle(IPC_CHANNELS.MCP_CHECK_PERMISSION, handleCheckMCPPermission);
}

/**
 * Désenregistre les handlers MCP
 */
export function unregisterMCPHandlers(): void {
  MCP_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  stopMCPEvents();
}

export function startMCPEvents(): void {
  mcpEventCleanup?.();
  mcpEventCleanup = setupMCPEvents();
}

export function stopMCPEvents(): void {
  mcpEventCleanup?.();
  mcpEventCleanup = undefined;
}
