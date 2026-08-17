/**
 * Zod Schemas - Filesystem
 */

import { z } from 'zod';

export const ReadFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'binary', 'hex']).optional().default('utf-8'),
});

export const WriteFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string(),
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'binary', 'hex']).optional().default('utf-8'),
});

export const ReadDirRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  recursive: z.boolean().optional().default(false),
});

export const WatchFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  watchId: z.string().min(1, 'Watch ID is required'),
});

export const UnwatchFileRequestSchema = z.object({
  watchId: z.string().min(1, 'Watch ID is required'),
});
