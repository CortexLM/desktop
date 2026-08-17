/**
 * Zod Schemas - Canaux IPC workspace (`workspace:*`)
 *
 * Distinct de `schemas/workspace.ts`, qui décrit la création/mise à jour d'une
 * entité `Workspace` persistée. Ici il s'agit des canaux consommés par
 * `WorkspaceSwitcher`, servis par `WorkspaceManager`.
 */

import { z } from 'zod';

export const WorkspaceSwitchRequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
});

export const WorkspaceAddRequestSchema = z.object({
  path: z.string().min(1, 'path is required'),
  name: z.string().min(1).optional(),
});

export const WorkspaceRemoveRequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
});

export type WorkspaceSwitchRequest = z.infer<typeof WorkspaceSwitchRequestSchema>;
export type WorkspaceAddRequest = z.infer<typeof WorkspaceAddRequestSchema>;
export type WorkspaceRemoveRequest = z.infer<typeof WorkspaceRemoveRequestSchema>;
