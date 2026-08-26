import { ipcMain } from 'electron';
import { MissionOrchestrator, type MissionRecord, type MissionStore } from '@cortex-ide/ai-engine';
import { IPC_CHANNELS } from '@cortex-ide/shared';
import { getDatabaseService } from '../../services/database-service';

function toRecord(row: {
  id: string;
  workspace_id: string | null;
  status: MissionRecord['status'];
  created_at: number;
  updated_at: number;
  state: {
    name?: string;
    description?: string;
    steps?: Array<{ id: string; name: string; status: string; result?: unknown; error?: string }>;
    currentStep?: number;
  };
}): MissionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? '',
    status: row.status,
    name: row.state.name ?? 'Mission',
    description: row.state.description ?? '',
    currentStep: row.state.currentStep ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: (row.state.steps ?? []).map((step) => ({
      id: step.id,
      name: step.name,
      status: step.status as MissionRecord['steps'][number]['status'],
      result: typeof step.result === 'string' ? step.result : undefined,
      error: step.error,
    })),
  };
}

async function store(): Promise<MissionStore> {
  const manager = await getDatabaseService().getManager();
  return {
    create: (mission) => {
      const row = manager.missions.create({
        workspace_id: mission.workspaceId,
        status: mission.status,
        state: {
          name: mission.name,
          description: mission.description,
          steps: mission.steps,
          currentStep: mission.currentStep,
        },
      });
      return toRecord(row);
    },
    update: (id, patch) => {
      const existing = manager.missions.get(id);
      if (!existing) return;
      manager.missions.update(id, {
        status: patch.status ?? existing.status,
        state: {
          ...existing.state,
          name: patch.name ?? existing.state.name,
          description: patch.description ?? existing.state.description,
          steps: patch.steps ?? existing.state.steps,
          currentStep: patch.currentStep ?? existing.state.currentStep,
        },
      });
    },
    get: (id) => {
      const row = manager.missions.get(id);
      return row ? toRecord(row) : null;
    },
    list: (workspaceId) => manager.missions.list(workspaceId).map(toRecord),
  };
}

export function registerMissionHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MISSION_LIST, async (_event, payload: unknown) => {
    const workspaceId = (payload as { workspaceId?: string })?.workspaceId ?? '';
    const orchestrator = new MissionOrchestrator(await store());
    return { success: true, data: { missions: await orchestrator.list(workspaceId) } };
  });

  ipcMain.handle(IPC_CHANNELS.MISSION_CREATE, async (_event, payload: unknown) => {
    const body = payload as {
      workspaceId?: string;
      name?: string;
      description?: string;
      steps?: string[];
    };
    const orchestrator = new MissionOrchestrator(await store());
    const mission = await orchestrator.create({
      workspaceId: body.workspaceId ?? '',
      name: body.name ?? 'Untitled mission',
      description: body.description ?? '',
      steps: body.steps ?? ['Plan', 'Implement', 'Verify'],
    });
    return { success: true, data: { mission } };
  });

  ipcMain.handle(IPC_CHANNELS.MISSION_START, async (_event, payload: unknown) => {
    const id = (payload as { id?: string })?.id;
    if (!id) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'id required' } };
    const orchestrator = new MissionOrchestrator(await store());
    return { success: true, data: { mission: await orchestrator.start(id) } };
  });

  ipcMain.handle(IPC_CHANNELS.MISSION_PAUSE, async (_event, payload: unknown) => {
    const id = (payload as { id?: string })?.id;
    if (!id) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'id required' } };
    const orchestrator = new MissionOrchestrator(await store());
    return { success: true, data: { mission: await orchestrator.pause(id) } };
  });

  ipcMain.handle(IPC_CHANNELS.MISSION_RESUME, async (_event, payload: unknown) => {
    const id = (payload as { id?: string })?.id;
    if (!id) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'id required' } };
    const orchestrator = new MissionOrchestrator(await store());
    return { success: true, data: { mission: await orchestrator.resume(id) } };
  });
}

export function unregisterMissionHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.MISSION_LIST);
  ipcMain.removeHandler(IPC_CHANNELS.MISSION_CREATE);
  ipcMain.removeHandler(IPC_CHANNELS.MISSION_START);
  ipcMain.removeHandler(IPC_CHANNELS.MISSION_PAUSE);
  ipcMain.removeHandler(IPC_CHANNELS.MISSION_RESUME);
}
