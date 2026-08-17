/**
 * Zod Schemas - Panneau debug (canaux `debug:*`)
 *
 * La forme de référence est `DebugSettings` de `src/types/debug.ts` : c'est
 * celle que le renderer importe et dont il lit `enabled`, `categories` et
 * `logRotation`. `DebugSettings` du main process (`services/debug-service.ts`)
 * est un type homonyme mais structurellement différent — voir
 * `ipc/handlers/debug-handlers.ts` pour la conversion.
 */

import { z } from 'zod';

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export const DebugCategoriesSchema = z.object({
  ipc: z.boolean(),
  performance: z.boolean(),
  network: z.boolean(),
  database: z.boolean(),
  ai: z.boolean(),
  git: z.boolean(),
});

/**
 * Mise à jour partielle des réglages de debug.
 *
 * `SettingsPanel` renvoie l'objet complet, `DebugContext.toggleDebugMode()` ne
 * renvoie que `{ enabled }` : tous les champs sont donc optionnels, y compris
 * `categories` qui accepte un sous-ensemble.
 */
export const DebugUpdateSettingsRequestSchema = z.object({
  enabled: z.boolean().optional(),
  logLevel: LogLevelSchema.optional(),
  categories: DebugCategoriesSchema.partial().optional(),
  maxLogSize: z.number().int().positive().max(10_000).optional(),
  logRotation: z.boolean().optional(),
});

export type DebugCategories = z.infer<typeof DebugCategoriesSchema>;
export type DebugUpdateSettingsRequest = z.infer<typeof DebugUpdateSettingsRequestSchema>;
