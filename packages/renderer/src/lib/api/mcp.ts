/**
 * Façade MCP (Model Context Protocol)
 */

import type {
  ListMCPServersResponse,
  GetMCPServerResponse,
  InstallMCPServerRequest,
  InstallMCPServerResponse,
  UninstallMCPServerResponse,
  StartMCPServerResponse,
  StopMCPServerResponse,
  DiscoverMCPToolsResponse,
  InvokeMCPToolRequest,
  InvokeMCPToolResponse,
  ListMCPPermissionsResponse,
  GrantMCPPermissionResponse,
  RevokeMCPPermissionResponse,
  CheckMCPPermissionResponse,
  MCPServerStatus,
  MCPToolInvokedEvent,
  MCPPermissionGrantedEvent,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export const mcp = {
  /**
   * Liste les serveurs MCP, éventuellement filtrés par statut
   */
  async listServers(request: { status?: MCPServerStatus } = {}): Promise<ListMCPServersResponse> {
    return unwrapResponse(await getAPI().mcp.listServers(request));
  },

  /**
   * Récupère un serveur MCP par son id
   */
  async getServer(request: { serverId: string }): Promise<GetMCPServerResponse> {
    return unwrapResponse(await getAPI().mcp.getServer(request));
  },

  /**
   * Installe un serveur MCP
   */
  async installServer(request: InstallMCPServerRequest): Promise<InstallMCPServerResponse> {
    return unwrapResponse(await getAPI().mcp.installServer(request));
  },

  /**
   * Désinstalle un serveur MCP
   */
  async uninstallServer(request: { serverId: string }): Promise<UninstallMCPServerResponse> {
    return unwrapResponse(await getAPI().mcp.uninstallServer(request));
  },

  /**
   * Démarre un serveur MCP
   */
  async startServer(request: { serverId: string }): Promise<StartMCPServerResponse> {
    return unwrapResponse(await getAPI().mcp.startServer(request));
  },

  /**
   * Arrête un serveur MCP
   */
  async stopServer(request: { serverId: string }): Promise<StopMCPServerResponse> {
    return unwrapResponse(await getAPI().mcp.stopServer(request));
  },

  /**
   * Découvre les tools exposés par un serveur
   */
  async discoverTools(request: { serverId: string }): Promise<DiscoverMCPToolsResponse> {
    return unwrapResponse(await getAPI().mcp.discoverTools(request));
  },

  /**
   * Invoque un tool MCP
   */
  async invokeTool(request: InvokeMCPToolRequest): Promise<InvokeMCPToolResponse> {
    return unwrapResponse(await getAPI().mcp.invokeTool(request));
  },

  /**
   * Liste les permissions accordées, éventuellement filtrées par serveur
   */
  async listPermissions(
    request: { serverId?: string } = {}
  ): Promise<ListMCPPermissionsResponse> {
    return unwrapResponse(await getAPI().mcp.listPermissions(request));
  },

  /**
   * Accorde à un serveur le droit d'invoquer un tool
   */
  async grantPermission(request: {
    serverId: string;
    toolName: string;
    grantedBy?: string;
  }): Promise<GrantMCPPermissionResponse> {
    return unwrapResponse(await getAPI().mcp.grantPermission(request));
  },

  /**
   * Révoque une permission
   */
  async revokePermission(request: {
    serverId: string;
    toolName: string;
  }): Promise<RevokeMCPPermissionResponse> {
    return unwrapResponse(await getAPI().mcp.revokePermission(request));
  },

  /**
   * Vérifie si un tool est autorisé
   */
  async checkPermission(request: {
    serverId: string;
    toolName: string;
  }): Promise<CheckMCPPermissionResponse> {
    return unwrapResponse(await getAPI().mcp.checkPermission(request));
  },

  /**
   * S'abonne au démarrage d'un serveur
   *
   * @returns fonction de désabonnement
   */
  onServerStarted(callback: (event: { serverId: string }) => void): () => void {
    return getAPI().mcp.onServerStarted(callback);
  },

  /**
   * S'abonne à l'arrêt d'un serveur
   *
   * @returns fonction de désabonnement
   */
  onServerStopped(callback: (event: { serverId: string }) => void): () => void {
    return getAPI().mcp.onServerStopped(callback);
  },

  /**
   * S'abonne aux erreurs d'un serveur
   *
   * @returns fonction de désabonnement
   */
  onServerError(callback: (event: { serverId: string; error: string }) => void): () => void {
    return getAPI().mcp.onServerError(callback);
  },

  /**
   * S'abonne aux invocations de tools
   *
   * @returns fonction de désabonnement
   */
  onToolInvoked(callback: (event: MCPToolInvokedEvent) => void): () => void {
    return getAPI().mcp.onToolInvoked(callback);
  },

  /**
   * S'abonne aux permissions accordées
   *
   * @returns fonction de désabonnement
   */
  onPermissionGranted(callback: (event: MCPPermissionGrantedEvent) => void): () => void {
    return getAPI().mcp.onPermissionGranted(callback);
  },

  /**
   * S'abonne aux permissions révoquées
   *
   * @returns fonction de désabonnement
   */
  onPermissionRevoked(callback: (event: { serverId: string; toolName: string }) => void): () => void {
    return getAPI().mcp.onPermissionRevoked(callback);
  },
};
