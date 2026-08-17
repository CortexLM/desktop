/**
 * Zod Schemas - Git Stash (canaux `git:stash-*`)
 *
 * Le renderer envoie les options de `stash save` à plat
 * (`{ repoPath, message, includeUntracked, keepIndex }`) alors que
 * `GitStashService.save()` attend `(repoPath, message, { includeUntracked,
 * keepIndex })`. Les schémas décrivent la forme reçue du renderer ; c'est le
 * handler qui fait la conversion.
 */

import { z } from 'zod';

const RepoPathSchema = z.string().min(1, 'repoPath is required');

/**
 * Index de stash : entier non négatif.
 *
 * `stash@{-1}` n'existe pas, et un flottant produirait une référence invalide
 * silencieusement.
 */
const StashIndexSchema = z.number().int().min(0, 'stashIndex must be >= 0');

export const StashListRequestSchema = z.object({
  repoPath: RepoPathSchema,
});

export const StashShowRequestSchema = z.object({
  repoPath: RepoPathSchema,
  stashIndex: StashIndexSchema.optional().default(0),
});

export const StashSaveRequestSchema = z.object({
  repoPath: RepoPathSchema,
  message: z.string().optional(),
  includeUntracked: z.boolean().optional().default(false),
  keepIndex: z.boolean().optional().default(false),
});

export const StashApplyRequestSchema = z.object({
  repoPath: RepoPathSchema,
  stashIndex: StashIndexSchema.optional().default(0),
});

export const StashPopRequestSchema = z.object({
  repoPath: RepoPathSchema,
  stashIndex: StashIndexSchema.optional().default(0),
});

export const StashDropRequestSchema = z.object({
  repoPath: RepoPathSchema,
  stashIndex: StashIndexSchema,
});

export const StashBranchRequestSchema = z.object({
  repoPath: RepoPathSchema,
  branchName: z.string().min(1, 'branchName is required'),
  stashIndex: StashIndexSchema.optional().default(0),
});

export type StashListRequest = z.infer<typeof StashListRequestSchema>;
export type StashShowRequest = z.infer<typeof StashShowRequestSchema>;
export type StashSaveRequest = z.infer<typeof StashSaveRequestSchema>;
export type StashApplyRequest = z.infer<typeof StashApplyRequestSchema>;
export type StashPopRequest = z.infer<typeof StashPopRequestSchema>;
export type StashDropRequest = z.infer<typeof StashDropRequestSchema>;
export type StashBranchRequest = z.infer<typeof StashBranchRequestSchema>;
