/**
 * Zod Schemas - Editor
 */

import { z } from 'zod';

export const OpenFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  workspaceId: z.string().optional(),
});

export const SaveFileRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string(),
});

export const FormatDocumentRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string(),
  language: z.string().min(1, 'Language is required'),
});
