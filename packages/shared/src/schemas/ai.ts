/**
 * Zod Schemas - AI
 */

import { z } from 'zod';

export const CreateSessionRequestSchema = z.object({
  workspaceId: z.string().optional(),
  model: z.string().min(1, 'Model is required'),
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama']),
  systemPrompt: z.string().optional(),
});

export const SendMessageRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  message: z.string().min(1, 'Message is required'),
  context: z.object({
    files: z.array(z.string()).optional(),
    selection: z.object({
      path: z.string(),
      start: z.number(),
      end: z.number(),
    }).optional(),
  }).optional(),
  workspacePath: z.string().optional(),
  mode: z.enum(['agent', 'plan', 'mission', 'ask']).optional(),
});

export const StreamResponseRequestSchema = SendMessageRequestSchema;
