/**
 * Secrets IPC Handlers.
 *
 * L'asymétrie est la même que pour les clés de providers :
 *
 *   renderer -> main : le nom et la valeur, UNE fois, à la création.
 *   main -> renderer : le nom, la portée, la dernière utilisation. Jamais la valeur.
 *
 * Il n'y a volontairement aucun canal qui rende une valeur. La méthode qui en rend
 * (`SecretsService.environment()`) n'est appelée que par la boucle d'agent, dans
 * main — c'est tout son intérêt que le renderer ne puisse pas l'atteindre.
 */

import { ipcMain } from 'electron';
import { z } from 'zod';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import type { SecretView } from '@cortex-ide/shared';

import { getSecretsService } from '../../services/secrets-service';
import { createHandler } from './shared/handler-factory';

export const SECRETS_CHANNELS = [
  IPC_CHANNELS.SECRETS_LIST,
  IPC_CHANNELS.SECRETS_CREATE,
  IPC_CHANNELS.SECRETS_DELETE,
] as const;

const NoPayloadSchema = z
  .object({})
  .optional()
  .transform(() => ({}) as Record<string, never>);

/**
 * `value` est borné à 8 Ko.
 *
 * Pas une limite d'environnement — c'est une borne sur ce qu'un process moins
 * fiable peut faire écrire en base d'un seul appel. Une clé privée PEM tient
 * largement dedans.
 */
const CreateSchema = z.object({
  name: z.string().min(1).max(128),
  value: z.string().min(1).max(8192),
});

const IdSchema = z.object({ id: z.string().min(1) });

export const handleListSecrets = createHandler<
  Record<string, never>,
  { secrets: SecretView[] }
>(NoPayloadSchema, async () => ({ secrets: await getSecretsService().list() }));

export const handleCreateSecret = createHandler<
  { name: string; value: string },
  { secret: SecretView }
>(CreateSchema, async (request) => ({
  secret: await getSecretsService().create(request.name, request.value),
}));

export const handleDeleteSecret = createHandler<{ id: string }, { deleted: true }>(
  IdSchema,
  async (request) => {
    await getSecretsService().remove(request.id);
    return { deleted: true };
  }
);

export function registerSecretsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SECRETS_LIST, handleListSecrets);
  ipcMain.handle(IPC_CHANNELS.SECRETS_CREATE, handleCreateSecret);
  ipcMain.handle(IPC_CHANNELS.SECRETS_DELETE, handleDeleteSecret);
}

export function unregisterSecretsHandlers(): void {
  SECRETS_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
