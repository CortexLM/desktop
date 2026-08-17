/**
 * Automation IPC Handlers
 */

import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  CreateAutomationRequestSchema,
  UpdateAutomationRequestSchema,
  DeleteAutomationRequestSchema,
  ListAutomationsRequestSchema,
  GetAutomationRequestSchema,
  RunAutomationRequestSchema,
  GetAutomationLogsRequestSchema,
  ToggleAutomationRequestSchema,
} from '@cortex-ide/shared';

import type {
  CreateAutomationRequest,
  CreateAutomationResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
  ListAutomationsRequest,
  ListAutomationsResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  RunAutomationRequest,
  RunAutomationResponse,
  GetAutomationLogsRequest,
  GetAutomationLogsResponse,
  ToggleAutomationRequest,
  ToggleAutomationResponse,
} from '@cortex-ide/shared';

import { automationService } from '../../services/automation-service';
import { createHandler } from './shared/handler-factory';

export const AUTOMATION_CHANNELS = [
  IPC_CHANNELS.AUTOMATION_CREATE,
  IPC_CHANNELS.AUTOMATION_UPDATE,
  IPC_CHANNELS.AUTOMATION_DELETE,
  IPC_CHANNELS.AUTOMATION_LIST,
  IPC_CHANNELS.AUTOMATION_GET,
  IPC_CHANNELS.AUTOMATION_RUN,
  IPC_CHANNELS.AUTOMATION_TOGGLE,
  IPC_CHANNELS.AUTOMATION_GET_LOGS,
] as const;

export const handleCreateAutomation = createHandler<
  CreateAutomationRequest,
  CreateAutomationResponse
>(CreateAutomationRequestSchema, async (request) => {
  const automation = await automationService.createAutomation(request);
  return { automation };
});

export const handleUpdateAutomation = createHandler<
  UpdateAutomationRequest,
  UpdateAutomationResponse
>(UpdateAutomationRequestSchema, async (request) => {
  const { id, ...updates } = request;
  const automation = await automationService.updateAutomation(id, updates);
  return { automation };
});

export const handleDeleteAutomation = createHandler<
  DeleteAutomationRequest,
  DeleteAutomationResponse
>(DeleteAutomationRequestSchema, async (request) => {
  await automationService.deleteAutomation(request.id);
  return { success: true };
});

export const handleListAutomations = createHandler<
  ListAutomationsRequest,
  ListAutomationsResponse
>(ListAutomationsRequestSchema, async (request) => {
  const automations = await automationService.listAutomations(request.workspaceId);
  return { automations };
});

export const handleGetAutomation = createHandler<GetAutomationRequest, GetAutomationResponse>(
  GetAutomationRequestSchema,
  async (request) => {
    const automation = await automationService.getAutomation(request.id);
    if (!automation) {
      throw new Error(`Automation ${request.id} not found`);
    }
    return { automation };
  }
);

export const handleRunAutomation = createHandler<RunAutomationRequest, RunAutomationResponse>(
  RunAutomationRequestSchema,
  async (request) => {
    const log = await automationService.runAutomation(request.id, request.triggerData);
    return { log };
  }
);

export const handleToggleAutomation = createHandler<
  ToggleAutomationRequest,
  ToggleAutomationResponse
>(ToggleAutomationRequestSchema, async (request) => {
  const automation = await automationService.toggleAutomation(request.id, request.enabled);
  return { automation };
});

export const handleGetAutomationLogs = createHandler<
  GetAutomationLogsRequest,
  GetAutomationLogsResponse
>(GetAutomationLogsRequestSchema, async (request) => {
  const logs = await automationService.getAutomationLogs(request.automationId, request.limit);
  return { logs };
});

/**
 * Enregistre les handlers automation
 */
export function registerAutomationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_CREATE, handleCreateAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_UPDATE, handleUpdateAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_DELETE, handleDeleteAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_LIST, handleListAutomations);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET, handleGetAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RUN, handleRunAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_TOGGLE, handleToggleAutomation);
  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET_LOGS, handleGetAutomationLogs);
}

/**
 * Désenregistre les handlers automation
 */
export function unregisterAutomationHandlers(): void {
  AUTOMATION_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
