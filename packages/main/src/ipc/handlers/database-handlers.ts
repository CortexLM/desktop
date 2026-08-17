/**
 * Database IPC Handlers
 *
 * Le SQL est validé par `DatabaseService` : `query()` n'accepte que des
 * lectures, `execute()` refuse le SQL destructif de schéma.
 */

import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  DBQueryRequestSchema,
  DBExecuteRequestSchema,
} from '@cortex-ide/shared';

import type {
  DBQueryRequest,
  DBQueryResponse,
  DBExecuteRequest,
  DBExecuteResponse,
} from '@cortex-ide/shared';

import { getDatabaseService } from '../../services/database-service';
import { createHandler } from './shared/handler-factory';

export const DATABASE_CHANNELS = [
  IPC_CHANNELS.DB_QUERY,
  IPC_CHANNELS.DB_EXECUTE,
] as const;

export const handleDBQuery = createHandler<DBQueryRequest, DBQueryResponse>(
  DBQueryRequestSchema,
  async (request) => getDatabaseService().query(request.query, request.params ?? [])
);

export const handleDBExecute = createHandler<DBExecuteRequest, DBExecuteResponse>(
  DBExecuteRequestSchema,
  async (request) => getDatabaseService().execute(request.statements)
);

/**
 * Enregistre les handlers database
 */
export function registerDatabaseHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DB_QUERY, handleDBQuery);
  ipcMain.handle(IPC_CHANNELS.DB_EXECUTE, handleDBExecute);
}

/**
 * Désenregistre les handlers database
 */
export function unregisterDatabaseHandlers(): void {
  DATABASE_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
