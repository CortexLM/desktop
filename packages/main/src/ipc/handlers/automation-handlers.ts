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
  AITaskAction,
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
import { activeWorkspacePath } from '../../services/active-workspace';
import { getAIService } from '../../services/ai-service';
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

/**
 * Fills in what the renderer must not supply.
 *
 * `FileTrigger.workspacePath` and `AITaskAction.provider` / `.model` are required
 * by the service, and none of the three is the renderer's to know: the path is a
 * disk location main deliberately does not send across, and the provider is
 * whichever one the stored key actually built. A renderer guessing them would
 * either leak the tree or point an automation at a provider that is not registered
 * — which fails on the first firing, hours later, with nobody watching.
 *
 * Empty values are treated as "resolve this", so a caller can send a complete
 * request and keep it.
 */
function registeredProvider(): AITaskAction['provider'] {
  try {
    const ids = getAIService().getRegisteredProviderIds?.() ?? [];
    return (ids[0] ?? 'openai') as AITaskAction['provider'];
  } catch {
    // Enrichment, not a dependency: the registry may not be built yet, and an
    // automation is still worth creating. The provider's own default applies.
    return 'openai';
  }
}

async function complete(request: CreateAutomationRequest): Promise<CreateAutomationRequest> {
  const workspacePath = (await activeWorkspacePath()) ?? '';
  const provider = registeredProvider();

  const trigger =
    request.trigger.type === 'file_watch'
      ? {
          ...request.trigger,
          workspacePath: request.trigger.workspacePath || workspacePath,
          // Every filesystem event, because "when files change" means all three.
          // Asking the user to pick among add/change/unlink is a distinction the
          // form has no reason to expose.
          events:
            request.trigger.events?.length > 0
              ? request.trigger.events
              : (['add', 'change', 'unlink'] as const).slice(),
        }
      : request.trigger;

  const actions = request.actions.map((action) =>
    action.type === 'ai_task'
      ? {
          ...action,
          provider: action.provider || provider,
          // An empty model lets the provider use its own default, which is what a
          // user who never chose one wants.
          model: action.model || '',
          context: action.context ?? { workspacePath },
        }
      : action,
  );

  return {
    ...request,
    workspaceId: request.workspaceId || workspacePath,
    trigger,
    actions,
  } as CreateAutomationRequest;
}

export const handleCreateAutomation = createHandler<
  CreateAutomationRequest,
  CreateAutomationResponse
>(CreateAutomationRequestSchema, async (request) => {
  const automation = await automationService.createAutomation(await complete(request));
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
