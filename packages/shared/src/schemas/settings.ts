/**
 * Zod Schemas — réglages de providers AI.
 *
 * Validé côté main avant tout usage : la requête `settings:set-provider` est le
 * seul endroit du dépôt où une clé d'API en clair traverse la frontière IPC, et
 * elle vient du process le moins fiable.
 *
 * Note sur les messages d'erreur : aucun message ci-dessous n'interpole la
 * valeur reçue. Zod inclut le *chemin* du champ invalide dans ses `issues`, pas
 * sa valeur — et `toErrorResponse` (handler-factory) renvoie ces issues au
 * renderer, où elles peuvent finir dans un log ou un rapport de bug. Un
 * `Invalid key: ${value}` aurait suffi à faire fuiter la clé par le chemin
 * d'erreur.
 */

import { z } from 'zod';

export const ProviderIdSchema = z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'grok']);

/**
 * Lecture de l'état des providers — appelée sans argument.
 *
 * Même raison que `NoPayloadSchema` : `ipcRenderer.invoke(channel)` transmet
 * `undefined`, qu'un `z.object({})` strict rejetterait.
 */
export const GetProviderSettingsRequestSchema = z
  .union([z.undefined(), z.null(), z.object({}).passthrough()])
  .transform(() => ({}) as Record<string, never>);

/**
 * Longueur maximale acceptée pour une clé d'API.
 *
 * Borne de sûreté, pas une validation de format : les préfixes varient selon les
 * providers (`sk-`, `sk-ant-`, `xai-`, …) et rejeter sur un motif casserait un
 * provider dès qu'il change de convention. 4096 est très au-dessus de toute clé
 * réelle observée et empêche un renderer compromis de pousser un blob dans le
 * fichier de réglages.
 */
const MAX_API_KEY_LENGTH = 4096;

export const SetProviderRequestSchema = z.object({
  id: ProviderIdSchema,
  enabled: z.boolean(),
  /**
   * Optionnel — l'absence signifie « garde la clé déjà stockée », la chaîne
   * vide signifie « efface-la ». L'UI ne connaît jamais la clé courante, donc
   * elle ne peut pas la renvoyer : sans cette distinction, tout Save fait depuis
   * un autre onglet effacerait la clé.
   *
   * Pas de `.trim()` implicite ici : un espace significatif dans une clé
   * n'existe pas, mais couper silencieusement modifierait ce que
   * l'utilisateur a saisi. Le service s'en charge explicitement.
   */
  apiKey: z.string().max(MAX_API_KEY_LENGTH).optional(),
  baseUrl: z.string().max(2048).optional(),
  defaultModel: z.string().max(256).optional(),
});

/**
 * Lecture des réglages d'exécution. Sans paramètre.
 *
 * `.optional()` pour la même raison que `GetProviderSettingsRequestSchema` : le
 * pont invoque sans argument, donc main reçoit `undefined`, et un schéma d'objet
 * strict rejetterait chaque appel à l'exécution seulement.
 */
export const GetWorkspaceRunSettingsRequestSchema = z
  .object({})
  .optional()
  .transform(() => ({}) as Record<string, never>);

const WorkspaceRunDefaultsPatchSchema = z
  .object({
    model: z.string(),
    repository: z.string(),
    baseBranch: z.string(),
    branchPrefix: z.string(),
    createPullRequests: z.enum(['draft', 'ready', 'never']),
  })
  .partial();

const WorkspaceRunPermissionsPatchSchema = z
  .object({
    runShellCommands: z.boolean(),
    applyDatabaseMigrations: z.boolean(),
    slackNotifications: z.boolean(),
    networkAccess: z.enum(['allowlist', 'all', 'none']),
  })
  .partial();

/**
 * Écriture partielle : l'UI change un réglage à la fois.
 *
 * Accepter l'objet entier obligerait le renderer à renvoyer ce qu'il a lu au
 * chargement, et un second onglet écraserait au clic suivant ce que le premier
 * vient de modifier.
 */
export const SetWorkspaceRunSettingsRequestSchema = z.object({
  defaults: WorkspaceRunDefaultsPatchSchema.optional(),
  permissions: WorkspaceRunPermissionsPatchSchema.optional(),
});
