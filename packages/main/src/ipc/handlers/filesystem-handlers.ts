/**
 * Filesystem IPC Handlers
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  IPC_CHANNELS,
  ReadFileRequestSchema,
  WriteFileRequestSchema,
  ReadDirRequestSchema,
} from '@cortex-ide/shared';

import type {
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  ReadDirRequest,
  ReadDirResponse,
  FileEntry,
} from '@cortex-ide/shared';

import { createHandler } from './shared/handler-factory';

export const FILESYSTEM_CHANNELS = [
  IPC_CHANNELS.FS_READ_FILE,
  IPC_CHANNELS.FS_WRITE_FILE,
  IPC_CHANNELS.FS_READ_DIR,
] as const;

export const handleReadFile = createHandler<ReadFileRequest, ReadFileResponse>(
  ReadFileRequestSchema,
  async (request) => {
    const content = await fs.readFile(request.path, { encoding: request.encoding || 'utf-8' });
    const stats = await fs.stat(request.path);

    return {
      content,
      stats: {
        size: stats.size,
        mtime: stats.mtimeMs,
        ctime: stats.ctimeMs,
      },
    };
  }
);

export const handleWriteFile = createHandler<WriteFileRequest, WriteFileResponse>(
  WriteFileRequestSchema,
  async (request) => {
    await fs.writeFile(request.path, request.content, { encoding: request.encoding || 'utf-8' });

    return {
      success: true,
      bytesWritten: Buffer.byteLength(request.content, request.encoding || 'utf-8'),
    };
  }
);

/**
 * Liste les entrées d'un répertoire, récursivement si demandé
 */
async function collectEntries(dirPath: string, recursive: boolean): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const stats = await fs.stat(fullPath);

    entries.push({
      name: item.name,
      path: fullPath,
      type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
      size: stats.size,
      mtime: stats.mtimeMs,
    });

    if (recursive && item.isDirectory()) {
      entries.push(...(await collectEntries(fullPath, recursive)));
    }
  }

  return entries;
}

export const handleReadDir = createHandler<ReadDirRequest, ReadDirResponse>(
  ReadDirRequestSchema,
  async (request) => {
    const entries = await collectEntries(request.path, request.recursive || false);
    return { entries };
  }
);

/**
 * Enregistre les handlers filesystem
 */
export function registerFilesystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, handleReadFile);
  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, handleWriteFile);
  ipcMain.handle(IPC_CHANNELS.FS_READ_DIR, handleReadDir);
}

/**
 * Désenregistre les handlers filesystem
 */
export function unregisterFilesystemHandlers(): void {
  FILESYSTEM_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
