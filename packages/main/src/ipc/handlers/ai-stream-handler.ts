/**
 * AI Stream Handler - Main Process
 * Gère le streaming des réponses AI via WebSocket/IPC
 */

import { ipcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { getAIService, StreamEventData } from '../../services/ai-service';
import { IPC_CHANNELS, StreamResponseRequest, StreamChunk } from '@cortex-ide/shared';
import { StreamResponseRequestSchema } from '@cortex-ide/shared';
import { asValidationIssues } from './shared/handler-factory';

interface ActiveStream {
  sessionId: string;
  webContents: WebContents;
  aborted: boolean;
}

const activeStreams = new Map<string, ActiveStream>();

/**
 * Enregistre le handler pour le streaming AI
 */
export function registerAIStreamHandler() {
  ipcMain.handle(IPC_CHANNELS.AI_STREAM_RESPONSE, handleStreamResponse);

  // The renderer's Stop button invokes this. Without a handler the invoke
  // rejects with "No handler registered", so stopping a generation failed
  // silently and the UI stayed stuck in its streaming state.
  ipcMain.handle(IPC_CHANNELS.AI_RESOLVE_PERMISSION, (_event, payload: unknown) => {
    const body = payload as { sessionId?: string; requestId?: string; decision?: string };
    if (!body?.sessionId || !body.requestId || !body.decision) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId, requestId and decision are required' } };
    }
    getAIService().resolvePermission(
      body.sessionId,
      body.requestId,
      body.decision as 'allow-once' | 'allow-always' | 'deny'
    );
    return { success: true, data: { requestId: body.requestId } };
  });

  ipcMain.handle(IPC_CHANNELS.AI_LIST_CHECKPOINTS, () => {
    return { success: true, data: { checkpoints: getAIService().listCheckpoints() } };
  });

  ipcMain.handle(IPC_CHANNELS.AI_RESTORE_CHECKPOINT, (_event, payload: unknown) => {
    const body = payload as { sessionId?: string; checkpointId?: string };
    if (!body?.sessionId || !body.checkpointId) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId and checkpointId are required' } };
    }
    getAIService().restoreCheckpoint(body.sessionId, body.checkpointId);
    return { success: true, data: { checkpointId: body.checkpointId } };
  });

  ipcMain.handle(IPC_CHANNELS.AI_STOP_STREAM, (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'sessionId is required' } };
    }

    abortStream(sessionId);
    return { success: true, data: { sessionId } };
  });

  
  // Écouter les événements du service AI
  const aiService = getAIService();
  
  aiService.on('stream:chunk', (data: StreamEventData) => {
    const stream = activeStreams.get(data.sessionId);
    if (stream && !stream.aborted) {
      const raw = data.chunk as StreamEventData['chunk'] & { ipc?: StreamChunk };
      const chunk: StreamChunk = raw.ipc ?? {
        type: data.chunk.done ? 'done' : 'chunk',
        content: data.chunk.content,
      };
      
      stream.webContents.send(`ai:stream:${data.sessionId}`, chunk);
    }
  });
  
  aiService.on('error', ({ sessionId, error }: { sessionId: string; error: Error }) => {
    const stream = activeStreams.get(sessionId);
    if (stream) {
      const chunk: StreamChunk = {
        type: 'error',
        error: error.message,
      };
      
      stream.webContents.send(`ai:stream:${sessionId}`, chunk);
      activeStreams.delete(sessionId);
    }
  });
  
  console.log('[IPC] AI stream handler registered');
}

/**
 * Handler pour les requêtes de streaming
 */
async function handleStreamResponse(
  event: IpcMainInvokeEvent,
  request: unknown
): Promise<
  | { success: true; streamId: string }
  | { success: false; error: { code: string; message: string; details?: unknown } }
> {
  try {
    // Validation
    const validatedRequest = StreamResponseRequestSchema.parse(request) as StreamResponseRequest;
    
    const aiService = getAIService();
    const { sessionId, message, workspacePath, mode } = validatedRequest;
    
    // Enregistrer le stream actif
    activeStreams.set(sessionId, {
      sessionId,
      webContents: event.sender,
      aborted: false,
    });
    
    // Démarrer le streaming en arrière-plan
    (async () => {
      try {
        for await (const _chunk of aiService.streamMessage(sessionId, message, undefined, {
          workspacePath,
          mode,
        })) {
          const stream = activeStreams.get(sessionId);
          if (!stream || stream.aborted) {
            break;
          }
        }
      } catch (error) {
        console.error('[AI Stream] Error:', error);
        // L'erreur sera émise via l'événement 'error' du service
      } finally {
        activeStreams.delete(sessionId);
      }
    })();
    
    return { success: true, streamId: sessionId };
  } catch (error) {
    // Detected by shape, not `instanceof`: several Zod copies coexist in this
    // monorepo (main resolves a different one than @cortex-ide/shared), so
    // `instanceof z.ZodError` is false for errors thrown by shared's schemas
    // and every validation failure was misreported as AI_ERROR.
    const issues = asValidationIssues(error);
    if (issues !== undefined) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: issues,
        },
      };
    }


    return {
      success: false,
      error: {
        code: 'AI_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Annule un stream en cours
 */
export function abortStream(sessionId: string): void {
  const stream = activeStreams.get(sessionId);
  if (stream) {
    stream.aborted = true;

    // Send a terminal chunk before dropping the stream. The renderer's
    // streamResponse promise only settles on `done` or `error`, so without this
    // an aborted stream would leave that promise pending and its IPC listener
    // attached for the lifetime of the window.
    if (!stream.webContents.isDestroyed()) {
      const chunk: StreamChunk = { type: 'done' };
      stream.webContents.send(`ai:stream:${sessionId}`, chunk);
    }

    activeStreams.delete(sessionId);
  }
}

/**
 * Nettoie tous les streams actifs
 */
export function cleanupAIStreamHandler(): void {
  activeStreams.clear();
  ipcMain.removeHandler(IPC_CHANNELS.AI_STREAM_RESPONSE);
  ipcMain.removeHandler(IPC_CHANNELS.AI_STOP_STREAM);
  ipcMain.removeHandler(IPC_CHANNELS.AI_RESOLVE_PERMISSION);
  ipcMain.removeHandler(IPC_CHANNELS.AI_LIST_CHECKPOINTS);
  ipcMain.removeHandler(IPC_CHANNELS.AI_RESTORE_CHECKPOINT);
  console.log('[IPC] AI stream handler cleaned up');
}
