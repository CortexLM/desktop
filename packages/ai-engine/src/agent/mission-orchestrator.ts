export type MissionStatus = 'planning' | 'running' | 'paused' | 'completed' | 'failed';

export interface MissionStepState {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface MissionRecord {
  id: string;
  workspaceId: string;
  status: MissionStatus;
  name: string;
  description: string;
  steps: MissionStepState[];
  currentStep: number;
  createdAt: number;
  updatedAt: number;
}

export interface MissionStore {
  create(mission: MissionRecord): Promise<MissionRecord | void> | MissionRecord | void;
  update(id: string, patch: Partial<MissionRecord>): Promise<void> | void;
  get(id: string): Promise<MissionRecord | null> | MissionRecord | null;
  list(workspaceId: string): Promise<MissionRecord[]> | MissionRecord[];
}

/**
 * Mission orchestration for long tasks: planning → running → paused → completed.
 * Backed by whatever store the app provides (SQLite repository in main).
 */
export class MissionOrchestrator {
  constructor(private readonly store: MissionStore) {}

  async create(input: {
    workspaceId: string;
    name: string;
    description: string;
    steps: string[];
  }): Promise<MissionRecord> {
    const now = Date.now();
    const mission: MissionRecord = {
      id: `mission-${now}`,
      workspaceId: input.workspaceId,
      status: 'planning',
      name: input.name,
      description: input.description,
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
      steps: input.steps.map((name, index) => ({
        id: `step-${index + 1}`,
        name,
        status: 'pending',
      })),
    };
    const stored = await this.store.create(mission);
    return stored ?? mission;
  }

  async start(id: string): Promise<MissionRecord> {
    return this.patch(id, (mission) => {
      mission.status = 'running';
      if (mission.steps[0]) mission.steps[0].status = 'running';
    });
  }

  async completeStep(id: string, result?: string): Promise<MissionRecord> {
    return this.patch(id, (mission) => {
      const step = mission.steps[mission.currentStep];
      if (step) {
        step.status = 'completed';
        step.result = result;
      }
      mission.currentStep += 1;
      const next = mission.steps[mission.currentStep];
      if (next) {
        next.status = 'running';
        mission.status = 'running';
      } else {
        mission.status = 'completed';
      }
    });
  }

  async fail(id: string, error: string): Promise<MissionRecord> {
    return this.patch(id, (mission) => {
      mission.status = 'failed';
      const step = mission.steps[mission.currentStep];
      if (step) {
        step.status = 'failed';
        step.error = error;
      }
    });
  }

  async pause(id: string): Promise<MissionRecord> {
    return this.patch(id, (mission) => {
      mission.status = 'paused';
    });
  }

  async resume(id: string): Promise<MissionRecord> {
    return this.patch(id, (mission) => {
      mission.status = 'running';
    });
  }

  async list(workspaceId: string): Promise<MissionRecord[]> {
    return this.store.list(workspaceId);
  }

  private async patch(
    id: string,
    mutate: (mission: MissionRecord) => void
  ): Promise<MissionRecord> {
    const mission = await this.store.get(id);
    if (!mission) {
      throw new Error(`Mission ${id} not found`);
    }
    mutate(mission);
    mission.updatedAt = Date.now();
    await this.store.update(id, mission);
    return mission;
  }
}
