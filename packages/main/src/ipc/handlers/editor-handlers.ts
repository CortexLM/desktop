/**
 * Editor IPC Handlers
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';

import {
  IPC_CHANNELS,
  OpenFileRequestSchema,
  SaveFileRequestSchema,
  FormatDocumentRequestSchema,
} from '@cortex-ide/shared';

import type {
  OpenFileRequest,
  OpenFileResponse,
  SaveFileRequest,
  SaveFileResponse,
  FormatDocumentRequest,
  FormatDocumentResponse,
} from '@cortex-ide/shared';

import { formatDocument } from '../../services/format-service';
import { createHandler } from './shared/handler-factory';
import { detectLanguage } from './shared/language';

export const EDITOR_CHANNELS = [
  IPC_CHANNELS.EDITOR_OPEN_FILE,
  IPC_CHANNELS.EDITOR_SAVE_FILE,
  IPC_CHANNELS.EDITOR_FORMAT,
] as const;

export const handleOpenFile = createHandler<OpenFileRequest, OpenFileResponse>(
  OpenFileRequestSchema,
  async (request) => {
    const content = await fs.readFile(request.path, 'utf-8');
    const stats = await fs.stat(request.path);
    const language = detectLanguage(request.path);

    return {
      content,
      language,
      stats: {
        size: stats.size,
        mtime: stats.mtimeMs,
      },
    };
  }
);

export const handleSaveFile = createHandler<SaveFileRequest, SaveFileResponse>(
  SaveFileRequestSchema,
  async (request) => {
    await fs.writeFile(request.path, request.content, 'utf-8');
    const stats = await fs.stat(request.path);

    return {
      success: true,
      mtime: stats.mtimeMs,
    };
  }
);

export const handleFormatDocument = createHandler<FormatDocumentRequest, FormatDocumentResponse>(
  FormatDocumentRequestSchema,
  async (request) =>
    formatDocument({
      path: request.path,
      content: request.content,
      language: request.language,
    })
);

/**
 * Enregistre les handlers editor
 */
export function registerEditorHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.EDITOR_OPEN_FILE, handleOpenFile);
  ipcMain.handle(IPC_CHANNELS.EDITOR_SAVE_FILE, handleSaveFile);
  ipcMain.handle(IPC_CHANNELS.EDITOR_FORMAT, handleFormatDocument);
}

/**
 * Désenregistre les handlers editor
 */
export function unregisterEditorHandlers(): void {
  EDITOR_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
