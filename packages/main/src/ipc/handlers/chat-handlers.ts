/**
 * Chat Export IPC Handlers
 *
 * Sert le canal `chat:export` consommé par `ChatExportButton` via `window.ipc`.
 *
 * Le composant n'envoie qu'un `sessionId` : le handler charge la session et ses
 * messages depuis la base, puis délègue le rendu à `ChatExportService`. Le
 * contenu est renvoyé au renderer (qui déclenche un téléchargement via un Blob),
 * il n'est pas écrit sur le disque ici.
 */

import { ipcMain } from 'electron';

import { ChatExportRequestSchema } from '@cortex-ide/shared';
import type { ChatExportRequest } from '@cortex-ide/shared';

import type { Session, Message } from '@cortex-ide/shared';
import type {
  Session as DBSession,
  Message as DBMessage,
} from '../../database/types';

import { getChatExportService, type ExportResult } from '../../services/chat-export-service';
import { getDatabaseService } from '../../services/database-service';
import { createHandler } from './shared/handler-factory';

export const CHAT_CHANNELS = ['chat:export'] as const;

/**
 * `ChatExportButton` lit `response.data.content` et `response.data.filename`.
 * `ExportResult` porte déjà exactement ces champs (plus `size`), il est donc
 * renvoyé tel quel comme `data`.
 */
export type ChatExportResponse = ExportResult;

// ============================================================================
// Adaptation base -> domaine
// ============================================================================

/**
 * Les lignes de la base et les entités du domaine n'ont PAS la même forme :
 *
 * | base (`database/types`)      | domaine (`@cortex-ide/shared`) |
 * |------------------------------|--------------------------------|
 * | `workspace_id: string｜null` | `workspaceId: string`          |
 * | `created_at: number`         | `createdAt: number`            |
 * | `updated_at: number`         | `updatedAt: number`            |
 * | `title: string｜null`        | `title: string`                |
 * | `model: string｜null`        | `model: string`                |
 *
 * `ChatExportService` attend la seconde. Passer la ligne de base directement ne
 * produit pas seulement une erreur de types : `generateFilename()` appelle
 * `session.title.toLowerCase()` (TypeError sur `null`) et
 * `new Date(session.createdAt).toISOString()` avec `createdAt` absent, ce qui
 * lève `RangeError: Invalid time value`. L'export échouerait à chaque appel.
 *
 * Les valeurs nulles reçoivent donc un substitut affichable plutôt que d'être
 * propagées.
 */
function toDomainSession(row: DBSession): Session {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? '',
    title: row.title ?? 'Untitled conversation',
    model: row.model ?? 'unknown',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata,
  };
}

function toDomainMessage(row: DBMessage): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata,
  };
}

export const handleChatExport = createHandler<ChatExportRequest, ChatExportResponse>(
  ChatExportRequestSchema,
  async (request) => {
    const db = await getDatabaseService().getManager();

    const session = db.getSession(request.sessionId);
    if (!session) {
      // Message contenant "not found" : `getErrorCode()` le classe en
      // FILE_NOT_FOUND, cohérent avec les autres handlers.
      throw new Error(`Session ${request.sessionId} not found`);
    }

    const messages = db.listMessages(request.sessionId);

    return getChatExportService().exportSession(
      toDomainSession(session),
      messages.map(toDomainMessage),
      {
        format: request.format,
        includeMetadata: request.includeMetadata,
        includeTimestamps: request.includeTimestamps,
        prettify: request.prettify,
      }
    );
  }
);

/**
 * Enregistre les handlers chat
 */
export function registerChatHandlers(): void {
  ipcMain.handle('chat:export', handleChatExport);
}

/**
 * Désenregistre les handlers chat
 */
export function unregisterChatHandlers(): void {
  CHAT_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
