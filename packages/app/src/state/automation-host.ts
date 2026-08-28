/**
 * The renderer's view of automations.
 *
 * Thin, because the work is in main: `AutomationService` owns the chokidar
 * watchers and the cron schedules, and it is the only place that can. A renderer
 * cannot watch a filesystem, and a schedule that only fires while a window is open
 * is not a schedule.
 */

import type { Automation, AutomationLog, IPCResponse, Trigger } from '@cortex-ide/shared';

import { createCloudAutomationHost } from './cloud-automation-host.ts';
import { liveSession } from './realtime-session.ts';

export interface AutomationHost {
  list(): Promise<Automation[]>;
  create(input: {
    name: string;
    trigger: Trigger;
    actions: Automation['actions'];
    enabled: boolean;
  }): Promise<Automation>;
  toggle(id: string, enabled: boolean): Promise<Automation>;
  remove(id: string): Promise<void>;
  run(id: string): Promise<AutomationLog>;
  logs(id: string): Promise<AutomationLog[]>;
}

interface AutomationBridge {
  list(request: { workspaceId?: string }): Promise<IPCResponse<{ automations: Automation[] }>>;
  create(request: unknown): Promise<IPCResponse<{ automation: Automation }>>;
  toggle(request: {
    id: string;
    enabled: boolean;
  }): Promise<IPCResponse<{ automation: Automation }>>;
  delete(request: { id: string }): Promise<IPCResponse<unknown>>;
  run(request: { id: string }): Promise<IPCResponse<{ log: AutomationLog }>>;
  getLogs(request: { id: string }): Promise<IPCResponse<{ logs: AutomationLog[] }>>;
}

function unwrap<T>(response: IPCResponse<T>): T {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function bridge(): AutomationBridge | undefined {
  return (globalThis as { cortex?: { automation?: AutomationBridge } }).cortex?.automation;
}

function electronAutomationHost(api: AutomationBridge): AutomationHost {
  return {
    list: async () => unwrap(await api.list({})).automations,
    create: async (input) =>
      unwrap(
        await api.create({
          // `workspaceId` is empty on purpose: main resolves the active workspace,
          // and a renderer-supplied one would be a path it should not know.
          workspaceId: '',
          ...input,
        }),
      ).automation,
    toggle: async (id, enabled) => unwrap(await api.toggle({ id, enabled })).automation,
    remove: async (id) => {
      unwrap(await api.delete({ id }));
    },
    run: async (id) => unwrap(await api.run({ id })).log,
    logs: async (id) => unwrap(await api.getLogs({ id })).logs,
  };
}

export function detachedAutomationHost(): AutomationHost {
  const unavailable = () => new Error('Automations only run in the desktop app');

  return {
    list: async () => [],
    create: () => Promise.reject(unavailable()),
    toggle: () => Promise.reject(unavailable()),
    remove: () => Promise.reject(unavailable()),
    run: () => Promise.reject(unavailable()),
    logs: async () => [],
  };
}

export function resolveAutomationHost(): AutomationHost {
  const api = bridge();
  if (api) return electronAutomationHost(api);

  const live = liveSession();
  return live ? createCloudAutomationHost(live.client) : detachedAutomationHost();
}
