/**
 * Zod Schemas - Chat export (canal `chat:export`)
 */

import { z } from 'zod';

export const ChatExportRequestSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  format: z.enum(['markdown', 'json', 'html', 'text']),
  includeMetadata: z.boolean().optional(),
  includeTimestamps: z.boolean().optional(),
  prettify: z.boolean().optional(),
});

export type ChatExportRequest = z.infer<typeof ChatExportRequestSchema>;
