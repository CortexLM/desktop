/**
 * Zod Schemas - Workspace
 */

import { z } from 'zod';

export const WorkspaceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional().default('system'),
  fontSize: z.number().int().min(8).max(32).optional().default(14),
  tabSize: z.number().int().min(1).max(8).optional().default(2),
  formatOnSave: z.boolean().optional().default(true),
  autoSave: z.boolean().optional().default(true),
  autoSaveDelay: z.number().int().min(100).max(10000).optional().default(1000),
});

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  path: z.string().min(1, 'Workspace path is required'),
  settings: WorkspaceSettingsSchema.optional(),
});

export const UpdateWorkspaceRequestSchema = z.object({
  id: z.string().min(1, 'Workspace ID is required'),
  name: z.string().optional(),
  settings: WorkspaceSettingsSchema.partial().optional(),
});

export type WorkspaceSettings = z.infer<typeof WorkspaceSettingsSchema>;
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;
