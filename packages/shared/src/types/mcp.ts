/**
 * MCP Types - Shared types for Model Context Protocol
 */

// ============================================================================
// MCP Server Types
// ============================================================================

export type MCPServerStatus = 'installed' | 'available' | 'running' | 'error' | 'stopped';

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  homepage?: string;
  status: MCPServerStatus;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport: 'stdio' | 'http';
  tools?: MCPTool[];
  installedAt?: number;
  lastError?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// ============================================================================
// MCP IPC Request/Response Types
// ============================================================================

export interface ListMCPServersRequest {
  status?: MCPServerStatus;
}

export interface ListMCPServersResponse {
  servers: MCPServer[];
}

export interface GetMCPServerRequest {
  serverId: string;
}

export interface GetMCPServerResponse {
  server: MCPServer;
}

export interface InstallMCPServerRequest {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'http';
  version?: string;
  author?: string;
  homepage?: string;
}

export interface InstallMCPServerResponse {
  server: MCPServer;
}

export interface UninstallMCPServerRequest {
  serverId: string;
}

export interface UninstallMCPServerResponse {
  success: boolean;
}

export interface StartMCPServerRequest {
  serverId: string;
}

export interface StartMCPServerResponse {
  success: boolean;
}

export interface StopMCPServerRequest {
  serverId: string;
}

export interface StopMCPServerResponse {
  success: boolean;
}

export interface DiscoverMCPToolsRequest {
  serverId: string;
}

export interface DiscoverMCPToolsResponse {
  tools: MCPTool[];
}

export interface InvokeMCPToolRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface InvokeMCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface ListMCPPermissionsRequest {
  serverId?: string;
}

export interface MCPPermission {
  serverId: string;
  toolName: string;
  granted: boolean;
  grantedAt?: number;
  grantedBy?: string;
}

export interface ListMCPPermissionsResponse {
  permissions: MCPPermission[];
}

export interface GrantMCPPermissionRequest {
  serverId: string;
  toolName: string;
  grantedBy?: string;
}

export interface GrantMCPPermissionResponse {
  success: boolean;
}

export interface RevokeMCPPermissionRequest {
  serverId: string;
  toolName: string;
}

export interface RevokeMCPPermissionResponse {
  success: boolean;
}

export interface CheckMCPPermissionRequest {
  serverId: string;
  toolName: string;
}

export interface CheckMCPPermissionResponse {
  granted: boolean;
}

// ============================================================================
// MCP Events (main -> renderer)
// ============================================================================

export interface MCPServerStartedEvent {
  type: 'mcp-server-started';
  serverId: string;
}

export interface MCPServerStoppedEvent {
  type: 'mcp-server-stopped';
  serverId: string;
}

export interface MCPServerErrorEvent {
  type: 'mcp-server-error';
  serverId: string;
  error: string;
}

export interface MCPToolInvokedEvent {
  type: 'mcp-tool-invoked';
  serverId: string;
  toolName: string;
  result: InvokeMCPToolResponse;
}

export interface MCPPermissionGrantedEvent {
  type: 'mcp-permission-granted';
  permission: MCPPermission;
}

export interface MCPPermissionRevokedEvent {
  type: 'mcp-permission-revoked';
  serverId: string;
  toolName: string;
}

export type MCPEvent =
  | MCPServerStartedEvent
  | MCPServerStoppedEvent
  | MCPServerErrorEvent
  | MCPToolInvokedEvent
  | MCPPermissionGrantedEvent
  | MCPPermissionRevokedEvent;
