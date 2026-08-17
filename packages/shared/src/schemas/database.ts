/**
 * Zod Schemas - Database
 */

import { z } from 'zod';

export const DBQueryRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  params: z.array(z.unknown()).optional(),
});

export const DBExecuteRequestSchema = z.object({
  statements: z.array(z.object({
    query: z.string().min(1, 'Query is required'),
    params: z.array(z.unknown()).optional(),
  })).min(1, 'At least one statement is required'),
});
