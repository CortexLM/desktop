/**
 * Zod Schemas - Terminal
 */

import { z } from 'zod';

export const CreateTerminalRequestSchema = z.object({
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  shell: z.string().optional(),
});

export const TerminalInputRequestSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  data: z.string(),
});

export const TerminalResizeRequestSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const TerminalKillRequestSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
});
