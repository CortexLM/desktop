/**
 * Zod Schemas - Canaux IPC sans payload
 *
 * `workspace:list`, `search:get-history`, `debug:get-settings`, ... sont
 * appelés sans argument. `ipcRenderer.invoke(channel)` transmet alors
 * `undefined`, ce qu'un `z.object({})` rejette (`"expected object, received
 * undefined"`), transformant un canal parfaitement valide en erreur de
 * validation.
 *
 * Ce schéma accepte l'absence de payload tout en refusant un payload d'un type
 * inattendu (string, number, ...), qui signalerait un appel erroné côté
 * renderer.
 */

import { z } from 'zod';

export const NoPayloadSchema = z
  .union([z.undefined(), z.null(), z.object({}).passthrough()])
  .transform(() => undefined as undefined);

export type NoPayload = undefined;

/**
 * Limite optionnelle passée par les canaux de lecture du panneau debug
 * (`debug:get-logs`, `debug:get-memory`, ...).
 */
export const OptionalLimitSchema = z
  .union([z.undefined(), z.null(), z.number().int().positive().max(100_000)])
  .transform((value) => (typeof value === 'number' ? value : undefined));
