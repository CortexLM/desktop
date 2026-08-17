/**
 * MCP Schemas - Zod validation schemas for MCP requests
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const MCPServerStatusSchema = z.enum([
  'installed',
  'available',
  'running',
  'error',
  'stopped',
]);

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }),
});

export const MCPServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().optional(),
  status: MCPServerStatusSchema,
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  transport: z.enum(['stdio', 'http']),
  tools: z.array(MCPToolSchema).optional(),
  installedAt: z.number().optional(),
  lastError: z.string().optional(),
});

export const MCPPermissionSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
  granted: z.boolean(),
  grantedAt: z.number().optional(),
  grantedBy: z.string().optional(),
});

// ============================================================================
// Request Schemas
// ============================================================================

export const ListMCPServersRequestSchema = z.object({
  status: MCPServerStatusSchema.optional(),
});

export const GetMCPServerRequestSchema = z.object({
  serverId: z.string(),
});

export const InstallMCPServerRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  transport: z.enum(['stdio', 'http']).optional().default('stdio'),
  version: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().optional(),
});

export const UninstallMCPServerRequestSchema = z.object({
  serverId: z.string(),
});

export const StartMCPServerRequestSchema = z.object({
  serverId: z.string(),
});

export const StopMCPServerRequestSchema = z.object({
  serverId: z.string(),
});

export const DiscoverMCPToolsRequestSchema = z.object({
  serverId: z.string(),
});

export const InvokeMCPToolRequestSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
  arguments: z.record(z.any()),
});

export const ListMCPPermissionsRequestSchema = z.object({
  serverId: z.string().optional(),
});

export const GrantMCPPermissionRequestSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
  grantedBy: z.string().optional(),
});

export const RevokeMCPPermissionRequestSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
});

export const CheckMCPPermissionRequestSchema = z.object({
  serverId: z.string(),
  toolName: z.string(),
});
